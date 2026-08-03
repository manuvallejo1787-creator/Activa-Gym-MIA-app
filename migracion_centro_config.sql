-- migracion_centro_config.sql
-- Antes: brand (nombre del centro, logo, color) vivía en localStorage —
-- por navegador, nunca sincronizaba entre dispositivos. Un cambio hecho en
-- la compu de la clínica no se veía en el dispositivo del gym.
-- Ahora: fila única en Supabase + realtime, mismo patrón que gym_clients.

create table if not exists centro_config (
  id            text primary key default 'default',
  gym_name      text default 'ACTIVA',
  gym_sub       text default 'FITNESS CLUB',
  logo_img      text,                 -- base64 del logo, o null
  color_primary text default '#CC0000',
  color_bg      text default '#1a1a1a',
  updated_at    timestamptz default now()
);

alter table centro_config enable row level security;

create policy "public_all_centro_config"
  on centro_config for all
  using (true) with check (true);

alter publication supabase_realtime add table centro_config;

-- Fila inicial (si no existe) para que el primer fetch no vuelva vacío
insert into centro_config (id) values ('default')
  on conflict (id) do nothing;
