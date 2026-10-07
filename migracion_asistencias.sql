-- ============================================================
-- MIGRACIÓN: Control de asistencias — lado ENTRENAMIENTO
--
-- La asistencia de los clientes CON usuario sale sola del portal
-- (ejecucion_registros + gym_sesion_feedback). Para los que todavía
-- no tienen usuario, los profes la marcan desde la pestaña Sala.
--
-- Todo se lee y se muestra en Gestión: una función programada de
-- Gestión llama cada hora a asistencia_export() y le devuelve el
-- listado de clientes "manuales" con asistencia_import_roster().
--
-- Aditiva y re-ejecutable: no toca ninguna tabla existente.
-- ============================================================

-- ── 1) Secreto compartido con Gestión (sin políticas: nadie lo lee) ──
create table if not exists sync_secretos (
  clave text primary key,
  valor text not null
);
alter table sync_secretos enable row level security;

-- ── 2) Clientes que se marcan a mano (lo escribe la sincronización) ──
create table if not exists asistencia_roster_manual (
  cliente_gestion_id bigint primary key,
  nombre      text not null,
  plan        text,
  celular     text,
  actualizado timestamptz default now()
);
alter table asistencia_roster_manual enable row level security;
drop policy if exists auth_read_roster on asistencia_roster_manual;
create policy auth_read_roster on asistencia_roster_manual
  for select to authenticated using (true);

-- ── 3) Asistencias marcadas en Sala ─────────────────────────
-- Una por cliente y día: marcar dos veces no duplica.
create table if not exists asistencias_manual (
  id                 uuid primary key default gen_random_uuid(),
  cliente_gestion_id bigint not null,
  nombre             text,
  fecha              date not null,
  hora               time,
  registrado_por     text,
  created_at         timestamptz default now(),
  unique (cliente_gestion_id, fecha)
);
alter table asistencias_manual enable row level security;
drop policy if exists auth_all_asist_manual on asistencias_manual;
create policy auth_all_asist_manual on asistencias_manual
  for all to authenticated using (true) with check (true);

-- ── 4) Exportación para Gestión ─────────────────────────────
-- DÍA: el que declara el cliente, salvo que quede en el futuro respecto
--      de la hora local de carga. Pasa con las cargas después de las 21 h:
--      el portal calculaba "hoy" en UTC y las fechaba al día siguiente.
-- HORA: la del primer registro de ese día, solo si se cargó ese mismo día
--      (hora de Montevideo). Si declaró un día anterior, la hora queda nula.
create or replace function asistencia_export(p_token text, p_desde date default '2026-01-01')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
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
    from cargas
    where gym_client_id is not null and created_at is not null
  ), portal as (
    select gym_client_id, dia,
           min(local_ts::time) filter (where local_ts::date = dia) as hora
    from norm
    where dia >= p_desde
    group by 1, 2
  )
  select jsonb_build_object(
    'portal', coalesce((select jsonb_agg(jsonb_build_object(
                 'gym_client_id', gym_client_id, 'fecha', dia,
                 'hora', to_char(hora, 'HH24:MI'))) from portal), '[]'::jsonb),
    'manual', coalesce((select jsonb_agg(jsonb_build_object(
                 'cliente_id', cliente_gestion_id, 'fecha', fecha,
                 'hora', to_char(hora, 'HH24:MI'), 'por', registrado_por))
                 from asistencias_manual where fecha >= p_desde), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', g.id,
                 'nombre', trim(coalesce(g.nombre,'') || ' ' || coalesce(g.apellido,'')),
                 'celular', g.celular,
                 'activo', coalesce(g.activo, true),
                 'num_dias', (select p.num_dias from gym_planes p
                              where p.gym_client_id = g.id and p.estado = 'activo'
                                and not coalesce(p.es_ejemplo, false)
                              order by p.fecha_inicio desc nulls last, p.created_at desc
                              limit 1)))
                 from gym_clients g), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- ── 5) Gestión manda la lista de clientes que se marcan a mano ──
create or replace function asistencia_import_roster(p_token text, p_roster jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_token is null or p_token <> (select valor from sync_secretos where clave = 'gestion') then
    raise exception 'token inválido';
  end if;
  delete from asistencia_roster_manual
   where cliente_gestion_id not in (select (x->>'id')::bigint from jsonb_array_elements(p_roster) x);
  insert into asistencia_roster_manual (cliente_gestion_id, nombre, plan, celular, actualizado)
  select (x->>'id')::bigint, x->>'nombre', x->>'plan', x->>'celular', now()
  from jsonb_array_elements(p_roster) x
  on conflict (cliente_gestion_id) do update
    set nombre = excluded.nombre, plan = excluded.plan,
        celular = excluded.celular, actualizado = now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function asistencia_export(text, date) from public;
revoke all on function asistencia_import_roster(text, jsonb) from public;
grant execute on function asistencia_export(text, date) to anon, authenticated;
grant execute on function asistencia_import_roster(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

-- El valor del secreto se carga aparte (no va en el repo):
-- insert into sync_secretos values ('gestion', '<token>')
--   on conflict (clave) do update set valor = excluded.valor;
