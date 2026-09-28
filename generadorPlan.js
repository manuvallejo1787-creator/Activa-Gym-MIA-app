// ═══════════════════════════════════════════════════════════════════════════
// generadorPlan.js — EL PLAN COMO SUBPRODUCTO DE LA EVALUACIÓN
//
// POR QUÉ EXISTE
// Armar un plan llevaba ~30 min por cliente. No porque requiriera criterio en
// cada paso, sino porque `suggestBlocks()` devolvía los bloques VACÍOS y a
// partir de ahí había que llenarlos a mano, uno por uno.
//
// Todas las piezas del motor combinatorio ya existían como funciones sueltas:
//   OBJS[obj].blocks        → esqueleto de bloques por fase
//   PERIODIZACIONES[x].fases→ series/reps/RIR por fase del ciclo
//   getMacroPlanSugerido()  → qué periodización corresponde
//   checkRestriction()      → filtro por banderas del cliente
//   sugerirPeso()           → carga desde fuerza_tests
//   motor.js                → déficits detectados en la evaluación
// Ninguna se encadenaba de punta a punta. Esto las encadena.
//
// LA PERSONALIZACIÓN NO SE PIERDE: el esqueleto es compartido, pero sobre él
// se filtran los ejercicios por las restricciones de ESA persona, se ordenan
// por SUS déficits y se cargan pesos desde SUS tests. Dos clientes con el mismo
// objetivo y los mismos días salen con planes distintos.
//
// REGLA DURA — PROCEDENCIA DE LOS DATOS
// Un generador alimentado con datos viejos produce planes coherentes y
// equivocados, que es peor que uno obviamente malo porque no se nota. Cada
// plan generado declara de qué dato salió y con cuántos días de antigüedad, y
// `bloqueantes` lista lo que exige confirmación humana antes de aplicarlo.
// ═══════════════════════════════════════════════════════════════════════════

import { PERIODIZACIONES, MACRO_PLAN_METODO, getMacroPlanSugerido, sugerirPeso, parseDuracionSemanas } from "./planificacion.js";
import { computarMetricas, CM_PATRONES, VIGENCIA_SCREENING_DIAS } from "./motor.js";

// Bloques por fase del método (espejo de OBJS en App.jsx)
export const BLOQUES_POR_FASE = {
  restaura: ['movilidad', 'prev_rehab', 'propiocepcion', 'activacion', 'flex_recovery'],
  activa:   ['movilidad', 'activacion', 'fuerza', 'accesorios', 'cardio'],
  potencia: ['activacion', 'fuerza', 'accesorios', 'cardio', 'flex_recovery'],
  rinde:    ['movilidad', 'activacion', 'potencia', 'pliometria', 'fuerza', 'funcional', 'propiocepcion'],
};

// Cuántos ejercicios lleva cada bloque según los días por semana.
// Con más días hay menos volumen por sesión: el volumen semanal se reparte,
// no se multiplica. Cuatro días de 6 ejercicios de fuerza no es un plan, es
// una lesión con cronograma.
const EJ_POR_BLOQUE = {
  2: { movilidad: 3, activacion: 3, fuerza: 4, accesorios: 3, cardio: 1, potencia: 3, pliometria: 3, prev_rehab: 3, propiocepcion: 2, flex_recovery: 3, funcional: 2, zona_media: 3 },
  3: { movilidad: 3, activacion: 2, fuerza: 3, accesorios: 3, cardio: 1, potencia: 2, pliometria: 2, prev_rehab: 3, propiocepcion: 2, flex_recovery: 2, funcional: 2, zona_media: 2 },
  4: { movilidad: 2, activacion: 2, fuerza: 3, accesorios: 2, cardio: 1, potencia: 2, pliometria: 2, prev_rehab: 2, propiocepcion: 2, flex_recovery: 2, funcional: 2, zona_media: 2 },
  5: { movilidad: 2, activacion: 2, fuerza: 2, accesorios: 2, cardio: 1, potencia: 2, pliometria: 2, prev_rehab: 2, propiocepcion: 1, flex_recovery: 2, funcional: 2, zona_media: 2 },
};

