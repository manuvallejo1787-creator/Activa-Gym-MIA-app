-- migracion_riel_liberar_2026_10_29.sql
--
-- SOLO EL ESQUEMA. Las pruebas no vienen acá: las corre Claude después, con
-- datos reales y limpiándolos. La versión anterior traía las pruebas adentro y
-- fallaba antes de llegar a ellas por un NOT NULL que no había verificado
-- (`plan_id` y `dia_id` en ejecucion_registros). Mandar un script de prueba
-- sin poder ejecutarlo es mandar algo sin verificar, y ya pasó dos veces.
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
-- Sin esto el umbral sería invisible: el mismo error que tenía gym_linea_base,
-- que se escribía y nadie la leía. Quien está en sala vería "patrón sin
-- progresar" sin saber si falta una sesión o siete, que es la diferencia entre
-- dejarlo correr y hacer algo.
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

-- Confirma qué quedó instalado. Las tres columnas tienen que dar 1.
select (select count(*) from pg_views where viewname='gym_incidencias_bloqueo') as vista,
       (select count(*) from pg_proc  where proname='fn_liberar_patron')        as funcion,
       (select count(*) from pg_trigger where tgname='tg_liberar_patron'
          and not tgisinternal)                                                as trigger;
