-- ════════════════════════════════════════════════════════════════════════════
-- TABLA ÚNICA DE BANDAS DEL SCREENING  ·  20/10/2026  ·  Manual v2
--
-- QUÉ RESUELVE
-- Los valores de referencia del ROM estaban escritos a mano en SEIS lugares:
--   1. src/motor.js      ROM_GYM (ref, bandas, corte, mdc, asimAbs)
--   2. src/App.jsx       PANEL_POSTURA_ROM[].bandas   (texto de la pantalla)
--   3. src/App.jsx       PANEL_SECUNDARIO[].bandas
--   4. src/App.jsx       tabla ROM del informe impreso
--   5. src/App.jsx       MOV[]  -> el texto que recibe la IA
--   6. src/App.jsx       MOVX[] -> etiquetas del checkpoint
-- Y ya se habían desincronizado: el panel decía "Óptimo >=35" para el tobillo
-- y el texto que viaja a la IA decía "ref >=38 · limitado <35".
--
-- Desde esta migración hay UNA fuente. El código mantiene los mismos valores
-- como respaldo: si esta tabla no responde, la app sigue funcionando igual.
--
-- POR QUÉ UNA TABLA NUEVA Y NO rom_normas
-- rom_normas NO es la tabla de bandas a medio hacer. Es otra cosa: 42 normas
-- goniométricas generales sobre 10 regiones (cervical, codo, muñeca, rodilla,
-- columna...), de las cuales el screening del gimnasio usa 6. Son los valores
-- clásicos de rango normal, y de ahí salieron los `ref` viejos del motor:
--   rom_normas hombro/Flexión = 180   -> ROM_GYM mov_hombro_flex.ref = 180
--   rom_normas hombro/Rot. Interna = 70 -> mov_hombro_ri.ref = 70
--   rom_normas hombro/Rot. Externa = 90 -> mov_hombro_re.ref = 90
--   rom_normas tobillo/Dorsiflexión = 20 -> mov_tobillo (legacy).ref = 20
--
-- Eso explica el problema de fondo: el `ref` era el MÁXIMO ANATÓMICO de una
-- tabla goniométrica general, no el umbral de óptimo del centro. Por eso un
-- cliente en el umbral leía 92% y nunca llegaba a 100.
--
-- Plegar las 42 filas dentro de la tabla de bandas obligaría a inventar
-- cuatro bandas para 36 movimientos que nadie evalúa en el screening. Así que
-- rom_normas queda como está, documentada, y las bandas van aparte.
-- ════════════════════════════════════════════════════════════════════════════

begin;

comment on table rom_normas is
  'Normas goniométricas generales (rango normal por región y movimiento). NO es '
  'la tabla de bandas del screening: esa es screening_bandas. De acá salieron '
  'los valores de referencia viejos del motor, que eran máximos anatómicos y no '
  'umbrales de óptimo. Se conserva como referencia clínica.';

-- ── La tabla ──────────────────────────────────────────────────────────────
create table if not exists screening_bandas (
  k                  text primary key,
  orden              smallint,
  label              text    not null,
  unidad             text    not null default 'grados',

  -- Pisos de cada banda. Se lee de arriba hacia abajo:
  --   v >= piso_optimo     -> óptimo
  --   v >= piso_funcional  -> funcional
  --   v >= piso_limitado   -> limitado        (si es null, se saltea)
  --   resto                -> disfuncional
  -- piso_optimo es TAMBIÉN el ancla del 100% del porcentaje informado.
  piso_optimo        numeric,
  piso_funcional     numeric,
  piso_limitado      numeric,
  techo_optimo       numeric,   -- solo para mostrar "35–40°"; no corta nada

  mdc                numeric,   -- cambio mínimo detectable, en la unidad
  asim_abs           numeric,   -- umbral absoluto de asimetría; manda sobre el relativo
  asim_rel           numeric default 0.15,
  max_plausible      numeric,   -- techo anatómico: por encima, medición inválida
  no_promedia        boolean not null default false,
  legacy             boolean not null default false,

  -- Juicio por arco (rotaciones de cadera)
  arco_par           text,      -- clave del movimiento complementario
  arco_restriccion   numeric,   -- por debajo: restricción real
  arco_disfuncional  numeric,   -- por debajo: restricción disfuncional
  arco_optimo        numeric,   -- ancla del 100% del arco

  metodo_id          text    not null,
  nota               text,
  version            text    not null default 'v2.0',
  updated_at         timestamptz not null default now()
);

comment on table screening_bandas is
  'Fuente única de los valores de referencia del screening de postura y ROM. '
  'La app la lee al arrancar y la mergea sobre la tabla del código, que queda '
  'como respaldo si esta no responde. Editable sin desplegar.';
comment on column screening_bandas.piso_optimo is
  'Umbral de óptimo Y ancla del 100% del porcentaje informado. Hasta el manual '
  'v1 el ancla era el máximo anatómico y el cliente óptimo leía 92%.';
comment on column screening_bandas.metodo_id is
  'Identidad del método (posición + instrumento + punto de reparo + fórmula). '
  'Dos mediciones con metodo_id distinto no se comparan entre sí.';

-- ── Las doce entradas ─────────────────────────────────────────────────────
-- Los valores son los publicados en el Manual de Screening Activa v2. Lo único
-- que cambia respecto del código anterior es piso_optimo en cuatro filas, que
-- pasa del máximo anatómico al umbral de óptimo, y el ancla del arco.
insert into screening_bandas
  (k, orden, label, piso_optimo, piso_funcional, piso_limitado, techo_optimo,
   mdc, asim_abs, max_plausible, no_promedia, legacy,
   arco_par, arco_restriccion, arco_disfuncional, arco_optimo, metodo_id, nota)
