-- migracion_escalon2_2026_10_30.sql
--
-- SOLO EL ESQUEMA. Las pruebas las corre Claude después, con datos reales y
-- limpiándolos: la conexión permite DML y cancela DDL, así que el reparto es
-- Manu corre el esquema, Claude corre las pruebas.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUÉ CIERRA
-- ═══════════════════════════════════════════════════════════════════════════
-- El escalón 2 existía como etiqueta y nada más. El estado `programa` se podía
-- setear, cambiaba el texto de la tarjeta y liberaba el bloqueo del patrón —y
-- no creaba ningún bloque dirigido en ningún plan. La pestaña Rehab tiene
-- REHAB_DB con 10 regiones de ejercicios y lo único que hace es imprimir un
-- PDF que no se conecta ni al riel ni al plan de gym.
--
-- Por la norma —nada desconectado, nada que no sea esencial en uso— eso era
-- material suelto, no un escalón implementado.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUÉ SUPERPOSICIÓN Y NO ESCRITO EN EL PLAN
-- ═══════════════════════════════════════════════════════════════════════════
-- Decisión de Manu el 30/10: el bloque dirigido se inserta en el plan de gym
-- SIN borrar la rutina original. Se bloquea la carga de datos del patrón
-- afectado y a continuación se agrega el bloque nuevo.
--
-- Hay dos formas de hacer eso y una es una trampa:
--
--   (a) Escribir el bloque dentro de gym_planes.dias (jsonb). Entonces hay que
--       DES-escribirlo cuando el bloqueo se levanta. Eso es un segundo
--       mecanismo, que puede fallar, y si falla el plan queda mutado para
--       siempre con un bloque de rehab que ya no corresponde. Nadie se
--       enteraría: el plan se vería normal.
--
--   (b) Que la incidencia cargue el bloque y que api/portal.js componga
--       plan + superposición al LEER. El plan original nunca se toca. Cuando
--       tg_liberar_patron pasa la incidencia a 'resuelta', la superposición
--       desaparece sola y la rutina vuelve intacta. Cero código nuevo para
--       deshacerlo.
--
-- Va (b). El principio es el mismo que el de la vista gym_incidencias_bloqueo:
-- el estado derivado se calcula, no se duplica.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Y LA REENTRADA, QUE NO ESTABA EN EL PEDIDO
-- ═══════════════════════════════════════════════════════════════════════════
-- Encontrado el 30/10 leyendo planificacion.js:717. `sugerirPeso` toma el
-- historial del ejercicio SIN NINGÚN LÍMITE DE FECHA: ordena por updated_at
-- desc y agarra el primero. Y si ese día el cliente completó las reps,
-- PROGRESA: Math.max(peso*1.025, peso+2.5).
--
-- O sea: un patrón bloqueado 4 sesiones se libera solo —tg_liberar_patron, del
-- 29/10— y la primera carga que la app sugiere al volver es la de antes del
-- dolor, más 2,5 kg, después de dos o tres semanas sin entrenar ese patrón.
--
-- Un bloqueo que se levanta sin regla de reentrada no protege: aplaza. Así que
-- la reentrada viaja con el bloqueo, en la misma incidencia, y es editable.

alter table gym_incidencias
  -- ── QUÉ SE BLOQUEA ──────────────────────────────────────────────────────
  -- Los ids de ejercicio del plan cuya carga queda bloqueada. Array y no una
  -- sola columna porque un patrón son varios ejercicios: bloquear "sentadilla"
  -- sin bloquear "prensa" y "zancada" deja el patrón abierto por la ventana.
  add column if not exists patron_bloqueado text[] default '{}',

  -- Días del plan donde aplica. Vacío = todos los días, que es el caso normal:
  -- un dolor de rodilla no distingue entre el día de pierna y el día full body.
  -- Existe para el caso raro de bloquear un solo día.
  add column if not exists patron_dias      text[] default '{}',

  -- ── QUÉ SE AGREGA ───────────────────────────────────────────────────────
  -- El bloque dirigido, como lo va a leer el portal:
  --   { region, fase, nombre, nota,
  --     exercises: [{ exId, nombre, desc, series, reps, notas }] }
  -- Se guarda DESNORMALIZADO a propósito: los ejercicios de REHAB_DB viven en
  -- el código (src/App.jsx), no en gym_ejercicios, y el portal no importa el
  -- bundle de la app. Si mañana REHAB_DB cambia, el bloque que el cliente ya
  -- tiene asignado no cambia abajo de sus pies — que es lo correcto para una
  -- prescripción.
  add column if not exists bloque_dirigido  jsonb,

  -- ── CÓMO SE VUELVE ──────────────────────────────────────────────────────
  -- { pct: 60, sesiones: 2 } → al liberarse, las primeras 2 sesiones del
  -- patrón se sugieren al 60% de la última carga previa al bloqueo, y de ahí
  -- la progresión normal.
  --
  -- 60% y 2 sesiones son el arranque, no un dogma: viven como dato para que
  -- Manu los mueva por caso sin desplegar. El valor por defecto es
  -- deliberadamente conservador — el costo de quedarse corto dos sesiones es
  -- dos sesiones; el de quedarse largo es la lesión que el riel vino a evitar.
  add column if not exists reentrada        jsonb default '{"pct":60,"sesiones":2}'::jsonb,

  -- La fecha en que el patrón se liberó. Es el "desde cuándo" que cuenta las
  -- sesiones de reentrada. La escribe tg_liberar_patron, abajo.
  add column if not exists liberado_el      date;

