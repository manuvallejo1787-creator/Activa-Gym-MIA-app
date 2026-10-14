-- migracion_roster_not_in_2026_10_14.sql
--
-- Arregla asistencia_import_roster(). Se encontró revisando el advisor de
-- seguridad de Supabase después de aplicar la migración de salud.
--
-- ─────────────────────────────────────────────────────────────────────────
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
-- Gestión quedan para siempre en el roster manual de asistencias.
--
-- Verificado con una consulta de prueba sobre tres filas (1, 2, 3):
--   [{"id":1},{"id":2}]              -> borra 1 fila   (correcto)
--   [{"id":1},{"nombre":"Sin id"}]   -> borra 0 filas  (debería borrar 2)
--   []                               -> borra las 3    (borrado total)
--
-- El segundo caso falla en silencio: la función devuelve el row_count del
-- INSERT, así que informa éxito igual.
--
-- Hay un segundo problema en el INSERT: tampoco filtra los elementos sin
-- `id`, así que intenta insertar NULL en cliente_gestion_id, y un `id` no
-- numérico hace fallar el cast y aborta la sincronización entera.
--
-- QUÉ CAMBIA
--   1) `not exists` en lugar de `not in`: inmune a los NULL.
--   2) Se aborta si el roster no trae ningún id válido, para que un payload
--      vacío o mal formado no borre la tabla completa.
--   3) Se filtran los elementos sin id numérico en el DELETE y en el INSERT,
--      y se informa cuántos se descartaron en vez de ignorarlos.
--
-- QUÉ NO CAMBIA
--   La validación del token y `SET search_path TO 'public'` quedan igual:
--   están bien. Las advertencias del advisor sobre estas funciones son
--   esperables — son endpoints de sincronización con Gestión-Activa, abiertos
--   a anon a propósito y protegidos por el secreto de sync_secretos.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.asistencia_import_roster(p_token text, p_roster jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_sincronizados integer;
  n_borrados      integer;
  n_validos       integer;
  n_descartados   integer;
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

  -- `not exists` en lugar de `not in`: un NULL en la subconsulta ya no anula
  -- la condición para todas las filas.
  delete from asistencia_roster_manual a
  where not exists (
    select 1 from jsonb_array_elements(p_roster) x
    where x->>'id' ~ '^[0-9]+$'
      and (x->>'id')::bigint = a.cliente_gestion_id);
  get diagnostics n_borrados = row_count;

  insert into asistencia_roster_manual (cliente_gestion_id, nombre, plan, celular, actualizado)
  select (x->>'id')::bigint, x->>'nombre', x->>'plan', x->>'celular', now()
  from jsonb_array_elements(p_roster) x
  where x->>'id' ~ '^[0-9]+$'
  on conflict (cliente_gestion_id) do update
    set nombre = excluded.nombre, plan = excluded.plan,
        celular = excluded.celular, actualizado = now();
  get diagnostics n_sincronizados = row_count;

  -- Devuelve jsonb en vez de integer: el integer solo informaba el row_count
  -- del INSERT, así que un DELETE que no borró nada se veía igual que uno
  -- correcto. Ahora el llamador puede ver si hubo elementos descartados.
  return jsonb_build_object(
    'sincronizados', n_sincronizados,
    'borrados',      n_borrados,
    'descartados',   n_descartados);
end $function$;

-- ═════════════════════════════════════════════════════════════════════════
-- OJO — CAMBIA EL TIPO DE RETORNO
--
-- Pasa de `integer` a `jsonb`. `create or replace` NO puede cambiar el tipo
-- de retorno de una función existente: Postgres va a rechazarlo con
-- "cannot change return type of existing function".
--
-- Si eso pasa, hay que dropearla primero:
--   drop function if exists public.asistencia_import_roster(text, jsonb);
-- y volver a correr el bloque de arriba.
--
-- ANTES DE HACERLO: si Gestión-Activa ya lee el entero que devuelve, hay que
-- ajustar ese lado también, o el import va a parecer roto desde allá. Si
-- preferís no tocar el contrato ahora, cambiá `returns jsonb` por
-- `returns integer` y la última sentencia por `return n_sincronizados;` — el
-- arreglo del `not in`, que es el que importa, funciona igual.
-- ═════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — las tres filas tienen que dar lo esperado
-- ═════════════════════════════════════════════════════════════════════════
with filas(cliente_gestion_id) as (values (1::bigint),(2::bigint),(3::bigint)),
casos(caso, roster, esperado) as (values
  ('roster normal',        '[{"id":1},{"id":2}]'::jsonb,            1),
  ('un elemento sin id',   '[{"id":1},{"nombre":"Sin id"}]'::jsonb, 2),
  ('id no numérico',       '[{"id":1},{"id":"abc"}]'::jsonb,        2)
)
select caso,
       (select count(*) from filas a where not exists (
          select 1 from jsonb_array_elements(roster) x
          where x->>'id' ~ '^[0-9]+$' and (x->>'id')::bigint = a.cliente_gestion_id)) as borra_ahora,
       (select count(*) from filas a where a.cliente_gestion_id not in
          (select (x->>'id')::bigint from jsonb_array_elements(roster) x
           where x->>'id' ~ '^[0-9]+$' or x->>'id' is null)) as borraba_antes,
       esperado
from casos;
