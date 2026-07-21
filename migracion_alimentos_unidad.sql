-- ============================================================
-- MIGRACIÓN: Unidades de porción para alimentos personalizados
-- Permite definir "2 fetas", "1 unidad", etc. en alimentos_custom,
-- igual que ya existe para los alimentos de fábrica.
-- Segura y re-ejecutable.
-- ============================================================

alter table alimentos_custom
  add column if not exists tiene_unidad boolean default false;
alter table alimentos_custom
  add column if not exists nombre_unidad text default '';
alter table alimentos_custom
  add column if not exists gramos_por_unidad numeric default null;

notify pgrst, 'reload schema';

select 'alimentos_custom' as tabla, count(*) as filas,
       count(*) filter (where tiene_unidad) as con_unidad
from alimentos_custom;
