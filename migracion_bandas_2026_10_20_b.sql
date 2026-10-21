-- ════════════════════════════════════════════════════════════════════════════
-- CORRECCIÓN DE screening_bandas  ·  20/10/2026  ·  va después de
-- migracion_bandas_2026_10_20.sql
--
-- DOS AGUJEROS, ENCONTRADOS VERIFICANDO QUE LA TABLA RECONSTRUYA EL MOTOR
--
-- 1) La fila del tobillo no se puede reconstruir.
--    El motor trata el tramo 30–35° del WBLT como HALLAZGO ("funcional pero
--    limitado"): entra a `limitados` y de ahí a los patrones de déficit del
--    generador de planes. El tramo 30–45° de la rotación torácica NO es
--    hallazgo: está por debajo del óptimo y nada más.
--    En la tabla las dos filas se ven idénticas —piso_optimo, piso_funcional,
--    piso_limitado en null— así que al leerla, el tobillo dejaría de marcar
--    entre 30 y 35 y esos clientes perderían la movilidad de tobillo del plan.
--    Hoy no hay ninguno en esa franja, pero el día que lo haya sería una
--    pérdida silenciosa.
--    Se agrega `banda_funcional_nivel`: null = el tramo no es hallazgo; con
--    texto = es hallazgo y así se llama.
--
-- 2) Faltan cuatro métodos que el manual v2 sí publica.
--    Tres mediciones graduadas (antepulsión de hombros, simetría de hombros,
--    inclinación pélvica) y la variante por pose de la flexión de hombro
--    tienen metodo_id en el manual y ninguna fila acá. No tienen bandas
--    —son cualitativas— pero sí tienen identidad de método, que es lo que
--    necesita el paso siguiente.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1) El nivel de la banda intermedia ────────────────────────────────────
alter table screening_bandas
  add column if not exists banda_funcional_nivel text,
  add column if not exists opciones jsonb;

comment on column screening_bandas.banda_funcional_nivel is
  'Cómo se llama el tramo [piso_funcional, piso_optimo) cuando ES un hallazgo '
  'que entra al informe y al generador de planes. NULL = el tramo está por '
  'debajo del óptimo pero no se reporta. Es lo único que distingue al tobillo '
  '(30-35 es hallazgo) de la rotación torácica (30-45 no lo es).';
comment on column screening_bandas.opciones is
  'Opciones de registro de las mediciones cualitativas, en orden. NULL en las '
  'angulares.';

update screening_bandas
   set banda_funcional_nivel = 'funcional pero limitado'
 where k = 'mov_tobillo_wblt';

-- ── 2) Las cuatro filas que faltaban ──────────────────────────────────────
insert into screening_bandas
  (k, orden, label, unidad, metodo_id, opciones, nota)
values
  ('postura_hombros_ante', 2, 'Antepulsión de hombros', 'cualitativo',
   'hombro_ante_troc_v1',
   '["Óptimo","Leve","Moderada","Marcada"]'::jsonb,
   'Se gradúa cuánto queda el acromion por delante de la vertical del trocánter mayor. La referencia es la cadera y no la oreja, para que una cabeza adelantada no contamine la lectura del hombro.'),

  ('postura_hombros', 3, 'Simetría bilateral de hombros', 'cualitativo',
   'hombro_sim_frontal_v1',
   '["Simétrico","Elevado derecho","Elevado izquierdo"]'::jsonb,
   'Altura relativa de ambos acromion contra una horizontal real.'),

  ('postura_pelvis', 7, 'Anteversión / retroversión pélvica', 'cualitativo',
   'pelvis_eias_eips_v1',
   '["Neutra","Anteversión leve","Anteversión marcada","Retroversión leve","Retroversión marcada"]'::jsonb,
   'No va en grados: el rango normativo es amplio y difiere entre sexos, y la palpación de EIPS en tejido blando tiene error alto que el ángulo calculado hereda multiplicado.')
on conflict (k) do nothing;

-- La variante por pose de la flexión de hombro comparte bandas con el método
-- de goniómetro pero ES OTRO MÉTODO: hasta que se valide el sesgo contra el
-- goniómetro, sus valores no se comparan con los de aquel.
insert into screening_bandas
  (k, orden, label, piso_optimo, piso_funcional, piso_limitado, mdc, metodo_id, nota)
select 'mov_hombro_flex_pose', 4, 'Flexión de hombro (medida por pose)',
       piso_optimo, piso_funcional, piso_limitado, mdc,
       'hombro_flex_supino_pose_v1',
       'Mismas bandas que el método con goniómetro, método distinto. No se compara con aquel hasta validar el sesgo.'
from screening_bandas where k = 'mov_hombro_flex'
on conflict (k) do nothing;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════════
select 'filas totales' as control,
       count(*)::text || ' (10 anteriores + 4 nuevas = 14)' as resultado,
       case when count(*) = 14 then 'OK' else 'REVISAR' end as estado
from screening_bandas
union all
select 'el tobillo marca su banda intermedia',
       coalesce(banda_funcional_nivel,'SIN MARCAR'),
       case when banda_funcional_nivel = 'funcional pero limitado' then 'OK' else 'REVISAR' end
from screening_bandas where k = 'mov_tobillo_wblt'
union all
select 'la torácica NO marca la suya',
       coalesce(banda_funcional_nivel,'null — correcto'),
       case when banda_funcional_nivel is null then 'OK' else 'REVISAR' end
from screening_bandas where k = 'mov_tor_rot'
union all
select 'métodos vigentes (el manual v2 publica 13)',
       count(*)::text,
       case when count(*) = 13 then 'OK' else 'REVISAR' end
from screening_bandas where legacy = false
union all
select 'cada método es único',
       count(*)::text || ' metodo_id repetido(s)',
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from (select metodo_id from screening_bandas group by metodo_id having count(*) > 1) d
union all
select 'las cualitativas no tienen bandas',
       count(*)::text || ' fila(s) cualitativa(s) con piso cargado',
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from screening_bandas
where unidad = 'cualitativo' and (piso_optimo is not null or piso_funcional is not null)
union all
select 'las cualitativas tienen opciones',
       count(*)::text || ' fila(s) cualitativa(s) sin opciones',
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from screening_bandas where unidad = 'cualitativo' and opciones is null
union all
select 'rom_normas sigue intacta',
       count(*)::text || ' normas goniométricas',
       case when count(*) = 42 then 'OK' else 'REVISAR' end
from rom_normas;
