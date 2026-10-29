-- prueba_riel_2026_10_29.sql — verifica el ruteo del disparador del riel
--
-- SE LIMPIA SOLO. Inserta filas sintéticas con gym_client_id 'TESTRIEL_*',
-- verifica qué incidencia produjo cada una, y al final borra TODO lo que creó:
-- feedbacks, incidencias y líneas de base de prueba. No toca ningún dato real.
--
-- CÓMO LEERLO
-- Imprime una línea por caso en el panel de mensajes del SQL Editor. Al final,
-- un resumen. Si alguna dice FALLA, el ruteo no es el que acordamos y hay que
-- corregir la función antes de construir las preguntas del portal.
--
-- LOS NUEVE CASOS
--   1. muscular, se fue, apareció hoy, primera vez  → escalón 0
--   2. el mismo cliente y zona 3 días después       → escalón 1, MISMA incidencia
--   3. articular                                     → escalón 1
--   4. nerviosa                                      → escalón 3 + bandera
--   5. "mucho, tuve que parar"                       → escalón 3
--   6. sigue al parar                                → escalón 1
--   7. dolor previo a la sesión                      → escalón 1
--   8. con línea de base igual al basal              → NO dispara
--   9. con línea de base y peor que el basal         → sí dispara

do $prueba$
declare
  pasa int := 0; falla int := 0;
  v_esc smallint; v_est text; v_band boolean; v_cnt int; v_id text; v_prev text;
