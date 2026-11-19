// ═══════════════════════════════════════════════════════════════════════════
// hoy.js — LA BANDEJA DE HOY
//
// Convierte el estado del centro en una lista corta de cosas que hacer hoy,
// ordenada por consecuencia. Es determinista: mismos datos, misma bandeja.
//
// POR QUÉ HAY TOPES Y AGRUPACIONES
// Contando todo, el centro genera ~58 avisos, y 27 son de una sola categoría
// (screening vencido). Una bandeja honesta que los liste todos se cierra el
// primer día y no se abre nunca más. Así que:
//   · Lo que implica riesgo o una decisión clínica va con nombre y apellido.
//   · Lo que es mantenimiento de datos va agrupado en un renglón con contador.
//   · Tope de ítems individuales visibles; el resto queda detrás de "ver todo".
//
// TRES NIVELES
//   critico   → alguien puede lastimarse o hay una decisión clínica esperando
//   atencion  → compromiso con el cliente o plata comprometida sin entregar
//   manten    → calidad de datos: importa, no es de hoy
// ═══════════════════════════════════════════════════════════════════════════

import { PERIODIZACIONES, parseDuracionSemanas } from "./planificacion.js";
import { estadoDe as estadoIncidencia, esPendiente, escalonDe, etiquetaEstado,
         fechaVence, zonaTexto, naturalezaTexto } from "./incidencias.js";
import { decidir, textoAviso, sugerirVinculos, etiquetaFase } from "./puenteClinica.js";

// ─── VENCIMIENTOS ─────────────────────────────────────────────────────────
// Plazos por defecto; se pueden cambiar en centro_config sin tocar código.
// 4 meses calendario para las dos cosas. Es la estructura de los planes de
// mensualidad del centro, no un criterio fisiológico: los plazos cortos son
// operativamente inviables acá. El plazo de screening es solo RESPALDO —
// cuando la ficha del cliente tiene "Próxima evaluación", esa fecha manda.
export const PLAZOS = { screening: 120, test: 120, aviso: 7 };

// Fase del ciclo en la que está el cliente HOY, y cuándo termina.
// Las fases traen sus semanas como '1–4' / '5-9': se parsean los dos bordes.
// Si el cliente pasó la última fase, el ciclo entero está vencido.
export function faseActual(periodizacionId, cicloInicio, hoyStr) {
  const per = PERIODIZACIONES[periodizacionId];
  if (!per || !cicloInicio) return null;
  const d = diasDesde(cicloInicio, hoyStr);
  if (d == null || d < 0) return null;
  const semana = Math.floor(d / 7) + 1;
  const base = new Date(String(cicloInicio).slice(0, 10) + 'T12:00');
  const fechaDeSemana = (n) => new Date(base.getTime() + (n - 1) * 7 * 864e5).toISOString().slice(0, 10);
  const fases = per.fases || [];

  // ── Formato A: rango ABSOLUTO de semanas → '1–4', '5-9' ───────────────
  const abs = fases.map(f => { const m = String(f.semanas || '').match(/^\s*(\d+)\s*[–-]\s*(\d+)\s*$/); return m ? [+m[1], +m[2]] : null; });
  // ── Formato B: duración RELATIVA → '4–6 sem', '2 sem'. Se encadenan.
  const rel = fases.map(f => { const m = String(f.semanas || '').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*sem/i); return m ? [+m[1], +(m[2] || m[1])] : null; });

  let tramos = null;
  if (abs.every(Boolean) && abs.length) {
    tramos = abs.map((r, i) => ({ i, desde: r[0], hasta: r[1] }));
  } else if (rel.every(Boolean) && rel.length) {
    // Se planifica con el borde ALTO de cada fase: adelantar un cambio de fase
    // es una decisión del profesional, no del calendario.
    let acum = 0;
    tramos = rel.map((r, i) => { const desde = acum + 1; acum += r[1]; return { i, desde, hasta: acum, rango: r }; });
  }

  // ── Formato C: rotación semanal (DUP, conjugado, fitness general).
  // No hay transición de fase que avisar: el estímulo rota dentro de cada
  // semana o cada 3 semanas. Lo que vence es el CICLO completo.
  if (!tramos) {
    const semTotal = parseDuracionSemanas(per.duracion) || null;
    if (!semTotal) return { sinCalendario: true, per: per.nombre, semana, rotativa: true };
    const finCiclo = fechaDeSemana(semTotal + 1);
    return {
      rotativa: true, per: per.nombre, semana, semanasCiclo: semTotal,
      finCiclo, diasParaFinCiclo: diasDesde(hoyStr, finCiclo),
      cicloTerminado: semana > semTotal,
      diasDesdeFin: semana > semTotal ? diasDesde(finCiclo, hoyStr) : null,
    };
  }

  const ultimo = tramos[tramos.length - 1];
  const enCurso = tramos.find(t => semana >= t.desde && semana <= t.hasta);
  if (!enCurso) {
    const finCiclo = fechaDeSemana(ultimo.hasta + 1);
    return { cicloTerminado: true, per: per.nombre, semana, totalFases: tramos.length,
      finCiclo, diasDesdeFin: diasDesde(finCiclo, hoyStr) };
  }
  const f = fases[enCurso.i];
  const finFase = fechaDeSemana(enCurso.hasta + 1);   // primer día fuera de la fase
  return {
    cicloTerminado: false, rotativa: false, per: per.nombre, semana,
    fase: f.nombre, faseIdx: enCurso.i, totalFases: tramos.length,
    semanaDeFase: semana - enCurso.desde + 1, semanasFase: enCurso.hasta - enCurso.desde + 1,
    reps: f.reps, intensidad: f.intensidad, rir: f.rir,
    finFase, diasParaFinFase: diasDesde(hoyStr, finFase),
    esUltima: enCurso.i === tramos.length - 1,
    siguiente: fases[enCurso.i + 1]?.nombre || null,
    aproximada: !!enCurso.rango && enCurso.rango[0] !== enCurso.rango[1],
  };
}

export const SEV = {
  critico:  { k: 'critico',  label: 'Resolver hoy',  color: '#DC2626', bg: '#FEF2F2', orden: 0 },
  atencion: { k: 'atencion', label: 'Esta semana',   color: '#D97706', bg: '#FFFBEB', orden: 1 },
  proximo:  { k: 'proximo',  label: 'Vence en 7 días', color: '#0E7490', bg: '#ECFEFF', orden: 2 },
  manten:   { k: 'manten',   label: 'Cuando puedas', color: '#0E7490', bg: '#ECFEFF', orden: 2 },
};

