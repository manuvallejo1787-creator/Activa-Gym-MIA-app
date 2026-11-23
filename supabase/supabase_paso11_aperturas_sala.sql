-- PASO 11 — BASE DE ENTRENAMIENTO (proyecto husokxkdwgpjwtgrijei)
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- 1) Registro de aperturas del portal (una fila por socio y día).
-- 2) La lista de Sala trae a todos los socios; "con_portal" separa a los que registran solos.
-- 3) La exportación a Gestión incluye las aperturas.

create table if not exists portal_aperturas (
  gym_client_id text not null,
  fecha date not null,
  hora time not null,
  primary key (gym_client_id, fecha)
);
alter table portal_aperturas enable row level security;

alter table asistencia_roster_manual add column if not exists con_portal boolean not null default false;

create or replace function public.asistencia_import_roster(p_token text, p_roster jsonb)
 returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare n integer; n_validos integer; n_descartados integer;
begin
  if p_token is null or p_token <> (select valor from sync_secretos where clave = 'gestion') then
    raise exception 'token inválido';
  end if;
  if p_roster is null or jsonb_typeof(p_roster) <> 'array' then
    raise exception 'p_roster tiene que ser un array JSON';
  end if;
  select count(*) filter (where x->>'id' ~ '^[0-9]+$'), count(*) filter (where x->>'id' is null or x->>'id' !~ '^[0-9]+$')
    into n_validos, n_descartados from jsonb_array_elements(p_roster) x;
  if n_validos = 0 then
    raise exception 'el roster no trae ningún id válido (% elementos descartados): se aborta para no borrar la tabla entera', n_descartados;
  end if;
  delete from asistencia_roster_manual a where not exists (
    select 1 from jsonb_array_elements(p_roster) x where x->>'id' ~ '^[0-9]+$' and (x->>'id')::bigint = a.cliente_gestion_id);
  insert into asistencia_roster_manual (cliente_gestion_id, nombre, plan, celular, bloqueado, con_portal, actualizado)
  select (x->>'id')::bigint, x->>'nombre', x->>'plan', x->>'celular',
         coalesce((x->>'bloqueado')::boolean, false), coalesce((x->>'con_portal')::boolean, false), now()
  from jsonb_array_elements(p_roster) x where x->>'id' ~ '^[0-9]+$'
  on conflict (cliente_gestion_id) do update
    set nombre = excluded.nombre, plan = excluded.plan, celular = excluded.celular,
        bloqueado = excluded.bloqueado, con_portal = excluded.con_portal, actualizado = now();
  get diagnostics n = row_count;
  return n;
end $function$;

create or replace function public.asistencia_export(p_token text, p_desde date default '2026-01-01'::date)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare r jsonb;
begin
  if p_token is null or p_token <> (select valor from sync_secretos where clave = 'gestion') then
    raise exception 'token inválido';
  end if;
  with cargas as (
    select gym_client_id, fecha, created_at from ejecucion_registros
    union all
    select gym_client_id, fecha, created_at from gym_sesion_feedback
  ), norm as (
    select gym_client_id,
           least(coalesce(fecha, (created_at at time zone 'America/Montevideo')::date),
                 (created_at at time zone 'America/Montevideo')::date) as dia,
           created_at at time zone 'America/Montevideo' as local_ts
    from cargas where gym_client_id is not null and created_at is not null
  ), portal as (
    select gym_client_id, dia, min(local_ts::time) filter (where local_ts::date = dia) as hora
    from norm where dia >= p_desde group by 1, 2
  )
  select jsonb_build_object(
    'portal', coalesce((select jsonb_agg(jsonb_build_object('gym_client_id', gym_client_id, 'fecha', dia, 'hora', to_char(hora, 'HH24:MI'))) from portal), '[]'::jsonb),
    'aperturas', coalesce((select jsonb_agg(jsonb_build_object('gym_client_id', gym_client_id, 'fecha', fecha, 'hora', to_char(hora, 'HH24:MI'))) from portal_aperturas where fecha >= p_desde), '[]'::jsonb),
    'manual', coalesce((select jsonb_agg(jsonb_build_object('cliente_id', cliente_gestion_id, 'fecha', fecha, 'hora', to_char(hora, 'HH24:MI'), 'por', registrado_por, 'motivo', motivo_excepcion)) from asistencias_manual where fecha >= p_desde), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', g.id, 'nombre', trim(coalesce(g.nombre,'') || ' ' || coalesce(g.apellido,'')),
                 'celular', g.celular, 'activo', coalesce(g.activo, true),
                 'num_dias', (select p.num_dias from gym_planes p where p.gym_client_id = g.id and p.estado = 'activo'
                                and not coalesce(p.es_ejemplo, false) order by p.fecha_inicio desc nulls last, p.created_at desc limit 1)))
                 from gym_clients g), '[]'::jsonb)
  ) into r;
  return r;
end $function$;

select 'PASO 11 listo' as resultado;
