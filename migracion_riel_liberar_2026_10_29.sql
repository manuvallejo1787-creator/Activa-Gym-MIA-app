-- migracion_riel_liberar_2026_10_29.sql
--
-- QUÉ CIERRA
-- Los patrones bloqueados no se liberaban solos. Un escalón 0 queda sustituido
-- y sin progresar hasta las 4 sesiones ejecutadas sin reporte nuevo en esa
-- zona, y un escalonamiento declinado hasta las 8 — pero nadie contaba esas
-- sesiones, así que había que resolver cada bloqueo a mano desde la pantalla.
--
-- POR QUÉ EN SESIONES Y NO EN DÍAS
-- El calendario corre aunque el cliente no venga. Ocho sesiones limpias son
-- evidencia de que tolera la carga; treinta días de silencio pueden ser tres
-- semanas sin pisar el gimnasio. Es el mismo error que ya se corrigió en la
-- semana del portal, y la ventaja de contarlo así es que la regla se puede
-- decir en voz alta: premia entrenar, no callarse.
--
-- DÓNDE SE CUENTA "DESDE"
-- Desde `gym_incidencias.fecha`, que el disparador del feedback actualiza con
-- cada reporte nuevo de esa zona. Así el contador se reinicia solo cuando la
-- molestia reaparece, sin necesidad de guardar una fecha aparte.

-- ═══ 1. Vista del bloqueo — para que el umbral se pueda VER ════════════════
-- Sin esto el umbral sería invisible otra vez: el mismo error que tenía
-- gym_linea_base, que se escribía y nadie la leía. Un criterio que nadie
-- puede ver es un criterio que nadie va a entender cuando actúe.
create or replace view gym_incidencias_bloqueo as
select i.id,
       i.gym_client_id,
       i.zona,
       i.estado,
       coalesce(i.sesiones_umbral, 4) as umbral,
       (select count(distinct e.fecha)
          from ejecucion_registros e
         where e.gym_client_id = i.gym_client_id
           and e.fecha > i.fecha::date)              as sesiones_limpias,
       greatest(0, coalesce(i.sesiones_umbral, 4) -
         (select count(distinct e.fecha)
            from ejecucion_registros e
           where e.gym_client_id = i.gym_client_id
             and e.fecha > i.fecha::date))           as faltan
from gym_incidencias i
where i.estado in ('en_sala', 'declinada');

grant select on gym_incidencias_bloqueo to authenticated;

-- ═══ 2. Liberación automática al registrar una sesión ═════════════════════
create or replace function fn_liberar_patron() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare r record; v_ses int;
begin
  if new.fecha is null or coalesce(new.gym_client_id,'') = '' then return new; end if;

  -- Una sola vez por sesión, no una por ejercicio: hay 14,2 filas por sesión
  -- en promedio, así que sin esta guarda el bloque de abajo correría 14 veces
  -- para el mismo resultado.
  if exists (select 1 from ejecucion_registros e
              where e.gym_client_id = new.gym_client_id
                and e.fecha = new.fecha
                and e.id <> new.id) then
    return new;
  end if;

  for r in select * from gym_incidencias
            where gym_client_id = new.gym_client_id
              and estado in ('en_sala', 'declinada')
  loop
    select count(distinct e.fecha) into v_ses
      from ejecucion_registros e
     where e.gym_client_id = r.gym_client_id
       and e.fecha > r.fecha::date;

    if v_ses >= coalesce(r.sesiones_umbral, 4) then
      update gym_incidencias set
        estado = 'resuelta',
        resuelto = true,
        -- Queda dicho POR QUÉ se cerró. Una incidencia que aparece resuelta
        -- sin explicación es indistinguible de una que alguien cerró a mano
        -- para sacarla de la lista.
        resuelto_nota = 'Liberada automáticamente: ' || v_ses ||
                        ' sesiones ejecutadas sin reporte nuevo en ' ||
                        coalesce(nullif(r.zona, ''), 'esa zona') ||
                        ' (umbral ' || coalesce(r.sesiones_umbral, 4) || ').',
        historial = coalesce(historial, '[]'::jsonb) || jsonb_build_object(
                      'fecha', new.fecha, 'origen', 'automatico',
                      'motivo_codigo', 'liberada_por_sesiones',
                      'sesiones', v_ses, 'umbral', coalesce(r.sesiones_umbral, 4))
      where id = r.id;
    end if;
  end loop;
  return new;

