-- migracion_salud_2026_10_14.sql
--
-- Correcciones derivadas del análisis de salud del sistema.
-- Estado verificado contra la base el 14/10/2026 a las 12:35: los 8 puntos
-- siguen pendientes, ninguno se aplicó.
--
-- CÓMO CORRERLO: son dos bloques independientes. El BLOQUE 1 es seguridad y
-- conviene correrlo solo primero, confirmar el resultado, y después el
-- BLOQUE 2. Ambos son idempotentes: se pueden volver a correr.
--
-- ─────────────────────────────────────────────────────────────────────────
-- CAMBIOS RESPECTO DE LA VERSIÓN ANTERIOR DE ESTE ARCHIVO
--
-- 1) CORREGIDO UN BUG QUE HABRÍA CORROMPIDO UN DATO.
--    La limpieza de antropometría usaba regexp_replace(v,'[^0-9.]','','g'),
--    que borra TODOS los caracteres no numéricos. Sobre el peso de Pablo
--    Hernández, '67/85' se convertía en '6785', y '6785' pasa el chequeo de
--    "número válido". Esa limpieza corría ANTES de la línea que fija su peso
--    en 67.85, así que el `where peso = '67/85'` ya no habría matcheado:
--    Pablo quedaba con 6785 kg, y el recálculo de IMC —que venía en medio—
--    le calculaba el IMC con ese peso.
--    Ahora se limpian solo los caracteres de los EXTREMOS, y el valor
--    resultante tiene que seguir siendo un número:
--      '`160'  -> '160'    (se limpia, es lo que se busca)
--      '67/85' -> '67/85'  (NO se toca, la barra es interior)
--    Y la corrección explícita de Pablo se movió ANTES de la limpieza
--    general, por si acaso.
--
-- 2) AGREGADO `enable row level security`.
--    La versión anterior solo cambiaba las políticas. Si RLS estuviera
--    apagado en esas tablas, las políticas no se aplican y la tabla queda
--    abierta igual: el arreglo habría parecido hecho sin estar hecho.
--
-- 3) VERIFICADO QUE EL DROP POLICY VA A ACERTAR EL NOMBRE.
--    `drop policy if exists` con un nombre equivocado no hace nada EN
--    SILENCIO, y la política abierta sobreviviría junto a la nueva. Se
--    consultó pg_policies: los nombres reales son exactamente
--    public_all_gym_medidas y public_all_gym_metas, una política por tabla,
--    rol {public}, cmd ALL, qual true, with_check true.
-- ─────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- BLOQUE 1 · SEGURIDAD — cerrar el acceso anónimo        [CORRER PRIMERO]
--
-- gym_medidas y gym_metas quedaron con política para el rol `public`, que
-- incluye `anon`. Las otras 23 tablas exigen sesión iniciada. La clave
-- anónima viaja dentro del bundle del frontend, así que cualquiera que la
-- extraiga puede leer y escribir peso, % de grasa y objetivos de los 70
-- clientes. Fue un error al escribir las migraciones de esas dos tablas.
--
-- VERIFICADO ANTES DE ESCRIBIR ESTO — no rompe nada:
--   · El frontend entra por AuthGate (src/main.jsx envuelve <App/>), que usa
--     supabase.auth.signInWithPassword. Rol efectivo: `authenticated`.
--   · api/portal.js usa SUPABASE_SERVICE_ROLE_KEY, que no pasa por RLS.
--   · public/portal.html no hace ninguna llamada directa a Supabase.
--   · Los únicos accesos a estas tablas en el código son src/db.js (app
--     autenticada) y api/portal.js (service role).
-- ═════════════════════════════════════════════════════════════════════════

alter table gym_medidas enable row level security;
alter table gym_metas   enable row level security;

drop policy if exists "public_all_gym_medidas" on gym_medidas;
create policy "auth_all_gym_medidas" on gym_medidas
  for all to authenticated using (true) with check (true);

drop policy if exists "public_all_gym_metas" on gym_metas;
create policy "auth_all_gym_metas" on gym_metas
  for all to authenticated using (true) with check (true);

-- Comprobación del BLOQUE 1. Las dos filas tienen que decir
-- rls_activo = true y roles = {authenticated}.
select c.relname                                   as tabla,
       c.relrowsecurity                            as rls_activo,
       p.policyname,
       p.roles::text                               as roles
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relname in ('gym_medidas','gym_metas')
order by c.relname, p.policyname;


