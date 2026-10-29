-- migracion_riel_motivo_codigo_2026_10_29.sql
--
-- Correr TODO de una vez. Hace tres cosas y devuelve una tabla con el
-- resultado de las once pruebas al final.
--
-- POR QUÉ
-- La prueba del riel verificaba el motivo buscando texto dentro de la prosa
-- (`nota like '%linea de base%'`). Falló por una tilde: el mensaje real dice
-- "línea" y la aserción buscaba "linea". El ruteo estaba bien, la prueba
-- estaba mal.
--
-- El problema de fondo no son las tildes: es verificar contra prosa. El motivo
-- es texto para que lo lea una persona, así que la prueba quedaba acoplada a
-- la redacción — cambiar una palabra del mensaje rompía la prueba sin que nada
-- estuviera mal. Y una prosa libre no se puede agregar: no hay forma de contar
-- cuántas incidencias dispararon por cada razón, que es el dato que hace falta
-- para calibrar el riel.
--
-- Ahora hay dos campos: `nota` sigue siendo la prosa que se le muestra a quien
-- atiende, y `motivo_codigo` es el código estable en snake_case sin acentos
-- contra el que se verifica y se agrega.

-- ═══ 1. La columna nueva ═══════════════════════════════════════════════════
alter table gym_incidencias
  add column if not exists motivo_codigo text;

comment on column gym_incidencias.motivo_codigo is
  'Código estable del motivo de disparo, para verificar y agregar: linea_base_cambio | nerviosa | paro_sesion | articular | sigue_al_parar | dolor_previo | repite_7d | primera_muscular. La prosa va en `nota`.';

-- ═══ 2. La función, que ahora escribe el código ════════════════════════════
create or replace function fn_riel_desde_feedback() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_esc     smallint;
  v_motivo  text;
  v_cod     text;
  v_base    gym_linea_base;
  v_previos int;
  v_inc     gym_incidencias;
  v_nid     text;
  ord_int   text[] := array['apenas','bastante','mucho'];
  ord_nat   text[] := array['muscular','articular','nerviosa'];
