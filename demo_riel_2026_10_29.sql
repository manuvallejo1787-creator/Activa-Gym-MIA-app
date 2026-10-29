-- demo_riel_2026_10_29.sql — para poder VER la pantalla nueva del riel
--
-- POR QUÉ HACE FALTA
-- La pestaña Hoy no muestra nada nuevo porque todavía no hay ninguna molestia
-- reportada con el formulario nuevo: hay 0 incidencias con los estados nuevos.
-- No se puede evaluar una pantalla sin datos, y esperar a que un socio reporte
-- una molestia real para recién entonces descubrir si la pantalla sirve es
-- exactamente el orden equivocado.
--
-- Esto crea UN CLIENTE DE PRUEBA con cuatro incidencias, una por escalón, para
-- que la tarjeta de sala se pueda mirar con todos los casos a la vez. No toca
-- ningún cliente real.
--
-- CÓMO USARLO
--   1. Correr este archivo.
--   2. En la app, pestaña Hoy, agregar a sala el cliente "ZZ Demo Riel".
--      Ahí se ven los cuatro escalones, la línea de base con revisión vencida,
--      y los botones que cambian según el estado.
--   3. Probar los botones: declinar pide motivo, valoración hecha pide
--      veredicto, crónico conocido pide el criterio y confirma.
--   4. Cuando termines, correr el bloque de LIMPIEZA del final.
--
-- EL CLIENTE VA ACTIVO, Y NO ES UN DESCUIDO.
-- La primera versión lo creaba con activo=false para que no ensuciara listados
-- ni métricas. Pero el buscador de sala filtra `c.activo !== false`, así que
-- quedaba imposible de encontrar: el cliente existía, las cuatro incidencias
-- existían, y no había forma de agregarlo a sala para verlas.
-- Va activo y se borra al terminar, que es lo que el bloque de limpieza hace.
insert into gym_clients (id, nombre, apellido, nivel, semaforo, activo, fecha_ingreso, screening_completo)
values ('cli_DEMO_RIEL', 'ZZ Demo', 'Riel', 'activa', 'verde', true, current_date, false)
on conflict (id) do update set activo = true;

delete from gym_incidencias where gym_client_id = 'cli_DEMO_RIEL';
delete from gym_linea_base  where gym_client_id = 'cli_DEMO_RIEL';

-- Escalón 0 — ajuste en sala. Patrón sustituido, sin progresar.
insert into gym_incidencias
  (id, gym_client_id, cliente_nombre, fecha, reportado_por, origen, escalon, zona,
   naturaleza, momento, ahora, estado, sesiones_umbral, banda, eva, bandera_activa,
   ejercicio_nombre, sustituto_nombre, nota, motivo_codigo)
values
  ('inc_DEMO_0', 'cli_DEMO_RIEL', 'ZZ Demo Riel', now() - interval '2 days', 'portal', 'feedback', 0,
   'rodilla_der', 'muscular', 'nueva', 'se_fue', 'en_sala', 4, 'leve', 2, false,
   'Sentadilla trasera con barra', 'Sentadilla al cajon',
   'primera molestia muscular en esa zona', 'primera_muscular'),

-- Escalón 1 — valoración pendiente. El estado que antes no existía.
-- Desde acá los botones NO ofrecen "resuelta": o se hizo, o la declinó, o se deriva.
  ('inc_DEMO_1', 'cli_DEMO_RIEL', 'ZZ Demo Riel', now() - interval '1 day', 'portal', 'feedback', 1,
   'lumbar', 'articular', 'nueva', 'sigue', 'valoracion_pendiente', 4, 'moderado', 5, false,
   'Peso muerto convencional', '',
   'molestia articular', 'articular'),

-- Escalón 1 declinado — se propuso y dijo que no. BLOQUEA el patrón sin vencimiento
-- por calendario: se libera a las 8 sesiones ejecutadas sin reporte nuevo.
  ('inc_DEMO_1D', 'cli_DEMO_RIEL', 'ZZ Demo Riel', now() - interval '6 days', 'sala', 'sala', 0,
   'hombro_izq', 'articular', 'previa', 'sigue', 'declinada', 8, 'moderado', 5, false,
   'Press militar con barra', '',
   'molestia articular', 'articular'),

-- Escalón 3 — nerviosa, entra sin esperar el segundo reporte y con intensidad baja.
  ('inc_DEMO_3', 'cli_DEMO_RIEL', 'ZZ Demo Riel', now() - interval '3 hours', 'portal', 'feedback', 3,
   'cuello', 'nerviosa', 'nueva', 'sigue', 'abierta', 4, 'leve', 2, true,
   'Jalon al pecho', '',
   'naturaleza nerviosa: no espera el segundo reporte', 'nerviosa');

update gym_incidencias
   set declinada_motivo = 'no puede costear la valoracion ahora',
       declinada_el = current_date - 6
 where id = 'inc_DEMO_1D';

-- Línea de base con la REVISIÓN YA VENCIDA, para ver la marca en rojo.
-- Es el caso de un crónico que quedó marcado hace más de 90 días y nadie
-- volvió a mirar: justo lo que la fecha de revisión existe para evitar.
insert into gym_linea_base
  (id, gym_client_id, zona, naturaleza_basal, intensidad_basal, ahora_basal,
   desde, revision_vence, autor, veredicto, activa)
values
  ('lb_DEMO_1', 'cli_DEMO_RIEL', 'dorsal', 'muscular', 'apenas', 'se_fue',
   current_date - 200, current_date - 12, 'demo',
   'Contractura dorsal de anos, sin banderas. Se descarto componente articular y neural. Tolera carga.', true),
  ('lb_DEMO_2', 'cli_DEMO_RIEL', 'tobillo_izq', 'muscular', 'apenas', 'se_fue',
   current_date - 30, current_date + 60, 'demo',
   'Rigidez matinal conocida, sin perdida de rango. Revalorar con el screening.', true);

notify pgrst, 'reload schema';

select 'Listo. En la app, pestaña Hoy, agregá a sala el cliente "ZZ Demo Riel".' as paso_1,
       (select count(*) from gym_incidencias where gym_client_id='cli_DEMO_RIEL') as incidencias_demo,
       (select count(*) from gym_linea_base  where gym_client_id='cli_DEMO_RIEL') as lineas_base_demo;

-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPIEZA — correr esto cuando termines de mirar
-- ═══════════════════════════════════════════════════════════════════════════
-- delete from gym_incidencias where gym_client_id = 'cli_DEMO_RIEL';
-- delete from gym_linea_base  where gym_client_id = 'cli_DEMO_RIEL';
-- delete from gym_clients     where id = 'cli_DEMO_RIEL';
-- select 'limpio' as estado,
--        (select count(*) from gym_incidencias) as incidencias_reales,
--        (select count(*) from gym_clients)     as clientes_reales;
