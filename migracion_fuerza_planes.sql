-- MIGRACIÓN: Tests de fuerza + Planes de periodización
-- Supabase → SQL Editor → New query → pegar → Run

-- Agregar columna periodizacion a gym_clients si no existe
alter table gym_clients add column if not exists periodizacion text default '';

-- Tabla tests de fuerza máxima
create table if not exists fuerza_tests (
  id              text primary key,
  gym_client_id   text not null references gym_clients(id) on delete cascade,
  fecha           date not null,
  test_id         text not null,
  test_nombre     text not null,
  peso_corporal   numeric,
  peso_levantado  numeric,
  reps_realizadas integer default 1,
  rm1_calculado   numeric,
  rm1_real        numeric,
  nivel_resultado text,
  notas           text default '',
  evaluador       text default '',
  created_at      timestamptz default now()
);

alter table fuerza_tests enable row level security;
drop policy if exists "public_all_fuerza_tests" on fuerza_tests;
create policy "public_all_fuerza_tests"
  on fuerza_tests for all using (true) with check (true);
alter publication supabase_realtime add table fuerza_tests;

-- Tabla planes de periodización
create table if not exists planes_periodizacion (
  id              text primary key,
  gym_client_id   text not null references gym_clients(id) on delete cascade,
  sistema_id      text not null,
  sistema_nombre  text not null,
  fecha_inicio    date,
  objetivo        text default '',
  notas           text default '',
  activo          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists planes_updated_at on planes_periodizacion;
create trigger planes_updated_at
  before update on planes_periodizacion
  for each row execute function update_updated_at();

alter table planes_periodizacion enable row level security;
drop policy if exists "public_all_planes" on planes_periodizacion;
create policy "public_all_planes"
  on planes_periodizacion for all using (true) with check (true);
alter publication supabase_realtime add table planes_periodizacion;

-- Verificación
select 'fuerza_tests' as tabla, count(*) as filas from fuerza_tests
union all
select 'planes_periodizacion', count(*) from planes_periodizacion;
