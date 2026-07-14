-- ============================================================
-- MIGRACIÓN: Alimentos personalizados (alimentos_custom)
-- Antes vivían solo en memoria de React (se perdían al recargar
-- o cambiar de dispositivo). Ahora persisten en Supabase y quedan
-- disponibles para todos los planes y para la IA.
-- Segura y re-ejecutable.
-- ============================================================

create table if not exists alimentos_custom (
  id              text primary key,
  nombre          text not null,
  categoria       text default 'otros',
  porcion_ref     numeric default 100,
  proteinas       numeric default 0,
  carbos          numeric default 0,
  grasas          numeric default 0,
  fibra           numeric default 0,
  calorias        numeric default 0,
  micro1_nombre   text default '',
  micro1_valor    numeric default 0,
  micro1_unidad   text default 'mg',
  micro2_nombre   text default '',
  micro2_valor    numeric default 0,
  micro2_unidad   text default 'mg',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table alimentos_custom enable row level security;
drop policy if exists "public_all_alimentos_custom" on alimentos_custom;
create policy "public_all_alimentos_custom"
  on alimentos_custom for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table alimentos_custom;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';

select 'alimentos_custom' as tabla, count(*) from alimentos_custom;
