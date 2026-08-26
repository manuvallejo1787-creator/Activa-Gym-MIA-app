-- migracion_screening_historial.sql
-- Antes cada re-evaluación pisaba el screening anterior — un solo objeto,
-- sin historial fechado. Ahora cada finalización de screening queda como
-- snapshot en este array, para poder armar un checkpoint comparativo real
-- (antes/después) igual que ya existe del lado clínico.
alter table gym_clients add column if not exists screening_historial jsonb default '[]';

-- Backfill: a los clientes que ya tenían un screening completo antes de
-- este cambio, se les crea un primer snapshot con lo que ya tenían cargado,
-- para que no arranquen con el historial vacío.
update gym_clients
set screening_historial = jsonb_build_array(
  jsonb_build_object(
    'id', 'scr_backfill_' || id,
    'fecha', coalesce(fecha_eval::text, created_at::date::text),
    'screening', screening,
    'nivel', nivel,
    'semaforo', semaforo
  )
)
where screening_completo = true
  and (screening_historial is null or jsonb_array_length(screening_historial) = 0);
