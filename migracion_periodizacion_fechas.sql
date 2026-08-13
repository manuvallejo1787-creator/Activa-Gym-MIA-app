-- migracion_periodizacion_fechas.sql
-- Fecha de inicio/fin de la periodización asignada a cada cliente, snapshot
-- de métricas al momento de asignarla, e historial de mini-evaluaciones de
-- cierre (comparativa inicio/fin al terminar cada periodización).

alter table gym_clients add column if not exists periodizacion_inicio date;
alter table gym_clients add column if not exists periodizacion_fin date;
alter table gym_clients add column if not exists periodizacion_snapshot_inicio jsonb;
alter table gym_clients add column if not exists periodizaciones_historial jsonb default '[]';
