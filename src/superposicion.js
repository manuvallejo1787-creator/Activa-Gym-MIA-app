// superposicion.js — ESCALÓN 2: EL BLOQUE DIRIGIDO QUE NO TOCA EL PLAN
//
// POR QUÉ EXISTE ESTE ARCHIVO Y NO ESTÁ ADENTRO DE api/portal.js
// Estaba. Y era lógica que no se podía probar: la composición del plan vivía
// inline en el handler, así que la única forma de verificarla era desplegar y
// mirar el portal de un cliente real. La norma pide análisis de salud después
// de cada intervención, y una regla que sólo se puede comprobar en producción
// no se puede analizar. Acá es una función pura con su arnés.
//
// Además lo leen los dos lados: api/portal.js para componer y rechazar, y la
// app para pintar el mismo bloqueo en la pantalla de sala. Una sola
// definición — el 29/10 dos listas blancas de estados en dos archivos dejaron
// seis estados invisibles, y no se repite.
//
// QUÉ DECIDIÓ MANU (30/10)
// El bloque dirigido se inserta en el plan de gym SIN borrar la rutina
// original: se bloquea la carga de datos del patrón afectado y a continuación
// se agrega el bloque nuevo.
//
// POR QUÉ SUPERPOSICIÓN Y NO ESCRITO EN gym_planes.dias
// Escribirlo obligaría a des-escribirlo cuando el bloqueo se levanta. Ese
// segundo mecanismo puede fallar, y si falla el plan queda mutado para siempre
// con un bloque de rehab que ya no corresponde — y nadie se entera, porque el
// plan se ve normal. Como superposición, cuando tg_liberar_patron pasa la
// incidencia a 'resuelta' las vistas dejan de devolver la fila y la rutina
// vuelve intacta sola. Cero código para deshacerlo.

// ¿Aplica esta fila al día `diaId`? `patron_dias` vacío = todos los días, que
// es el caso normal: un dolor de rodilla no distingue entre el día de pierna y
// el día full body. La lista existe para el caso raro de bloquear un solo día.
const aplicaAlDia = (dias, diaId) => {
  const d = dias || [];
  return !d.length || d.includes(diaId);
};

// ── EL RECHAZO DE LA ESCRITURA ────────────────────────────────────────────
// Lo usa api/portal.js en el POST. Devuelve la fila que bloquea, o null.
//
// La barrera va en el SERVIDOR y no en el portal: pintar el ejercicio de
// solo-lectura no alcanza porque un portal cacheado manda el POST igual, y
// cachés viejos del portal son un problema observado acá — es la razón por la
// que existe PORTAL_V. Si la única barrera estuviera en el cliente, el patrón
// que el riel bloqueó seguiría recibiendo carga sin que nadie se enterara.
export function bloqueoDe(superposicion = [], ejercicioId, diaId = null) {
  if (!ejercicioId) return null;
  return (superposicion || []).find(s =>
    s && s.bloquea_carga &&
    (s.patron_bloqueado || []).includes(ejercicioId) &&
    (diaId == null || aplicaAlDia(s.patron_dias, diaId))
  ) || null;
}

// El mensaje que lee el CLIENTE cuando el servidor le rechaza la carga. Vive
// acá y no en el handler para que el arnés pueda verificar que explica el
// motivo en lugar de decir "error al guardar": el cliente reportó una molestia
// y la app tomó una conducta — eso se dice, no se esconde detrás de un error.
export function mensajeBloqueo(hit) {
  const zona = hit && hit.zona ? String(hit.zona).replace(/_/g, ' ') : '';
  return 'Este ejercicio está sustituido mientras se revisa la molestia que reportaste' +
    (zona ? ` en ${zona}` : '') +
    '. Hacé el bloque dirigido que aparece al final del día y cargá ahí.';
}

