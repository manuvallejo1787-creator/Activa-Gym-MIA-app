// ═══════════════════════════════════════════════════════════════════════════
// motor.js — MOTOR DETERMINISTA DE EVALUACIÓN
//
// POR QUÉ EXISTE
// El análisis de una evaluación llevaba ~30 min. La app ya tenía IA para eso
// (AIAnalisisEvaluacion), pero se le pedía aritmética E interpretación al
// mismo tiempo: había que auditar cada número antes de confiar en el texto, y
// auditar cuentas ajenas cuesta casi lo mismo que hacerlas.
//
// Este módulo hace SOLO la aritmética, en JS, de forma reproducible. La IA
// después escribe prosa sobre banderas YA resueltas. Se deja de auditar
// números y se pasa a leer un texto.
//
// REGLA DE ORO — "no medido" ≠ "no cumple".
// Un criterio sin dato es una medición pendiente, no un criterio fallado.
// Confundirlos produce semáforos que parecen informados y no lo están, que es
// exactamente el modo de fallo que veníamos arrastrando (eva_reposo tapando
// eva_movimiento, columnas promovidas en null, etc.).
//
// TODAS las funciones son puras: entra data, sale objeto. Sin estado, sin red.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Escalas reales del screening del gym ──────────────────────────────────
// VERIFICADAS una por una contra los 53 clientes cargados. Cada patrón tiene
// su PROPIO vocabulario — no comparten escala. Asumir una escala única
// puntuaría mal 5 de los 6 patrones.
// Escala común de salida: 3 = óptimo · 2 = compensa/asimétrico · 1 = falla
// bilateral o marcada · 0 = no puede realizarlo.
export const CM_PATRONES = [
  { k: 'cm_squat',   label: 'Sentadilla', escala: {
      'Óptimo': 3, 'Compensaciones leves': 2, 'Compensaciones marcadas': 1, 'No puede realizarlo': 0 } },
  { k: 'cm_bisagra', label: 'Bisagra de cadera', escala: {
      'Óptimo': 3, 'Compensaciones leves': 2, 'Compensaciones marcadas': 1, 'No puede realizarlo': 0 } },
  { k: 'cm_lunge',   label: 'Zancada', escala: {
      'Óptimo D/I': 3, 'Falla derecho': 2, 'Falla izquierdo': 2, 'Falla bilateral': 1, 'No puede realizarlo': 0 },
      unilateral: true },
  { k: 'cm_sls',     label: 'Sentadilla a una pierna', escala: {
      'Estable D/I': 3, 'Inestable derecho': 2, 'Inestable izquierdo': 2, 'Inestable bilateral': 1, 'No puede realizarlo': 0 },
      unilateral: true },
  { k: 'cm_deadbug', label: 'Dead bug', escala: {
      'Óptimo': 3, 'Pierde neutro lumbar': 1, 'No puede realizarlo': 0 } },
  { k: 'cm_birddog', label: 'Bird dog', escala: {
      'Óptimo': 3, 'Rotación pélvica': 2, 'Inestabilidad marcada': 1, 'No puede realizarlo': 0 } },
];

// Detecta el lado deficitario en los patrones unilaterales
const LADO_RE = /derech/i;
const ladoDe = (valor) => {
  if (!valor) return null;
  if (/bilateral/i.test(valor)) return 'bilateral';
  if (LADO_RE.test(valor)) return 'derecho';
  if (/izquierd/i.test(valor)) return 'izquierdo';
  return null;
};

// dolorActual del screening → banda EVA equivalente
export const DOLOR_EVA = { no: 0, leve: 2, moderado: 5, intenso: 8 };

// Vigencia del dolor autoinformado en el alta. Pasado este plazo el motor lo
// considera NO MEDIDO. 60 días ≈ un ciclo de periodización.
export const VIGENCIA_SCREENING_DIAS = 60;

