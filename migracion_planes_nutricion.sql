-- ============================================================
-- MIGRACIÓN: Registro de planes de nutrición (gym_planes_nutricion)
-- Persiste los planes nutricionales por cliente para llevar su
-- evolución y alimentar a la IA con el historial. Segura y re-ejecutable.
-- ============================================================

create table if not exists gym_planes_nutricion (
  id              text primary key,
  gym_client_id   text not null references gym_clients(id) on delete cascade,
  nombre          text not null,
  fecha_creacion  date,
  objetivo_nut    text default '',
  kcal            numeric,
  perfil          jsonb,                    -- {peso, talla, edad, sexo, actividad, objetivo_nut}
  semana          jsonb not null default '{}'::jsonb,  -- menús de los 7 días
  resumen         text default '',          -- resumen corto (lista + contexto IA)
  es_ejemplo      boolean default false,    -- marcar como ejemplo para "entrenar" la IA
  notas           text default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table gym_planes_nutricion enable row level security;
drop policy if exists "public_all_gym_planes_nutricion" on gym_planes_nutricion;
create policy "public_all_gym_planes_nutricion"
  on gym_planes_nutricion for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table gym_planes_nutricion;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';

select 'gym_planes_nutricion' as tabla, count(*) from gym_planes_nutricion;
