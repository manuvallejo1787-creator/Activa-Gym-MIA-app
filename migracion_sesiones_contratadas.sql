-- migracion_sesiones_contratadas.sql
-- Permite mostrar "sesiones restantes" en el dashboard de KPIs clínicos.
alter table fisio_pacientes add column if not exists sesiones_contratadas integer;
