-- ═══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 1 de 2 — RIEL DE INCIDENCIAS DE SALA
-- Correr ESTA primero. La de RLS (migracion_auth_rls.sql) va DESPUÉS
-- de verificar que el login funciona.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists gym_incidencias (
  id                text primary key,
  gym_client_id     text,
  cliente_nombre    text default '',
  fecha             timestamptz default now(),
  reportado_por     text default '',

  -- Paso 1 — descarte clínico (cualquiera en true corta el riel)
  banderas          jsonb   default '{}'::jsonb,
  bandera_activa    boolean default false,

  -- Paso 2 — intensidad
  banda             text default 'leve',      -- leve | moderado | severo | bandera
  eva               integer,

  -- Paso 3 — contexto
  ejercicio_id      text default '',
  ejercicio_nombre  text default '',

  -- Paso 4 — resolución
  accion            text default '',          -- continua | sustituye | frena_deriva
  sustituto_id      text default '',
  sustituto_nombre  text default '',
  nota              text default '',

  -- Seguimiento del profesional
  avisado           boolean default false,
  resuelto          boolean default false,
  resuelto_nota     text default '',
  derivado_fisio    boolean default false,

  created_at        timestamptz default now()
);

create index if not exists gym_incidencias_cliente_idx on gym_incidencias(gym_client_id);
create index if not exists gym_incidencias_pend_idx    on gym_incidencias(resuelto, fecha desc);

-- Teléfono de aviso (WhatsApp) para el escalamiento del riel
alter table centro_config add column if not exists tel_aviso text default '';

alter table gym_incidencias enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='gym_incidencias' and policyname='public_all_gym_incidencias') then
    create policy "public_all_gym_incidencias" on gym_incidencias for all using (true) with check (true);
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table gym_incidencias;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';

select 'gym_incidencias' as tabla, count(*) as filas from gym_incidencias;
