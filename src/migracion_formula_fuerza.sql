-- ============================================================
-- MIGRACIÓN: columna 'formula' en fuerza_tests
-- Soluciona: "Could not find the 'formula' column of 'fuerza_tests'
-- in the schema cache" al guardar un test de fuerza.
-- La app guarda qué fórmula se usó (brzycki | epley | epley_brzycki | lombardi)
-- para invertirla luego y calcular el % de 1RM en el constructor.
-- Es segura y re-ejecutable.
-- ============================================================

alter table fuerza_tests
  add column if not exists formula text default 'epley_brzycki';

-- Rellena los tests ya cargados que quedaron sin fórmula
update fuerza_tests
  set formula = 'epley_brzycki'
  where formula is null;

-- Fuerza la recarga del schema cache de PostgREST (Supabase)
-- para que el error desaparezca de inmediato sin esperar.
notify pgrst, 'reload schema';

-- Verificación (opcional)
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'fuerza_tests' and column_name = 'formula';
