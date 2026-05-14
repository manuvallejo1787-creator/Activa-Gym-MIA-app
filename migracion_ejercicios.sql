-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN — Ejecutar en Supabase SQL Editor
-- (Si ya corriste el schema.sql original, ejecutar solo esto)
-- ═══════════════════════════════════════════════════════

create table if not exists ejercicios (
  id            text primary key,
  nombre        text not null,
  bloque        text not null,
  musculos      text default '',
  contraccion   text default '',
  patron        text default '',
  nivel         text default 'Principiante',
  equipo        text default '',
  regresion     text default '',
  progresion    text default '',
  media_url     text default '',
  media_tipo    text default 'imagen',
  media_desc    text default '',
  custom        boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists ejercicios_updated_at on ejercicios;
create trigger ejercicios_updated_at
  before update on ejercicios
  for each row execute function update_updated_at();

alter table ejercicios enable row level security;

drop policy if exists "public_all_ejercicios" on ejercicios;
create policy "public_all_ejercicios"
  on ejercicios for all using (true) with check (true);

alter publication supabase_realtime add table ejercicios;

-- Verificación
select 'ejercicios' as tabla, count(*) as filas from ejercicios;