begin
  -- Sin naturaleza no hay criterio y sin zona no hay a qué rutear: la regla de
  -- repetición es POR ZONA. Esto mantiene a los 256 registros viejos afuera.
  if new.naturaleza is null or coalesce(new.dolor_zona,'') = '' then
    return new;
  end if;

  -- Línea de base: silencia, salvo que el patrón empeore.
  select * into v_base from gym_linea_base
   where gym_client_id = new.gym_client_id and zona = new.dolor_zona and activa;
  if found then
    if not (
         array_position(ord_int, new.intensidad) > array_position(ord_int, v_base.intensidad_basal)
      or array_position(ord_nat, new.naturaleza) > array_position(ord_nat, v_base.naturaleza_basal)
      or (new.ahora = 'sigue' and v_base.ahora_basal = 'se_fue')
      or v_base.revision_vence < current_date
    ) then
      return new;
    end if;
    v_motivo := 'cambió el patrón sobre una línea de base conocida';
    v_cod    := 'linea_base_cambio';
  end if;

  if new.naturaleza = 'nerviosa' then
    v_esc := 3;
    v_motivo := coalesce(v_motivo, 'naturaleza nerviosa: no espera el segundo reporte');
    v_cod    := coalesce(v_cod, 'nerviosa');
  elsif new.intensidad = 'mucho' then
    v_esc := 3;
    v_motivo := coalesce(v_motivo, 'tuvo que parar la sesión');
    v_cod    := coalesce(v_cod, 'paro_sesion');
  elsif new.naturaleza = 'articular' then
    v_esc := 1;
    v_motivo := coalesce(v_motivo, 'molestia articular');
    v_cod    := coalesce(v_cod, 'articular');
  elsif new.ahora = 'sigue' then
    v_esc := 1;
    v_motivo := coalesce(v_motivo, 'la molestia no se fue al parar');
    v_cod    := coalesce(v_cod, 'sigue_al_parar');
  elsif new.momento = 'previa' then
    -- CRITERIO A RATIFICAR: un dolor traído de afuera no lo causó el
    -- entrenamiento, pero el entrenamiento lo está cargando.
    v_esc := 1;
    v_motivo := coalesce(v_motivo, 'dolor previo a la sesión, cargado bajo entrenamiento');
    v_cod    := coalesce(v_cod, 'dolor_previo');
  else
    -- Misma ZONA (no mismo ejercicio), 7 días corridos, dos SESIONES distintas.
    select count(*) into v_previos from gym_sesion_feedback f
     where f.gym_client_id = new.gym_client_id
       and f.dolor_zona    = new.dolor_zona
       and f.naturaleza is not null
       and f.id <> new.id
       and f.fecha >= new.fecha - 7
       and f.fecha <  new.fecha;
    if v_previos >= 1 then
      v_esc := 1;
      v_motivo := coalesce(v_motivo, '2 reportes en la misma zona en 7 días');
      v_cod    := coalesce(v_cod, 'repite_7d');
    else
      v_esc := 0;
      v_motivo := coalesce(v_motivo, 'primera molestia muscular en esa zona');
      v_cod    := coalesce(v_cod, 'primera_muscular');
    end if;
  end if;

  -- Idempotencia por cliente+zona: el escalón sólo sube. Sin esto un crónico
  -- genera una incidencia por semana y el riel se vuelve ruido.
  select * into v_inc from gym_incidencias
   where gym_client_id = new.gym_client_id
     and zona = new.dolor_zona
     and coalesce(estado,'abierta') <> 'resuelta'
   order by fecha desc limit 1;

  if found then
    update gym_incidencias set
      escalon       = greatest(coalesce(escalon,0), v_esc),
      fecha         = now(),
      -- El motivo se actualiza sólo si el escalón sube: si no, el de la
      -- incidencia sigue siendo el que la abrió.
      motivo_codigo = case when v_esc > coalesce(escalon,0) then v_cod else motivo_codigo end,
      nota          = case when v_esc > coalesce(escalon,0) then v_motivo else nota end,
      historial     = coalesce(historial,'[]'::jsonb) || jsonb_build_object(
                        'fecha', new.fecha, 'origen', 'feedback',
                        'motivo', v_motivo, 'motivo_codigo', v_cod,
                        'naturaleza', new.naturaleza, 'momento', new.momento,
                        'ahora', new.ahora, 'intensidad', new.intensidad),
      sesiones_umbral = case when coalesce(estado,'') = 'declinada' then 8 else 4 end
    where id = v_inc.id;
    return new;
  end if;

  v_nid := 'inc_' || to_char(now(),'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text),1,5);

  insert into gym_incidencias (
    id, gym_client_id, fecha, reportado_por, origen, escalon, zona,
    naturaleza, momento, ahora, estado, sesiones_umbral,
    banda, eva, bandera_activa, ejercicio_nombre, nota, motivo_codigo, historial
  ) values (
    v_nid, new.gym_client_id, now(), 'portal', 'feedback', v_esc, new.dolor_zona,
    new.naturaleza, new.momento, new.ahora,
    case v_esc when 3 then 'abierta' when 1 then 'valoracion_pendiente' else 'en_sala' end,
    4,
    case new.intensidad when 'mucho' then 'severo' when 'bastante' then 'moderado' else 'leve' end,
    case new.intensidad when 'mucho' then 8        when 'bastante' then 5          else 2      end,
    new.naturaleza = 'nerviosa',
    coalesce(new.dolor_ejercicio,''),
    v_motivo, v_cod,
    jsonb_build_array(jsonb_build_object(
      'fecha', new.fecha, 'origen', 'feedback',
      'motivo', v_motivo, 'motivo_codigo', v_cod,
      'naturaleza', new.naturaleza, 'momento', new.momento,
      'ahora', new.ahora, 'intensidad', new.intensidad))
  );
  return new;

-- EL RIEL NO PUEDE BLOQUEAR EL CAMINO PRINCIPAL DEL DATO. Un trigger que falla
-- aborta el INSERT: un bug acá le impediría al cliente guardar su feedback, y
-- perder el reporte es peor que no rutearlo.
exception when others then
  raise warning 'fn_riel_desde_feedback falló (feedback %, cliente %): %',
    new.id, new.gym_client_id, sqlerrm;
  return new;
end $fn$;

notify pgrst, 'reload schema';

-- ═══ 3. Las once pruebas, verificando contra el CÓDIGO ═════════════════════
create temp table pr (n int, caso text, esperado text, obtenido text, veredicto text);

do $prueba$
declare
  v_esc smallint; v_est text; v_band boolean; v_cnt int; v_id text; v_prev text; v_cod text;
begin
  delete from gym_incidencias      where gym_client_id like 'TESTRIEL\_%';
  delete from gym_sesion_feedback  where gym_client_id like 'TESTRIEL\_%';
  delete from gym_linea_base       where gym_client_id like 'TESTRIEL\_%';

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt1','TESTRIEL_A','d1',1,current_date-3,true,'muscular','nueva','se_fue','apenas','lumbar');
  select escalon,estado,motivo_codigo into v_esc,v_est,v_cod from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into pr values (1,'muscular, se fue, 1a vez','0 / en_sala / primera_muscular',
    coalesce(v_esc::text,'—')||' / '||coalesce(v_est,'—')||' / '||coalesce(v_cod,'—'),
    case when v_esc=0 and v_est='en_sala' and v_cod='primera_muscular' then 'PASA' else 'FALLA' end);

  select id into v_prev from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt2','TESTRIEL_A','d2',1,current_date,true,'muscular','nueva','se_fue','apenas','lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_A';
  select escalon,id,motivo_codigo into v_esc,v_id,v_cod from gym_incidencias where gym_client_id='TESTRIEL_A';
  insert into pr values (2,'repite en 7 días (idempotencia)','1 incidencia / escalón 1 / repite_7d / mismo id',
    v_cnt||' incidencia(s) / escalón '||coalesce(v_esc::text,'—')||' / '||coalesce(v_cod,'—')||' / mismo id: '||coalesce((v_id=v_prev)::text,'—'),
    case when v_cnt=1 and v_esc=1 and v_cod='repite_7d' and v_id=v_prev then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt3','TESTRIEL_B','d1',1,current_date,true,'articular','nueva','se_fue','apenas','rodilla_izq');
  select escalon,estado,motivo_codigo into v_esc,v_est,v_cod from gym_incidencias where gym_client_id='TESTRIEL_B';
  insert into pr values (3,'articular','1 / valoracion_pendiente / articular',
    coalesce(v_esc::text,'—')||' / '||coalesce(v_est,'—')||' / '||coalesce(v_cod,'—'),
    case when v_esc=1 and v_est='valoracion_pendiente' and v_cod='articular' then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt4','TESTRIEL_C','d1',1,current_date,true,'nerviosa','nueva','se_fue','apenas','lumbar');
  select escalon,bandera_activa,motivo_codigo into v_esc,v_band,v_cod from gym_incidencias where gym_client_id='TESTRIEL_C';
  insert into pr values (4,'nerviosa con intensidad "apenas"','3 / bandera true / nerviosa',
    coalesce(v_esc::text,'—')||' / bandera '||coalesce(v_band::text,'—')||' / '||coalesce(v_cod,'—'),
    case when v_esc=3 and v_band and v_cod='nerviosa' then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt5','TESTRIEL_D','d1',1,current_date,true,'muscular','nueva','se_fue','mucho','hombro_der');
  select escalon,banda,motivo_codigo into v_esc,v_est,v_cod from gym_incidencias where gym_client_id='TESTRIEL_D';
  insert into pr values (5,'tuvo que parar','3 / severo / paro_sesion',
    coalesce(v_esc::text,'—')||' / '||coalesce(v_est,'—')||' / '||coalesce(v_cod,'—'),
    case when v_esc=3 and v_est='severo' and v_cod='paro_sesion' then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt6','TESTRIEL_E','d1',1,current_date,true,'muscular','nueva','sigue','apenas','cuello');
  select escalon,motivo_codigo into v_esc,v_cod from gym_incidencias where gym_client_id='TESTRIEL_E';
  insert into pr values (6,'sigue al parar','1 / sigue_al_parar',
    coalesce(v_esc::text,'—')||' / '||coalesce(v_cod,'—'),
    case when v_esc=1 and v_cod='sigue_al_parar' then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt7','TESTRIEL_F','d1',1,current_date,true,'muscular','previa','se_fue','apenas','dorsal');
  select escalon,motivo_codigo into v_esc,v_cod from gym_incidencias where gym_client_id='TESTRIEL_F';
  insert into pr values (7,'dolor previo (a ratificar por Manu)','1 / dolor_previo',
    coalesce(v_esc::text,'—')||' / '||coalesce(v_cod,'—'),
    case when v_esc=1 and v_cod='dolor_previo' then 'PASA' else 'FALLA' end);

  insert into gym_linea_base
    (id,gym_client_id,zona,naturaleza_basal,intensidad_basal,ahora_basal,autor,veredicto)
  values ('lbt1','TESTRIEL_G','lumbar','muscular','apenas','se_fue','prueba','basal de prueba');
  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt8','TESTRIEL_G','d1',1,current_date,true,'muscular','previa','se_fue','apenas','lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_G';
  insert into pr values (8,'igual a la línea de base','0 incidencias (registra, no dispara)',
    v_cnt||' incidencia(s)', case when v_cnt=0 then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt9','TESTRIEL_G','d2',1,current_date,true,'muscular','previa','se_fue','bastante','lumbar');
  select count(*),max(motivo_codigo) into v_cnt,v_cod from gym_incidencias where gym_client_id='TESTRIEL_G';
  insert into pr values (9,'peor que la línea de base','1 incidencia / linea_base_cambio',
    v_cnt||' incidencia(s) / '||coalesce(v_cod,'—'),
    case when v_cnt=1 and v_cod='linea_base_cambio' then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback (id,gym_client_id,dia_id,semana,fecha,dolor,dolor_zona)
  values ('fbt10','TESTRIEL_H','d1',1,current_date,2,'lumbar');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_H';
  insert into pr values (10,'feedback sin naturaleza (los 256 viejos)','0 incidencias',
    v_cnt||' incidencia(s)', case when v_cnt=0 then 'PASA' else 'FALLA' end);

  insert into gym_sesion_feedback
    (id,gym_client_id,dia_id,semana,fecha,molestia,naturaleza,momento,ahora,intensidad,dolor_zona)
  values ('fbt11','TESTRIEL_I','d1',1,current_date,true,'articular','nueva','sigue','bastante','');
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTRIEL_I';
  insert into pr values (11,'molestia sin zona','0 incidencias (no es ruteable)',
    v_cnt||' incidencia(s)', case when v_cnt=0 then 'PASA' else 'FALLA' end);

  delete from gym_incidencias      where gym_client_id like 'TESTRIEL\_%';
  delete from gym_sesion_feedback  where gym_client_id like 'TESTRIEL\_%';
  delete from gym_linea_base       where gym_client_id like 'TESTRIEL\_%';
end $prueba$;

select n, caso, esperado, obtenido, veredicto from pr
union all
select 99, '► RESUMEN',
  (select count(*)::text from pr where veredicto='PASA')||' de '||(select count(*)::text from pr)||' pasan',
  (select coalesce(string_agg('caso '||n, ', ' order by n),'ninguna') from pr where veredicto='FALLA')||' falla(n)',
  (select case when count(*)=0 then 'RUTEO CORRECTO' else 'CORREGIR ANTES DEL PORTAL' end from pr where veredicto='FALLA')
union all
select 100, '► DATOS', 'prueba borrada, reales intactos',
  (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTRIEL\_%')||' de prueba · '||
  (select count(*) from gym_sesion_feedback)||' feedback real · '||
  (select count(*) from gym_incidencias)||' incidencias reales',
  case when (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTRIEL\_%')
          + (select count(*) from gym_incidencias     where gym_client_id like 'TESTRIEL\_%')
          + (select count(*) from gym_linea_base      where gym_client_id like 'TESTRIEL\_%') = 0
       then 'LIMPIO' else 'QUEDÓ BASURA' end
order by n;
