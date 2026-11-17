-- PASO 10 (17/11) — ya aplicado por migración. Copia de referencia.
-- La tarjeta de Sala recibe de Gestión solo la marca "bloqueado" (cuota 20+ días)
-- y, si igual se marca la asistencia, guarda el motivo, que vuelve a Gestión.
alter table asistencia_roster_manual add column if not exists bloqueado boolean not null default false;
alter table asistencias_manual add column if not exists motivo_excepcion text;
-- asistencia_import_roster: lee x->>'bloqueado'. asistencia_export: agrega 'motivo' en manual.
