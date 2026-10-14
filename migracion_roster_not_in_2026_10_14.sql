-- migracion_roster_not_in_2026_10_14.sql   ·   v2
--
-- Arregla asistencia_import_roster(). Se encontró revisando el advisor de
-- seguridad de Supabase después de aplicar la migración de salud.
--
-- CORRER TAL CUAL. Entra con `create or replace`, sin DROP.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ ESTA ES LA v2
--
-- La v1 cambiaba el retorno de `integer` a `jsonb` para poder informar
-- cuántas filas se borraron y cuántos elementos se descartaron. Postgres la
-- rechazó con "cannot change return type of existing function" y pedía un
-- DROP previo.
--
-- Se descartó ese camino. El DROP + recreate cambia el contrato con
-- Gestión-Activa, que consume esta función por /rest/v1/rpc: si ese lado lee
-- el entero, el import se rompe desde allá sin que esta base avise. El valor
-- del jsonb era diagnóstico, no el arreglo. No vale una rotura entre sistemas.
--
-- Esta versión mantiene `returns integer` y el mismo valor de siempre
-- (el row_count del INSERT), y manda las diagnósticas por `raise warning`,
-- que aparecen en el editor SQL y en los logs sin tocar el contrato.
-- ─────────────────────────────────────────────────────────────────────────
--
-- EL BUG: `not in` con un NULL adentro
--
-- El DELETE actual es:
--   delete from asistencia_roster_manual
--    where cliente_gestion_id not in
--      (select (x->>'id')::bigint from jsonb_array_elements(p_roster) x);
--
-- Si UN elemento del roster no trae `id`, `(x->>'id')::bigint` da NULL, y en
-- SQL `valor NOT IN (1, 2, NULL)` no es `false`: es NULL. Como NULL no es
-- true, el DELETE no borra NINGUNA fila. Los clientes dados de baja en
-- Gestión quedan para siempre en el roster manual de asistencias, y la
-- función informa éxito igual porque devuelve el row_count del INSERT.
--
-- Verificado contra esta base, sobre tres filas (1, 2, 3):
--   [{"id":1},{"id":2}]              -> borra 1 fila   (correcto)
--   [{"id":1},{"nombre":"Sin id"}]   -> borra 0 filas  (debería borrar 2)
--   []                               -> borra las 3    (borrado total)
--
-- El INSERT tenía el mismo descuido: tampoco filtraba los elementos sin
-- `id`, así que intentaba meter NULL en cliente_gestion_id, y un `id` no
-- numérico hacía fallar el cast y abortaba la sincronización entera.
--
-- QUÉ CAMBIA
--   1) `not exists` en lugar de `not in`: inmune a los NULL.
--   2) Se aborta si el roster no trae ningún id válido, para que un payload
--      vacío o mal formado no borre la tabla completa.
--   3) Se filtran los elementos sin id numérico en el DELETE y en el INSERT.
--   4) `raise warning` cuando se descarta algún elemento o cuando se borran
--      filas, para que la sincronización deje rastro.
--
-- QUÉ NO CAMBIA
--   · El tipo de retorno y el valor devuelto: `integer` = filas insertadas o
--     actualizadas, igual que antes.
--   · La validación del token y `SET search_path TO 'public'`: están bien.
--   · Las advertencias del advisor sobre que `anon` puede ejecutar esta
--     función y asistencia_export son esperables — son endpoints de
--     sincronización con Gestión-Activa, abiertos a propósito y protegidos
--     por el secreto de sync_secretos. Revisado también sync_secretos, que
--     tiene RLS sin políticas: correcto, no se lee desde el frontend y solo
--     la alcanza el service role a través de estas funciones.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.asistencia_import_roster(p_token text, p_roster jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n             integer;
  n_borrados    integer;
  n_validos     integer;
  n_descartados integer;
begin
  if p_token is null or p_token <> (select valor from sync_secretos where clave = 'gestion') then
    raise exception 'token inválido';
  end if;

  if p_roster is null or jsonb_typeof(p_roster) <> 'array' then
    raise exception 'p_roster tiene que ser un array JSON';
  end if;

  -- Solo se consideran válidos los elementos con un id entero.
  select count(*) filter (where x->>'id' ~ '^[0-9]+$'),
         count(*) filter (where x->>'id' is null or x->>'id' !~ '^[0-9]+$')
    into n_validos, n_descartados
  from jsonb_array_elements(p_roster) x;

  -- Sin esta guarda, un payload vacío o enteramente mal formado borraba el
  -- roster completo y la función devolvía 0 como si no hubiera pasado nada.
  if n_validos = 0 then
    raise exception 'el roster no trae ningún id válido (% elementos descartados): se aborta para no borrar la tabla entera', n_descartados;
  end if;

  if n_descartados > 0 then
    raise warning 'asistencia_import_roster: % de % elementos descartados por no tener id numérico. Revisar el payload de Gestión-Activa.',
      n_descartados, n_validos + n_descartados;
  end if;

  -- `not exists` en lugar de `not in`: un NULL en la subconsulta ya no anula
  -- la condición para todas las filas.
  delete from asistencia_roster_manual a
  where not exists (
    select 1 from jsonb_array_elements(p_roster) x
    where x->>'id' ~ '^[0-9]+$'
      and (x->>'id')::bigint = a.cliente_gestion_id);
  get diagnostics n_borrados = row_count;

  if n_borrados > 0 then
    raise warning 'asistencia_import_roster: % filas borradas del roster (clientes que ya no vienen de Gestión).', n_borrados;
  end if;

  insert into asistencia_roster_manual (cliente_gestion_id, nombre, plan, celular, actualizado)
  select (x->>'id')::bigint, x->>'nombre', x->>'plan', x->>'celular', now()
  from jsonb_array_elements(p_roster) x
  where x->>'id' ~ '^[0-9]+$'
  on conflict (cliente_gestion_id) do update
    set nombre = excluded.nombre, plan = excluded.plan,
        celular = excluded.celular, actualizado = now();
  get diagnostics n = row_count;

  -- Mismo valor que la versión anterior: filas insertadas o actualizadas.
  return n;
end $function$;


-- ═════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN 1 — el tipo de retorno quedó intacto
-- Tiene que decir: integer
-- ═════════════════════════════════════════════════════════════════════════
select p.proname as funcion,
       pg_get_function_result(p.oid) as tipo_de_retorno,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname = 'asistencia_import_roster';


-- ═════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN 2 — la lógica del DELETE
-- `borra_ahora` tiene que coincidir con `esperado` en las tres filas.
-- `borraba_antes` muestra el bug: 0 en el caso del elemento sin id.
-- ═════════════════════════════════════════════════════════════════════════
with filas(cliente_gestion_id) as (values (1::bigint),(2::bigint),(3::bigint)),
casos(caso, roster, esperado) as (values
  ('roster normal [{1},{2}]',      '[{"id":1},{"id":2}]'::jsonb,            1),
  ('un elemento sin id',           '[{"id":1},{"nombre":"Sin id"}]'::jsonb, 2),
  ('roster completo [{1},{2},{3}]','[{"id":1},{"id":2},{"id":3}]'::jsonb,   0)
)
select caso, esperado,
  (select count(*) from filas a where not exists (
     select 1 from jsonb_array_elements(roster) x
     where x->>'id' ~ '^[0-9]+$' and (x->>'id')::bigint = a.cliente_gestion_id)) as borra_ahora,
  (select count(*) from filas a where a.cliente_gestion_id not in (
     select (x->>'id')::bigint from jsonb_array_elements(roster) x)) as borraba_antes
from casos;