-- ═════════════════════════════════════════════════════════════════════════
-- BLOQUE 2 · DATOS CORRUPTOS
-- ═════════════════════════════════════════════════════════════════════════

-- ── 2.a) Pablo Hernández: peso = "67/85" ────────────────────────────────
-- Confirmado por Manu el 14/10: es 67,85 kg. Se escribe con punto porque es
-- el formato de cálculo; la app lo muestra con coma.
-- VA PRIMERO, antes de cualquier limpieza genérica.
update gym_clients
set screening = jsonb_set(screening, '{peso}', '"67.85"'::jsonb)
where (screening->>'peso') = '67/85';

-- ── 2.b) Debora Ferron: fechaEvaluacion = "262026-12-06" ────────────────
-- Es la SEGUNDA vez que aparece: se corrigió el 30/09 y volvió. Además de
-- ser inválida, 2026-12-06 es futuro, así que no puede ser la fecha de una
-- evaluación ya hecha. Se vacía en vez de inventar una: "sin medir" es un
-- estado válido del motor; una fecha inventada contamina los cálculos de
-- vigencia.
update gym_clients
set screening = jsonb_set(screening, '{fechaEvaluacion}', '""'::jsonb)
where (screening->>'fechaEvaluacion') !~ '^\d{4}-\d{2}-\d{2}$'
  and nullif(screening->>'fechaEvaluacion','') is not null;

-- ── 2.c0) Coma decimal → punto: DESCARTADO ──────────────────────────────
-- Se escribió y se descartó el 14/10. La idea era normalizar '67,85' a
-- '67.85', que en Uruguay es inequívoco. El test lo tumbó: con la misma regla,
-- una talla escrita como '1,60' —metro sesenta, la forma natural de
-- escribirla acá— se convierte en '1.60', que el sistema lee como 1,6 cm.
-- Eso transforma un error VISIBLE (valor no numérico, aparece en la
-- verificación) en un error INVISIBLE que pasa el chequeo de "es numérico".
-- Además es un no-op sobre los datos actuales: hoy no hay ningún valor con
-- coma en los campos antropométricos.
-- El sanitizador de src/db.js ya normaliza la coma al escribir, así que los
-- datos nuevos entran con punto. Queda anotado que ese sanitizador tiene el
-- mismo problema con '1,60' y conviene revisarlo aparte.