// ═══════════════════════════════════════════════════════════════════════════
// DIVISIONES DE RUTINA
//
// Cada división define una SECUENCIA de días; se cicla hasta cubrir los días
// por semana elegidos. Cada día es una etiqueta más los TÉRMINOS con los que
// se buscan ejercicios, y los términos están escritos con el vocabulario real
// de la base: `patron` ("Empuje horizontal", "Dominante de rodilla") y
// `musculos` ("Cuadriceps, Gluteo", "Dorsal, Biceps, Romboide").
//
// `min` es la cantidad de días por debajo de la cual la división pierde
// sentido: una PPL en 2 días deja un patrón sin entrenar. No se bloquea —
// se avisa.
// ═══════════════════════════════════════════════════════════════════════════
const D = (label, ...terminos) => ({ label, terminos });

export const DIVISIONES = {
  auto: {
    nombre: 'Alternancia de patrones (por defecto)',
    desc: 'Rota empuje, tracción, rodilla y bisagra. Sirve para cualquier cantidad de días.',
    min: 2,
    secuencia: [
      D('empuje / rodilla', 'empuje', 'rodilla'),
      D('tracción / bisagra', 'traccion', 'bisagra'),
      D('rodilla / empuje', 'rodilla', 'empuje'),
      D('tracción / zona media', 'traccion', 'zona media', 'abdominal'),
      D('cuerpo completo', 'cuerpo completo', 'funcional'),
    ],
  },
  torso_pierna: {
    nombre: 'Torso / Pierna',
    desc: 'Un día de tren superior completo y otro de tren inferior. La más eficiente en 2 y 4 días.',
    min: 2,
    secuencia: [
      D('torso', 'empuje', 'traccion', 'pectoral', 'dorsal', 'deltoide'),
      D('pierna', 'rodilla', 'bisagra', 'cuadriceps', 'gluteo', 'isquiotibial'),
    ],
  },
  ppl: {
    nombre: 'Empuje / Tracción / Pierna',
    desc: 'La clásica push-pull-legs. Necesita 3 o 6 días para cerrar el ciclo completo.',
    min: 3,
    secuencia: [
      D('empuje', 'empuje', 'pectoral', 'deltoide', 'triceps'),
      D('tracción', 'traccion', 'dorsal', 'romboide', 'biceps'),
      D('pierna', 'rodilla', 'bisagra', 'cuadriceps', 'gluteo', 'isquiotibial', 'gemelo'),
    ],
  },
  empuje_traccion: {
    nombre: 'Empuje / Tracción',
    desc: 'Todo el cuerpo repartido en dos patrones; la pierna se divide entre ambos días.',
    min: 2,
    secuencia: [
      D('empuje', 'empuje', 'pectoral', 'deltoide', 'triceps', 'rodilla', 'cuadriceps'),
      D('tracción', 'traccion', 'dorsal', 'biceps', 'bisagra', 'isquiotibial', 'gluteo'),
    ],
  },
  fullbody: {
    nombre: 'Cuerpo completo',
    desc: 'Cada sesión cubre todos los patrones. Lo mejor con 2 o 3 días y para principiantes.',
    min: 1,
    secuencia: [
      D('cuerpo completo', 'rodilla', 'empuje', 'traccion'),
      D('cuerpo completo', 'bisagra', 'traccion', 'empuje'),
      D('cuerpo completo', 'rodilla', 'empuje', 'zona media'),
    ],
  },
  grupo_muscular: {
    nombre: 'Por grupo muscular',
    desc: 'Pecho y tríceps, espalda y bíceps, pierna, hombro y core. Necesita 4 días o más.',
    min: 4,
    secuencia: [
      D('pecho y tríceps', 'pectoral', 'empuje horizontal', 'triceps'),
      D('espalda y bíceps', 'dorsal', 'traccion', 'romboide', 'biceps'),
      D('pierna', 'rodilla', 'bisagra', 'cuadriceps', 'gluteo', 'isquiotibial', 'gemelo'),
      D('hombro y core', 'deltoide', 'empuje vertical', 'zona media', 'abdominal'),
    ],
  },
  patron_principal: {
    nombre: 'Un levantamiento principal por día',
    desc: 'Cada día gira alrededor de un patrón: sentadilla, banca, peso muerto, press militar.',
    min: 3,
    secuencia: [
      D('sentadilla', 'sentadilla', 'rodilla', 'cuadriceps'),
      D('press banca', 'press', 'pectoral', 'empuje horizontal'),
      D('peso muerto', 'peso muerto', 'bisagra', 'isquiotibial'),
      D('press militar', 'press militar', 'deltoide', 'empuje vertical'),
    ],
  },
};

