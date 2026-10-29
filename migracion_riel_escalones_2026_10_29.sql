-- migracion_riel_escalones_2026_10_29.sql
--
-- QUÉ RESUELVE
-- Había dos tablas capturando dolor que no se hablaban:
--   gym_sesion_feedback  247 filas · el cliente, desde el portal · NO disparaba nada
--   gym_incidencias       10 filas · el operador, en sala      · se abría a mano
-- 42 reportes de dolor produjeron 10 incidencias y 2 derivaciones. Un cliente
-- marcaba dolor a las once de la noche y no pasaba nada.
--
-- Esta migración cierra el circuito y agrega el camino de 4 escalones.
--
-- TODO ES ADITIVO E IDEMPOTENTE. No borra ni reinterpreta nada:
--   · `dolor` y `energia` quedan como columnas históricas
--   · `rpe_sesion` (0-10, intensidad del entrenamiento) no se toca
--   · ningún registro viejo dispara el riel: sin `naturaleza` no hay criterio,
--     y deducirla retroactivamente sería inventar datos clínicos
--
-- ROLLBACK al pie del archivo.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. gym_sesion_feedback — las preguntas nuevas
-- ═══════════════════════════════════════════════════════════════════════════
-- `persistencia` NO existe a propósito. Se había diseñado como "¿te duró unas
-- horas? / ¿seguís igual mañana?" y es impracticable: la encuesta se llena al
-- terminar la sesión, así que esas opciones preguntan por el futuro y sólo se
-- pueden adivinar. Una variable adivinada mete ruido justo en el eje que iba a
-- ordenar el ruteo.
-- En su lugar van dos preguntas contestables mirando el presente — `momento` y
-- `ahora` — y la persistencia real queda MEDIDA en lugar de predicha: si la
-- misma zona reaparece, eso es persistencia, y la regla de 2 en 7 días ya la
-- detecta.
alter table gym_sesion_feedback
  add column if not exists llegada     text,     -- pilas | medio | cansado  (🔋 😐 🪫, al LLEGAR)
  add column if not exists molestia    boolean default false,
  add column if not exists naturaleza  text,     -- muscular | articular | nerviosa
  add column if not exists momento     text,     -- nueva | previa
  add column if not exists ahora       text,     -- se_fue | sigue
  add column if not exists intensidad  text;     -- apenas | bastante | mucho

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. gym_incidencias — el camino de escalones
-- ═══════════════════════════════════════════════════════════════════════════
-- El agujero que tenía: `derivado_fisio = false` + `resuelta` significaba lo
-- mismo para "no hacía falta" que para "se lo propuse y no quiso". Ocho de las
-- diez incidencias estaban en ese limbo, así que no hay forma de saber qué
-- proporción de los escalonamientos muere en el ofrecimiento.
alter table gym_incidencias
  add column if not exists escalon           smallint default 0,
  add column if not exists origen            text     default 'sala',  -- sala | feedback | manual
  add column if not exists zona              text     default '',
  add column if not exists naturaleza        text,
  add column if not exists momento           text,
  add column if not exists ahora             text,
  -- Sesiones EJECUTADAS sin reporte nuevo para liberar el patrón: 4 en
  -- escalón 0, 8 en declinada. Se cuenta en sesiones y no en días porque el
  -- calendario corre aunque el cliente no venga — mismo error que ya se
  -- corrigió en la semana del portal. Ocho sesiones limpias son evidencia de
  -- que tolera la carga; treinta días de silencio pueden ser tres semanas sin
  -- venir. Vive como dato y no como constante para poder ajustarlo sin
  -- desplegar.
  add column if not exists sesiones_umbral   smallint default 4,
  add column if not exists declinada_motivo  text     default '',
  add column if not exists declinada_el      date,
  add column if not exists revision_vence    date;

comment on column gym_incidencias.estado is
  'abierta | en_sala | valoracion_pendiente | valoracion_hecha | programa | derivada | declinada | linea_base | resuelta';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. gym_linea_base — el crónico conocido deja de gritar sin dejar de registrarse
-- ═══════════════════════════════════════════════════════════════════════════
-- El caso que la obliga: lumbares 2, 2, 2, 2 en diez días, con seguimiento
-- verbal, y una molestia de años. Con la regla de 2 en 7 días y sin esto,
-- dispara una incidencia por semana de por vida — y así mueren estos sistemas:
-- no por fallar, por gritar.
-- El error fácil es silenciarlo. Lo correcto es convertirlo en línea de base
-- CONTRA LA CUAL COMPARAR: sigue registrando, deja de disparar, y vuelve a
-- disparar si cambia el patrón.
create table if not exists gym_linea_base (
  id                 text primary key,
  gym_client_id      text not null,
  zona               text not null,
  naturaleza_basal   text not null,
  intensidad_basal   text not null,
  ahora_basal        text not null,
  desde              date not null default current_date,
  -- Una línea de base sin fecha de caducidad es un criterio de hace un año
  -- gobernando una decisión de hoy.
  revision_vence     date not null default (current_date + 90),
  autor              text not null,
  veredicto          text not null,   -- qué se descartó y con qué criterio
  incidencia_origen  text,
  activa             boolean not null default true,
  created_at         timestamptz default now(),
  unique (gym_client_id, zona)
);

