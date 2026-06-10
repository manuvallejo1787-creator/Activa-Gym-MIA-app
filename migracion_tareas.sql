-- ============================================================
-- GESTION ACTIVA — Migracion: ROADMAP (tareas)
-- Ejecutar COMPLETO en el SQL Editor de Supabase.
--
-- Hace dos cosas:
--   1) Agrega la columna 'activa' para el borrado logico (las tareas
--      existentes quedan activas automaticamente).
--   2) Suma las 8 tareas nuevas destiladas de los documentos de
--      Sistema de Contenido y Embajadores, repartidas en Marketing
--      y Conversion.
--
-- Las FECHAS (campo vence) son tentativas: cambialas a tu criterio
-- ANTES de correr el script si queres otras. Igual vas a poder
-- editarlas desde la app con la version nueva del App.jsx.
-- Es seguro correrlo mas de una vez (no duplica las tareas).
-- ============================================================

-- ── 1) Columna de borrado logico ────────────────────────────
alter table tareas add column if not exists activa boolean default true;
update tareas set activa = true where activa is null;

-- ── 2) Tareas nuevas ─────────────────────────────────────────
-- CONVERSION (4) + MARKETING (4). No se insertan si ya existe una
-- tarea con el mismo titulo (evita duplicar al re-ejecutar).
insert into tareas (titulo, frente, pri, st, vence, activa)
select * from (values
  -- ── CONVERSION ──
  ('Incorporar el ritual de referido como paso fijo de cada reeval (Manu + Santiago)', 'Conversion', 'alta',  'pendiente', date '2026-06-16', true),
  ('Lanzar Embajadores: publicar el anuncio unico a la base',                          'Conversion', 'alta',  'pendiente', date '2026-06-16', true),
  ('Agregar campo "referido por" en el alta de socios (Gestion ACTIVA)',               'Conversion', 'media', 'pendiente', date '2026-06-23', true),
  ('Cerrar el circulo: avisar y agradecer al embajador al acreditar el mes gratis',    'Conversion', 'media', 'pendiente', date '2026-06-30', true),
  -- ── MARKETING ──
  ('Instaurar la sesion semanal de tandeo de contenido (viernes al cerrar, fija en agenda)', 'Marketing', 'alta',  'pendiente', date '2026-06-13', true),
  ('Sostener la cadena de 60 dias sin semana en blanco (habilita escalon de precios sept.)', 'Marketing', 'alta',  'pendiente', date '2026-08-12', true),
  ('Montar el sistema de captura de material (carpeta o WhatsApp propio)',                   'Marketing', 'media', 'pendiente', date '2026-06-13', true),
  ('Implementar el calendario de rotacion de los 4 baldes de contenido',                     'Marketing', 'media', 'pendiente', date '2026-06-20', true)
) as v(titulo, frente, pri, st, vence, activa)
where not exists (select 1 from tareas t where t.titulo = v.titulo);

-- ── VERIFICACION (opcional) ──────────────────────────────────
-- select frente, count(*) from tareas where activa group by frente order by frente;
-- select titulo, frente, pri, vence from tareas where activa and frente in ('Conversion','Marketing') order by vence;
