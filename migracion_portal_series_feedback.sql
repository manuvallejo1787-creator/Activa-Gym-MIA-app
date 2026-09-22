-- ═══════════════════════════════════════════════════════════════════════
-- PORTAL: CARGA POR SERIE + RPE DE SESIÓN
--
-- 1) series_detalle: el registro sigue siendo UNA fila por (plan, día,
--    ejercicio, semana) — la tabla no se multiplica. El detalle por serie va
--    en un jsonb: [{"s":1,"peso":80,"reps":10},{"s":2,"peso":80,"reps":8}]
--    peso_real y reps_real quedan como RESUMEN (serie tope y reps totales)
--    para que todo lo que ya los lee siga funcionando sin cambios:
--    el portal viejo, los KPIs, el motor y las consultas existentes.
--
-- 2) gym_sesion_feedback: el RPE es de la SESIÓN, no del ejercicio.
--    Una fila por (cliente, día, semana) — se renueva sola cada vez que
--    entrena ese día de la semana siguiente.
--
-- 3) Las metas por ejercicio (meta_kg / meta_reps) viven dentro del jsonb
--    `dias` del plan. No hacen falta columnas nuevas.
-- ═══════════════════════════════════════════════════════════════════════

alter table ejecucion_registros add column if not exists series_detalle jsonb default '[]'::jsonb;

create table if not exists gym_sesion_feedback (
  id             text primary key,
  gym_client_id  text not null,
  plan_id        text,
  dia_id         text not null,
  dia_nombre     text default '',
  semana         integer not null,
  fecha          date default current_date,
  rpe_sesion     integer,   -- 1-10, percepción de esfuerzo de la sesión
  energia        integer,   -- 1-5, cómo llegó
  dolor          integer,   -- 0-10, molestia durante la sesión
  nota           text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create unique index if not exists gym_sesion_feedback_unico
  on gym_sesion_feedback(gym_client_id, dia_id, semana);
create index if not exists gym_sesion_feedback_cli_idx
  on gym_sesion_feedback(gym_client_id, fecha desc);

alter table gym_sesion_feedback enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='gym_sesion_feedback') then
    create policy auth_all_gym_sesion_feedback on gym_sesion_feedback
      for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$ begin
  begin alter publication supabase_realtime add table gym_sesion_feedback;
  exception when duplicate_object then null; end;
end $$;

-- Resumen por cliente: alimenta el motor determinista y el prompt de la IA
-- sin recalcular en cada render.
create or replace view gym_feedback_resumen as
select f.gym_client_id,
       count(*)                            as sesiones_con_rpe,
       round(avg(f.rpe_sesion)::numeric,1) as rpe_promedio,
       round(avg(f.energia)::numeric,1)    as energia_promedio,
       round(avg(f.dolor)::numeric,1)      as dolor_promedio,
       max(f.fecha)                        as ultima_sesion,
       round(avg(f.rpe_sesion) filter (where f.fecha >= current_date - 14)::numeric,1) as rpe_ultimas_2sem,
       count(*) filter (where f.dolor >= 4) as sesiones_con_dolor
from gym_sesion_feedback f
group by f.gym_client_id;

notify pgrst, 'reload schema';

select 'gym_sesion_feedback' as tabla, count(*) as filas from gym_sesion_feedback;
