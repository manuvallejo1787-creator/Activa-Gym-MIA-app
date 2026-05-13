-- ═══════════════════════════════════════════════════════════════
-- SCHEMA ACTIVA INTEGRA — Pegar completo en Supabase SQL Editor
-- Settings → SQL Editor → New query → Pegar → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── TABLA: CLIENTES DEL GYM ──────────────────────────────────
create table if not exists gym_clients (
  id                    text primary key,
  nombre                text not null,
  apellido              text not null,
  documento             text,
  celular               text,
  nivel                 text default 'activa',
  semaforo              text default 'pendiente',
  restricciones         text default '',
  restricciones_flags   jsonb default '{"impacto":false,"overhead":false,"cargaAxial":false}',
  objetivo              text default '',
  criterios_personalizados jsonb default '[]',
  fecha_ingreso         date,
  fecha_eval            date,
  notas_internas        text default '',
  screening_completo    boolean default false,
  screening             jsonb default '{}',
  fisio_paciente_id     text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── TABLA: PACIENTES FISIOACTIVA ────────────────────────────
create table if not exists fisio_pacientes (
  id              text primary key,
  nombre          text not null,
  apellido        text not null,
  documento       text,
  celular         text,
  email           text,
  fecha_nac       date,
  genero          text,
  region          text default 'lumbar',
  derivado_por    text,
  gym_cliente_id  text,
  notas           text default '',
  activo          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── TABLA: EVALUACIONES ─────────────────────────────────────
create table if not exists fisio_evaluaciones (
  id           text primary key,
  paciente_id  text not null references fisio_pacientes(id) on delete cascade,
  fecha        date,
  tipo         text default 'inicial',
  region       text,
  evaluador    text,
  fase         text default 'restaura',
  objetivo     text,
  eva_reposo   text,
  eva_mov      text,
  rom_pct      integer,
  fms_total    integer,
  ybalance_diff text,
  diagnostico_pt text,
  plan         text,
  criterios_personalizados jsonb default '[]',
  data         jsonb default '{}',
  created_at   timestamptz default now()
);

-- ─── TRIGGER: updated_at automático ──────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger gym_clients_updated_at
  before update on gym_clients
  for each row execute function update_updated_at();

create trigger fisio_pacientes_updated_at
  before update on fisio_pacientes
  for each row execute function update_updated_at();

-- ─── RLS: ACCESO PÚBLICO (sin auth por ahora) ────────────────
-- Permite leer y escribir sin autenticación
-- Cuando quieras agregar login, estas políticas se modifican

alter table gym_clients        enable row level security;
alter table fisio_pacientes    enable row level security;
alter table fisio_evaluaciones enable row level security;

create policy "public_all_gym_clients"
  on gym_clients for all
  using (true) with check (true);

create policy "public_all_fisio_pacientes"
  on fisio_pacientes for all
  using (true) with check (true);

create policy "public_all_fisio_evaluaciones"
  on fisio_evaluaciones for all
  using (true) with check (true);

-- ─── REALTIME: Habilitar en las tres tablas ───────────────────
alter publication supabase_realtime add table gym_clients;
alter publication supabase_realtime add table fisio_pacientes;
alter publication supabase_realtime add table fisio_evaluaciones;

-- ─── VERIFICACIÓN ────────────────────────────────────────────
select 'gym_clients' as tabla, count(*) as filas from gym_clients
union all
select 'fisio_pacientes', count(*) from fisio_pacientes
union all
select 'fisio_evaluaciones', count(*) from fisio_evaluaciones;