values
  ('mov_cv_angulo', 1, 'Antepulsión cefálica (áng. craneovertebral)',
   50, 44, 38, null, 4, null, null, true, false,
   null, null, null, null, 'cv_c7_trago_v1',
   'Percentiles de Cote 2021 (10.5195/ijt.2021.6346): media 50,7° ± 6,3°. No promedia: la media poblacional ya cae en el óptimo justo.'),

  ('mov_hombro_flex', 4, 'Flexión de hombro',
   170, 150, 120, null, 8, null, null, false, false,
   null, null, null, null, 'hombro_flex_supino_gonio_v1',
   'piso_optimo pasa de 180 (máximo anatómico, de rom_normas) a 170 (umbral de óptimo del manual).'),

  ('mov_hombro_ri', 5, 'Rotación interna de hombro',
   65, 55, 45, null, 8, null, null, false, false,
   null, null, null, null, 'hombro_ri_90abd_gonio_v1',
   'piso_optimo pasa de 70 a 65. Asimetría: 15% Y 8° (Gradoz 2018).'),

  ('mov_hombro_re', 6, 'Rotación externa de hombro',
   85, 70, 60, null, 8, null, null, false, false,
   null, null, null, null, 'hombro_re_90abd_gonio_v1',
   'piso_optimo pasa de 90 a 85.'),

  ('mov_cad_flex', 8, 'Flexión de cadera',
   120, 100, 80, null, 10, null, null, false, false,
   null, null, null, null, 'cadera_flex_supino_gonio_v1',
   'Ya coincidía: 120 es a la vez el máximo de rom_normas y el umbral de óptimo.'),

  ('mov_cad_rot', 9, 'Rotación interna de cadera',
   45, null, null, null, 8, null, null, false, false,
   'mov_cad_rot_ext', 70, 60, 80, 'cadera_ri_prono_v1',
   'No se juzga por su valor aislado: manda el arco RI+RE. Los registros previos a octubre de 2026 son de este mismo método (prono), así que se comparan; lo que no tienen es la RE del mismo lado.'),

  ('mov_cad_rot_ext', 10, 'Rotación externa de cadera',
   45, null, null, null, 8, null, null, false, false,
   null, null, null, null, 'cadera_re_prono_v1',
   'Componente del arco. No emite veredicto propio.'),

  ('mov_tobillo_wblt', 11, 'Dorsiflexión de tobillo (WBLT)',
   35, 30, null, 40, 2, 4, null, false, false,
   null, null, null, null, 'tobillo_wblt_tibial_v1',
   'piso_optimo pasa de 38 a 35. MDC 1,7° por pose (Howe 2020) y 4,6–4,7° a mano con regla entre sesiones (Powden 2015): el asim_abs de 4° solo es detectable medido por pose.'),

  ('mov_tor_rot', null, 'Rotación torácica',
   45, 30, null, null, 8, null, null, false, false,
   null, null, null, null, 'toracica_rot_sentado_v1',
   'Antes el motor marcaba limitación por debajo de 36 (0,8 × ref) mientras el manual decía disfuncional <30. Ahora manda el manual. Verificado el 20/10: los 5 clientes con dato están todos en 36° o más, así que ninguno cambia de veredicto.'),

  ('mov_tobillo', null, 'Dorsiflexión de tobillo (protocolo anterior)',
   20, null, null, null, 5, null, 25, false, true,
   null, null, null, null, 'tobillo_dedos_menos90',
   'Serie cerrada. No se compara con el WBLT: son métodos distintos, con sesgos de 1,93° a 14,42° entre sí (Langarika-Rocafort 2016). max_plausible 25: 59 de 60 mediciones cargadas estaban por encima del techo anatómico.')
on conflict (k) do nothing;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════════
select 'filas cargadas' as control,
       count(*)::text || ' de 10 esperadas' as resultado,
       case when count(*) = 10 then 'OK' else 'REVISAR' end as estado
from screening_bandas
union all
select 'pisos coherentes (optimo > funcional > limitado)',
       count(*)::text || ' fila(s) con pisos fuera de orden',
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from screening_bandas
where (piso_funcional is not null and piso_optimo <= piso_funcional)
   or (piso_limitado  is not null and piso_funcional is not null and piso_funcional <= piso_limitado)
union all
select 'cada fila tiene metodo_id',
       count(*)::text || ' fila(s) sin método',
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from screening_bandas where coalesce(metodo_id,'') = ''
union all
select 'el par del arco existe',
       coalesce(string_agg(k, ', '), 'ninguno') || ' apunta(n) a un par inexistente',
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from screening_bandas b
where b.arco_par is not null
  and not exists (select 1 from screening_bandas x where x.k = b.arco_par)
union all
select 'rom_normas intacta',
       count(*)::text || ' normas goniométricas conservadas',
       case when count(*) = 42 then 'OK' else 'REVISAR' end
from rom_normas
union all
select 'cambios de ancla respecto del código anterior',
       string_agg(k || ': ' || viejo::text || ' -> ' || piso_optimo::text, ' · ' order by k),
       'informativo'
from (
  select b.k, b.piso_optimo, v.viejo
  from screening_bandas b
  join (values ('mov_hombro_flex',180),('mov_hombro_ri',70),('mov_hombro_re',90),
               ('mov_tobillo_wblt',38)) as v(k,viejo) on v.k = b.k
) t;
