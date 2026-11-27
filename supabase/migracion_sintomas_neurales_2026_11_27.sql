-- ═══════════════════════════════════════════════════════════════════════════
-- SÍNTOMAS NEURALES ESTRUCTURADOS EN LA SESIÓN CLÍNICA
-- 27/11/2026 · correr una sola vez
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ
-- El documento de razonamiento clínico de Manu pone el seguimiento de los
-- síntomas neurales como el criterio 2 de avance de fase, y lo marca él mismo
-- como "especialmente importante": no avanzar si aparece mayor irradiación
-- distal, parestesias nuevas, pérdida de fuerza, o aumento persistente de
-- síntomas después de la sesión.
--
-- Hoy ese criterio NO SE PUEDE EXIGIR. La sesión clínica guarda `respuesta`
-- como texto libre, así que "no aumentó la irradiación distal" no se puede
-- leer de ahí: queda como una tilde de confianza del clínico. Y un criterio
-- que se tilda a mano no es distinto de la frase de texto que teníamos antes,
-- que era justamente el reclamo del 27/11: "los criterios de avance no están
-- bien establecidos, y no los contempla la programación".
--
-- QUÉ AGREGA
-- Una sola columna jsonb en lugar de cuatro columnas sueltas, porque esto va a
-- crecer (territorio del nervio, distancia de la irradiación en centímetros) y
-- cada campo nuevo sería otra migración.
--
--   neural = {
--     "irradiacion":     "no" | "proximal" | "hasta_codo" | "hasta_mano",
--     "parestesias":     true | false,
--     "perdida_fuerza":  true | false,
--     "vs":              "basal" | "sesion_previa",
--     "nota":            texto libre, opcional
--   }
--
-- LA ESCALA DE IRRADIACIÓN ES ORDINAL Y ESO NO ES COSMÉTICO
-- "no" < "proximal" < "hasta_codo" < "hasta_mano". El criterio neural se
-- evalúa comparando la irradiación de esta sesión contra la anterior: si
-- avanzó en la escala, el criterio no se cumple y la fase no avanza. Sin un
-- orden, "cambió la irradiación" no dice si mejoró o empeoró.
--
-- NO SE TOCA NADA DE LO QUE YA HAY
-- `respuesta` se queda como está y sigue usándose para lo cualitativo. Las 42
-- sesiones existentes quedan con neural = NULL, que el evaluador de criterios
-- lee como "medición pendiente" y NUNCA como "no cumple" — la misma regla que
-- rige todo el sistema de criterios.

alter table public.sesiones_clinicas
  add column if not exists neural jsonb;

comment on column public.sesiones_clinicas.neural is
  'Síntomas neurales estructurados de la sesión: {irradiacion: no|proximal|hasta_codo|hasta_mano, parestesias: bool, perdida_fuerza: bool, vs: basal|sesion_previa, nota: text}. Hace exigible el criterio 2 de avance de fase (síntomas neurales), que como texto libre solo podía tildarse a mano. NULL = sin registrar, que el evaluador lee como pendiente y nunca como incumplido.';

-- ─── Control de que la escala se respeta ───────────────────────────────────
-- Si entra un valor fuera de la escala, el criterio neural no puede comparar
-- y el pase de fase vuelve a decidirse a ojo sin que nadie se entere. Mejor
-- que la base lo rechace que descubrirlo tres meses después.
alter table public.sesiones_clinicas
  drop constraint if exists sesiones_clinicas_neural_irradiacion_ck;

alter table public.sesiones_clinicas
  add constraint sesiones_clinicas_neural_irradiacion_ck check (
    neural is null
    or not (neural ? 'irradiacion')
    or neural->>'irradiacion' in ('no','proximal','hasta_codo','hasta_mano')
  );

-- ─── Verificación ──────────────────────────────────────────────────────────
-- Tiene que devolver: columna_existe = t, restriccion_existe = t,
-- sesiones = 42, con_neural = 0 (las viejas quedan pendientes, es lo correcto)
select
  (select count(*) > 0 from information_schema.columns
     where table_schema='public' and table_name='sesiones_clinicas'
       and column_name='neural' and data_type='jsonb')      as columna_existe,
  (select count(*) > 0 from pg_constraint
     where conname='sesiones_clinicas_neural_irradiacion_ck') as restriccion_existe,
  (select count(*) from public.sesiones_clinicas)            as sesiones,
  (select count(neural) from public.sesiones_clinicas)       as con_neural;
