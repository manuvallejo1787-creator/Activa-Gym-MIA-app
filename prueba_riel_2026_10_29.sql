-- prueba_riel_2026_10_29.sql — verifica el ruteo del disparador del riel
--
-- SE LIMPIA SOLO y DEVUELVE EL VEREDICTO COMO TABLA.
--
-- La primera versión imprimía los resultados con RAISE NOTICE y el SQL Editor
-- no los muestra: el script terminaba, limpiaba, y no había forma de saber si
-- el ruteo era correcto. Una FALLA no interrumpe nada, sólo cuenta, así que
-- "terminó bien" no significaba "pasó". Ahora los resultados van a una tabla
-- temporal y el último SELECT los muestra.
--
-- Trabaja con clientes falsos 'TESTRIEL_*' y borra sus propias filas de las
-- tres tablas antes de terminar. La tabla temporal desaparece al cerrar la
-- sesión del editor: no queda nada.
--
-- CÓMO LEERLO
-- La columna `veredicto` tiene que decir PASA en las once filas. Cualquier
-- FALLA significa que hay que corregir la función antes de tocar el portal.

create temp table pr (n int, caso text, esperado text, obtenido text, veredicto text);

do $prueba$
declare
  v_esc smallint; v_est text; v_band boolean; v_cnt int; v_id text; v_prev text; v_nota text;