const num = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1) CALIDAD DE MOVIMIENTO — equivalente funcional del FMS, con lo que
//    realmente se mide en el gym: 6 patrones × 3 puntos = 18.
// ═══════════════════════════════════════════════════════════════════════════
export function calcCalidadMovimiento(screening = {}) {
  const detalle = [], faltantes = [], desconocidos = [], asimetrias = [];
  let total = 0, n = 0;
  CM_PATRONES.forEach(p => {
    const raw = screening[p.k];
    if (raw === undefined || raw === null || raw === '') { faltantes.push(p.label); return; }
    const pts = p.escala[raw];
    if (pts === undefined) { desconocidos.push(`${p.label}: "${raw}"`); return; }
    total += pts; n++;
    const lado = p.unilateral ? ladoDe(raw) : null;
    if (lado && lado !== 'bilateral') asimetrias.push({ patron: p.label, lado, valor: raw });
    detalle.push({ patron: p.label, valor: raw, puntos: pts, lado });
  });
  if (n === 0) return { medido: false, total: null, max: 0, pct: null, detalle: [], faltantes, desconocidos, asimetrias: [], deficits: [] };
  const max = n * 3;
  return {
    medido: true, total, max, n,
    pct: Math.round(total / max * 100),
    // Escalado a 21 para comparar con los umbrales tipo FMS de checkCriteriosAvance
    equivalenteFMS: Math.round(total / max * 21),
    detalle: detalle.slice().sort((a, b) => a.puntos - b.puntos),
    faltantes, desconocidos, asimetrias,
    deficits: detalle.filter(d => d.puntos <= 1).map(d => `${d.patron}: ${d.valor}`),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) Y-BALANCE — asimetría entre lados. Compuesto ant + posteromedial +
//    posterolateral. Es la única medida bilateral real que existe hoy.
// ═══════════════════════════════════════════════════════════════════════════
export function calcYBalance(screening = {}) {
  const g = (k) => num(screening[k]);
  const dAnt = g('yreach_d_ant'), iAnt = g('yreach_i_ant');
  if (dAnt === null || iAnt === null) {
    return { medido: false, difCm: null, difAntCm: null, simetrico: null };
  }
  const compD = dAnt + (g('yreach_d_pm') ?? 0) + (g('yreach_d_pl') ?? 0);
  const compI = iAnt + (g('yreach_i_pm') ?? 0) + (g('yreach_i_pl') ?? 0);
  const difAnt = Math.abs(dAnt - iAnt);
  const mayor = Math.max(compD, compI);
  return {
    medido: true,
    compD: Math.round(compD * 10) / 10,
    compI: Math.round(compI * 10) / 10,
    difCm: Math.round(Math.abs(compD - compI) * 10) / 10,
    difAntCm: Math.round(difAnt * 10) / 10,
    difPct: mayor > 0 ? Math.round(Math.abs(compD - compI) / mayor * 1000) / 10 : null,
    // Umbral habitual de riesgo en alcance anterior: > 4 cm entre lados
    simetrico: difAnt < 4,
    ladoCorto: compD < compI ? 'derecho' : 'izquierdo',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) EVA RECTOR — el dolor que gobierna la tolerancia a la carga.
//    Prioridad: incidencia de sala reciente > evaluación clínica > screening.
//    Entre reposo y movimiento manda SIEMPRE el peor (ver syncConGym).
// ═══════════════════════════════════════════════════════════════════════════
export function calcEva({ screening = {}, evaluacion = null, incidencias = [] } = {}, diasVigencia = 21) {
  const limite = Date.now() - diasVigencia * 864e5;

  const recientes = (incidencias || [])
    .filter(i => i.eva != null && new Date(i.fecha).getTime() >= limite)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (recientes.length) {
    const peor = Math.max(...recientes.map(i => num(i.eva) ?? 0));
    return { medido: true, eva: peor, origen: 'incidencia de sala', fecha: recientes[0].fecha };
  }

  if (evaluacion) {
    const r = num(evaluacion.eva_reposo) ?? num(evaluacion.data?.eva_reposo);
    const m = num(evaluacion.eva_mov) ?? num(evaluacion.eva_movimiento) ?? num(evaluacion.data?.eva_movimiento);
    if (r !== null || m !== null) {
      return {
        medido: true,
        eva: Math.max(r ?? 0, m ?? 0),
        origen: 'evaluación clínica',
        fecha: evaluacion.fecha,
        detalle: { reposo: r, movimiento: m },
      };
    }
  }

  // Último recurso: el dolorActual del screening de alta.
  // Es categórico y se toma una sola vez, así que envejece mal. Un "no"
  // de hace tres meses no dice nada sobre la tolerancia a la carga de hoy.
  // Si está vencido se reporta como NO MEDIDO, no como dolor 0: tratar un
  // dato viejo como válido es lo que promovería gente de fase a ciegas.
  const d = screening.dolorActual;
  if (d && DOLOR_EVA[d] !== undefined) {
    const fEval = screening.fechaEvaluacion ? new Date(screening.fechaEvaluacion) : null;
    const dias = fEval && !isNaN(fEval) ? Math.round((Date.now() - fEval.getTime()) / 864e5) : null;
    const vencido = dias === null || dias > VIGENCIA_SCREENING_DIAS;
    if (vencido) {
      return {
        medido: false, eva: null, origen: 'screening vencido',
        aproximado: true, dias,
        motivo: dias === null
          ? 'El screening no tiene fecha — no se puede saber si el dato sigue vigente'
          : `El dato de dolor tiene ${dias} días (vence a los ${VIGENCIA_SCREENING_DIAS}). Hace falta un dato nuevo.`,
      };
    }
    return { medido: true, eva: DOLOR_EVA[d], origen: `screening (dolor ${d}, ${dias} días)`, aproximado: true, dias };
  }
  return { medido: false, eva: null, origen: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) BANDERAS CLÍNICAS
// ═══════════════════════════════════════════════════════════════════════════
export function calcBanderas(screening = {}, incidencias = []) {
  const activas = [];
  if (screening.banderaRoja === 'si')    activas.push({ nivel: 'roja',    texto: 'Bandera roja en screening' });
  if (screening.banderaNaranja === 'si') activas.push({ nivel: 'naranja', texto: 'Bandera naranja en screening' });
  if (screening.banderaAmarilla === 'si')activas.push({ nivel: 'amarilla',texto: 'Bandera amarilla en screening' });
  (incidencias || [])
    .filter(i => i.bandera_activa && !i.resuelto)
    .forEach(i => activas.push({
      nivel: 'roja',
      texto: `Incidencia sin resolver — ${i.ejercicio_nombre || 'sin ejercicio'} (${new Date(i.fecha).toLocaleDateString('es-UY')})`,
    }));
  return { hay: activas.length > 0, activas, bloqueante: activas.some(a => a.nivel === 'roja') };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) ASIMETRÍA DE FUERZA
//    Hoy NO es computable: no hay tests bilaterales cargados (bench, squat,
//    deadlift, hip thrust, dominadas, remo, press militar — todos bilaterales
//    de barra). Devolver `medido:false` en vez de un número inventado.
// ═══════════════════════════════════════════════════════════════════════════
export function calcAsimetriaFuerza(tests = []) {
  const uni = (tests || []).filter(t => /izq|der|unilat|single|una pierna|un brazo/i.test(t.test_nombre || ''));
  if (uni.length < 2) {
    return { medido: false, pct: null, motivo: 'No hay tests unilaterales cargados' };
  }
  const izq = uni.filter(t => /izq/i.test(t.test_nombre)).map(t => num(t.rm1_calculado ?? t.rm1_real)).filter(Boolean);
  const der = uni.filter(t => /der/i.test(t.test_nombre)).map(t => num(t.rm1_calculado ?? t.rm1_real)).filter(Boolean);
  if (!izq.length || !der.length) return { medido: false, pct: null, motivo: 'Falta un lado' };
  const mi = Math.max(...izq), md = Math.max(...der), may = Math.max(mi, md);
  return { medido: true, pct: Math.round(Math.abs(mi - md) / may * 1000) / 10, izq: mi, der: md };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) COMPUTAR TODAS LAS MÉTRICAS
// ═══════════════════════════════════════════════════════════════════════════
export function computarMetricas(cliente = {}, { evaluacion = null, tests = [], incidencias = [] } = {}) {
  const sc = cliente.screening || {};
  const incCliente = (incidencias || []).filter(i => i.gym_client_id === cliente.id);

  const calidad  = calcCalidadMovimiento(sc);
  const ybalance = calcYBalance(sc);
  const evaR     = calcEva({ screening: sc, evaluacion, incidencias: incCliente });
  const banderas = calcBanderas(sc, incCliente);
  const fuerza   = calcAsimetriaFuerza(tests);

  // ROM %: de la evaluación clínica (ya lo deriva el trigger de la base)
  const romPct = evaluacion?.rom_pct ?? null;

  return {
    calidad, ybalance, eva: evaR, banderas, fuerza, romPct,
    // Forma que espera checkCriteriosAvance()
    paraCheck: {
      eva: evaR.medido ? evaR.eva : null,
      romPct,
      ybDiff: ybalance.medido ? ybalance.difAntCm : null,
      fmsTotal: calidad.medido ? calidad.equivalenteFMS : null,
      fuerzaAsimetria: fuerza.medido ? fuerza.pct : null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) VEREDICTO DE AVANCE
//    Separa explícitamente tres estados por criterio: cumple / no cumple /
//    sin medir. El avance solo se propone si TODOS los medibles cumplen y no
//    queda ninguno sin medir.
// ═══════════════════════════════════════════════════════════════════════════
export function evaluarAvance(fase, metricas, checkFn) {
  const res = checkFn(fase, metricas.paraCheck, metricas) || [];
  // ORDEN IMPORTANTE: la ausencia de dato se evalúa PRIMERO. Si el valor es
  // '—' el criterio está SIN MEDIR, sin importar qué devuelva `pass`.
  // (Bug corregido: antes un pass=null por falta de dato se clasificaba como
  // 'clinico' — o sea, "listo, solo falta tu firma" — cuando en realidad no
  // se había medido nada. Es exactamente el error que este motor evita.)
  const clasificados = res.map(r => {
    const sinDato = r.val === '—' || r.val == null || r.val === '';
    return {
      ...r,
      estado: sinDato ? 'sin_medir'
            : r.pass === true  ? 'cumple'
            : r.pass === false ? 'no_cumple'
            : 'clinico',   // pass === null CON dato → requiere criterio profesional
    };
  });

  const cumplen   = clasificados.filter(c => c.estado === 'cumple');
  const noCumplen = clasificados.filter(c => c.estado === 'no_cumple');
  const sinMedir  = clasificados.filter(c => c.estado === 'sin_medir');
  const clinicos  = clasificados.filter(c => c.estado === 'clinico');

  let veredicto, resumen;
  if (metricas.banderas.bloqueante) {
    veredicto = 'bloqueado';
    resumen = 'Bandera clínica activa — no evaluar avance hasta resolverla.';
  } else if (noCumplen.length > 0) {
    veredicto = 'no_avanza';
    resumen = `Falta cumplir ${noCumplen.length} criterio${noCumplen.length > 1 ? 's' : ''}.`;
  } else if (sinMedir.length > 0) {
    veredicto = 'faltan_datos';
    resumen = `Cumple todo lo medido, pero falta medir ${sinMedir.length}: ${sinMedir.map(s => s.label).join(', ')}.`;
  } else if (clinicos.length > 0) {
    veredicto = 'listo_con_criterio';
    resumen = 'Todos los criterios objetivos cumplen. Queda tu confirmación clínica.';
  } else {
    veredicto = 'listo';
    resumen = 'Todos los criterios cumplen.';
  }

  return { veredicto, resumen, criterios: clasificados, cumplen, noCumplen, sinMedir, clinicos };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8) RESUMEN PARA LA IA
//    Bloque de HECHOS YA CALCULADOS. La IA no vuelve a hacer una sola cuenta:
//    solo redacta sobre esto. Ese es el ahorro de tiempo de revisión.
// ═══════════════════════════════════════════════════════════════════════════
export function resumenDeterminista(cliente, metricas, avance) {
  const L = [];
  L.push(`Cliente: ${cliente.nombre} ${cliente.apellido} · Fase actual: ${(cliente.nivel || '—').toUpperCase()}`);
  L.push(`Objetivo declarado: ${cliente.objetivo || cliente.screening?.objetivoPrincipal || '—'}`);

  const e = metricas.eva;
  L.push(e.medido
    ? `DOLOR: EVA ${e.eva}/10 (fuente: ${e.origen}${e.detalle ? `; reposo ${e.detalle.reposo ?? '—'} / movimiento ${e.detalle.movimiento ?? '—'}` : ''})`
    : `DOLOR: sin medir`);

  const c = metricas.calidad;
  L.push(c.medido
    ? `CALIDAD DE MOVIMIENTO: ${c.total}/${c.max} (${c.pct}%). Peores patrones: ${c.detalle.slice(0, 3).map(d => `${d.patron}=${d.valor}`).join('; ')}`
    : `CALIDAD DE MOVIMIENTO: sin medir`);
  if (c.faltantes?.length) L.push(`  · patrones sin evaluar: ${c.faltantes.join(', ')}`);

  const y = metricas.ybalance;
  L.push(y.medido
    ? `Y-BALANCE: compuesto D ${y.compD} / I ${y.compI} · alcance anterior dif. ${y.difAntCm} cm — ${y.simetrico ? 'simétrico' : `ASIMÉTRICO, lado corto ${y.ladoCorto}`}`
    : `Y-BALANCE: sin medir`);

  L.push(metricas.romPct != null ? `ROM: ${metricas.romPct}% del rango normativo` : `ROM: sin medir`);
  L.push(metricas.fuerza.medido ? `ASIMETRÍA DE FUERZA: ${metricas.fuerza.pct}%` : `ASIMETRÍA DE FUERZA: ${metricas.fuerza.motivo}`);

  if (metricas.banderas.hay) L.push(`BANDERAS: ${metricas.banderas.activas.map(a => `[${a.nivel}] ${a.texto}`).join(' · ')}`);
  else L.push(`BANDERAS: ninguna activa`);

  L.push(`VEREDICTO DE AVANCE (calculado): ${avance.veredicto.toUpperCase()} — ${avance.resumen}`);
  avance.criterios.forEach(cr => L.push(`  · ${cr.label}: ${cr.val} → ${cr.estado}`));

  return L.join('\n');
}

// Prompt para la capa interpretativa. Prohíbe explícitamente recalcular.
export const PROMPT_INTERPRETACION = `Sos fisioterapeuta y preparador físico. Abajo hay un bloque de HECHOS YA CALCULADOS sobre un cliente.

REGLAS ESTRICTAS:
1. NO recalcules ningún número. Los valores del bloque son definitivos.
2. NO inventes datos. Si algo dice "sin medir", tratalo como pendiente de medición, NUNCA como un mal resultado.
3. NO contradigas el VEREDICTO DE AVANCE.

Redactá en español rioplatense (voseo), tono profesional y directo, sin relleno:
- INTERPRETACIÓN (3-4 oraciones): qué significa este cuadro en conjunto.
- PRIORIDADES (máximo 3, ordenadas): en qué enfocar el entrenamiento, con el porqué.
- PRECAUCIONES: qué evitar o regresar, si corresponde. Si no hay, decilo.
- QUÉ FALTA MEDIR: listá lo pendiente y por qué importa. Omitir si no falta nada.`;


// ═══════════════════════════════════════════════════════════════════════════
// 9) CRITERIOS DE AVANCE PARA CLIENTES DE GIMNASIO
//
// PROBLEMA DETECTADO al correr el motor contra los 53 clientes reales:
// checkCriteriosAvance() exige "ROM > 85%", y rom_pct solo existe si el
// cliente tiene una evaluación clínica de FisioActiva. Hoy 0 de 53 clientes
// del gym tienen paciente de fisio vinculado. Resultado: el criterio queda
// SIEMPRE "sin medir" y NINGÚN cliente puede alcanzar el veredicto "listo".
// Los criterios estaban diseñados para el recorrido clínico y se aplicaban
// al recorrido del gimnasio. Por eso el panel de avance quedó sin usar:
// solo 3 de 53 clientes tienen criterios tildados a mano.
//
// Esta versión usa lo que el gimnasio SÍ mide: dolor, calidad de movimiento
// (6 patrones) y Y-Balance. ROM pasa a ser opcional: suma si existe, no
// bloquea si no. checkCriteriosAvance() queda intacta para el lado clínico.
// ═══════════════════════════════════════════════════════════════════════════
export function checkCriteriosGym(fase, m) {
  const r = [];
  const cal = m.calidad, yb = m.ybalance, ev = m.eva;
  const evaOk = (max) => ev.medido ? ev.eva <= max : null;
  const pushEva = (max) => r.push({
    label: `Dolor EVA ≤ ${max}/10`,
    pass: evaOk(max),
    val: ev.medido ? `${ev.eva}/10` : '—',
  });
  const pushCal = (min) => r.push({
    label: `Calidad de movimiento ≥ ${min}%`,
    pass: cal.medido ? cal.pct >= min : null,
    val: cal.medido ? `${cal.pct}% (${cal.total}/${cal.max})` : '—',
  });
  const pushYb = (max) => r.push({
    label: `Y-Balance: diferencia anterior < ${max} cm`,
    pass: yb.medido ? yb.difAntCm < max : null,
    val: yb.medido ? `${yb.difAntCm} cm` : '—',
  });
  const pushSim = () => r.push({
    label: 'Sin asimetría unilateral en patrones',
    pass: cal.medido ? cal.asimetrias.length === 0 : null,
    val: cal.medido ? (cal.asimetrias.length ? cal.asimetrias.map(a => `${a.patron} (${a.lado})`).join(', ') : 'Simétrico') : '—',
  });

  if (fase === 'restaura') { pushEva(3); pushCal(50); }
  if (fase === 'activa')   { pushEva(2); pushCal(70); pushYb(6); }
  if (fase === 'potencia') { pushEva(2); pushCal(85); pushYb(4); pushSim(); }
  if (fase === 'rinde')    { pushEva(1); pushCal(90); pushYb(4); pushSim(); }

  if (m.romPct != null) {
    const min = fase === 'restaura' ? 70 : fase === 'activa' ? 85 : 90;
    r.push({ label: `ROM > ${min}% (clínico)`, pass: m.romPct > min, val: `${m.romPct}%` });
  }
  return r;
}

// evaluarAvance espera checkFn(fase, metricas.paraCheck). checkCriteriosGym
// necesita el objeto completo, así que se adapta acá.
export const adaptadorGym = (fase, _paraCheck, metricas) => checkCriteriosGym(fase, metricas);