comment on column gym_incidencias.patron_bloqueado is
  'ids de ejercicio del plan cuya carga queda bloqueada; la api rechaza el POST';
comment on column gym_incidencias.bloque_dirigido is
  'escalon 2: bloque de rehab que api/portal.js SUPERPONE al plan; el plan no se toca';
comment on column gym_incidencias.reentrada is
  '{pct,sesiones}: como vuelve el patron al liberarse. Editable por caso.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. La vista que el portal y la app leen
-- ═══════════════════════════════════════════════════════════════════════════
-- Sin esto, cada lado tendría que saber qué estados bloquean la carga, y eso
-- es exactamente la lista blanca duplicada que el 29/10 dejó seis estados
-- invisibles en la app. La definición vive en un lugar.
--
-- Qué estados bloquean la carga del patrón: los mismos que `bloquea` en
-- src/incidencias.js, menos `programa`. `programa` NO bloquea —tiene el bloque
-- dirigido corriendo, que es trabajo específico, no ausencia de trabajo— pero
-- sí superpone. Son dos cosas distintas y la vista devuelve las dos.
create or replace view gym_superposicion as
select i.id                                     as incidencia_id,
       i.gym_client_id,
       i.estado,
       i.zona,
       i.escalon,
       coalesce(i.patron_bloqueado, '{}')       as patron_bloqueado,
       coalesce(i.patron_dias, '{}')            as patron_dias,
       i.bloque_dirigido,
       coalesce(i.reentrada, '{"pct":60,"sesiones":2}'::jsonb) as reentrada,
       i.liberado_el,
       -- ¿Se rechaza la carga de esos ejercicios?
       (i.estado in ('abierta','en_sala','valoracion_pendiente',
                     'valoracion_hecha','derivada','declinada'))  as bloquea_carga,
       -- ¿Hay un bloque que agregar al plan?
       (i.bloque_dirigido is not null and i.estado = 'programa')   as suma_bloque,
       coalesce(nullif(i.resuelto_nota,''),
                nullif(i.nota,''),
                'molestia reportada en ' || coalesce(nullif(i.zona,''), 'esa zona')) as motivo
from gym_incidencias i
where i.estado <> 'resuelta'
  and (coalesce(array_length(i.patron_bloqueado,1),0) > 0
       or i.bloque_dirigido is not null);

grant select on gym_superposicion to authenticated;
grant select on gym_superposicion to anon;   -- el portal lee con la anon key

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. tg_liberar_patron deja constancia de CUÁNDO liberó
-- ═══════════════════════════════════════════════════════════════════════════
-- La función del 29/10 pasaba la incidencia a 'resuelta' y no guardaba la
-- fecha. Sin esa fecha no se pueden contar las sesiones de reentrada: no hay
-- desde cuándo. Se reemplaza entera porque es más honesto que un parche.
create or replace function fn_liberar_patron() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare r record; v_ses int;
begin
  if new.fecha is null or coalesce(new.gym_client_id,'') = '' then return new; end if;

  -- Una sola vez por sesión, no una por ejercicio: hay 14,2 filas por sesión
  -- en promedio. La guarda compara la MISMA FECHA, así que no interfiere con
  -- inserciones de varias sesiones de días distintos: ésas pasan y liberan
  -- normalmente. Verificado el 30/10 con las dos formas.
  if exists (select 1 from ejecucion_registros e
              where e.gym_client_id = new.gym_client_id
                and e.fecha = new.fecha
                and e.id <> new.id) then
    return new;
  end if;

  for r in select * from gym_incidencias
            where gym_client_id = new.gym_client_id
              and estado in ('en_sala', 'declinada')
  loop
    select count(distinct e.fecha) into v_ses
      from ejecucion_registros e
     where e.gym_client_id = r.gym_client_id
       and e.fecha > r.fecha::date;

    if v_ses >= coalesce(r.sesiones_umbral, 4) then
      update gym_incidencias set
        estado = 'resuelta',
        resuelto = true,
        -- NUEVO: el desde-cuándo de la reentrada. Sin esto la regla de
        -- reentrada no tiene de dónde contar.
        liberado_el = new.fecha::date,
        resuelto_nota = 'Liberada automáticamente: ' || v_ses ||
                        ' sesiones ejecutadas sin reporte nuevo en ' ||
                        coalesce(nullif(r.zona, ''), 'esa zona') ||
                        ' (umbral ' || coalesce(r.sesiones_umbral, 4) || ').',
        historial = coalesce(historial, '[]'::jsonb) || jsonb_build_object(
                      'fecha', new.fecha, 'origen', 'automatico',
                      'motivo_codigo', 'liberada_por_sesiones',
                      'sesiones', v_ses, 'umbral', coalesce(r.sesiones_umbral, 4))
      where id = r.id;
    end if;
  end loop;
  return new;