begin
  -- Limpieza previa, por si quedó algo de una corrida anterior.
  delete from gym_incidencias      where gym_client_id like 'TESTRIEL\_%';
  delete from gym_sesion_feedback  where gym_client_id like 'TESTRIEL\_%';
  delete from gym_linea_base       where gym_client_id like 'TESTRIEL\_%';

  -- ══ 1. muscular + se fue + nueva, primera vez → escalón 0 ══════════════
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt1','TESTRIEL_A','d1',1,current_date-3,true,'muscular','nueva','se_fue','apenas','lumbar');
  select escalon,estado into v_esc,v_est from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into pr values (1,'muscular, se fue, 1a vez','escalón 0 / en_sala',
    coalesce(v_esc::text,'sin incidencia')||' / '||coalesce(v_est,'—'),
    case when v_esc=0 and v_est='en_sala' then 'PASA' else 'FALLA' end);

  -- ══ 2. repite misma zona en 7 días → escalón 1, UNA sola incidencia ════
  -- Es la prueba de idempotencia: sin esto un crónico genera una incidencia
  -- por semana y el riel se vuelve ruido.
  select id into v_prev from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt2','TESTRIEL_A','d2',1,current_date,true,'muscular','nueva','se_fue','apenas','lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_A';
  select escalon,id into v_esc,v_id from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into pr values (2,'repite en 7 días (idempotencia)','escalón 1, 1 incidencia, mismo id',
    'escalón '||coalesce(v_esc::text,'?')||', '||v_cnt||' incidencia(s), mismo id: '||coalesce((v_id=v_prev)::text,'?'),
    case when v_cnt=1 and v_esc=1 and v_id=v_prev then 'PASA' else 'FALLA' end);

  -- ══ 3. articular → escalón 1 ═══════════════════════════════════════════
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt3','TESTRIEL_B','d1',1,current_date,true,'articular','nueva','se_fue','apenas','rodilla_izq');
  select escalon,estado into v_esc,v_est from gym_incidencias where gym_client_id='TESTRIEL_B';
  insert into pr values (3,'articular','escalón 1 / valoracion_pendiente',
    coalesce(v_esc::text,'sin incidencia')||' / '||coalesce(v_est,'—'),
    case when v_esc=1 and v_est='valoracion_pendiente' then 'PASA' else 'FALLA' end);

  -- ══ 4. nerviosa → escalón 3 + bandera, aunque la intensidad sea "apenas" ═
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt4','TESTRIEL_C','d1',1,current_date,true,'nerviosa','nueva','se_fue','apenas','lumbar');
  select escalon,bandera_activa into v_esc,v_band from gym_incidencias where gym_client_id='TESTRIEL_C';
  insert into pr values (4,'nerviosa con intensidad "apenas"','escalón 3 + bandera',
    'escalón '||coalesce(v_esc::text,'?')||', bandera '||coalesce(v_band::text,'?'),
    case when v_esc=3 and v_band then 'PASA' else 'FALLA' end);

  -- ══ 5. "tuve que parar" → escalón 3, banda severo ══════════════════════
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt5','TESTRIEL_D','d1',1,current_date,true,'muscular','nueva','se_fue','mucho','hombro_der');
  select escalon,banda into v_esc,v_est from gym_incidencias where gym_client_id='TESTRIEL_D';
  insert into pr values (5,'tuvo que parar','escalón 3 / banda severo',
    coalesce(v_esc::text,'sin incidencia')||' / '||coalesce(v_est,'—'),
    case when v_esc=3 and v_est='severo' then 'PASA' else 'FALLA' end);

  -- ══ 6. sigue al parar → escalón 1 ══════════════════════════════════════
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt6','TESTRIEL_E','d1',1,current_date,true,'muscular','nueva','sigue','apenas','cuello');
  select escalon into v_esc from gym_incidencias where gym_client_id='TESTRIEL_E';
  insert into pr values (6,'sigue al parar','escalón 1',
    coalesce(v_esc::text,'sin incidencia'),
    case when v_esc=1 then 'PASA' else 'FALLA' end);

  -- ══ 7. dolor previo a la sesión → escalón 1 (CRITERIO A RATIFICAR) ═════
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt7','TESTRIEL_F','d1',1,current_date,true,'muscular','previa','se_fue','apenas','dorsal');
  select escalon into v_esc from gym_incidencias where gym_client_id='TESTRIEL_F';
  insert into pr values (7,'dolor previo (a ratificar por Manu)','escalón 1',
    coalesce(v_esc::text,'sin incidencia'),
    case when v_esc=1 then 'PASA' else 'FALLA' end);

  -- ══ 8. línea de base igual al basal → NO dispara ═══════════════════════
  -- El caso de Raúl: lumbares "apenas", muscular, se va al parar, hace años.
  insert into gym_linea_base
    (id,gym_client_id,zona,naturaleza_basal,intensidad_basal,ahora_basal,autor,veredicto)
  values ('lbt1','TESTRIEL_G','lumbar','muscular','apenas','se_fue','prueba','basal de prueba');
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt8','TESTRIEL_G','d1',1,current_date,true,'muscular','previa','se_fue','apenas','lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_G';
  insert into pr values (8,'igual a la línea de base','0 incidencias (registra, no dispara)',
    v_cnt||' incidencia(s)',
    case when v_cnt=0 then 'PASA' else 'FALLA' end);

  -- ══ 9. línea de base + empeora la intensidad → sí dispara ══════════════
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt9','TESTRIEL_G','d2',1,current_date,true,'muscular','previa','se_fue','bastante','lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_G';
  select nota into v_nota from gym_incidencias where gym_client_id='TESTRIEL_G';
  insert into pr values (9,'peor que la línea de base','1 incidencia por cambio de patrón',
    v_cnt||' incidencia(s), motivo: '||coalesce(v_nota,'—'),
    case when v_cnt=1 and v_nota like '%linea de base%' then 'PASA' else 'FALLA' end);

  -- ══ 10. feedback sin naturaleza → NO dispara ═══════════════════════════
  -- La forma de los 256 registros que ya existen. Esto es lo que mantuvo la
  -- serie histórica fuera del riel y lo que hizo seguro aplicar la migración.
  insert into gym_sesion_feedback (id,gym_client_id,dia_id,semana,fecha,dolor,dolor_zona)
  values ('fbt10','TESTRIEL_H','d1',1,current_date,2,'lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_H';
  insert into pr values (10,'feedback sin naturaleza (los 256 viejos)','0 incidencias',
    v_cnt||' incidencia(s)',
    case when v_cnt=0 then 'PASA' else 'FALLA' end);

  -- ══ 11. molestia sin zona → NO dispara ═════════════════════════════════
  -- La regla de repetición es POR ZONA: un reporte sin zona no es ruteable.
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt11','TESTRIEL_I','d1',1,current_date,true,'articular','nueva','sigue','bastante','');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_I';
  insert into pr values (11,'molestia sin zona','0 incidencias (no es ruteable)',
    v_cnt||' incidencia(s)',
    case when v_cnt=0 then 'PASA' else 'FALLA' end);

  -- ── Limpieza: borra TODO lo que creó esta prueba ───────────────────────
  delete from gym_incidencias      where gym_client_id like 'TESTRIEL\_%';
  delete from gym_sesion_feedback  where gym_client_id like 'TESTRIEL\_%';
  delete from gym_linea_base       where gym_client_id like 'TESTRIEL\_%';
end $prueba$;

-- EL RESULTADO. Las 11 filas tienen que decir PASA.
select n, caso, esperado, obtenido, veredicto from pr
union all
select 99,
  '► RESUMEN',
  (select count(*)::text from pr where veredicto='PASA')||' de '||(select count(*)::text from pr)||' pasan',
  (select coalesce(string_agg('caso '||n, ', ' order by n),'ninguna') from pr where veredicto='FALLA')||' falla(n)',
  (select case when count(*)=0 then 'RUTEO CORRECTO' else 'CORREGIR ANTES DEL PORTAL' end
     from pr where veredicto='FALLA')
union all
select 100,
  '► DATOS',
  'prueba borrada, reales intactos',
  (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTRIEL\_%')||' de prueba · '||
  (select count(*) from gym_sesion_feedback)||' feedback real · '||
  (select count(*) from gym_incidencias)||' incidencias reales',
  case when (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTRIEL\_%')
          + (select count(*) from gym_incidencias where gym_client_id like 'TESTRIEL\_%')
          + (select count(*) from gym_linea_base where gym_client_id like 'TESTRIEL\_%') = 0
       then 'LIMPIO' else 'QUEDÓ BASURA' end
order by n;