const HOY = () => new Date().toISOString().slice(0, 10);
// Días transcurridos de `desde` a `hasta` (positivo si `desde` es anterior).
export function diasDesde(desde, hasta) {
  if (!desde || !hasta) return null;
  const a = new Date(String(desde).slice(0, 10) + 'T12:00');
  const b = new Date(String(hasta).slice(0, 10) + 'T12:00');
  if (isNaN(a) || isNaN(b)) return null;
  const n = Math.round((b - a) / 864e5);
  return (n < -3650 || n > 3650) ? null : n;
}
const dias = (desde, hasta = HOY()) => {
  if (!desde) return null;
  const d = new Date(String(desde).slice(0, 10) + 'T12:00');
  if (isNaN(d)) return null;
  const n = Math.round((new Date(hasta + 'T12:00') - d) / 864e5);
  return (n < -3650 || n > 3650) ? null : n;   // fecha corrupta: se ignora
};
const sumarDias = (fecha, n) => {
  const d = new Date(String(fecha).slice(0, 10) + 'T12:00');
  return isNaN(d) ? '—' : new Date(d.getTime() + n * 864e5).toISOString().slice(0, 10);
};
const nom = (x) => `${x.nombre || ''} ${x.apellido || ''}`.trim();
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

export function construirHoy({ gym = [], fisio = [], descartes = [], reportes = [], incidencias = [], puente = [], sueltos = [], cambiosFase = [], config = {}, hoy = HOY(), topeIndividual = 9 }) {
  const PZ = { ...PLAZOS, screening: config.venc_screening_dias ?? PLAZOS.screening,
    test: config.venc_test_dias ?? PLAZOS.test, aviso: config.aviso_previo_dias ?? PLAZOS.aviso };
  const items = [];
  // Estado guardado de cada aviso. `resuelto` y `descartado` lo ocultan hasta
  // la fecha `hasta`; `atendido` y `en_proceso` lo dejan visible CON su marca,
  // porque algo atendido que sigue pendiente no debe desaparecer de la vista.
  const estadoDe = (key) => descartes.find(d => d.item_key === key) || null;
  const oculto = (key) => {
    const e = estadoDe(key);
    if (!e) return false;
    if (e.estado === 'atendido' || e.estado === 'en_proceso') return false;
    return !e.hasta || e.hasta >= hoy;
  };
  const add = (it) => {
    if (oculto(it.key)) return;
    const e = estadoDe(it.key);
    items.push(e && (e.estado === 'atendido' || e.estado === 'en_proceso')
      ? { ...it, estadoGuardado: e.estado, estadoNota: e.motivo || '' } : it);
  };

  // ── CRÍTICO ────────────────────────────────────────────────────────────

  // ── EL RIEL: INCIDENCIAS CON ESCALÓN ───────────────────────────────────
  //
  // POR QUÉ ESTÁN ACÁ Y NO SOLO EN SALA
  // El escalón 1 —pedir una valoración— se eligió notificar por RESUMEN
  // DIARIO. Sin esto el resumen no existía: las valoraciones pendientes solo
  // se veían abriendo la pestaña Sala, que es justamente la que no se abre
  // cuando no hay nadie entrenando. Una valoración pendiente que nadie ve es
  // un patrón bloqueado indefinidamente, y eso ya pasó: 8 de las 10
  // incidencias históricas se cerraron sin derivación porque la única salida
  // visible era la más pesada.
  //
  // `seguimiento` NO entra acá: es el estado heredado y ya tiene su propio
  // aviso más abajo (`incid_revision`), armado desde la vista de Hoy. Meterlo
  // también acá daría dos renglones para la misma revisión.
  const nombreDe = (cid) => {
    const c = gym.find(x => x.id === cid);
    return c ? nom(c) : 'Cliente';
  };
  const clienteDeBaja = (cid) => gym.find(x => x.id === cid)?.activo === false;

  // Lo que el riel ya sabe sobre cada zona de cada cliente. Lo consume el
  // bloque de reportes de dolor de abajo para no decir dos veces lo mismo.
  const rielPorZona = new Map();   // `${cliente}|${zona}` → incidencia
  incidencias.forEach(i => {
    if (!i.zona) return;
    const k = `${i.gym_client_id}|${i.zona}`;
    const prev = rielPorZona.get(k);
    // Si hay varias para la misma zona gana la más reciente: es la que
    // describe el estado actual del patrón.
    if (!prev || String(i.fecha || '') > String(prev.fecha || '')) rielPorZona.set(k, i);
  });

  const cronicosEnSilencio = [];   // líneas de base vigentes: registran y callan

  incidencias.forEach(i => {
    const est = estadoIncidencia(i);
    if (est === 'seguimiento' || est === 'resuelta') return;
    if (clienteDeBaja(i.gym_client_id)) return;      // de baja: no está entrenando

    const nombre = nombreDe(i.gym_client_id);
    // Las 10 incidencias cargadas a mano antes del riel tienen `zona = ''`:
    // la zona vivía en la nota libre ("Hombro derecho tendinosis…"). Sin este
    // reemplazo el título decía "Antonela: zona sin especificar sin conducta
    // definida", que además de ilegible suena a error de la app.
    const conZona = !!i.zona;
    const zona = conZona ? zonaTexto(i.zona) : 'incidencia';
    const nat = naturalezaTexto(i.naturaleza);
    const d = dias(i.fecha, hoy);
    const desde = d == null ? '' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${plural(d, 'día', 'días')}`;
    const esc = escalonDe(i);
    const ficha = `${conZona ? zona : 'sin zona registrada'}${nat ? ` · ${nat}` : ''}` +
      (i.banda ? ` · ${i.banda}` : '') +
      (i.origen === 'feedback' ? ' · lo reportó el cliente en el portal' : i.origen ? ` · ${i.origen}` : '') +
      (desde ? ` · ${desde}` : '');

    // ── Línea de base vigente: no es un aviso, es lo contrario ───────────
    // Está acá y no afuera porque es el único lugar donde se puede verificar
    // que la decisión sigue vigente. Vencida sube a aviso; viva se cuenta en
    // un renglón agrupado para que se sepa que está haciendo su trabajo.
    if (est === 'linea_base') {
      const vence = fechaVence(i);
      if (!esPendiente(i, hoy)) {
        cronicosEnSilencio.push({ id: i.gym_client_id, nombre: `${nombre} (${zona})`, vence });
        return;
      }
      const dv = dias(vence, hoy);
      add({
        key: `base_vencida:${i.id}`, sev: 'atencion', icono: '📌',
        titulo: `Revalorar el crónico de ${nombre}: ${zona}`,
        detalle: `La línea de base venció ${dv === 0 ? 'hoy' : `hace ${plural(dv, 'día', 'días')}`}` +
          ` (del ${vence})` + (i.notas_seguimiento ? ` · veredicto anterior: “${i.notas_seguimiento}”` : ''),
        rank: 600 + (dv || 0), clienteId: i.gym_client_id, incidenciaId: i.id, escalon: esc, estado: 'base_vencida',
        accion: { label: 'Abrir el riel de sala', tab: 'sala', clienteId: i.gym_client_id },
        porQue: 'Una línea de base dice "esto es su normal" con fecha de caducidad. Vencida, el riel dejó de disparar sobre una zona que nadie volvió a mirar.',
      });
      return;
    }

    // ── Los tres estados que piden una acción ────────────────────────────
    // La zona va como SUFIJO y no incrustada en la frase: así el título sigue
    // leyéndose cuando no hay zona, que es el caso de todo lo cargado a mano
    // antes del riel.
    const z = conZona ? `: ${zona}` : '';
    const AVISO = {
      valoracion_pendiente: {
        sev: 'critico', icono: '🔍', rank: 900,
        titulo: `Valoración pendiente de ${nombre}${z}`,
        porQue: 'El patrón está sustituido y sin progresar, y así se queda hasta que haya veredicto. No vence por tiempo a propósito: la app no premia la demora.',
      },
      valoracion_hecha: {
        sev: 'critico', icono: '🧭', rank: 920,
        titulo: `${nombre} está valorada y sin rutear${z}`,
        porQue: 'Hay veredicto escrito y el patrón sigue bloqueado. Falta la decisión: baja a sala, bloque dirigido, clínica o crónico conocido.',
      },
      abierta: {
        sev: 'critico', icono: '⚠️', rank: 940,
        titulo: `${nombre}${z || ': incidencia'} sin conducta definida`,
        porQue: nat === 'nerviosa'
          ? 'Naturaleza nerviosa: el riel la mandó directo a escalón 3 y nadie definió conducta. Es el único patrón que no se sustituye, se deriva.'
          : 'El riel la abrió y nadie decidió qué hacer. Mientras tanto el patrón queda sustituido y sin progresar.',
      },
      declinada: {
        sev: 'atencion', icono: '✗', rank: 200,
        titulo: `${nombre} declinó el escalón${z}`,
        porQue: 'La decisión es del cliente y queda registrada. El patrón se libera solo a las 8 sesiones ejecutadas sin reporte nuevo en esa zona.',
      },
      en_sala: {
        sev: 'manten', icono: '🔧', rank: 150,
        titulo: `${nombre}${z || ': incidencia'} con ajuste en sala`,
        porQue: 'Escalón 0 corriendo. Se libera solo a las 4 sesiones ejecutadas sin reporte nuevo. Aparece acá para que el ajuste no se olvide, no para hacer algo hoy.',
      },
      programa: {
        sev: 'manten', icono: '📋', rank: 140,
        titulo: `${nombre}: bloque dirigido corriendo${conZona ? ` en ${zona}` : ''}`,
        porQue: 'Escalón 2. El patrón ya no está bloqueado: hay trabajo específico dentro del plan.',
      },
      derivada: {
        sev: 'atencion', icono: '🏥', rank: 210,
        titulo: `${nombre} está derivada a clínica${z}`,
        porQue: 'Escalón 3. El patrón queda bloqueado hasta que la clínica devuelva conducta.',
      },
    }[est];
    if (!AVISO) return;

    add({
      key: `riel:${i.id}`, sev: AVISO.sev, icono: AVISO.icono,
      titulo: AVISO.titulo,
      // "Escalón 0 · Sin conducta" es contradictorio: sin conducta no hay
      // escalón. Las incidencias viejas traen la columna en 0 porque el valor
      // por defecto es 0, no porque alguien las haya ruteado al escalón 0.
      detalle: `${est === 'abierta' ? 'Sin escalón asignado' : `Escalón ${esc}`} · ${etiquetaEstado(i)} · ${ficha}` +
        (i.nota ? ` · “${i.nota}”` : ''),
      rank: AVISO.rank + (d || 0), clienteId: i.gym_client_id, incidenciaId: i.id, escalon: esc, estado: est,
      accion: { label: 'Abrir el riel de sala', tab: 'sala', clienteId: i.gym_client_id },
      porQue: AVISO.porQue,
    });
  });

  // ── EL PUENTE CLÍNICA ↔ GIMNASIO ───────────────────────────────────────
  //
  // POR QUÉ ESTÁ EN LA BANDEJA Y NO EN LA PANTALLA DE FISIO
  // Porque la consecuencia es del gimnasio. Un alta de clínica que sólo se ve
  // abriendo FisioActiva es un cliente que se queda con el patrón bloqueado
  // hasta que alguien, por casualidad, abre esa pestaña. Es el mismo error que
  // tenía el escalón 1 antes del resumen diario.
  //
  // LA DECISIÓN QUE ESTO IMPLEMENTA (Manu, 30/10): hacia abajo la app actúa
  // sola y acá sólo se informa; hacia arriba NUNCA actúa sola y acá está el
  // toque que lo aplica.
  puente.forEach(fila => {
    const d = decidir(fila);
    if (d.accion === 'nada') return;
    const t = textoAviso(d, fila.nombre || 'El cliente');
    if (!t) return;

    // 'bloquear' es lo único crítico de este bloque: la clínica bajó la fase y
    // el patrón TODAVÍA NO está bloqueado, así que el cliente puede cargarlo
    // hoy. Lo demás es servicio, no riesgo: confirmar un alta tarde retiene a
    // alguien de más, que es molesto pero no peligroso.
    const sev = d.accion === 'bloquear' ? 'critico'
      : d.accion === 'revisar' ? 'atencion' : 'atencion';
    add({
      key: `puente_${d.accion}:${fila.gym_client_id}`,
      sev, icono: d.accion === 'bloquear' ? '🏥' : d.accion === 'revisar' ? '❓' : '🎓',
      titulo: t.titulo,
      detalle: `Gimnasio: ${etiquetaFase(fila.fase_gym)} · Clínica: ${etiquetaFase(fila.fase_clinica)}` +
        (fila.fecha_eval ? ` · evaluación del ${fila.fecha_eval}` : '') +
        (fila.region ? ` · ${fila.region}` : '') +
        ` · ${fila.planes_activos || 0} plan${(fila.planes_activos || 0) === 1 ? '' : 'es'} activo${(fila.planes_activos || 0) === 1 ? '' : 's'}`,
      rank: d.accion === 'bloquear' ? 950 : 700,
      clienteId: fila.gym_client_id,
      // Lo consume App.jsx para ofrecer el botón de un toque que corresponda.
      puente: { ...d, clienteId: fila.gym_client_id, nombre: fila.nombre,
        evaluacionId: fila.evaluacion_id || null },
      accion: { label: d.accion === 'bloquear' ? 'Abrir el riel de sala' : 'Abrir ficha',
        tab: d.accion === 'bloquear' ? 'sala' : 'clientes', clienteId: fila.gym_client_id },
      porQue: t.porQue,
    });
  });

  // ── LO QUE LA APP HIZO SOLA ────────────────────────────────────────────
  // Una bajada automática deja las dos fases iguales, así que la vista del
  // puente deja de mostrarla. Sin este renglón la app le cambiaría la fase a
  // un cliente y nadie se enteraría nunca — y una automatización invisible no
  // se puede auditar ni desarmar.
  cambiosFase.filter(c => c.origen === 'clinica_automatico').forEach(c => {
    const dd = dias(String(c.fecha || '').slice(0, 10), hoy);
    if (dd == null || dd > 7) return;            // una semana a la vista, no para siempre
    const g = gym.find(x => x.id === c.gym_client_id);
    add({
      key: `fase_auto:${c.id}`, sev: 'manten', icono: '⬇️',
      titulo: `La app bajó a ${g ? nom(g) : 'un cliente'} de ${etiquetaFase(c.fase_de)} a ${etiquetaFase(c.fase_a)}`,
      detalle: (c.nota || 'Bajada automática por indicación de la clínica.') +
        (dd === 0 ? ' · hoy' : dd === 1 ? ' · ayer' : ` · hace ${plural(dd, 'día', 'días')}`),
      rank: 100 - dd, clienteId: c.gym_client_id,
      accion: { label: 'Ver ficha', tab: 'clientes', clienteId: c.gym_client_id },
      porQue: 'No hay nada que hacer: se informa para que quede constancia de que la fase la movió la app y no una persona. Bajar es el lado seguro y no espera a nadie.',
    });
  });

  // ── REPORTES DE DOLOR DEL PORTAL, UNO POR UNO ─────────────────────────
  // Antes era un solo aviso por cliente con el CONTEO de sesiones: "2 sesiones
  // con molestia ≥4/10". No decía dónde dolía, cuánto, qué día ni en qué
  // sesión — y con eso no se puede hacer nada. Ahora cada reporte es su propio
  // aviso, con su zona, su intensidad y su sesión, y se puede cerrar por
  // separado: atender el lumbar del martes no debe tapar la rodilla del jueves.
  // Aparecen TODOS los que manifiesten dolor, no solo los de 4 o más.
  //
  // LO QUE EL RIEL YA TOMÓ NO SE REPITE ACÁ
  // Desde el 29/10 el disparador crea una incidencia por cada molestia
  // reportada, así que sin este filtro cada molestia salía DOS veces: una como
  // reporte crudo y otra como incidencia con conducta. Dos renglones para un
  // problema y dos lugares donde cerrarlo. Gana el del riel, que es el que
  // tiene escalón y botones de conducta; el reporte crudo queda como el dato
  // que lo originó.
  const deBaja = new Set(gym.filter(c => c.activo === false).map(c => c.id));
  const yaEnElRiel = (r) => {
    const i = rielPorZona.get(`${r.gym_client_id}|${r.dolor_zona || ''}`);
    if (!i) return false;
    const est = estadoIncidencia(i);
    if (est === 'resuelta') return false;             // cerrada: el reporte nuevo vuelve a contar
    // Una línea de base VENCIDA ya generó su propio aviso arriba; viva, el
    // silencio es su función. En los dos casos el reporte crudo no aporta.
    if (est === 'linea_base') return true;
    // Sólo absorbe reportes de la incidencia en curso o anteriores. Uno
    // POSTERIOR a su última fecha es información nueva que el disparador no
    // alcanzó a rutear, y esconderlo sería perder el dato.
    return String(r.fecha || '') <= String(i.fecha || '').slice(0, 10);
  };
  reportes.filter(r => (r.dolor || 0) > 0 && !deBaja.has(r.gym_client_id) && !yaEnElRiel(r)).forEach(r => {
    const c = gym.find(x => x.id === r.gym_client_id) || { nombre: r.cliente_nombre || 'Cliente', apellido: '' };
    const d = dias(r.fecha, hoy);
    const cuando = d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${plural(d, 'día', 'días')}`;
    const fuerte = r.dolor >= 4;
    add({
      key: `dolor_reporte:${r.id}`,          // por reporte: uno nuevo no queda tapado por uno viejo cerrado
      sev: fuerte ? 'critico' : 'atencion', icono: '🩹',
      titulo: `${nom(c)}: ${r.dolor_zona || 'zona sin especificar'} ${r.dolor}/10 — ${cuando}`,
      detalle: `${r.fecha}${r.dia_nombre ? ` · ${r.dia_nombre}` : ''}${r.semana ? ` · semana ${r.semana}` : ''}` +
               ` · esfuerzo percibido ${r.rpe_sesion}/10` +
               (r.energia != null ? ` · energía ${r.energia}/5` : '') +
               (r.nota ? ` · “${r.nota}”` : '') +
               (r.dolor_zona ? '' : ' · reportado antes de que la encuesta pidiera la zona'),
      rank: r.dolor * 10 - (d || 0),          // más dolor y más reciente, más arriba
      clienteId: r.gym_client_id,
      accion: { label: 'Abrir el riel de sala', tab: 'sala', clienteId: r.gym_client_id },
      porQue: fuerte
        ? 'Lo reportó el propio cliente. Mientras no se decida qué hacer con ese ejercicio, sigue entrenando con dolor.'
        : 'Molestia leve: puede ser normal del entrenamiento o el principio de algo. Si se repite en la misma zona, deja de ser leve.',
    });
  });

  // Revisión de incidencia de sala pasada de fecha.
  gym.filter(c => dias(c.incidencia_revision) > 0).forEach(c => add({
    key: `incid_revision:${c.id}`, sev: 'critico', icono: '⚠️',
    titulo: `Revisión pendiente de ${nom(c)}`,
    detalle: `La incidencia quedó en seguimiento y la revisión venció hace ${plural(dias(c.incidencia_revision), 'día', 'días')}`,
    accion: { label: 'Ver incidencias', tab: 'sala', clienteId: c.id },
    porQue: 'Una incidencia en seguimiento sin revisar es una lesión que nadie cerró.',
  }));

  // Reevaluación clínica vencida: el plan sigue corriendo sobre datos viejos.
  fisio.filter(p => !p.tiene_alta && dias(p.reeval_proxima) > 0).forEach(p => add({
    key: `reeval:${p.id}`, sev: 'critico', icono: '🩺',
    titulo: `Reevaluar a ${nom(p)}`,
    detalle: `Vencida hace ${plural(dias(p.reeval_proxima), 'día', 'días')}` +
             (p.eva_ultimo ? ` · último EVA ${p.eva_ultimo}/10` : ''),
    accion: { label: 'Nueva evaluación', tab: 'fisio', pacienteId: p.id },
    porQue: 'Sin reevaluar, el tratamiento avanza sobre mediciones que ya no describen al paciente.',
  }));

  // Carga percibida al límite de forma sostenida.
  gym.filter(c => (c.rpe_ultimas_2sem || 0) >= 8.5).forEach(c => add({
    key: `rpe_alto:${c.id}`, sev: 'critico', icono: '🔥',
    titulo: `${nom(c)} viene al límite`,
    detalle: `RPE ${c.rpe_ultimas_2sem}/10 promedio en las últimas 2 semanas`,
    accion: { label: 'Abrir ficha', tab: 'clientes', clienteId: c.id },
    porQue: 'Con RPE 8,5 sostenido, subir carga acumula fatiga en vez de adaptación.',
  }));

  // ── ATENCIÓN ───────────────────────────────────────────────────────────

  // Plan vencido: el cliente entrena sin plan vigente.
  gym.filter(c => dias(c.plan_vence) > 0).forEach(c => add({
    key: `plan_vencido:${c.id}`, sev: 'atencion', icono: '📅',
    titulo: `El plan de ${nom(c)} venció`,
    detalle: `Terminó hace ${plural(dias(c.plan_vence), 'día', 'días')}` +
             (c.portal_ultimo ? ` · sigue cargando en el portal (último ${c.portal_ultimo})` : ''),
    rank: dias(c.plan_vence) || 0,
    accion: { label: 'Armar el siguiente', tab: 'constructor', clienteId: c.id },
    porQue: 'Sin plan nuevo, repite el ciclo anterior y deja de progresar.',
  }));

  // Plan por vencer: hay tiempo de cerrar el ciclo con una mini evaluación.
  gym.filter(c => { const d = dias(c.plan_vence); return d != null && d <= 0 && d >= -14; }).forEach(c => add({
    key: `plan_porvencer:${c.id}`, sev: 'atencion', icono: '⏳',
    titulo: `El plan de ${nom(c)} termina en ${plural(Math.abs(dias(c.plan_vence)), 'día', 'días')}`,
    detalle: 'Cerralo con una mini evaluación para tener comparativa del ciclo',
    rank: 14 - Math.abs(dias(c.plan_vence)),
    accion: { label: 'Abrir ficha', tab: 'clientes', clienteId: c.id },
    porQue: 'Si el ciclo se cierra sin medir, se pierde la comparación y el próximo plan sale a ciegas.',
  }));

  // Paquete pago sin entregar: es plata cobrada y servicio no dado.
  fisio.filter(p => !p.tiene_alta && (p.sesiones_contratadas || 0) > (p.sesiones_hechas || 0)).forEach(p => {
    const faltan = p.sesiones_contratadas - p.sesiones_hechas;
    const sinVenir = dias(p.sesion_ultima);
    add({
      key: `sesiones_pendientes:${p.id}`, sev: 'atencion', icono: '🎫',
      titulo: `${nom(p)}: ${plural(faltan, 'sesión', 'sesiones')} sin usar`,
      detalle: p.sesion_ultima
        ? `De ${p.sesiones_contratadas} contratadas usó ${p.sesiones_hechas} · última hace ${plural(sinVenir, 'día', 'días')}`
        : `Contrató ${p.sesiones_contratadas} y todavía no vino a ninguna`,
      rank: faltan * 4,
      accion: { label: 'Agendar sesión', tab: 'fisio', pacienteId: p.id },
      porQue: 'Sesiones cobradas y no dadas: es un compromiso abierto con el paciente.',
    });
  });

  // Paciente activo que dejó de venir.
  fisio.filter(p => p.activo !== false && !p.tiene_alta && (p.sesiones_contratadas || 0) <= (p.sesiones_hechas || 0)
                 && dias(p.sesion_ultima) > 21).forEach(p => add({
    key: `fisio_ausente:${p.id}`, sev: 'atencion', icono: '📞',
    titulo: `${nom(p)} no viene hace ${plural(dias(p.sesion_ultima), 'día', 'días')}`,
    detalle: 'Sigue como paciente activo sin alta registrada',
    rank: Math.round(dias(p.sesion_ultima) / 7),
    accion: { label: 'Ver paciente', tab: 'fisio', pacienteId: p.id },
    porQue: 'O terminó el tratamiento y falta darle el alta, o lo abandonó. Las dos cosas se resuelven con un llamado.',
  }));

  // Plan clínico que llegó al final de su horizonte.
  fisio.filter(p => p.plan_inicio && p.plan_semanas &&
    dias(p.plan_inicio) > p.plan_semanas * 7).forEach(p => add({
    key: `plan_clinico_fin:${p.id}`, sev: 'atencion', icono: '🗓️',
    titulo: `El plan clínico de ${nom(p)} terminó su horizonte`,
    detalle: `${p.plan_semanas} semanas cumplidas desde el ${p.plan_inicio}`,
    rank: dias(p.plan_inicio) - p.plan_semanas * 7,
    accion: { label: 'Reevaluar y replanificar', tab: 'fisio', pacienteId: p.id },
    porQue: 'Corresponde reevaluar y decidir: alta, nuevo ciclo o cambio de enfoque.',
  }));

  // Dejó de cargar el portal: o abandonó, o entrena sin registrar.
  gym.filter(c => c.planes_activos > 0 && c.portal_registros > 0 && dias(c.portal_ultimo) > 10).forEach(c => add({
    key: `portal_frio:${c.id}`, sev: 'atencion', icono: '📉',
    titulo: `${nom(c)} no carga el portal hace ${plural(dias(c.portal_ultimo), 'día', 'días')}`,
    detalle: `Tiene plan activo y ${c.portal_registros} registros previos`,
    rank: dias(c.portal_ultimo),
    accion: { label: 'Abrir ficha', tab: 'clientes', clienteId: c.id },
    porQue: 'Venía cargando y dejó. Suele ser la primera señal de que va a dejar de venir.',
  }));

  // ── EVALUADO Y SIN PLAN ────────────────────────────────────────────────
  //
  // El agujero más caro del sistema, medido el 14/10/2026:
  //   · 27 clientes con screening completo nunca recibieron un plan
  //   · demora mediana entre evaluar y armar el plan: 33 días (máxima 112)
  //   · ninguno el mismo día
  //   · de los que esperaron sin plan, el 40% se dio de baja
  //     contra el 11% de los que sí recibieron plan
  //   · 9.000 $/mes ya perdidos en bajas, 15.150 $/mes todavía en riesgo
  //
  // No era un problema de velocidad: nadie tarda 33 días de trabajo en armar
  // un plan. Era que nada mostraba la cola. La evaluación se guardaba, se
  // cerraba la ficha, y el pendiente desaparecía de la vista.
  //
  // La ventana son los primeros días: alguien que se evaluó y todavía no
  // tiene con qué entrenar está pagando por un producto que no recibe.
  gym.filter(c => c.activo !== false && c.planes_activos === 0 && c.screening_fecha)
    .forEach(c => {
      const d = dias(c.screening_fecha);
      if (d == null || d < 2) return;   // margen razonable para armarlo
      add({
        key: `sin_plan:${c.id}`,
        sev: d > 7 ? 'critico' : 'atencion',
        icono: '📋',
        titulo: `${nom(c)} se evaluó hace ${plural(d, 'día', 'días')} y no tiene plan`,
        detalle: `Evaluación del ${c.screening_fecha}` +
          (c.test_ultimo ? ` · test de fuerza del ${c.test_ultimo}` : ' · sin test de fuerza'),
        rank: 1000 + d,   // por encima de casi todo: es plata que se va
        accion: { label: 'Armar el plan', tab: 'session', clienteId: c.id },
        porQue: d > 30
          ? 'Más de un mes esperando. De los clientes que quedaron sin plan, el 40% se dio de baja.'
          : 'Está pagando y todavía no tiene con qué entrenar. Es la ventana en la que se decide si se queda.',
      });
    });

  // ── VENCIMIENTOS DEL GYM ───────────────────────────────────────────────
  // Todo aparece con AVISO PREVIO (7 días por defecto) y vuelve a aparecer,
  // con más peso, una vez vencido. Un vencimiento que solo se ve el día
  // después ya llegó tarde.
  // Un cliente dado de baja no genera avisos: no está entrenando.
  const conPlan = gym.filter(c => c.planes_activos > 0 && c.activo !== false);

  // 1) EVALUACIÓN / SCREENING — por calendario.
  conPlan.forEach(c => {
    // La fecha de la ficha ("Próxima evaluación") tiene PRIORIDAD sobre
    // cualquier plazo calculado: la fija el profesional según el plan de
    // mensualidad del cliente y puede ser a 4 meses o al año.
    const fechaFicha = c.reeval_prevista || null;
    const fecha = fechaFicha || (c.screening_fecha ? sumarDias(c.screening_fecha, PZ.screening) : null);
    if (!fecha || fecha === '—') return;             // sin base: lo toma el grupo
    const restan = dias(hoy, fecha);
    if (restan == null || restan > PZ.aviso) return;
    const vencido = restan < 0;
    add({
      key: `venc_screening:${c.id}`, sev: vencido ? 'atencion' : 'manten', icono: '📋',
      titulo: vencido
        ? `La reevaluación de ${nom(c)} venció hace ${plural(-restan, 'día', 'días')}`
        : `Reevaluar a ${nom(c)} en ${plural(restan, 'día', 'días')}`,
      detalle: `Prevista para el ${fecha}` +
        (fechaFicha ? ' · fecha puesta en la ficha' : ` · estimada (última el ${c.screening_fecha} + ${PZ.screening} días)`) +
        (c.screening_fecha ? '' : ' · sin evaluación previa registrada'),
      rank: 300 - restan,
      accion: { label: 'Abrir ficha', tab: 'clientes', clienteId: c.id },
      porQue: vencido
        ? 'Es la reevaluación pactada con el cliente. Además, con el screening vencido el motor no puede decidir avance de fase.'
        : 'Agendala ahora: llega con la mensualidad y conviene tener el turno reservado.',
    });
  });

  // 2) TEST DE FUERZA — vence al terminar la fase en curso O al cumplir el
  //    plazo máximo, lo que ocurra primero. Un 1RM medido en acumulación no
  //    sirve para prescribir la fase de fuerza: cambió la capacidad.
  conPlan.forEach(c => {
    const f = faseActual(c.periodizacion, c.ciclo_inicio, hoy);
    const dTest = dias(c.test_ultimo);
    // Sin ningún test registrado: no hay fecha de la que contar, pero es
    // justamente el caso más importante. Antes se caía entre las dos reglas.
    if (dTest == null) {
      add({
        key: `sin_test:${c.id}`, sev: 'manten', icono: '🏋️',
        titulo: `${nom(c)} no tiene ningún test de fuerza`,
        detalle: 'Tiene plan activo · las cargas salen del historial o de una estimación por peso corporal',
        rank: 250,
        accion: { label: 'Ir a Fuerza', tab: 'fuerza', clienteId: c.id },
        porQue: 'Sin 1RM no hay porcentaje: el plan se prescribe sobre una estimación conservadora, no sobre su capacidad real.',
      });
      return;
    }
    const porPlazo = PZ.test - dTest;
    // El disparador es el CALENDARIO: 4 meses. Retestear en cada cambio de
    // fase sería lo correcto desde la planificación, pero es inviable de
    // operar con 36 clientes activos. El cambio de fase se menciona como
    // contexto para poder juntar las dos cosas en una sola sesión.
    const restan = porPlazo;
    if (restan > PZ.aviso) return;
    const vencido = restan < 0;
    const cambioCerca = (f && !f.rotativa && !f.cicloTerminado && f.diasParaFinFase != null && f.diasParaFinFase <= 21)
      ? f.diasParaFinFase : null;
    // Si la reevaluación cae cerca, se hacen en la misma visita. Con 4 meses
    // de por medio, juntar las dos cosas ahorra un turno por cliente.
    const fReeval = c.reeval_prevista || (c.screening_fecha ? sumarDias(c.screening_fecha, PZ.screening) : null);
    const dReeval = fReeval && fReeval !== '—' ? dias(hoy, fReeval) : null;
    const juntarConReeval = dReeval != null && Math.abs(dReeval - restan) <= 14 ? dReeval : null;
    const motivo = `${PZ.test} días (4 meses) desde el último test`;
    add({
      key: `venc_test:${c.id}`, sev: vencido ? 'atencion' : 'manten', icono: '🏋️',
      titulo: vencido
        ? `Retestear a ${nom(c)} — vencido hace ${plural(-restan, 'día', 'días')}`
        : `Retestear a ${nom(c)} en ${plural(restan, 'día', 'días')}`,
      detalle: `Último test ${c.test_ultimo} · ${motivo}` +
        (juntarConReeval != null
          ? ` · la reevaluación cae ${juntarConReeval < 0 ? `hace ${-juntarConReeval}d` : `en ${juntarConReeval}d`}: hacelas en la misma visita`
          : cambioCerca != null ? ` · además cambia de fase en ${cambioCerca}d` : ''),
      rank: 320 - restan,
      accion: { label: 'Ir a Fuerza', tab: 'fuerza', clienteId: c.id },
      porQue: 'Las cargas sugeridas salen del 1RM. Mientras el test esté vencido, el motor las calcula desde lo que el cliente levantó en el portal, que es menos preciso pero está al día.',
    });
  });

  // 3) RUTINA — vence cuando termina la FASE del ciclo, no cuando termina el
  //    plan. Al cambiar de fase cambian reps, intensidad y RIR: la rutina
  //    anterior deja de corresponder aunque el plan siga vigente.
  conPlan.forEach(c => {
    const f = faseActual(c.periodizacion, c.ciclo_inicio, hoy);
    if (!f || f.sinCalendario) return;
    const inferido = c.ciclo_inicio_inferido ? ' · fecha de ciclo tomada del inicio del plan' : '';

    if (f.cicloTerminado) {
      add({
        key: `ciclo_vencido:${c.id}`, sev: 'atencion', icono: '🔁',
        titulo: `${nom(c)} terminó el ciclo completo hace ${plural(f.diasDesdeFin, 'día', 'días')}`,
        detalle: `${f.per} · semana ${f.semana}${inferido}`,
        rank: 500 + f.diasDesdeFin,
        accion: { label: 'Revisar criterios de avance', tab: 'clientes', clienteId: c.id },
        porQue: 'Cerrar un ciclo es el momento de decidir si avanza de fase: revisá los criterios de avance antes de armar el plan siguiente. Después, retestear y elegir la periodización.',
      });
      return;
    }
    if (f.rotativa) {
      const r = f.diasParaFinCiclo;
      if (r == null || r > PZ.aviso) return;
      add({
        key: `ciclo_rotativo:${c.id}`, sev: r < 0 ? 'atencion' : 'manten', icono: '🔁',
        titulo: r < 0
          ? `El ciclo de ${nom(c)} venció hace ${plural(-r, 'día', 'días')}`
          : `El ciclo de ${nom(c)} termina en ${plural(r, 'día', 'días')}`,
        detalle: `${f.per} · semana ${f.semana} de ${f.semanasCiclo} · rota el estímulo cada semana, sin fases${inferido}`,
        rank: 400 - r,
        accion: { label: 'Abrir ficha', tab: 'clientes', clienteId: c.id },
        porQue: 'En una periodización ondulante no hay cambio de fase que avisar: lo que se renueva es el ciclo entero.',
      });
      return;
    }
    // Última fase por terminar: es cuando hay que revisar los criterios de
    // avance, no después. Si el ciclo cierra sin revisarlos, el cliente
    // arranca el ciclo siguiente en la misma fase por omisión.
    if (f.esUltima && f.diasParaFinFase != null && f.diasParaFinFase >= 0 && f.diasParaFinFase <= PZ.aviso) {
      add({
        key: `criterios_fin_ciclo:${c.id}`, sev: 'atencion', icono: '✅',
        titulo: `${nom(c)} cierra el ciclo en ${plural(f.diasParaFinFase, 'día', 'días')}: revisá los criterios de avance`,
        detalle: `${f.per} · última fase "${f.fase}" · nivel actual ${c.nivel || '—'}`,
        rank: 480 - f.diasParaFinFase,
        accion: { label: 'Ver criterios de avance', tab: 'clientes', clienteId: c.id },
        porQue: 'El cambio de nivel se decide con los criterios cumplidos. Si el ciclo cierra sin revisarlos, el cliente sigue en la misma fase por omisión, no por decisión.',
      });
    }
    const r = f.diasParaFinFase;
    if (r == null || r > PZ.aviso) return;
    add({
      key: `fin_fase:${c.id}`, sev: r < 0 ? 'atencion' : 'manten', icono: '🎚️',
      titulo: r < 0
        ? `La fase de ${nom(c)} terminó hace ${plural(-r, 'día', 'días')} y la rutina sigue igual`
        : `${nom(c)} cambia de fase en ${plural(r, 'día', 'días')}`,
      detalle: `${f.per} · F${f.faseIdx + 1}/${f.totalFases} "${f.fase}" (${f.reps} reps, RIR ${f.rir})` +
               (f.siguiente ? ` → "${f.siguiente}"` : ' · es la última fase del ciclo') +
               (f.aproximada ? ' · duración estimada en el borde alto' : '') + inferido,
      rank: 450 - r,
      accion: { label: 'Armar la rutina nueva', tab: 'constructor', clienteId: c.id },
      porQue: f.siguiente
        ? 'Al cambiar de fase cambian reps, intensidad y RIR. Si la rutina no cambia, el cliente repite el estímulo anterior con otro nombre.'
        : 'Termina la última fase: corresponde cerrar el ciclo con test y elegir la periodización siguiente.',
    });
  });

  // ── MANTENIMIENTO (agrupado) ───────────────────────────────────────────
  const grupos = [];
  const grupo = (key, icono, titulo, lista, accionLabel, tab, porQue) => {
    if (!lista.length || oculto(key)) return;
    grupos.push({
      key, sev: 'manten', icono, titulo: titulo(lista.length), agrupado: true,
      detalle: lista.slice(0, 5).map(nom).join(' · ') + (lista.length > 5 ? ` y ${lista.length - 5} más` : ''),
      lista: lista.map(x => ({ id: x.id, nombre: nom(x) })),
      accion: { label: accionLabel, tab }, porQue,
    });
  };

  grupo('g_screening', '📋',
    (n) => `${plural(n, 'cliente', 'clientes')} con screening vencido`,
    // Solo los que NO tienen aviso individual: los que ya tienen fecha
    // aparecen arriba con su vencimiento. Acá quedan los que no tienen fecha.
    gym.filter(c => c.planes_activos > 0 && dias(c.screening_fecha) == null),
    'Ver clientes', 'clientes',
    'Con el screening vencido, el motor no puede decidir avance de fase: quedan trabados en "faltan datos".');

  grupo('g_duplicados', '🔀',
    (n) => `${plural(n, 'cliente', 'clientes')} con más de un plan activo`,
    gym.filter(c => c.planes_activos > 1),
    'Ver clientes', 'clientes',
    'Con varios planes activos, el portal le muestra el más reciente que ya empezó. Conviene cerrar los anteriores.');

  // ── LO QUE EL RIEL ESTÁ CALLANDO A PROPÓSITO ──────────────────────────
  // Este renglón no pide nada: dice cuántas molestias NO están en la bandeja
  // porque ya se decidió que son el normal de esa persona. Sin él, marcar una
  // línea de base se siente como perder información —el hallazgo desaparece y
  // no queda señal de que la decisión existe— y la próxima vez nadie la marca.
  if (cronicosEnSilencio.length && !oculto('g_cronicos')) {
    grupos.push({
      key: 'g_cronicos', sev: 'manten', icono: '📌', agrupado: true,
      titulo: `${plural(cronicosEnSilencio.length, 'crónico conocido', 'crónicos conocidos')} sin avisar`,
      detalle: cronicosEnSilencio.slice(0, 5).map(x => x.nombre).join(' · ') +
        (cronicosEnSilencio.length > 5 ? ` y ${cronicosEnSilencio.length - 5} más` : ''),
      lista: cronicosEnSilencio.map(x => ({ id: x.id, nombre: `${x.nombre} — se revisa el ${x.vence || '—'}` })),
      accion: { label: 'Ver en sala', tab: 'sala' },
      porQue: 'Son zonas con línea de base vigente: el riel registra el reporte y no dispara. Cuando vence la revisión aparecen arriba como aviso.',
    });
  }

  // ── PACIENTES DE LA CLÍNICA SIN VINCULAR ──────────────────────────────
  // Medido el 30/10: sólo 8 de 80 clientes activos están vinculados a un
  // paciente de la clínica, y 2 pacientes no están vinculados a nadie. Todo el
  // puente corre sobre el vínculo, así que sin vínculo no corre nada — y eso
  // no se nota, porque la ausencia de avisos se parece a que todo está bien.
  //
  // Se separan en dos renglones a propósito: los que tienen un cliente del
  // mismo nombre son un toque de trabajo; los que no, hay que buscarlos a mano.
  {
    const conPar = sugerirVinculos(
      sueltos.map(s => {
        const partes = String(s.nombre || '').trim().split(' ');
        return { id: s.paciente_id, nombre: partes[0] || '', apellido: partes.slice(1).join(' ') };
      }), gym);
    const idsConPar = new Set(conPar.map(x => x.pacienteId));

    if (conPar.length && !oculto('g_vincular')) {
      grupos.push({
        key: 'g_vincular', sev: 'manten', icono: '🔗', agrupado: true,
        titulo: `${plural(conPar.length, 'paciente', 'pacientes')} de la clínica con su cliente del gym sin vincular`,
        detalle: conPar.slice(0, 5).map(x => x.nombre).join(' · ') +
          (conPar.length > 5 ? ` y ${conPar.length - 5} más` : ''),
        lista: conPar.map(x => ({ id: x.clienteId, nombre: x.nombre })),
        vinculos: conPar,
        accion: { label: 'Ver clientes', tab: 'clientes' },
        porQue: 'Coincide el nombre y apellido con un cliente activo. Mientras no estén vinculados, un alta o una bajada de fase de la clínica no llega al gimnasio: el puente entero corre sobre ese vínculo.',
      });
    }
    const sinPar = sueltos.filter(s => !idsConPar.has(s.paciente_id));
    if (sinPar.length && !oculto('g_sin_par')) {
      grupos.push({
        key: 'g_sin_par', sev: 'manten', icono: '🏥', agrupado: true,
        titulo: `${plural(sinPar.length, 'paciente', 'pacientes')} de la clínica sin cliente del gym`,
        detalle: sinPar.slice(0, 5).map(s => s.nombre).join(' · ') +
          (sinPar.length > 5 ? ` y ${sinPar.length - 5} más` : ''),
        lista: sinPar.map(s => ({ id: s.paciente_id, nombre: s.nombre })),
        accion: { label: 'Ver pacientes', tab: 'fisio' },
        porQue: 'O sólo usan la clínica —y entonces está bien así— o son candidatos a seguir en el gimnasio y nadie los invitó. Las dos cosas se resuelven mirando la lista una vez.',
      });
    }
  }

  grupo('g_sin_portal', '🔑',
    (n) => `${plural(n, 'cliente', 'clientes')} con plan y sin usar el portal`,
    gym.filter(c => c.planes_activos > 0 && (c.portal_registros || 0) === 0),
    'Ver clientes', 'clientes',
    'Nunca cargaron nada: o no tienen el enlace, o no saben usarlo.');

  // ── ORDEN Y TOPES ──────────────────────────────────────────────────────
  // Primero por nivel; dentro del nivel, por magnitud de la consecuencia
  // (días vencidos, sesiones sin dar). Sin esto el orden era el de inserción y
  // un paciente con 15 sesiones sin usar quedaba detrás de uno con 4.
  items.sort((a, b) =>
    SEV[a.sev].orden - SEV[b.sev].orden || (b.rank || 0) - (a.rank || 0));

  const criticos = items.filter(i => i.sev === 'critico');
  const atencion = items.filter(i => i.sev === 'atencion');
  // BUG QUE ESTO CORRIGE: el retorno solo incluía críticos y atención, así que
  // los ítems individuales de nivel "mantenimiento" se descartaban en silencio.
  // Ahí caían justamente TODOS los avisos previos al vencimiento — lo que hay
  // que ver una semana antes nunca llegaba a la pantalla.
  const proximos = items.filter(i => i.sev === 'manten');

  // Los críticos se muestran TODOS: no se esconde un riesgo por prolijidad.
  // El tope recorta los de atención.
  const cupoAtencion = Math.max(2, topeIndividual - criticos.length);
  const visibles = [...criticos, ...atencion.slice(0, cupoAtencion)];
  const ocultos = atencion.slice(cupoAtencion);

  // El resumen del riel se devuelve aparte de la bandeja porque tiene otro
  // destino: la bandeja se mira, el resumen se MANDA. Si fuera solo un filtro
  // de `visibles` habría que recalcularlo en la pantalla, que es como se
  // desincronizan las dos vistas de un mismo dato.
  // Se filtra por `estado`, no por icono ni por el texto del título: asertar
  // contra prosa ya costó tres bugs esta semana, el último un `like '%linea de
  // base%'` que nunca matcheó porque el dato decía "línea".
  const delRiel = items.filter(i => i.incidenciaId);
  const porEstado = (e) => delRiel.filter(i => i.estado === e);
  const riel = {
    valoraciones:  porEstado('valoracion_pendiente'),
    rutear:        porEstado('valoracion_hecha'),
    sinConducta:   porEstado('abierta'),
    basesVencidas: porEstado('base_vencida'),
    cronicos: cronicosEnSilencio,
  };
  riel.pendientes = riel.valoraciones.length + riel.rutear.length +
    riel.sinConducta.length + riel.basesVencidas.length;

  // El puente va aparte del riel aunque los dos salgan de la clínica: el riel
  // lo resuelve quien está en sala, y el puente lo confirma quien decide la
  // fase. Mezclarlos haría que el resumen diario le mande a una persona cosas
  // que no son suyas.
  const clinica = {
    confirmar: items.filter(i => i.puente && i.puente.accion === 'confirmar'),
    bloquear:  items.filter(i => i.puente && i.puente.accion === 'bloquear'),
    revisar:   items.filter(i => i.puente && i.puente.accion === 'revisar'),
    automaticas: items.filter(i => i.key.startsWith('fase_auto:')),
  };
  clinica.pendientes = clinica.confirmar.length + clinica.bloquear.length + clinica.revisar.length;

  return {
    visibles, ocultos, proximos, grupos, riel, clinica,
    conteo: { critico: criticos.length, atencion: atencion.length,
      proximos: proximos.length,
      manten: grupos.reduce((s, g) => s + g.lista.length, 0) },
    total: criticos.length + atencion.length,
    todoAlDia: criticos.length === 0 && atencion.length === 0 && proximos.length === 0,
    generado: hoy,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EL RESUMEN DIARIO DEL RIEL, EN TEXTO
//
// POR QUÉ EN TEXTO Y NO OTRO PANEL
// El escalón 1 se eligió notificar por resumen diario, y un resumen que vive
// dentro de la app es un cuarto lugar donde mirar lo mismo. Esto sale de la
// app: se copia o se manda por WhatsApp a quien tenga que hacer la valoración,
// que puede no ser quien abre la app.
//
// No hay envío automático a propósito: no hay un servicio de mensajería
// conectado, y un "resumen diario" que depende de que alguien lo mande es
// honesto. Uno que dice enviarse y no se envía, no.
// ═══════════════════════════════════════════════════════════════════════════
export function resumenRiel(H, { centro = '' } = {}) {
  const r = H?.riel;
  if (!r) return '';
  const f = new Date(String(H.generado || HOY()) + 'T12:00')
    .toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });
  const L = [`*Riel — ${f}*${centro ? ` · ${centro}` : ''}`];

  if (!r.pendientes) {
    L.push('', 'Sin valoraciones pendientes, sin incidencias sin conducta y sin líneas de base vencidas.');
  } else {
    const bloque = (titulo, lista) => {
      if (!lista.length) return;
      L.push('', `*${titulo}* (${lista.length})`);
      lista.forEach(i => L.push(`• ${i.titulo}`));
    };
    bloque('Valoraciones pendientes', r.valoraciones);
    bloque('Valoradas, falta rutear', r.rutear);
    bloque('Sin conducta definida', r.sinConducta);
    bloque('Crónicos a revalorar', r.basesVencidas);
  }

  const c = H.clinica;
  if (c && c.pendientes) {
    L.push('', `*Clínica ↔ gimnasio* (${c.pendientes})`);
    c.bloquear.forEach(i => L.push(`• ${i.titulo}`));
    c.confirmar.forEach(i => L.push(`• ${i.titulo}`));
    c.revisar.forEach(i => L.push(`• ${i.titulo}`));
  }

  if (r.cronicos.length) {
    L.push('', `_${plural(r.cronicos.length, 'crónico conocido', 'crónicos conocidos')} con línea de base vigente: el riel no avisa sobre ${r.cronicos.length === 1 ? 'esa zona' : 'esas zonas'}._`);
  }
  return L.join('\n');
}
