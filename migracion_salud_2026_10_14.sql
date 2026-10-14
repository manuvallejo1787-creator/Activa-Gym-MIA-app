-- migracion_salud_2026_10_14.sql
--
-- Correcciones derivadas del análisis de salud del sistema.
-- Correr entero en el editor SQL de Supabase. Es idempotente: se puede
-- volver a correr sin efectos secundarios.

-- ═════════════════════════════════════════════════════════════════════════
-- 1) SEGURIDAD — cerrar el acceso anónimo a dos tablas   [URGENTE]
--
-- gym_medidas y gym_metas quedaron con política para el rol `public`, que
-- incluye `anon`. Las otras 23 tablas exigen sesión iniciada. La clave
-- anónima viaja dentro del bundle del frontend, así que cualquiera que la
-- extraiga puede leer y escribir peso, % de grasa y objetivos de los 70
-- clientes. Fue un error al escribir las migraciones de esas dos tablas.
--
-- El portal del cliente NO se rompe: usa la service role key del lado del
-- servidor, que no pasa por RLS.
-- ═════════════════════════════════════════════════════════════════════════

drop policy if exists "public_all_gym_medidas" on gym_medidas;
create policy "auth_all_gym_medidas" on gym_medidas
  for all to authenticated using (true) with check (true);

drop policy if exists "public_all_gym_metas" on gym_metas;
create policy "auth_all_gym_metas" on gym_metas
  for all to authenticated using (true) with check (true);


-- ═════════════════════════════════════════════════════════════════════════
-- 2) DATOS CORRUPTOS
-- ═════════════════════════════════════════════════════════════════════════

-- Debora Ferron: fechaEvaluacion = "262026-12-06".
-- Es la SEGUNDA vez que aparece: se corrigió el 30/09 y volvió. Además de ser
-- inválida, 2026-12-06 es futuro, así que no puede ser la fecha de una
-- evaluación ya hecha. Se vacía en vez de inventar una: "sin medir" es un
-- estado válido del motor; una fecha inventada contamina los cálculos de
-- vigencia.
update gym_clients
set screening = jsonb_set(screening, '{fechaEvaluacion}', '""'::jsonb)
where (screening->>'fechaEvaluacion') !~ '^\d{4}-\d{2}-\d{2}$'
  and nullif(screening->>'fechaEvaluacion','') is not null;

