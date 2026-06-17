-- ============================================================
-- MIGRACIÓN: Ejercicios personalizados de fuerza por cliente
-- Mueve los 3 ejercicios custom (antes en localStorage del navegador)
-- a Supabase, para que funcionen en todos los dispositivos.
-- Segura y re-ejecutable.
-- ============================================================

create table if not exists fuerza_tests_custom (
  id             text primary key,        -- ${clientId}__${slot}
  gym_client_id  text not null references gym_clients(id) on delete cascade,
  slot           text not null,           -- 'ct1' | 'ct2' | 'ct3' (id lógico estable)
  nombre         text not null,
  patron         text default '',
  protocolo      text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create unique index if not exists idx_fuerza_custom_slot
  on fuerza_tests_custom(gym_client_id, slot);

alter table fuerza_tests_custom enable row level security;
drop policy if exists "public_all_fuerza_tests_custom" on fuerza_tests_custom;
create policy "public_all_fuerza_tests_custom"
  on fuerza_tests_custom for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table fuerza_tests_custom;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';

select 'fuerza_tests_custom' as tabla, count(*) from fuerza_tests_custom;
