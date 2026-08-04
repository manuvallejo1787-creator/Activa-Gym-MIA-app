-- migracion_criterios_avance.sql
-- Plantilla EDITABLE de requisitos para avanzar de una fase del Método
-- Activa Integra a la siguiente. Antes esto vivía hardcodeado como texto
-- fijo en FASES_METODO.criterios_avance (criterios.js) y no se usaba para
-- trabar nada — checkCriteriosAvance() existía pero nunca se llamaba desde
-- ningún lado. Ahora es editable y bloquea el avance si no se cumple.
--
-- Una fila por fase de ORIGEN (los criterios que hay que cumplir para
-- salir de esa fase hacia la siguiente). RESTAURA no tiene fila propia de
-- "avance de fuerza" — su avance lo controla el módulo clínico (FisioActiva/
-- FASES_REHAB), no este mecanismo de negocio.

create table if not exists criterios_avance_template (
  fase       text primary key,             -- 'restaura' | 'activa' | 'potencia' | 'rinde'
  criterios  jsonb default '[]',           -- [{id, texto}]
  updated_at timestamptz default now()
);

alter table criterios_avance_template enable row level security;

create policy "public_all_criterios_avance_template"
  on criterios_avance_template for all
  using (true) with check (true);

alter publication supabase_realtime add table criterios_avance_template;

-- Seed inicial — mismo contenido que ya existía en FASES_METODO, para que
-- nadie pierda los criterios que ya estaban definidos. A partir de acá son
-- editables desde la app.
insert into criterios_avance_template (fase, criterios) values
('restaura', '[
  {"id":"r1","texto":"EVA ≤ 3/10 en movimiento"},
  {"id":"r2","texto":"ROM > 70% del normal"},
  {"id":"r3","texto":"Fuerza ≥ 3/5 MRC"},
  {"id":"r4","texto":"Control motor básico presente"},
  {"id":"r5","texto":"Sin signos inflamatorios activos"}
]'),
('activa', '[
  {"id":"a1","texto":"EVA ≤ 2/10"},
  {"id":"a2","texto":"ROM > 85% del normal"},
  {"id":"a3","texto":"Fuerza ≥ 4/5 MRC"},
  {"id":"a4","texto":"Control motor funcional establecido"},
  {"id":"a5","texto":"Y-Balance: asimetría < 6 cm"}
]'),
('potencia', '[
  {"id":"p1","texto":"EVA ≤ 2/10"},
  {"id":"p2","texto":"ROM > 90% del normal"},
  {"id":"p3","texto":"Y-Balance: asimetría < 4 cm"},
  {"id":"p4","texto":"FMS ≥ 14/21"},
  {"id":"p5","texto":"Fuerza bilateral: asimetría < 10%"}
]')
on conflict (fase) do nothing;

-- Estado del checklist por cliente: qué ítems de la plantilla de SU fase
-- actual ya están marcados como cumplidos. Se resetea al avanzar de fase.
alter table gym_clients add column if not exists criterios_avance_estado jsonb default '{}';