-- Liberar un patrón no puede impedir que se registre una serie. Si esto falla,
-- el bloqueo sigue puesto —que es el lado seguro— y el entrenamiento se carga
-- igual. Perder la carga del cliente sería peor que no liberar el patrón.
exception when others then
  raise warning 'fn_liberar_patron falló (cliente %, fecha %): %',
    new.gym_client_id, new.fecha, sqlerrm;
  return new;
end $fn$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. La reentrada, consultable desde la api sin recalcularla
-- ═══════════════════════════════════════════════════════════════════════════
-- Devuelve, por cliente y ejercicio, el porcentaje al que corresponde volver y
-- cuántas sesiones de reentrada quedan. La api la lee y se la pasa al portal;
-- la app la usa en sugerirPeso. Un solo cálculo para los dos lados: si cada
-- uno lo hiciera por su cuenta se desincronizarían, que es lo que pasó con las
-- dos listas blancas de estados.
create or replace view gym_reentrada as
with liberadas as (
  select i.gym_client_id, i.id as incidencia_id, i.zona, i.liberado_el,
         unnest(coalesce(i.patron_bloqueado,'{}')) as ejercicio_id,
         coalesce((i.reentrada->>'pct')::numeric, 60)    as pct,
         coalesce((i.reentrada->>'sesiones')::int, 2)    as sesiones_req
  from gym_incidencias i
  where i.estado = 'resuelta' and i.liberado_el is not null
    and coalesce(array_length(i.patron_bloqueado,1),0) > 0
)
select l.gym_client_id, l.ejercicio_id, l.incidencia_id, l.zona,
       l.liberado_el, l.pct, l.sesiones_req,
       -- Sesiones en las que el cliente YA cargó ese ejercicio desde la
       -- liberación. Se cuentan por ejercicio y no por sesión del cliente:
       -- volver al gimnasio no es volver al patrón.
       (select count(distinct e.fecha) from ejecucion_registros e
         where e.gym_client_id = l.gym_client_id
           and e.ejercicio_id = l.ejercicio_id
           and e.fecha > l.liberado_el) as sesiones_hechas,
       greatest(0, l.sesiones_req -
         (select count(distinct e.fecha) from ejecucion_registros e
           where e.gym_client_id = l.gym_client_id
             and e.ejercicio_id = l.ejercicio_id
             and e.fecha > l.liberado_el)) as sesiones_restantes
from liberadas l
-- Sólo mientras la reentrada esté en curso. Terminada, la fila desaparece y la
-- progresión vuelve a ser la normal: nada que limpiar a mano.
where (select count(distinct e.fecha) from ejecucion_registros e
        where e.gym_client_id = l.gym_client_id
          and e.ejercicio_id = l.ejercicio_id
          and e.fecha > l.liberado_el) < l.sesiones_req;

grant select on gym_reentrada to authenticated;
grant select on gym_reentrada to anon;

notify pgrst, 'reload schema';

-- Confirma qué quedó instalado. Las cuatro columnas tienen que dar lo indicado.
select (select count(*) from information_schema.columns
         where table_name='gym_incidencias'
           and column_name in ('patron_bloqueado','patron_dias','bloque_dirigido',
                               'reentrada','liberado_el'))            as columnas_5,
       (select count(*) from pg_views where viewname='gym_superposicion') as vista_sup_1,
       (select count(*) from pg_views where viewname='gym_reentrada')     as vista_reen_1,
       (select count(*) from pg_proc  where proname='fn_liberar_patron')  as funcion_1;