// ── EL ÍNDICE DE REENTRADAS ───────────────────────────────────────────────
// La vista gym_reentrada devuelve una fila por ejercicio en reentrada. Se
// indexa por ejercicio porque es así como la consultan sugerirPeso y el
// portal, uno por uno mientras pintan.
export function indexarReentradas(filas = []) {
  const out = {};
  (filas || []).forEach(r => {
    if (!r || !r.ejercicio_id) return;
    out[r.ejercicio_id] = {
      pct: Number(r.pct), sesiones_req: r.sesiones_req,
      sesiones_hechas: r.sesiones_hechas, sesiones_restantes: r.sesiones_restantes,
      liberado_el: r.liberado_el, zona: r.zona || null, incidenciaId: r.incidencia_id,
    };
  });
  return out;
}

// ── LA COMPOSICIÓN ────────────────────────────────────────────────────────
// Devuelve un plan NUEVO con las marcas puestas y los bloques dirigidos
// agregados, más el índice de bloqueados y los nombres a inyectar. No muta el
// plan que recibe: el original tiene que seguir siendo el original, que es el
// punto entero de hacerlo por superposición.
export function componerPlan({ plan, superposicion = [] } = {}) {
  const bloqueados = {};
  const nombresNuevos = {};
  const mediaNueva = {};
  const dirigidos = [];

  (superposicion || []).forEach(s => {
    if (!s) return;
    if (s.bloquea_carga) {
      (s.patron_bloqueado || []).forEach(exId => {
        // El primero gana: si dos incidencias bloquean el mismo ejercicio,
        // mostrar dos motivos no ayuda a nadie en un celular.
        if (!bloqueados[exId]) bloqueados[exId] = {
          incidenciaId: s.incidencia_id, zona: s.zona || null,
          escalon: s.escalon, estado: s.estado, motivo: s.motivo || '',
        };
      });
    }
    if (s.suma_bloque && s.bloque_dirigido) dirigidos.push(s);
  });

  if (!plan || !Array.isArray(plan.dias)) {
    return { plan, bloqueados, nombres: nombresNuevos, media: mediaNueva };
  }

  const dias = plan.dias.map(dia => {
    const blocks = (dia.blocks || []).map(b => ({
      ...b,
      exercises: (b.exercises || []).map(be => {
        if (!be || !be.exId) return be;
        const s = bloqueoDe(superposicion, be.exId, dia.id);
        if (!s) return be;
        return { ...be, bloqueado: bloqueados[be.exId] };
      }),
    }));

    // El bloque dirigido va AL FINAL del día: "a continuación se agrega el
    // bloque nuevo". Después de la rutina, no en lugar de ella.
    dirigidos.forEach(s => {
      const bd = s.bloque_dirigido || {};
      const exs = Array.isArray(bd.exercises) ? bd.exercises : [];
      if (!exs.length) return;
      if (!aplicaAlDia(bd.dias, dia.id)) return;
      blocks.push({
        type: `🎯 Bloque dirigido — ${bd.region || 'rehab'}${bd.fase ? ` · ${bd.fase}` : ''}`,
        dirigido: true, incidenciaId: s.incidencia_id, zona: s.zona || null,
        escalon: s.escalon, notaBloque: bd.nota || '',
        exercises: exs.map(e => ({
          exId: e.exId,
          params: { series: e.series || 3, reps: e.reps || '', descanso: e.descanso || '' },
          dirigido: true, anotacion: e.notas || '',
        })),
      });
      // Los ejercicios de REHAB_DB no están en la tabla `ejercicios`: viven en
      // el código de la app, y el portal no importa el bundle. El nombre viaja
      // DENTRO de bloque_dirigido justamente por eso, y se devuelve acá para
      // que el portal los pinte por el mismo camino que el resto.
      exs.forEach(e => {
        if (!e || !e.exId) return;
        if (!nombresNuevos[e.exId]) nombresNuevos[e.exId] = e.nombre || e.exId;
        if (e.media_url && !mediaNueva[e.exId]) {
          mediaNueva[e.exId] = { url: e.media_url, tipo: e.media_tipo || 'imagen', desc: e.desc || '' };
        }
      });
    });

    return { ...dia, blocks };
  });

  return { plan: { ...plan, dias }, bloqueados, nombres: nombresNuevos, media: mediaNueva };
}