// Diccionario para el texto libre: cómo dice las cosas el profe → cómo están
// escritas en la base. Si un término no está acá, se informa como no
// reconocido en vez de ignorarlo.
const SINONIMOS = {
  empuje: ['empuje', 'pectoral', 'press'], push: ['empuje', 'pectoral', 'press'],
  traccion: ['traccion', 'dorsal', 'remo'], pull: ['traccion', 'dorsal', 'remo'],
  pecho: ['pectoral', 'empuje horizontal', 'press banca', 'apertura'],
  espalda: ['dorsal', 'traccion', 'romboide', 'remo', 'jalon'],
  hombro: ['deltoide', 'empuje vertical', 'press militar', 'elevacion', 'vuelo'],
  hombros: ['deltoide', 'empuje vertical', 'press militar'],
  brazo: ['biceps', 'triceps', 'curl'], brazos: ['biceps', 'triceps', 'curl'],
  biceps: ['biceps', 'curl', 'flexion de codo'],
  triceps: ['triceps', 'extension de codo', 'frances'],
  pierna: ['rodilla', 'bisagra', 'cuadriceps', 'gluteo', 'isquiotibial'],
  piernas: ['rodilla', 'bisagra', 'cuadriceps', 'gluteo', 'isquiotibial'],
  cuadriceps: ['cuadriceps', 'rodilla', 'sentadilla', 'prensa'],
  isquios: ['isquiotibial', 'bisagra', 'femoral'], isquiotibiales: ['isquiotibial', 'bisagra', 'femoral'],
  gluteo: ['gluteo', 'hip thrust', 'bisagra'], gluteos: ['gluteo', 'hip thrust', 'bisagra'],
  gemelo: ['gemelo', 'gastrocnemio', 'flexion plantar'], gemelos: ['gemelo', 'gastrocnemio', 'flexion plantar'],
  torso: ['empuje', 'traccion', 'pectoral', 'dorsal', 'deltoide'],
  superior: ['empuje', 'traccion', 'pectoral', 'dorsal', 'deltoide'],
  inferior: ['rodilla', 'bisagra', 'cuadriceps', 'gluteo', 'isquiotibial'],
  core: ['zona media', 'abdominal', 'recto abdominal'],
  abdominales: ['zona media', 'abdominal', 'recto abdominal'],
  'zona media': ['zona media', 'abdominal'],
  'cuerpo completo': ['cuerpo completo', 'rodilla', 'empuje', 'traccion'],
  fullbody: ['cuerpo completo', 'rodilla', 'empuje', 'traccion'],
  sentadilla: ['sentadilla', 'rodilla'], 'peso muerto': ['peso muerto', 'bisagra'],
  bisagra: ['bisagra', 'isquiotibial'], rodilla: ['rodilla', 'cuadriceps'],
  cardio: ['cardio', 'cardiovascular'], funcional: ['funcional', 'cuerpo completo'],
  movilidad: ['movilidad'], potencia: ['potencia', 'pliometria'],
};

