-- migracion_riel_update_2026_10_29.sql
--
-- EL AGUJERO QUE CIERRA
-- `api/portal.js` guarda el feedback con `on_conflict=id` y
-- `resolution=merge-duplicates`, y el id incluye día, semana y fecha. Eso
-- significa que si el cliente reenvía la misma sesión, PostgREST hace
-- INSERT ... ON CONFLICT DO UPDATE y la fila se actualiza en lugar de
-- insertarse. El disparador del riel es `after insert`, así que un UPDATE no
-- lo despierta.
--
-- El caso concreto: el cliente manda "no me molestó nada" (se inserta, el
-- riel sale de entrada porque no hay naturaleza), y después corrige para
-- agregar la molestia. Ese segundo envío es un UPDATE, y la molestia nunca se
-- rutea. El dato queda guardado y el riel no se entera — exactamente el
-- problema que esta función vino a resolver.
--
-- La idempotencia por cliente+zona que ya tiene la función protege contra el
-- doble disparo: si la incidencia ya existe, el reporte se suma al historial y
-- el escalón sólo puede subir.

drop trigger if exists tg_riel_desde_feedback on gym_sesion_feedback;

create trigger tg_riel_desde_feedback
  after insert or update of naturaleza, dolor_zona, intensidad, ahora, momento
  on gym_sesion_feedback
  for each row execute function fn_riel_desde_feedback();

notify pgrst, 'reload schema';

-- ═══ Prueba del caso que motivó esto ══════════════════════════════════════
create temp table pu (n int, caso text, esperado text, obtenido text, veredicto text);

do $p$
declare v_cnt int; v_esc smallint; v_cod text;
begin
  delete from gym_incidencias     where gym_client_id like 'TESTUPD\_%';
  delete from gym_sesion_feedback where gym_client_id like 'TESTUPD\_%';

  -- 1) Primer envío sin molestia: no dispara.
  insert into gym_sesion_feedback (id,gym_client_id,dia_id,semana,fecha,rpe_sesion,molestia)
  values ('fbu1','TESTUPD_A','d1',1,current_date,7,false);
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTUPD_A';
  insert into pu values (1,'envío sin molestia','0 incidencias',
    v_cnt||' incidencia(s)', case when v_cnt=0 then 'PASA' else 'FALLA' end);

  -- 2) El cliente corrige y agrega la molestia: ES UN UPDATE y tiene que disparar.
  update gym_sesion_feedback
     set molestia=true, naturaleza='articular', momento='nueva',
         ahora='sigue', intensidad='bastante', dolor_zona='rodilla_izq'
   where id='fbu1';
  select count(*),max(escalon),max(motivo_codigo) into v_cnt,v_esc,v_cod
    from gym_incidencias where gym_client_id='TESTUPD_A';
  insert into pu values (2,'corrige y agrega la molestia (UPDATE)','1 incidencia / escalón 1 / articular',
    v_cnt||' incidencia(s) / escalón '||coalesce(v_esc::text,'—')||' / '||coalesce(v_cod,'—'),
    case when v_cnt=1 and v_esc=1 and v_cod='articular' then 'PASA' else 'FALLA' end);

  -- 3) Reenvía lo mismo otra vez: no crea una segunda incidencia.
  update gym_sesion_feedback set intensidad='bastante' where id='fbu1';
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTUPD_A';
  insert into pu values (3,'reenvía igual (idempotencia en UPDATE)','sigue habiendo 1 incidencia',
    v_cnt||' incidencia(s)', case when v_cnt=1 then 'PASA' else 'FALLA' end);

  -- 4) Un UPDATE que no toca los campos del riel no lo despierta.
  --    Sin la lista `of ...` en el trigger, editar la nota dispararía de nuevo.
  update gym_sesion_feedback set nota='cambié la nota' where id='fbu1';
  select count(*) into v_cnt from gym_incidencias where gym_client_id='TESTUPD_A';
  insert into pu values (4,'edita sólo la nota','sigue habiendo 1 incidencia',
    v_cnt||' incidencia(s)', case when v_cnt=1 then 'PASA' else 'FALLA' end);

  delete from gym_incidencias     where gym_client_id like 'TESTUPD\_%';
  delete from gym_sesion_feedback where gym_client_id like 'TESTUPD\_%';
end $p$;

select n, caso, esperado, obtenido, veredicto from pu
union all
select 99, '► RESUMEN',
  (select count(*)::text from pu where veredicto='PASA')||' de '||(select count(*)::text from pu)||' pasan',
  (select coalesce(string_agg('caso '||n,', ' order by n),'ninguna') from pu where veredicto='FALLA')||' falla(n)',
  (select case when count(*)=0 then 'CERRADO' else 'REVISAR' end from pu where veredicto='FALLA')
union all
select 100, '► DATOS', 'prueba borrada, reales intactos',
  (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTUPD\_%')||' de prueba · '||
  (select count(*) from gym_sesion_feedback)||' feedback real · '||
  (select count(*) from gym_incidencias)||' incidencias reales',
  case when (select count(*) from gym_sesion_feedback where gym_client_id like 'TESTUPD\_%')
          + (select count(*) from gym_incidencias where gym_client_id like 'TESTUPD\_%') = 0
       then 'LIMPIO' else 'QUEDÓ BASURA' end
order by n;
