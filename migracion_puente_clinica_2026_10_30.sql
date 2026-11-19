-- migracion_puente_clinica_2026_10_30.sql
--
-- SOLO EL ESQUEMA. Las pruebas las corre Claude después, con datos propios y
-- limpiándolos.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUÉ CIERRA
-- ═══════════════════════════════════════════════════════════════════════════
-- La conexión entre la clínica y el gimnasio ya estaba escrita en los datos,
-- en prosa, y nadie la leía. Los criterios de alta de R2 que guarda
-- fisio_planes_clinicos dicen literalmente "Alta clínica habilitada — puede
-- continuar en POTENCIA/RINDE del método sin restricción", y la única función
-- que traduce fase clínica → fase del método tenía UN consumidor: una frase en
-- pantalla que decía "se puede aceptar o cambiar manualmente".
--
-- Medido el 30/10: de 8 clientes del gimnasio vinculados a un paciente de la
-- clínica, los 6 con evaluación coinciden en fase. Eso no es que funcione: es
-- que alguien los puso iguales a mano y ninguno cambió de fase todavía. El
-- primer cambio real iba a ser el que lo descubriera.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LAS DOS DECISIONES DE MANU Y POR QUÉ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. DIRECCIÓN ASIMÉTRICA. Hacia abajo automático e inmediato; hacia arriba
--    con un toque de alguien. Los dos errores no cuestan lo mismo: si la app
--    tarda en bajar a alguien, sigue cargando pesado una zona que la clínica
--    ya marcó —el costo es que a alguien le frenen el plan de más—. Si sube a
--    alguien sola, una nota escrita en la clínica le habilita trabajo pesado y
--    balístico sin que el que está en sala lo haya visto: ahí el costo es la
--    lesión. Mismo criterio que el riel: bajar de escalón requiere veredicto,
--    nunca silencio ni tiempo.
--
-- 2. SÓLO SE BLOQUEAN LOS PATRONES DE LA ZONA, no el plan entero. Acá Manu
--    corrigió una recomendación equivocada de Claude, que había propuesto
--    suspender todo el plan sacándolo de un texto del método ("RESTAURA no
--    tiene periodización de fuerza") escrito para otra población. Un cliente
--    con un pinzamiento de hombro no tiene por qué dejar de sentar.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LOS DOS CAMINOS
-- ═══════════════════════════════════════════════════════════════════════════
--   'ingreso'  entró por la clínica y no tiene plan de gimnasio. Su plan ES el
--              protocolo clínico, así que la fase del método la manda la
--              clínica y puede bajar sola: no hay plan que proteger.
--   'lesion'   ya tenía plan corriendo y se lesionó. La fase NO se mueve: si
--              bajara, la etiqueta diría "sin periodización de fuerza" mientras
--              corre un plan de fuerza con un patrón bloqueado. Lo que se mueve
--              es el bloqueo del patrón de la zona.
--
-- Los distingue una sola cosa, y está en los datos: ¿tiene planes de gimnasio
-- en estado 'activo'? Se usa la MISMA definición que la vista hoy_gym para que
-- las dos pantallas no discrepen.

-- ═══ 1. El orden de las fases ═════════════════════════════════════════════
-- ⚠ ESTE ARRAY TIENE QUE SER IGUAL A `ORDEN_FASES` EN src/criterios.js.
-- Están en dos lugares porque la app no puede consultar la base para pintar y
-- la base no puede importar el código. Es la misma situación que PORTAL_V, y
-- se resuelve igual: `npm run salud` compara este archivo con criterios.js y
-- falla si se desincronizan. No cambiar uno sin el otro.
create or replace function fn_nivel_fase(f text) returns int
language sql immutable as $$
  select coalesce(array_position(array['restaura','activa','potencia','rinde'], f) - 1, -1);
$$;

-- ═══ 2. La vista que compara las dos fases ════════════════════════════════
-- Una fila por cliente del gimnasio VINCULADO a un paciente de la clínica. Los
-- 72 clientes sin vincular no aparecen: para ellos no hay nada que comparar.
create or replace view gym_clinica_puente as
with ult as (
  -- La evaluación más reciente de cada paciente. `distinct on` y no un
  -- max(fecha) con join, porque dos evaluaciones del mismo día existen y hay
  -- que quedarse con una sola de forma determinista.
  select distinct on (e.paciente_id)
         e.paciente_id, e.fase, e.fecha, e.region, e.id as evaluacion_id
  from fisio_evaluaciones e
  order by e.paciente_id, e.fecha desc nulls last, e.created_at desc nulls last
)
select c.id                                   as gym_client_id,
       trim(c.nombre || ' ' || coalesce(c.apellido,'')) as nombre,
       c.fisio_paciente_id                    as paciente_id,
       c.nivel                                as fase_gym,
       u.fase                                 as fase_clinica,
       u.fecha                                as fecha_eval,
       u.region                               as region,
       u.evaluacion_id,
       -- MISMA definición que hoy_gym.planes_activos: consistencia antes que
       -- precisión. Si cambia una, cambian las dos.
       (select count(*) from gym_planes p
         where p.gym_client_id = c.id and p.estado = 'activo')  as planes_activos,
       -- ¿Ya hay algo abierto sobre esa zona? Si sí, el patrón está tomado y
       -- no hace falta crear otra incidencia.
       exists (select 1 from gym_incidencias i
                where i.gym_client_id = c.id
                  and i.estado not in ('resuelta','linea_base')
                  and (coalesce(i.zona,'') = coalesce(u.region,'')
                       or split_part(coalesce(i.zona,''),'_',1) = coalesce(u.region,'')))
                                              as incidencia_abierta,
       fn_nivel_fase(c.nivel)                 as nivel_gym,
       fn_nivel_fase(u.fase)                  as nivel_clinica,
       case when fn_nivel_fase(c.nivel) < 0 or fn_nivel_fase(u.fase) < 0 then 'revisar'
            when fn_nivel_fase(u.fase) < fn_nivel_fase(c.nivel) then 'baja'
            when fn_nivel_fase(u.fase) > fn_nivel_fase(c.nivel) then 'sube'
            else 'igual' end                  as direccion
from gym_clients c
join ult u on u.paciente_id = c.fisio_paciente_id
where c.fisio_paciente_id is not null
  and coalesce(c.activo, true);

grant select on gym_clinica_puente to authenticated;

-- ═══ 3. Pacientes de la clínica sin vincular ══════════════════════════════
-- La automatización no sirve de nada sobre vínculos que no existen. El
-- emparejamiento por nombre lo hace la app (src/puenteClinica.js), porque
-- vincular a dos personas distintas que se llaman igual mezclaría dos
-- historiales clínicos y eso no se deshace solo. Acá sólo se dice QUIÉNES
-- están sueltos.
create or replace view fisio_sin_vincular as
select p.id as paciente_id,
       trim(p.nombre || ' ' || coalesce(p.apellido,'')) as nombre,
       (select max(e.fecha) from fisio_evaluaciones e where e.paciente_id = p.id) as ultima_eval,
       (select e.fase from fisio_evaluaciones e where e.paciente_id = p.id
         order by e.fecha desc nulls last limit 1)                                as fase_clinica
from fisio_pacientes p
where not exists (select 1 from gym_clients c where c.fisio_paciente_id = p.id);

grant select on fisio_sin_vincular to authenticated;

-- ═══ 3-bis. El registro de los cambios de fase ════════════════════════════
--
-- EL AGUJERO QUE ESTO CIERRA, encontrado al conectar la vista con la pantalla:
-- una bajada automática deja la fase del gimnasio igual a la de la clínica, así
-- que la vista pasa a decir 'igual' y el aviso DESAPARECE. O sea: la app movía
-- de fase a un cliente y nadie se enteraba nunca. Lo contrario de lo que pide
-- la norma.
--
-- Sirve para las dos direcciones: la bajada automática queda registrada con
-- origen 'clinica_automatico', y la confirmación de un alta con quién la
-- confirmó. Sin esto, "la app le cambió la fase a alguien" es invisible, y una
-- automatización invisible no se puede auditar ni desarmar.
create table if not exists gym_fase_historial (
  id            text primary key,
  gym_client_id text not null references gym_clients(id) on delete cascade,
  fase_de       text,
  fase_a        text not null,
  direccion     text not null,                 -- 'baja' | 'sube'
  origen        text not null,                 -- 'clinica_automatico' | 'confirmacion' | 'manual'
  camino        text,                          -- 'ingreso' | 'lesion'
  evaluacion_id text,
  autor         text default '',
  nota          text default '',
  fecha         timestamptz not null default now()
);

create index if not exists idx_fase_hist_cliente on gym_fase_historial (gym_client_id, fecha desc);

alter table gym_fase_historial enable row level security;
-- Sin política la tabla queda INERTE desde el cliente: es el caso exacto de
-- screening_bandas el 20/10, que tenía RLS y cero políticas y la app leía cero
-- filas en silencio. salud.sql controla justamente eso.
drop policy if exists p_fase_hist_lectura on gym_fase_historial;
create policy p_fase_hist_lectura on gym_fase_historial
  for select to authenticated using (true);
drop policy if exists p_fase_hist_escritura on gym_fase_historial;
create policy p_fase_hist_escritura on gym_fase_historial
  for all to authenticated using (true) with check (true);

-- ═══ 4. Hacia abajo: actúa solo ═══════════════════════════════════════════
-- Sólo hacia abajo. Un ascenso NUNCA se aplica acá — ni con un salto de una
-- fase ni de tres. Eso lo decide una persona desde la pantalla Hoy.
create or replace function fn_puente_clinica() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_cli record; v_nivel_gym int; v_nivel_cli int; v_planes int; v_abierta boolean;
begin
  if coalesce(new.fase,'') = '' then return new; end if;

  select c.* into v_cli from gym_clients c
   where c.fisio_paciente_id = new.paciente_id and coalesce(c.activo,true) limit 1;
  if not found then return new; end if;          -- paciente sin cliente vinculado

  v_nivel_gym := fn_nivel_fase(v_cli.nivel);
  v_nivel_cli := fn_nivel_fase(new.fase);

  -- Una fase que no se reconoce NO se trata como "no pasa nada": no se toca
  -- nada y queda el aviso 'revisar' de la vista, que la pantalla Hoy muestra.
  if v_nivel_gym < 0 or v_nivel_cli < 0 then return new; end if;

  -- SUBE o IGUAL: la base no hace nada. El ascenso espera el toque.
  if v_nivel_cli >= v_nivel_gym then return new; end if;

  select count(*) into v_planes from gym_planes p
   where p.gym_client_id = v_cli.id and p.estado = 'activo';

  if v_planes = 0 then
    -- CAMINO 'ingreso': no hay plan de gimnasio que proteger. La fase baja.
    update gym_clients set nivel = new.fase, updated_at = now() where id = v_cli.id;
    -- Y QUEDA REGISTRADO. Sin esto la vista pasaría a decir 'igual', el aviso
    -- desaparecería, y nadie se enteraría de que la app le movió la fase.
    insert into gym_fase_historial (id, gym_client_id, fase_de, fase_a, direccion,
                                    origen, camino, evaluacion_id, nota)
    values ('fh_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
            v_cli.id, v_cli.nivel, new.fase, 'baja', 'clinica_automatico', 'ingreso', new.id,
            'Bajada automática: la clínica evaluó el ' || coalesce(new.fecha::text,'?') ||
            ' y el cliente no tiene plan de gimnasio activo.');
    return new;
  end if;

  -- CAMINO 'lesion': la fase NO se toca. Se abre la incidencia de la zona para
  -- que aparezca como crítica en Hoy y se bloquee el patrón desde ahí.
  --
  -- POR QUÉ NO SE ELIGEN LOS EJERCICIOS ACÁ
  -- Qué ejercicio del plan carga una zona lo sugiere la app por el nombre del
  -- ejercicio (src/rehabPuente.js). Portar esas reglas a SQL duplicaría la
  -- definición en dos lenguajes, que es exactamente lo que dejó seis estados
  -- invisibles el 29/10. La incidencia se crea SIN patron_bloqueado y la
  -- pantalla Hoy ofrece aplicar la sugerencia en un toque.
  select exists (select 1 from gym_incidencias i
                  where i.gym_client_id = v_cli.id
                    and i.estado not in ('resuelta','linea_base')
                    and (coalesce(i.zona,'') = coalesce(new.region,'')
                         or split_part(coalesce(i.zona,''),'_',1) = coalesce(new.region,'')))
    into v_abierta;
  if v_abierta then return new; end if;          -- el patrón ya está tomado

  insert into gym_incidencias (
    id, gym_client_id, fecha, reportado_por, origen, escalon, zona,
    estado, sesiones_umbral, banda, eva, bandera_activa, nota, historial
  ) values (
    'inc_cli_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
    v_cli.id, now(), 'clinica', 'clinica', 0, coalesce(new.region,''),
    'abierta', 4, 'moderado', 5, false,
    'La clínica bajó la fase a ' || new.fase || ' (evaluación del ' ||
      coalesce(new.fecha::text,'?') || '). Falta elegir qué patrones quedan sin carga.',
    jsonb_build_array(jsonb_build_object(
      'fecha', coalesce(new.fecha, current_date), 'origen', 'clinica',
      'motivo_codigo', 'bajada_de_fase_clinica',
      'fase_clinica', new.fase, 'fase_gym', v_cli.nivel, 'evaluacion', new.id))
  );
  return new;

-- EL PUENTE NO PUEDE IMPEDIR QUE SE GUARDE UNA EVALUACIÓN CLÍNICA.
-- Un disparador que falla aborta el INSERT: un bug acá le impediría al
-- fisioterapeuta guardar su evaluación, y perder la evaluación es peor que no
-- propagar la fase. Mismo criterio que fn_riel_desde_feedback.
exception when others then
  raise warning 'fn_puente_clinica falló (evaluacion %, paciente %): %',
    new.id, new.paciente_id, sqlerrm;
  return new;
end $fn$;

drop trigger if exists tg_puente_clinica on fisio_evaluaciones;
create trigger tg_puente_clinica
  after insert or update of fase on fisio_evaluaciones
  for each row execute function fn_puente_clinica();

notify pgrst, 'reload schema';

-- Confirma qué quedó instalado. Las cuatro primeras tienen que dar 1.
select (select count(*) from information_schema.tables
         where table_name='gym_fase_historial')                                as tabla_hist_1,
       (select count(*) from pg_views where viewname='gym_clinica_puente')      as vista_puente_1,
       (select count(*) from pg_views where viewname='fisio_sin_vincular')      as vista_sueltos_1,
       (select count(*) from pg_proc  where proname='fn_puente_clinica')        as funcion_1,
       (select count(*) from pg_trigger where tgname='tg_puente_clinica'
          and not tgisinternal)                                                as trigger_1,
       (select count(*) from gym_clinica_puente)                               as vinculados,
       (select count(*) from gym_clinica_puente where direccion <> 'igual')     as desalineados,
       (select count(*) from fisio_sin_vincular)                               as pacientes_sueltos,
       (select count(*) from gym_fase_historial)                               as cambios_registrados;