begin
  -- ── Limpieza previa, por si quedó algo de una corrida anterior ──────────
  delete from gym_incidencias      where gym_client_id like 'TESTRIEL\_%';
  delete from gym_sesion_feedback  where gym_client_id like 'TESTRIEL\_%';
  delete from gym_linea_base       where gym_client_id like 'TESTRIEL\_%';

  raise notice '──────────────────────────────────────────────────────────';

  -- ══ CASO 1 — muscular, se fue, nueva, primera vez → escalón 0 ══════════
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt1','TESTRIEL_A','d1',1,current_date-3,true,'muscular','nueva','se_fue','apenas','lumbar');

  select escalon, estado into v_esc, v_est from gym_incidencias where gym_client_id='TESTRIEL_A';
  if v_esc = 0 and v_est = 'en_sala' then pasa:=pasa+1;
    raise notice 'PASA  1. muscular 1a vez            → escalón 0 / en_sala';
  else falla:=falla+1;
    raise notice 'FALLA 1. muscular 1a vez            → esperaba 0/en_sala, dio %/%', v_esc, v_est;
  end if;

  -- ══ CASO 2 — repite misma zona en 7 días → escalón 1, misma incidencia ══
  select id into v_prev from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt2','TESTRIEL_A','d2',1,current_date,true,'muscular','nueva','se_fue','apenas','lumbar');

  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_A';
  select escalon, id into v_esc, v_id from gym_incidencias where gym_client_id='TESTRIEL_A';
  if v_cnt = 1 and v_esc = 1 and v_id = v_prev then pasa:=pasa+1;
    raise notice 'PASA  2. repite en 7 días           → escalón 1, una sola incidencia (idempotente)';
  else falla:=falla+1;
    raise notice 'FALLA 2. repite en 7 días           → esperaba 1 incidencia en escalón 1 y el mismo id; dio % incidencia(s), escalón %, id igual: %', v_cnt, v_esc, (v_id = v_prev);
  end if;

  -- ══ CASO 3 — articular → escalón 1 ═════════════════════════════════════
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt3','TESTRIEL_B','d1',1,current_date,true,'articular','nueva','se_fue','apenas','rodilla_izq');

  select escalon, estado into v_esc, v_est from gym_incidencias where gym_client_id='TESTRIEL_B';
  if v_esc = 1 and v_est = 'valoracion_pendiente' then pasa:=pasa+1;
    raise notice 'PASA  3. articular                  → escalón 1 / valoracion_pendiente';
  else falla:=falla+1;
    raise notice 'FALLA 3. articular                  → esperaba 1/valoracion_pendiente, dio %/%', v_esc, v_est;
  end if;

  -- ══ CASO 4 — nerviosa → escalón 3 + bandera, sin esperar repetición ════
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt4','TESTRIEL_C','d1',1,current_date,true,'nerviosa','nueva','se_fue','apenas','lumbar');

  select escalon, bandera_activa into v_esc, v_band from gym_incidencias where gym_client_id='TESTRIEL_C';
  if v_esc = 3 and v_band then pasa:=pasa+1;
    raise notice 'PASA  4. nerviosa                   → escalón 3 + bandera, con intensidad "apenas"';
  else falla:=falla+1;
    raise notice 'FALLA 4. nerviosa                   → esperaba 3 + bandera, dio % / bandera %', v_esc, v_band;
  end if;

  -- ══ CASO 5 — "tuve que parar" → escalón 3 ══════════════════════════════
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt5','TESTRIEL_D','d1',1,current_date,true,'muscular','nueva','se_fue','mucho','hombro_der');

  select escalon, banda into v_esc, v_est from gym_incidencias where gym_client_id='TESTRIEL_D';
  if v_esc = 3 and v_est = 'severo' then pasa:=pasa+1;
    raise notice 'PASA  5. tuvo que parar             → escalón 3 / banda severo (compatible con el riel viejo)';
  else falla:=falla+1;
    raise notice 'FALLA 5. tuvo que parar             → esperaba 3/severo, dio %/%', v_esc, v_est;
  end if;

  -- ══ CASO 6 — sigue al parar → escalón 1 ════════════════════════════════
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt6','TESTRIEL_E','d1',1,current_date,true,'muscular','nueva','sigue','apenas','cuello');

  select escalon into v_esc from gym_incidencias where gym_client_id='TESTRIEL_E';
  if v_esc = 1 then pasa:=pasa+1;
    raise notice 'PASA  6. sigue al parar             → escalón 1';
  else falla:=falla+1;
    raise notice 'FALLA 6. sigue al parar             → esperaba 1, dio %', v_esc;
  end if;

  -- ══ CASO 7 — dolor previo a la sesión → escalón 1 (criterio a ratificar) ═
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt7','TESTRIEL_F','d1',1,current_date,true,'muscular','previa','se_fue','apenas','dorsal');

  select escalon into v_esc from gym_incidencias where gym_client_id='TESTRIEL_F';
  if v_esc = 1 then pasa:=pasa+1;
    raise notice 'PASA  7. dolor previo               → escalón 1 (CRITERIO A RATIFICAR por Manu)';
  else falla:=falla+1;
    raise notice 'FALLA 7. dolor previo               → esperaba 1, dio %', v_esc;
  end if;

  -- ══ CASO 8 — línea de base igual al basal → NO dispara ═════════════════
  -- Es el caso de Raúl: lumbares "apenas", muscular, se va al parar, hace años.
  insert into gym_linea_base
    (id, gym_client_id, zona, naturaleza_basal, intensidad_basal, ahora_basal, autor, veredicto)
  values ('lbt1','TESTRIEL_G','lumbar','muscular','apenas','se_fue','prueba','basal conocido de prueba');

  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt8','TESTRIEL_G','d1',1,current_date,true,'muscular','previa','se_fue','apenas','lumbar');

  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_G';
  if v_cnt = 0 then pasa:=pasa+1;
    raise notice 'PASA  8. igual al basal             → NO dispara (el feedback quedó registrado)';
  else falla:=falla+1;
    raise notice 'FALLA 8. igual al basal             → esperaba 0 incidencias, dio %', v_cnt;
  end if;

  -- ══ CASO 9 — línea de base + empeora la intensidad → sí dispara ════════
  insert into gym_sesion_feedback
    (id, gym_client_id, dia_id, semana, fecha, molestia, naturaleza, momento, ahora, intensidad, dolor_zona)
  values ('fbt9','TESTRIEL_G','d2',1,current_date,true,'muscular','previa','se_fue','bastante','lumbar');

  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_G';
  select nota into v_est from gym_incidencias where gym_client_id='TESTRIEL_G';
  if v_cnt = 1 and v_est like '%linea de base%' then pasa:=pasa+1;
    raise notice 'PASA  9. peor que el basal          → sí dispara, motivo: "%"', v_est;
  else falla:=falla+1;
    raise notice 'FALLA 9. peor que el basal          → esperaba 1 incidencia por cambio de patrón, dio % (motivo: %)', v_cnt, v_est;
  end if;

  -- ══ Control extra — los 256 registros viejos no disparan nada ══════════
  -- Un feedback sin naturaleza (como los 256 que ya están) tiene que salir de
  -- entrada. Esto es lo que mantiene la serie vieja fuera del riel.
  insert into gym_sesion_feedback (id, gym_client_id, dia_id, semana, fecha, dolor, dolor_zona)
  values ('fbt10','TESTRIEL_H','d1',1,current_date,2,'lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_H';
  if v_cnt = 0 then pasa:=pasa+1;
    raise notice 'PASA 10. feedback sin naturaleza    → NO dispara (los 256 viejos quedan afuera)';
  else falla:=falla+1;
    raise notice 'FALLA 10. feedback sin naturaleza   → esperaba 0, dio %', v_cnt;
  end if;

  -- ── Limpieza: borra TODO lo que creó esta prueba ────────────────────────
  delete from gym_incidencias      where gym_client_id like 'TESTRIEL\_%';
  delete from gym_sesion_feedback  where gym_client_id like 'TESTRIEL\_%';
  delete from gym_linea_base       where gym_client_id like 'TESTRIEL\_%';

  raise notice '──────────────────────────────────────────────────────────';
  raise notice 'RESULTADO: % pasan, % fallan. Datos de prueba borrados.', pasa, falla;
  if falla > 0 then
    raise notice 'Hay fallas: NO construir las preguntas del portal todavía.';
  else
    raise notice 'Ruteo correcto. Siguiente paso: las preguntas del portal.';
  end if;
end $prueba$;

-- Verificación independiente de que no quedó nada: las tres tienen que dar 0.
select
  (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTRIEL\_%') as feedback_de_prueba,
  (select count(*) from gym_incidencias     where gym_client_id like 'TESTRIEL\_%') as incidencias_de_prueba,
  (select count(*) from gym_linea_base      where gym_client_id like 'TESTRIEL\_%') as lineas_de_prueba,
  (select count(*) from gym_sesion_feedback) as feedback_real_intacto,
  (select count(*) from gym_incidencias)     as incidencias_reales_intactas;
