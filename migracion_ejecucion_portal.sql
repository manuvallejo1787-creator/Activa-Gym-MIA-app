-- ============================================================
-- MIGRACIÓN: Registro de ejecución real + Portal del cliente
-- - ejecucion_registros: lo que el cliente efectivamente hizo (peso/reps por semana)
-- - portal_token en gym_clients: llave personal para el portal del cliente
-- Segura y re-ejecutable.
-- ============================================================

-- ── 1) LLAVE PERSONAL DEL CLIENTE (portal) ──────────────────
alter table gym_clients
  add column if not exists portal_token text;

-- Backfill: genera token a los clientes que no tengan
update gym_clients
  set portal_token = replace(gen_random_uuid()::text, '-', '')
  where portal_token is null;

create unique index if not exists idx_gym_clients_portal_token
  on gym_clients(portal_token);

-- ── 2) REGISTRO DE EJECUCIÓN REAL ───────────────────────────
create table if not exists ejecucion_registros (
  id               text primary key,
  gym_client_id    text not null references gym_clients(id) on delete cascade,
  plan_id          text not null,
  dia_id           text not null,
  dia_nombre       text default '',
  ejercicio_id     text not null,
  ejercicio_nombre text default '',
  semana           integer not null,        -- 1..8
  peso_real        numeric,
  reps_real        text default '',
  rpe_real         text default '',
  fecha            date default current_date,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Un registro único por (plan, día, ejercicio, semana) → al recargar, actualiza
create unique index if not exists idx_ejec_unico
  on ejecucion_registros(plan_id, dia_id, ejercicio_id, semana);

alter table ejecucion_registros enable row level security;
-- El portal NO usa esta política (entra por la función serverless con service key),
-- pero la app admin sí lee con anon key:
drop policy if exists "public_all_ejecucion" on ejecucion_registros;
create policy "public_all_ejecucion"
  on ejecucion_registros for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table ejecucion_registros;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';

select 'clientes con token' as info, count(*) from gym_clients where portal_token is not null
union all
select 'registros ejecucion', count(*) from ejecucion_registros;