-- Melissa González: talla = "`160" (comilla invertida al principio).
-- parseFloat da NaN: se quedaba sin IMC y sin índice cintura-talla.
-- Se limpian los caracteres no numéricos de los campos antropométricos,
-- pero SOLO cuando lo que queda es un número válido. Un valor ambiguo como
-- el peso "67/85" de Pablo Hernández NO se toca: podría ser 67,85 o una
-- tensión arterial en el campo equivocado, y adivinar sería inventar un dato
-- clínico.
update gym_clients c
set screening = (
  select jsonb_object_agg(k,
    case when k in ('peso','talla','imc','pctGrasa','fcReposo','per_cintura','per_cadera',
                    'per_cintura_escapular','per_brazo_d','per_brazo_i','per_muslo_d',
                    'per_muslo_i','per_pantorrilla_d','per_pantorrilla_i')
          and v #>> '{}' ~ '[^0-9.]'
          and regexp_replace(v #>> '{}', '[^0-9.]', '', 'g') ~ '^[0-9]+\.?[0-9]*$'
         then to_jsonb(regexp_replace(v #>> '{}', '[^0-9.]', '', 'g'))
         else v end)
  from jsonb_each(c.screening) as campos(k, v))
where exists (
  select 1 from jsonb_each_text(c.screening) e(k,v)
  where k in ('peso','talla','imc','pctGrasa','fcReposo','per_cintura','per_cadera',
              'per_cintura_escapular','per_brazo_d','per_brazo_i','per_muslo_d',
              'per_muslo_i','per_pantorrilla_d','per_pantorrilla_i')
    and v ~ '[^0-9.]'
    and regexp_replace(v, '[^0-9.]', '', 'g') ~ '^[0-9]+\.?[0-9]*$');

-- IMC inconsistente con peso y talla en 4 clientes.
-- El IMC es una fórmula, no una observación: si no coincide con peso y talla,
-- el valor guardado está mal. El cálculo automático solo reescribe al abrir
-- la ficha, así que los que no se abrieron conservaban el valor viejo.
--   Sebastián Hugo  24,8 guardado  vs  27,3 real  (normopeso -> sobrepeso)
--   Ana Castro      17,15          vs  19,9
--   Valeria Vidal   19,2           vs  21,1
--   Manuel Vallejo  22,9           vs  24,7
update gym_clients
set screening = jsonb_set(screening, '{imc}',
  to_jsonb(round((screening->>'peso')::numeric / power((screening->>'talla')::numeric/100, 2), 1)::text))
where (screening->>'peso')  ~ '^[0-9]+\.?[0-9]*$'
  and (screening->>'talla') ~ '^[0-9]+\.?[0-9]*$'
  and (screening->>'imc')   ~ '^[0-9]+\.?[0-9]*$'
  and (screening->>'talla')::numeric between 100 and 230
  and abs((screening->>'imc')::numeric
          - round((screening->>'peso')::numeric / power((screening->>'talla')::numeric/100, 2), 1)) > 0.5;

-- Pablo Hernández: peso = "67/85". Confirmado por Manu el 14/10: es 67,85 kg.
-- Se escribe con punto porque es el formato de cálculo; la app lo muestra
-- con coma.
update gym_clients
set screening = jsonb_set(screening, '{peso}', '"67.85"'::jsonb)
where (screening->>'peso') = '67/85';

-- Matías Dumas: dominadas con peso_levantado = -1.
-- Las dominadas sin lastre van con 0; -1 no significa nada y ensucia
-- cualquier promedio o ratio por peso corporal.
update fuerza_tests set peso_levantado = 0 where peso_levantado < 0;

-- Periodizaciones activas duplicadas: un cliente tenía 3 simultáneas.
-- Solo la más reciente queda activa; las otras pasan a histórico, no se
-- borran.
update planes_periodizacion p set activo = false
where activo and exists (
  select 1 from planes_periodizacion q
  where q.gym_client_id = p.gym_client_id and q.activo and q.created_at > p.created_at);

-- 16 registros huérfanos de Raúl Mansilla (Sesión 2 del 09/09, 15 de 16 con
-- peso cargado). Son datos reales de un entrenamiento: el plan
-- plan_1788816623571_paqto se borró y los dejó colgados. Se reasignan a su
-- plan activo actual para que vuelvan a verse en su historial.
update ejecucion_registros e
set plan_id = (select p.id from gym_planes p
               where p.gym_client_id = e.gym_client_id and p.estado = 'activo'
               order by p.fecha_inicio desc nulls last limit 1)
where not exists (select 1 from gym_planes p where p.id = e.plan_id)
  and exists (select 1 from gym_planes p
              where p.gym_client_id = e.gym_client_id and p.estado = 'activo');


-- ═════════════════════════════════════════════════════════════════════════
-- 3) QUE LA CORRUPCIÓN NO PUEDA VOLVER
--
-- La fecha de Debora volvió porque nada impedía reescribirla. Estas
-- restricciones la rechazan en la base, no solo en la pantalla.
-- ═════════════════════════════════════════════════════════════════════════

alter table gym_clients drop constraint if exists chk_screening_fecha_eval;
alter table gym_clients add constraint chk_screening_fecha_eval check (
  screening->>'fechaEvaluacion' is null
  or screening->>'fechaEvaluacion' = ''
  or screening->>'fechaEvaluacion' ~ '^\d{4}-\d{2}-\d{2}$'
) not valid;
alter table gym_clients validate constraint chk_screening_fecha_eval;

alter table fuerza_tests drop constraint if exists chk_peso_no_negativo;
alter table fuerza_tests add constraint chk_peso_no_negativo
  check (peso_levantado is null or peso_levantado >= 0) not valid;
alter table fuerza_tests validate constraint chk_peso_no_negativo;


-- ═════════════════════════════════════════════════════════════════════════
-- 4) VERIFICACIÓN — debería devolver 0 en todo menos en la última fila
-- ═════════════════════════════════════════════════════════════════════════
select 'tablas abiertas a anon' chequeo,
       (select count(*)::text from pg_policies
        where schemaname='public' and roles::text like '%public%') valor
union all
select 'fechas de evaluación inválidas',
       (select count(*)::text from gym_clients
        where (screening->>'fechaEvaluacion') !~ '^\d{4}-\d{2}-\d{2}$'
          and nullif(screening->>'fechaEvaluacion','') is not null)
union all
select 'antropometría no numérica',
       (select count(*)::text from gym_clients c, lateral jsonb_each_text(c.screening) e(k,v)
        where k in ('peso','talla','imc','pctGrasa','per_cintura','per_cadera')
          and nullif(trim(v),'') is not null and v !~ '^[0-9]+\.?[0-9]*$')
union all
select 'IMC inconsistente',
       (select count(*)::text from gym_clients
        where (screening->>'peso') ~ '^[0-9.]+$' and (screening->>'talla') ~ '^[0-9.]+$'
          and (screening->>'imc') ~ '^[0-9.]+$' and (screening->>'talla')::numeric > 50
          and abs((screening->>'imc')::numeric
                  - round((screening->>'peso')::numeric/power((screening->>'talla')::numeric/100,2),1)) > 0.5)
union all
select 'tests con peso negativo',
       (select count(*)::text from fuerza_tests where peso_levantado < 0)
union all
select 'periodizaciones activas duplicadas',
       (select count(*)::text from (select gym_client_id from planes_periodizacion
         where activo group by 1 having count(*)>1) q)
union all
select 'registros huérfanos',
       (select count(*)::text from ejecucion_registros e
        where not exists (select 1 from gym_planes p where p.id=e.plan_id))
union all
select 'pesos ambiguos sin resolver',
       (select count(*)::text from gym_clients
        where (screening->>'peso') is not null and (screening->>'peso') <> ''
          and (screening->>'peso') !~ '^[0-9]+\.?[0-9]*$');