-- Liberar un patrón no puede impedir que se registre una serie. Si esto falla,
-- el bloqueo sigue puesto —que es el lado seguro— y el entrenamiento se carga
-- igual. Perder la carga del cliente sería peor que no liberar el patrón.
exception when others then
  raise warning 'fn_liberar_patron falló (cliente %, fecha %): %',
    new.gym_client_id, new.fecha, sqlerrm;
  return new;
end $fn$;

drop trigger if exists tg_liberar_patron on ejecucion_registros;
create trigger tg_liberar_patron
  after insert on ejecucion_registros
  for each row execute function fn_liberar_patron();

notify pgrst, 'reload schema';

-- ═══ 3. Pruebas ════════════════════════════════════════════════════════════
create temp table pl (n int, caso text, esperado text, obtenido text, veredicto text);

do $p$
declare v_est text; v_cnt int; v_falt int; v_nota text;
begin
  delete from ejecucion_registros where gym_client_id like 'TESTLIB\_%';
  delete from gym_incidencias     where gym_client_id like 'TESTLIB\_%';

  -- Escalón 0 con umbral 4, abierta hace 10 días.
  insert into gym_incidencias (id,gym_client_id,fecha,estado,escalon,zona,sesiones_umbral,banda)
  values ('inc_lib_A','TESTLIB_A',current_date-10,'en_sala',0,'lumbar',4,'leve');

  -- 3 sesiones: todavía no alcanza.
  for v_cnt in 1..3 loop
    insert into ejecucion_registros (id,gym_client_id,fecha,ejercicio_id,semana)
    values ('er_A'||v_cnt,'TESTLIB_A',current_date-10+v_cnt,'ex1',1);
  end loop;
  select estado into v_est from gym_incidencias where id='inc_lib_A';
  select faltan into v_falt from gym_incidencias_bloqueo where id='inc_lib_A';
  insert into pl values (1,'escalón 0 con 3 de 4 sesiones','sigue en_sala, falta 1',
    v_est||', faltan '||coalesce(v_falt::text,'?'),
    case when v_est='en_sala' and v_falt=1 then 'PASA' else 'FALLA' end);

  -- La cuarta libera.
  insert into ejecucion_registros (id,gym_client_id,fecha,ejercicio_id,semana)
  values ('er_A4','TESTLIB_A',current_date-5,'ex1',1);
  select estado,resuelto_nota into v_est,v_nota from gym_incidencias where id='inc_lib_A';
  insert into pl values (2,'la 4a sesión libera','resuelta, con el motivo escrito',
    v_est||' · '||coalesce(left(v_nota,46),'sin nota'),
    case when v_est='resuelta' and v_nota like '%Liberada autom%' then 'PASA' else 'FALLA' end);

  -- Un declinado necesita 8, no 4.
  insert into gym_incidencias (id,gym_client_id,fecha,estado,escalon,zona,sesiones_umbral,banda)
  values ('inc_lib_B','TESTLIB_B',current_date-20,'declinada',0,'hombro_izq',8,'moderado');
  for v_cnt in 1..5 loop
    insert into ejecucion_registros (id,gym_client_id,fecha,ejercicio_id,semana)
    values ('er_B'||v_cnt,'TESTLIB_B',current_date-20+v_cnt,'ex1',1);
  end loop;
  select estado into v_est from gym_incidencias where id='inc_lib_B';
  select faltan into v_falt from gym_incidencias_bloqueo where id='inc_lib_B';
  insert into pl values (3,'declinada con 5 de 8','sigue declinada, faltan 3',
    v_est||', faltan '||coalesce(v_falt::text,'?'),
    case when v_est='declinada' and v_falt=3 then 'PASA' else 'FALLA' end);

  for v_cnt in 6..8 loop
    insert into ejecucion_registros (id,gym_client_id,fecha,ejercicio_id,semana)
    values ('er_B'||v_cnt,'TESTLIB_B',current_date-20+v_cnt,'ex1',1);
  end loop;
  select estado into v_est from gym_incidencias where id='inc_lib_B';
  insert into pl values (4,'la 8a libera la declinada','resuelta',
    v_est, case when v_est='resuelta' then 'PASA' else 'FALLA' end);

  -- Varias filas del MISMO día cuentan como una sola sesión.
  insert into gym_incidencias (id,gym_client_id,fecha,estado,escalon,zona,sesiones_umbral,banda)
  values ('inc_lib_C','TESTLIB_C',current_date-10,'en_sala',0,'rodilla_der',4,'leve');
  for v_cnt in 1..14 loop
    insert into ejecucion_registros (id,gym_client_id,fecha,ejercicio_id,semana)
    values ('er_C'||v_cnt,'TESTLIB_C',current_date-3,'ex'||v_cnt,1);
  end loop;
  select estado into v_est from gym_incidencias where id='inc_lib_C';
  select sesiones_limpias into v_cnt from gym_incidencias_bloqueo where id='inc_lib_C';
  insert into pl values (5,'14 ejercicios de un mismo día','1 sesión, sigue bloqueada',
    coalesce(v_cnt::text,'?')||' sesión(es), '||v_est,
    case when v_est='en_sala' and v_cnt=1 then 'PASA' else 'FALLA' end);

  -- Un estado que NO bloquea no se toca: una valoración pendiente no se
  -- libera por entrenar, se libera por veredicto.
  insert into gym_incidencias (id,gym_client_id,fecha,estado,escalon,zona,sesiones_umbral,banda)
  values ('inc_lib_D','TESTLIB_D',current_date-30,'valoracion_pendiente',1,'cuello',4,'moderado');
  for v_cnt in 1..10 loop
    insert into ejecucion_registros (id,gym_client_id,fecha,ejercicio_id,semana)
    values ('er_D'||v_cnt,'TESTLIB_D',current_date-30+v_cnt,'ex1',1);
  end loop;
  select estado into v_est from gym_incidencias where id='inc_lib_D';
  insert into pl values (6,'valoración pendiente con 10 sesiones','sigue pendiente: se libera por veredicto',
    v_est, case when v_est='valoracion_pendiente' then 'PASA' else 'FALLA' end);

  delete from ejecucion_registros where gym_client_id like 'TESTLIB\_%';
  delete from gym_incidencias     where gym_client_id like 'TESTLIB\_%';
end $p$;

select n, caso, esperado, obtenido, veredicto from pl
union all
select 99,'► RESUMEN',
  (select count(*)::text from pl where veredicto='PASA')||' de '||(select count(*)::text from pl)||' pasan',
  (select coalesce(string_agg('caso '||n,', ' order by n),'ninguna') from pl where veredicto='FALLA')||' falla(n)',
  (select case when count(*)=0 then 'CERRADO' else 'REVISAR' end from pl where veredicto='FALLA')
union all
select 100,'► DATOS','prueba borrada, reales intactos',
  (select count(*) from ejecucion_registros where gym_client_id like 'TESTLIB\_%')||' de prueba · '||
  (select count(*) from ejecucion_registros)||' registros reales · '||
  (select count(*) from gym_incidencias)||' incidencias reales',
  case when (select count(*) from ejecucion_registros where gym_client_id like 'TESTLIB\_%')
          + (select count(*) from gym_incidencias where gym_client_id like 'TESTLIB\_%') = 0
       then 'LIMPIO' else 'QUEDÓ BASURA' end
order by n;
