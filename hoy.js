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

export function construirHoy({ gym = [], fisio = [], descartes = [], reportes = [], config = {}, hoy = HOY(), topeIndividual = 9 }) {
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

  // ── REPORTES DE DOLOR DEL PORTAL, UNO POR UNO ─────────────────────────
  // Antes era un solo aviso por cliente con el CONTEO de sesiones: "2 sesiones
  // con molestia ≥4/10". No decía dónde dolía, cuánto, qué día ni en qué
  // sesión — y con eso no se puede hacer nada. Ahora cada reporte es su propio
  // aviso, con su zona, su intensidad y su sesión, y se puede cerrar por
  // separado: atender el lumbar del martes no debe tapar la rodilla del jueves.
  // Aparecen TODOS los que manifiesten dolor, no solo los de 4 o más.
  const deBaja = new Set(gym.filter(c => c.activo === false).map(c => c.id));
  reportes.filter(r => (r.dolor || 0) > 0 && !deBaja.has(r.gym_client_id)).forEach(r => {
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

  return {
    visibles, ocultos, proximos, grupos,
    conteo: { critico: criticos.length, atencion: atencion.length,
      proximos: proximos.length,
      manten: grupos.reduce((s, g) => s + g.lista.length, 0) },
    total: criticos.length + atencion.length,
    todoAlDia: criticos.length === 0 && atencion.length === 0 && proximos.length === 0,
    generado: hoy,
  };
}