// Texto libre → días. Separadores entre días: salto de línea, ";", "/" o "|".
// Dentro de cada día, los términos se separan con "," "+" o " y ".
export function parsearDivisionLibre(texto, nDias) {
  const bruto = String(texto || '').split(/\n|;|\||\//).map(x => x.trim()).filter(Boolean);
  if (!bruto.length) return null;
  const noReconocidos = [];
  const dias = bruto.map(linea => {
    const partes = linea.split(/,|\+| y /i).map(x => norm(x).trim()).filter(Boolean);
    const terminos = [];
    partes.forEach(pz => {
      const syn = SINONIMOS[pz] || Object.entries(SINONIMOS).find(([k]) => pz.includes(k))?.[1];
      if (syn) syn.forEach(t => { if (!terminos.includes(t)) terminos.push(t); });
      else noReconocidos.push(pz);
    });
    return { label: linea, terminos };
  }).filter(d => d.terminos.length);
  if (!dias.length) return { dias: null, noReconocidos };
  return { dias, noReconocidos, diasEscritos: bruto.length, nDias };
}

// Cicla la secuencia hasta cubrir los días pedidos.
export function armarRotacion({ division = 'auto', libre = '', nDias = 3 }) {
  const avisos = [];
  if (libre && libre.trim()) {
    const p = parsearDivisionLibre(libre, nDias);
    if (p?.dias?.length) {
      if (p.noReconocidos.length)
        avisos.push(`No reconocí: ${[...new Set(p.noReconocidos)].join(', ')}. Esos términos no se usaron para elegir ejercicios — escribilos como grupo muscular (pecho, espalda, pierna) o patrón (empuje, tracción, bisagra).`);
      if (p.dias.length !== nDias)
        avisos.push(`Escribiste ${p.dias.length} día(s) y el plan es de ${nDias}: la secuencia se repite en ciclo.`);
      return { dias: Array.from({ length: nDias }, (_, i) => p.dias[i % p.dias.length]), avisos, origen: 'libre' };
    }
    avisos.push('No pude interpretar la división escrita. Se usó la alternancia de patrones por defecto.');
  }
  const dv = DIVISIONES[division] || DIVISIONES.auto;
  if (nDias < dv.min)
    avisos.push(`"${dv.nombre}" necesita al menos ${dv.min} días por semana; con ${nDias} queda algún patrón sin entrenar en la semana.`);
  return {
    dias: Array.from({ length: nDias }, (_, i) => dv.secuencia[i % dv.secuencia.length]),
    avisos, origen: division,
  };
}

// Los déficits del screening se traducen a patrones a priorizar.
// Verificado contra los 6 patrones que realmente se miden en el gym.
const DEFICIT_A_PATRON = {
  'Sentadilla':                  ['rodilla', 'sentadilla'],
  'Bisagra de cadera':           ['bisagra', 'isquio'],
  'Zancada':                     ['zancada', 'estocada', 'unilateral'],
  'Sentadilla a una pierna':     ['unilateral', 'propioc', 'gluteo'],
  'Dead bug':                    ['zona media', 'core'],
  'Bird dog':                    ['zona media', 'core'],
};

// Comparación insensible a acentos: la base mezcla "Traccion horizontal" con
// "Tracción vertical", así que sin esto el patrón del día no matcheaba nunca.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ─── Familia de movimiento ──────────────────────────────────────────────────
// Clave del arreglo del bug de las sesiones de pura sentadilla: sin agrupar
// por familia no hay forma de exigir variedad.
const FAMILIAS = [
  ['rodilla',    /sentadilla|squat|prensa|hack|extensi[oó]n.*cu[aá]dricep|estocada|zancada|lunge|b[uú]lgara|step|goblet/i],
  ['bisagra',    /peso muerto|deadlift|rumano|rdl|stiff|good ?morning|hip thrust|puente|curl femoral|swing|bisagra/i],
  ['empuje_h',   /press.*(banca|banco|pecho|plano|inclinad|declinad)|bench|apertura|fly|cruce|flexi[oó]n|push ?up|fondos|dips/i],
  ['empuje_v',   /press.*(militar|hombro|vertical|overhead)|arnold|push ?press|elevaci[oó]n|vuelo|thruster/i],
  ['traccion_h', /remo|row|face ?pull/i],
  ['traccion_v', /jal[oó]n|pulldown|dominada|pull[\s-]?up|chin[\s-]?up/i],
  ['core',       /plancha|plank|dead ?bug|bird ?dog|pallof|abdominal|core|zona media|rotaci[oó]n|antiextensi|plancha/i],
  ['brazo',      /curl|tr[ií]ceps|franc[eé]s|pushdown|b[ií]ceps|antebrazo|mu[ñn]eca/i],
  ['pantorrilla',/gemelo|pantorrilla|calf|s[oó]leo/i],
];
function familia(ex) {
  const t = `${ex.nombre || ''} ${ex.patron || ''}`;
  const hit = FAMILIAS.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'otro';
}

// ─── Selección de ejercicios para un bloque ────────────────────────────────
// Se elige de a uno, y cada elección PENALIZA a los de la misma familia. Así
// un déficit en sentadilla consigue UN lugar prioritario en el bloque, no
// todos: antes el bono por déficit (+100 y acumulable por cada patrón que
// matcheara) sepultaba el patrón del día y salían tres días idénticos de
// sentadillas.
function elegirEjercicios({ bloque, cantidad, exs, cliente, checkRestriction, patronesDia, patronesDeficit, faseCliente, yaUsados, usoEnPlan = {} }) {
  const nivelObjetivo = faseCliente === 'restaura' ? 'Principiante'
                      : faseCliente === 'activa' ? 'Intermedio' : 'Avanzado';
  const ordenNivel = { Principiante: 0, Intermedio: 1, Avanzado: 2 };

  const candidatos = exs
    .filter(e => e.bloque === bloque && !yaUsados.has(e.id))
    .map(e => {
      const restr = checkRestriction ? checkRestriction(e, cliente) : null;
      if (restr === 'block') return null;
      const texto = `${norm(e.nombre)} ${norm(e.patron)} ${norm(e.musculos)}`;
      let base = 0;

      // 1) Patrón dominante del día: es lo que define la sesión.
      patronesDia.forEach(p => { if (texto.includes(norm(p))) base += 40; });
      // 2) Déficit detectado: un empujón, no una sentencia. Se cuenta UNA vez
      //    aunque el ejercicio matchee varios patrones del mismo déficit.
      if (patronesDeficit.some(p => texto.includes(norm(p)))) base += 25;
      // 3) Cercanía al nivel de la fase.
      base -= Math.abs((ordenNivel[e.nivel] ?? 1) - ordenNivel[nivelObjetivo]) * 12;
      // 4) Una advertencia no descarta, pero baja mucho la prioridad.
      if (restr === 'warn') base -= 45;
      // 5) Repetir el mismo ejercicio en otros días del plan: se evita si hay
      //    alternativas, pero no se prohíbe.
      base -= (usoEnPlan[e.id] || 0) * 22;

      return { ex: e, base, restr, fam: familia(e) };
    })
    .filter(Boolean);

  const elegidos = [];
  const porFamilia = {};
  for (let k = 0; k < cantidad; k++) {
    let mejor = null, mejorScore = -Infinity;
    for (const c of candidatos) {
      if (elegidos.includes(c)) continue;
      // Penalización por familia ya cubierta: la segunda del mismo patrón
      // pierde 60 puntos, la tercera 120. Con esto, después de una sentadilla
      // gana un empuje o una tracción antes que otra sentadilla.
      const score = c.base - (porFamilia[c.fam] || 0) * 60;
      if (score > mejorScore) { mejorScore = score; mejor = c; }
    }
    if (!mejor) break;
    elegidos.push(mejor);
    porFamilia[mejor.fam] = (porFamilia[mejor.fam] || 0) + 1;
  }
  return elegidos;
}

// ─── Parámetros del bloque según la fase del ciclo de periodización ────────
function paramsDeBloque(bloque, fasePer) {
  const base = { series: 3, reps: '10-12', rpe: 7, tempo: '2-0-1', descanso: '90s' };
  if (['movilidad', 'flex_recovery'].includes(bloque)) return { series: 2, reps: '8-10', rpe: 4, tempo: '3-1-3', descanso: '30s' };
  if (['activacion', 'propiocepcion'].includes(bloque)) return { series: 2, reps: '10-12', rpe: 5, tempo: '2-0-2', descanso: '45s' };
  if (bloque === 'prev_rehab') return { series: 3, reps: '12-15', rpe: 5, tempo: '3-1-3', descanso: '60s' };
  if (bloque === 'cardio') return { series: 1, reps: '15 min', rpe: 6, tempo: '—', descanso: '—' };
  if (['potencia', 'pliometria'].includes(bloque)) return { series: 4, reps: '3-5', rpe: 8, tempo: 'explosivo', descanso: '150s' };

  // fuerza / accesorios / funcional siguen la fase del ciclo
  if (!fasePer) return base;
  const rir = String(fasePer.rir || '').match(/\d+/);
  return {
    series: /alto/i.test(fasePer.volumen || '') ? 4 : /bajo/i.test(fasePer.volumen || '') ? 3 : 4,
    reps: (fasePer.reps || '10-12').replace('–', '-'),
    rpe: rir ? Math.max(5, 10 - parseInt(rir[0])) : 7,
    tempo: /máxima|alta/i.test(fasePer.intensidad || '') ? '1-0-1' : '2-0-1',
    descanso: /máxima|alta/i.test(fasePer.intensidad || '') ? '180s' : bloque === 'accesorios' ? '60s' : '120s',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export function generarPlanBase({
  cliente, exs = [], tests = [], incidencias = [], feedback = [], evaluacion = null,
  diasSemana = 3, periodizacionId = null, faseCicloIndex = 0,
  division = 'auto', divisionLibre = '',
  checkRestriction = null, genId = (p) => p + '_' + Date.now().toString(36),
}) {
  const avisos = [], bloqueantes = [], procedencia = [];
  const fase = cliente.nivel || 'activa';

  // ── 1) Métricas y déficits desde la evaluación ──────────────────────────
  const m = computarMetricas(cliente, { evaluacion, tests, incidencias, feedback });

  // Procedencia del dato de dolor — el criterio más decisivo y el más frágil
  if (m.eva.medido) {
    procedencia.push(`Dolor: EVA ${m.eva.eva}/10 · fuente ${m.eva.origen}`);
    if (m.eva.aproximado) avisos.push('El dolor viene del screening, no de una medición directa. Confirmalo antes de aplicar el plan.');
  } else {
    bloqueantes.push(m.eva.motivo || 'No hay dato de dolor vigente. Sin eso no se puede decidir carga con seguridad.');
  }

  if (m.calidad.medido) {
    procedencia.push(`Calidad de movimiento: ${m.calidad.total}/${m.calidad.max} (${m.calidad.pct}%)`);
    if (m.calidad.faltantes.length) avisos.push(`Patrones sin evaluar: ${m.calidad.faltantes.join(', ')}. El plan no los prioriza porque no sabe cómo están.`);
    // Un patrón que la persona NO PUEDE ejecutar no se carga: se enseña.
    // Generar un bloque de fuerza con sentadillas para alguien cuyo screening
    // dice "No puede realizarlo" es el error que este motor debe evitar.
    const noPuede = (m.calidad.detalle || []).filter(d => /no puede realizarlo/i.test(d.valor || ''));
    if (noPuede.length) bloqueantes.push(
      `No puede ejecutar: ${noPuede.map(d => d.patron).join(', ')}. Esos patrones necesitan enseñanza antes de cargarse — revisá el plan antes de aplicarlo.`);
    else if (m.calidad.pct != null && m.calidad.pct < 50) avisos.push(
      `Calidad de movimiento en ${m.calidad.pct}%: el plan sale con nivel principiante, pero conviene revisarlo ejercicio por ejercicio.`);
  } else {
    bloqueantes.push('Sin calidad de movimiento medida: el plan no puede priorizar déficits y sale genérico.');
  }

  if (m.ybalance.medido) procedencia.push(`Y-Balance: dif. anterior ${m.ybalance.difAntCm} cm${m.ybalance.simetrico ? '' : ` (lado corto: ${m.ybalance.ladoCorto})`}`);
  if (m.romPct != null) procedencia.push(`ROM: ${m.romPct}% · fuente ${m.romOrigen}`);
  if (m.banderas.bloqueante) bloqueantes.push('Bandera clínica activa. No generar plan de entrenamiento hasta resolverla.');

  // El RPE que reporta el cliente desde el portal ajusta la intensidad del
  // plan siguiente. Es el único dato que viene del cliente y no de una
  // medición nuestra: dice cómo se SIENTE la carga que prescribimos.
  const fb = m.feedback;
  if (fb?.medido) {
    procedencia.push(`Percepción del cliente: RPE ${fb.rpe}/10 en ${fb.n} sesiones — ${fb.lectura}`);
    if (fb.ajuste === 'bajar') bloqueantes.push(
      `RPE promedio ${fb.rpe}/10 sostenido: el cliente viene al límite. Subir carga acá acumula fatiga en vez de adaptación — revisá el plan antes de aplicarlo.`);
    if (fb.ajuste === 'vigilar') avisos.push(`RPE ${fb.rpe}/10: carga exigente. Sostenible por bloques cortos, no de forma indefinida.`);
    if (fb.ajuste === 'subir') avisos.push(`RPE ${fb.rpe}/10: hay margen real para progresar la carga.`);
    if (fb.sesionesConDolor > 0) avisos.push(`${fb.sesionesConDolor} sesiones con molestia ≥4/10 reportada desde el portal. Revisá qué ejercicio la genera.`);
    if (fb.tendencia) avisos.push(fb.tendencia.texto + '.');
  } else avisos.push('Sin reportes de RPE desde el portal: la intensidad del plan sale de la prescripción, sin ajuste por percepción del cliente.');

  // ── 2) Patrones a priorizar, derivados de los déficits ──────────────────
  const patronesDeficit = [];
  (m.calidad.detalle || []).filter(d => d.puntos <= 2).forEach(d => {
    (DEFICIT_A_PATRON[d.patron] || []).forEach(p => { if (!patronesDeficit.includes(p)) patronesDeficit.push(p); });
  });
  (m.calidad.asimetrias || []).forEach(a => {
    if (!patronesDeficit.includes('unilateral')) patronesDeficit.unshift('unilateral');
    avisos.push(`Asimetría en ${a.patron} (lado ${a.lado}): se priorizan ejercicios unilaterales.`);
  });
  if (m.ybalance.medido && !m.ybalance.simetrico) {
    if (!patronesDeficit.includes('unilateral')) patronesDeficit.unshift('unilateral');
    if (!patronesDeficit.includes('propioc')) patronesDeficit.push('propioc');
  }
  (m.romGym?.limitados || []).forEach(l => {
    const mov = norm(l.split(':')[0]);
    if (mov.includes('hombro')) patronesDeficit.push('hombro');
    if (mov.includes('cadera')) patronesDeficit.push('cadera');
    if (mov.includes('tobillo')) patronesDeficit.push('tobillo');
    if (mov.includes('torácica')) patronesDeficit.push('torácica');
  });

  // ── 3) Periodización ────────────────────────────────────────────────────
  let perId = periodizacionId || cliente.periodizacion || null;
  if (!perId) {
    const sug = getMacroPlanSugerido(cliente.objetivo || '').find(p => p.fase === fase);
    perId = sug?.periodizacion || MACRO_PLAN_METODO[fase]?.periodizacion || null;
    if (perId) avisos.push(`Periodización elegida automáticamente: ${PERIODIZACIONES[perId]?.nombre || perId}.`);
  }
  const per = perId ? PERIODIZACIONES[perId] : null;
  const fasePer = per?.fases?.[Math.min(faseCicloIndex, (per.fases?.length || 1) - 1)] || null;
  if (fase === 'restaura') avisos.push('En RESTAURA no corresponde periodización de fuerza: el plan es el protocolo de rehabilitación y avanza por criterios clínicos.');
  if (per) procedencia.push(`Periodización: ${per.nombre}${fasePer ? ` · fase "${fasePer.nombre}" (sem ${fasePer.semanas})` : ''}`);

  // ── 4) Armado de los días ───────────────────────────────────────────────
  const nDias = Math.max(1, Math.min(5, diasSemana));
  const bloques = BLOQUES_POR_FASE[fase] || BLOQUES_POR_FASE.activa;
  const cupos = EJ_POR_BLOQUE[nDias] || EJ_POR_BLOQUE[3];
  const rot = armarRotacion({ division, libre: divisionLibre, nDias });
  rot.avisos.forEach(a => avisos.push(a));
  const rotacion = rot.dias;

  const dias = [];
  const usoEnPlan = {};   // cuántas veces se usó cada ejercicio en todo el plan
  for (let d = 0; d < nDias; d++) {
    const diaPlan = rotacion[d % rotacion.length] || { label: 'general', terminos: [] };
    const patronesDia = diaPlan.terminos;
    const yaUsados = new Set();   // sin repetir ejercicio dentro del mismo día
    const blocks = bloques.map((tipo, i) => {
      const params = paramsDeBloque(tipo, fasePer);
      const elegidos = elegirEjercicios({
        bloque: tipo, cantidad: cupos[tipo] ?? 2, exs, cliente, checkRestriction,
        patronesDia, patronesDeficit, faseCliente: fase, yaUsados, usoEnPlan,
      });
      elegidos.forEach(c => { yaUsados.add(c.ex.id); usoEnPlan[c.ex.id] = (usoEnPlan[c.ex.id] || 0) + 1; });

      return {
        id: `${Date.now()}_${d}_${i}`,
        type: tipo,
        position: i + 1,
        params,
        exercises: elegidos.map(c => {
          const ns = sugerirPeso(c.ex.nombre, tests, fasePer, params.reps);
          return {
            exId: c.ex.id,
            override: c.restr === 'warn',
            note: c.restr === 'warn' ? 'Marcado por restricción del cliente — revisar antes de ejecutar' : '',
            params: { ...params },
            pesoSug: ns?.pesoSugerido ? String(ns.pesoSugerido) : '',
            pesoReal: '', anotacion: '', pesoSugAuto: true,
          };
        }),
      };
    }).filter(b => b.exercises.length > 0);

    // Misma forma que blankDia() en App.jsx, para que el constructor no vea
    // diferencia entre un día generado y uno creado a mano.
    dias.push({
      id: genId('dia'),
      obj: fase,
      name: `Día ${d + 1} — ${diaPlan.label || 'general'}`,
      blocks,
      notas: '',
    });
  }

  // ── 5) Cobertura ────────────────────────────────────────────────────────
  const totalEj = dias.reduce((s, d) => s + d.blocks.reduce((x, b) => x + b.exercises.length, 0), 0);
  // Con semáforo rojo, checkRestriction bloquea TODOS los ejercicios y el plan
  // salía vacío sin decir por qué. Ahora lo declara.
  if (totalEj === 0) bloqueantes.unshift(
    cliente.semaforo === 'rojo'
      ? 'Semáforo ROJO: toda la base de ejercicios queda bloqueada por restricción. Este cliente no entrena en el gimnasio hasta que la clínica lo habilite.'
      : 'No se pudo seleccionar ningún ejercicio con las restricciones actuales del cliente.');
  const conPeso = dias.reduce((s, d) => s + d.blocks.reduce((x, b) => x + b.exercises.filter(e => e.pesoSug).length, 0), 0);
  const conAviso = dias.reduce((s, d) => s + d.blocks.reduce((x, b) => x + b.exercises.filter(e => e.override).length, 0), 0);

  const semanas = per ? parseDuracionSemanas(per.duracion) : null;
  const inicio = new Date();
  const fin = semanas ? new Date(inicio.getTime() + semanas * 7 * 864e5) : null;

  return {
    plan: {
      id: genId('plan'),
      nombre: `Plan ${(fase || '').toUpperCase()} · ${nDias} días${fasePer ? ` · ${fasePer.nombre}` : ''}`,
      gym_client_id: cliente.id,
      estado: 'activo',
      num_dias: nDias,
      dias,
      periodizacion: perId || '',
      nivel_metodo: fase,
      fecha_inicio: inicio.toISOString().slice(0, 10),
      fecha_fin_estimada: fin ? fin.toISOString().slice(0, 10) : '',
      evaluacion_origen: evaluacion?.id || cliente.screening?.fechaEvaluacion || '',
      division: rot.origen,
      resumen: [
        `Generado desde la evaluación de ${cliente.nombre} ${cliente.apellido}.`,
        ...procedencia.map(p => '· ' + p),
        patronesDeficit.length ? `· Prioridades detectadas: ${patronesDeficit.slice(0, 6).join(', ')}` : '· Sin déficits específicos detectados: plan de base.',
      ].join('\n'),
      notas: '',
      es_ejemplo: false,
    },
    diagnostico: {
      procedencia, avisos, bloqueantes,
      patronesDeficit,
      periodizacion: per ? { id: perId, nombre: per.nombre, fase: fasePer?.nombre, semanas } : null,
      division: { id: rot.origen, nombre: DIVISIONES[rot.origen]?.nombre || 'Escrita a mano', dias: rotacion.map(d => d.label) },
      cobertura: {
        totalEj, conPeso, conAviso,
        pctConPeso: totalEj ? Math.round(conPeso / totalEj * 100) : 0,
        bloquesVacios: bloques.filter(b => !dias[0]?.blocks.some(x => x.type === b)),
      },
      listoParaAplicar: bloqueantes.length === 0,
    },
  };
}