-- ── 2.c) Antropometría con basura en los extremos ───────────────────────
-- Melissa González tiene talla = "`160" (comilla invertida al principio).
-- parseFloat da NaN: se quedaba sin IMC y sin índice cintura-talla.
--
-- Se limpian SOLO los caracteres no numéricos de los EXTREMOS, y el
-- resultado tiene que seguir siendo un número. Un valor con un separador
-- INTERIOR ambiguo no se toca, porque adivinar sería inventar un dato
-- clínico: '67/85' podría ser 67,85 o una tensión arterial en el campo
-- equivocado.
update gym_clients c
set screening = (
  select jsonb_object_agg(k,
    case when k in ('peso','talla','imc','pctGrasa','fcReposo','per_cintura','per_cadera',
                    'per_cintura_escapular','per_brazo_d','per_brazo_i','per_muslo_d',
                    'per_muslo_i','per_pantorrilla_d','per_pantorrilla_i')
          and v #>> '{}' ~ '[^0-9.]'
          -- Si el prefijo que se descarta contiene un signo menos, no se toca:
          -- convertir '-5' en '5' sería inventar un dato, no limpiarlo.
          and substring(v #>> '{}' from '^[^0-9]*') !~ '-'
          and regexp_replace(regexp_replace(v #>> '{}', '^[^0-9]+', ''), '[^0-9]+$', '')
              ~ '^[0-9]+(\.[0-9]+)?$'
         then to_jsonb(regexp_replace(regexp_replace(v #>> '{}', '^[^0-9]+', ''), '[^0-9]+$', ''))
         else v end)
  from jsonb_each(c.screening) as campos(k, v))
where exists (
  select 1 from jsonb_each_text(c.screening) e(k,v)
  where k in ('peso','talla','imc','pctGrasa','fcReposo','per_cintura','per_cadera',
              'per_cintura_escapular','per_brazo_d','per_brazo_i','per_muslo_d',
              'per_muslo_i','per_pantorrilla_d','per_pantorrilla_i')
    and v ~ '[^0-9.]'
    and substring(v from '^[^0-9]*') !~ '-'
    and regexp_replace(regexp_replace(v, '^[^0-9]+', ''), '[^0-9]+$', '') ~ '^[0-9]+(\.[0-9]+)?$');

-- ── 2.d) IMC inconsistente con peso y talla ─────────────────────────────
-- El IMC es una fórmula, no una observación: si no coincide con peso y
-- talla, el valor guardado está mal. El cálculo automático solo reescribe al
-- abrir la ficha, así que los que no se abrieron conservaban el valor viejo.
-- Verificado el 14/10 — 4 clientes:
--   Sebastián Hugo  24,8 guardado  vs  27,3 real  (normopeso -> sobrepeso)
--   Manuel Vallejo  22,9           vs  24,7
--   Ana Castro      17,15          vs  19,9
--   Valeria Vidal   19,2           vs  21,1
-- Corre DESPUÉS de 2.a y 2.c para que lea pesos y tallas ya saneados.
update gym_clients
set screening = jsonb_set(screening, '{imc}',
  to_jsonb(round((screening->>'peso')::numeric / power((screening->>'talla')::numeric/100, 2), 1)::text))
where (screening->>'peso')  ~ '^[0-9]+\.?[0-9]*$'
  and (screening->>'talla') ~ '^[0-9]+\.?[0-9]*$'
  and (screening->>'imc')   ~ '^[0-9]+\.?[0-9]*$'
  and (screening->>'talla')::numeric between 100 and 230
  and (screening->>'peso')::numeric between 25 and 300   -- cinturón extra: si
      -- algo dejó un peso absurdo, no se propaga al IMC.
  and abs((screening->>'imc')::numeric
          - round((screening->>'peso')::numeric / power((screening->>'talla')::numeric/100, 2), 1)) > 0.5;

-- ── 2.e) Matías Dumas: dominadas con peso_levantado = -1 ────────────────
-- Las dominadas sin lastre van con 0; -1 no significa nada y ensucia
-- cualquier promedio o ratio por peso corporal.
update fuerza_tests set peso_levantado = 0 where peso_levantado < 0;

-- ── 2.f) Periodizaciones activas duplicadas ─────────────────────────────
-- Un cliente tenía 3 simultáneas. Solo la más reciente queda activa; las
-- otras pasan a histórico, no se borran.
-- OJO: esto NO toca gym_planes. Tener varios PLANES activos en secuencia es
-- una característica del método, no un error — el portal ya elige el bloque
-- vigente por fecha. Lo que se corrige acá son las PERIODIZACIONES.
update planes_periodizacion p set activo = false
where activo and exists (
  select 1 from planes_periodizacion q
  where q.gym_client_id = p.gym_client_id and q.activo and q.created_at > p.created_at);

-- ── 2.g) 16 registros huérfanos de Raúl Mansilla ────────────────────────
-- Sesión 2 del 09/09, 15 de 16 con peso cargado. Son datos reales de un
-- entrenamiento: el plan plan_1788816623571_paqto se borró y los dejó
-- colgados. Se reasignan a su plan activo actual para que vuelvan a verse en
-- su historial.
update ejecucion_registros e
set plan_id = (select p.id from gym_planes p
               where p.gym_client_id = e.gym_client_id and p.estado = 'activo'
               order by p.fecha_inicio desc nulls last limit 1)
where not exists (select 1 from gym_planes p where p.id = e.plan_id)
  and exists (select 1 from gym_planes p
              where p.gym_client_id = e.gym_client_id and p.estado = 'activo');


-- ═════════════════════════════════════════════════════════════════════════
-- BLOQUE 3 · QUE LA CORRUPCIÓN NO PUEDA VOLVER
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
-- BLOQUE 4 · VERIFICACIÓN FINAL
--
-- Las primeras 7 filas tienen que decir 0 / "ninguna".
-- La última ("peso de Pablo") tiene que decir 67.85, NO 6785.
-- ═════════════════════════════════════════════════════════════════════════
select 'tablas abiertas a anon' chequeo,
       (select coalesce(string_agg(distinct tablename, ', '),'ninguna') from pg_policies
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
select 'peso de Pablo (debe ser 67.85)',
       (select coalesce(string_agg(screening->>'peso', ', '),'no encontrado')
        from gym_clients where nombre ilike 'Pablo%');
