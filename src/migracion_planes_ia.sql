-- ============================================================
-- MIGRACIÓN: Registro de planes (gym_planes) + Base de conocimiento IA (ia_conocimiento)
-- Segura y re-ejecutable.
-- ============================================================

-- ── 1) REGISTRO DE PLANES POR CLIENTE ───────────────────────
-- Guarda cada plan completo del constructor (días, bloques, ejercicios,
-- %, plazos) para llevar la evolución del cliente y alimentar a la IA.
create table if not exists gym_planes (
  id                 text primary key,
  gym_client_id      text not null references gym_clients(id) on delete cascade,
  nombre             text not null,
  fecha_inicio       date,
  fecha_fin_estimada date,
  periodizacion      text default '',
  nivel_metodo       text default '',
  num_dias           integer default 1,
  estado             text default 'activo',   -- activo | completado | reemplazado
  dias               jsonb not null default '[]'::jsonb,  -- estructura del constructor
  plazos             jsonb,                    -- snapshot de planTimeline
  resumen            text default '',          -- resumen corto (lista + contexto IA)
  evaluacion_origen  text default '',          -- nota/ref de la evaluación que lo originó
  es_ejemplo         boolean default false,    -- marcar como ejemplo para "entrenar" la IA
  notas              text default '',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table gym_planes enable row level security;
drop policy if exists "public_all_gym_planes" on gym_planes;
create policy "public_all_gym_planes"
  on gym_planes for all using (true) with check (true);

-- realtime (ignora error si ya está agregada)
do $$ begin
  alter publication supabase_realtime add table gym_planes;
exception when duplicate_object then null; end $$;

-- ── 2) BASE DE CONOCIMIENTO DE LA IA ────────────────────────
-- Reglas/principios que el profesional escribe y que se inyectan en
-- cada prompt de la IA. Es el mecanismo de "entrenamiento" controlado.
create table if not exists ia_conocimiento (
  id          text primary key,
  ambito      text default 'entrenamiento',  -- entrenamiento | rehab | nutricion | evaluacion | general
  regla       text not null,
  activo      boolean default true,
  created_at  timestamptz default now()
);

alter table ia_conocimiento enable row level security;
drop policy if exists "public_all_ia_conocimiento" on ia_conocimiento;
create policy "public_all_ia_conocimiento"
  on ia_conocimiento for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table ia_conocimiento;
exception when duplicate_object then null; end $$;

-- Refrescar el schema cache de PostgREST
notify pgrst, 'reload schema';

-- Verificación
select 'gym_planes' as tabla, count(*) from gym_planes
union all
select 'ia_conocimiento', count(*) from ia_conocimiento;