alter table gym_linea_base enable row level security;
do $$ begin
  create policy auth_all_gym_linea_base on gym_linea_base
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table gym_linea_base;
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. El disparador — acá se cierra el circuito
-- ═══════════════════════════════════════════════════════════════════════════
-- Vive en la base y no en el cliente por tres razones: el portal es HTML plano
-- sin build y no debería tener lógica clínica; el disparo tiene que ocurrir
-- aunque nadie abra la app; y si el cálculo vive junto al dato no hay dos
-- implementaciones que se desincronicen.
create or replace function fn_riel_desde_feedback() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_esc     smallint;
  v_motivo  text;
  v_base    gym_linea_base;
  v_previos int;
  v_inc     gym_incidencias;
  v_nid     text;
  ord_int   text[] := array['apenas','bastante','mucho'];
  ord_nat   text[] := array['muscular','articular','nerviosa'];
begin
  -- Sin naturaleza no hay criterio, y sin zona no hay a qué rutear: la regla
  -- de repetición es POR ZONA, así que un reporte sin zona no es ruteable.
  -- Esto es también lo que mantiene a los 247 registros viejos fuera del riel.
  if new.naturaleza is null or coalesce(new.dolor_zona,'') = '' then
    return new;
  end if;

  -- ── Línea de base: silencia, salvo que el patrón empeore ────────────────
  select * into v_base from gym_linea_base
   where gym_client_id = new.gym_client_id and zona = new.dolor_zona and activa;
  if found then
    if not (
         array_position(ord_int, new.intensidad) > array_position(ord_int, v_base.intensidad_basal)
      or array_position(ord_nat, new.naturaleza) > array_position(ord_nat, v_base.naturaleza_basal)
      or (new.ahora = 'sigue' and v_base.ahora_basal = 'se_fue')
      or v_base.revision_vence < current_date
    ) then
      return new;   -- queda registrado en el feedback y no dispara nada
    end if;
    v_motivo := 'cambió el patrón sobre una línea de base conocida';
  end if;

  -- ── Ruteo ───────────────────────────────────────────────────────────────
  if new.naturaleza = 'nerviosa' then
    v_esc := 3; v_motivo := coalesce(v_motivo, 'naturaleza nerviosa: no espera el segundo reporte');
  elsif new.intensidad = 'mucho' then
    v_esc := 3; v_motivo := coalesce(v_motivo, 'tuvo que parar la sesión');
  elsif new.naturaleza = 'articular' then
    v_esc := 1; v_motivo := coalesce(v_motivo, 'molestia articular');
  elsif new.ahora = 'sigue' then
    v_esc := 1; v_motivo := coalesce(v_motivo, 'la molestia no se fue al parar');
  elsif new.momento = 'previa' then
    -- CRITERIO A RATIFICAR (Claude, 29/10): un dolor que la persona trajo de
    -- afuera no lo causó el entrenamiento, pero el entrenamiento lo está
    -- cargando. Eso es más razón para valorar, no menos. Si Manu prefiere que
    -- espere la repetición, se saca esta rama y cae en la regla de 2 en 7.
    v_esc := 1; v_motivo := coalesce(v_motivo, 'dolor previo a la sesión, cargado bajo entrenamiento');
  else
    -- Muscular, se fue al parar, aparecida hoy: ¿repite?
    -- Misma ZONA (no mismo ejercicio: un lumbar que molesta en sentadilla y
    -- después en peso muerto es un lumbar, no dos problemas), 7 días CORRIDOS,
    -- y en dos SESIONES DISTINTAS — dos reportes del mismo día son un evento.
    select count(*) into v_previos from gym_sesion_feedback f
     where f.gym_client_id = new.gym_client_id
       and f.dolor_zona    = new.dolor_zona
       and f.naturaleza is not null
       and f.id <> new.id
       and f.fecha >= new.fecha - 7
       and f.fecha <  new.fecha;
    if v_previos >= 1 then
      v_esc := 1; v_motivo := coalesce(v_motivo, '2 reportes en la misma zona en 7 días');
    else
      v_esc := 0; v_motivo := coalesce(v_motivo, 'primera molestia muscular en esa zona');
    end if;
  end if;

  -- ── Idempotencia: una incidencia por cliente y zona ─────────────────────
  -- Sin esto, un crónico genera una incidencia por semana y el riel se vuelve
  -- ruido. Si ya hay una abierta, el reporte se SUMA a su historial y el
  -- escalón sólo puede subir — mismo criterio monótono del resto del método.
  select * into v_inc from gym_incidencias
   where gym_client_id = new.gym_client_id
     and zona = new.dolor_zona
     and coalesce(estado,'abierta') <> 'resuelta'
   order by fecha desc limit 1;

  if found then
    update gym_incidencias set
      escalon   = greatest(coalesce(escalon,0), v_esc),
      fecha     = now(),
      historial = coalesce(historial,'[]'::jsonb) || jsonb_build_object(
                    'fecha', new.fecha, 'origen', 'feedback', 'motivo', v_motivo,
                    'naturaleza', new.naturaleza, 'momento', new.momento,
                    'ahora', new.ahora, 'intensidad', new.intensidad),
      -- El umbral sube con el escalón: 4 sesiones limpias en escalón 0,
      -- 8 cuando hay un escalonamiento declinado.
      sesiones_umbral = case when coalesce(estado,'') = 'declinada' then 8 else 4 end
    where id = v_inc.id;
    return new;
  end if;

  v_nid := 'inc_' || to_char(now(),'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text),1,5);

  insert into gym_incidencias (
    id, gym_client_id, fecha, reportado_por, origen, escalon, zona,
    naturaleza, momento, ahora, estado, sesiones_umbral,
    -- Se llenan también las columnas viejas para que el riel y los paneles
    -- que ya existen sigan leyendo sin cambios: nada queda desconectado.
    banda, eva, bandera_activa, ejercicio_nombre, nota, historial
  ) values (
    v_nid, new.gym_client_id, now(), 'portal', 'feedback', v_esc, new.dolor_zona,
    new.naturaleza, new.momento, new.ahora,
    case v_esc when 3 then 'abierta' when 1 then 'valoracion_pendiente' else 'en_sala' end,
    4,
    case new.intensidad when 'mucho' then 'severo' when 'bastante' then 'moderado' else 'leve' end,
    case new.intensidad when 'mucho' then 8        when 'bastante' then 5          else 2      end,
    new.naturaleza = 'nerviosa',
    coalesce(new.dolor_ejercicio,''),
    v_motivo,
    jsonb_build_array(jsonb_build_object(
      'fecha', new.fecha, 'origen', 'feedback', 'motivo', v_motivo,
      'naturaleza', new.naturaleza, 'momento', new.momento,
      'ahora', new.ahora, 'intensidad', new.intensidad))
  );
  return new;

-- EL RIEL NO PUEDE BLOQUEAR EL CAMINO PRINCIPAL DEL DATO.
-- Un trigger que falla aborta el INSERT: un bug acá le impediría al cliente
-- guardar su feedback desde el portal, y perder el reporte es peor que no
-- rutearlo. Mismo criterio que el error boundary del cartel de versión: un
-- sistema de diagnóstico no puede poder romper lo que diagnostica.
-- El WARNING queda en los logs de Postgres para verlo con query_logs.
exception when others then
  raise warning 'fn_riel_desde_feedback falló (feedback %, cliente %): %',
    new.id, new.gym_client_id, sqlerrm;
  return new;
end $$;

drop trigger if exists tg_riel_desde_feedback on gym_sesion_feedback;
create trigger tg_riel_desde_feedback
  after insert on gym_sesion_feedback
  for each row execute function fn_riel_desde_feedback();

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (no hace falta salvo que algo salga mal)
-- ═══════════════════════════════════════════════════════════════════════════
-- drop trigger if exists tg_riel_desde_feedback on gym_sesion_feedback;
-- drop function if exists fn_riel_desde_feedback();
-- drop table if exists gym_linea_base;
-- Las columnas agregadas se pueden dejar: son aditivas y nadie las lee hasta
-- que el portal las escriba. Si igual se quieren sacar:
-- alter table gym_sesion_feedback
--   drop column if exists llegada, drop column if exists molestia,
--   drop column if exists naturaleza, drop column if exists momento,
--   drop column if exists ahora, drop column if exists intensidad;
-- alter table gym_incidencias
--   drop column if exists escalon, drop column if exists origen,
--   drop column if exists zona, drop column if exists naturaleza,
--   drop column if exists momento, drop column if exists ahora,
--   drop column if exists sesiones_umbral, drop column if exists declinada_motivo,
--   drop column if exists declinada_el, drop column if exists revision_vence;
