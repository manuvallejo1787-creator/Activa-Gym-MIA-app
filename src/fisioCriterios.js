// ═══════════════════════════════════════════════════════════════════════════
// CRITERIOS DE AVANCE DE FASE: DATOS, NO FRASES
// ═══════════════════════════════════════════════════════════════════════════
// EL PROBLEMA QUE ARREGLA (reportado por Manu el 27/11/2026)
// "Los criterios de avance no están bien establecidos, y no los contempla la
// programación."
//
// La causa medida: hoy la IA devuelve `criterios_alta_fase: ["criterio 1",
// "criterio 2", "criterio 3"]` — tres frases de texto libre que solo se
// pintan en pantalla. "Mejoría del dolor en elevación" no se puede evaluar
// contra nada, así que el pase de fase se sigue decidiendo a ojo. No importa
// que la frase esté bien escrita: no es un dato.
//
// LO QUE CAMBIA
// Un criterio pasa a ser un objeto con forma fija: qué eje, qué se mide, con
// qué métrica, contra qué umbral y de qué lado. La IA elige QUÉ ejes aplican a
// cada lesión —eso lo decidió Manu y tiene razón: un caso con componente
// neural no se mide con los mismos ejes que un esguince— pero la forma la pone
// el sistema, así que `evaluarCriterio` puede decir si se cumple y el pase de
// fase deja de ser una opinión.
//
// LA REGLA QUE NO SE NEGOCIA
// Un dato sin medir devuelve 'pendiente', NUNCA 'no_cumplido'. Es la misma
// regla que ya tiene el bloque determinista del analizador de evaluaciones:
// "sin medir significa MEDICIÓN PENDIENTE, nunca mal resultado". Si se
// confunden, un paciente al que no le midieron la fuerza queda trabado en
// protección para siempre y nadie entiende por qué.
import { romGrados, calcROMpct, calcDN4 } from "./fisioMedidas.js";

// ─── Los ejes ──────────────────────────────────────────────────────────────
// Son los que usa Manu en su propio razonamiento clínico. La IA elige cuáles
// aplican al caso; no está obligada a usar los cinco ni limitada a ellos.
export const EJES = {
  dolor:   { label: 'Dolor',            orden: 1, icon: '🔴' },
  neural:  { label: 'Síntomas neurales', orden: 2, icon: '⚡' },
  rom:     { label: 'Movilidad (ROM)',  orden: 3, icon: '📐' },
  fuerza:  { label: 'Fuerza',           orden: 4, icon: '💪' },
  funcion: { label: 'Función',          orden: 5, icon: '🎯' },
  carga:   { label: 'Tolerancia a la carga', orden: 6, icon: '📈' },
  clinico: { label: 'Juicio clínico',   orden: 7, icon: '🩺' },
};

// ─── Las métricas, y de dónde sale cada dato ───────────────────────────────
// `auto` dice si el sistema puede evaluarla solo. Las que no, las confirma el
// clínico a mano — y eso se muestra distinto en pantalla, para que nadie crea
// que una confirmación manual es una medición.
export const METRICAS = {
  rom_grados: {
    label: 'Grados de un movimiento', unidad: '°', auto: true,
    pide: 'ref = nombre del movimiento (ej "Abducción"), region, lado',
  },
  rom_pct: {
    label: 'ROM promedio de la región vs norma', unidad: '%', auto: true,
    pide: 'region',
  },
  eva: {
    label: 'EVA', unidad: '/10', auto: true,
    pide: 'ref = "reposo" | "movimiento" | "durante_ejercicio" | "post_sesion"',
  },
  fuerza_mrc: {
    label: 'Fuerza manual (MRC 0-5)', unidad: '/5', auto: true,
    pide: 'ref = nombre del grupo muscular como está en la evaluación',
  },
  dinamometria_pct: {
    label: 'Prensión vs lado contralateral', unidad: '%', auto: true,
    pide: 'lado = el afectado',
  },
  dn4: { label: 'DN4', unidad: '/7', auto: true, pide: 'nada' },
  escala: {
    label: 'Escala funcional', unidad: '', auto: true,
    pide: 'ref = "dash" | "odi" | "lefs" | "koos_dolor" | "koos_avd" | "koos_sport" | "koos_qol" | "koos_sintomas"',
  },
  prueba: {
    label: 'Prueba especial', unidad: '', auto: true,
    pide: 'ref = nombre exacto de la prueba, region, lado',
  },
  neural: {
    label: 'Síntomas neurales (no empeoraron)', unidad: '', auto: true,
    pide: 'nada: compara la última sesión contra la anterior',
  },
  // ── Las que NO se pueden automatizar hoy ──────────────────────────────────
  // No es una limitación de diseño: es que la sesión clínica no guarda estos
  // datos de forma estructurada. `respuesta` es un campo de texto libre, así
  // que "no aumentó la irradiación distal" no se puede leer de ahí.
  // DEUDA (27/11/2026): para que el eje neural sea exigible de verdad, la
  // sesión necesita campos estructurados: irradiación distal (sí/no + hasta
  // dónde), parestesias nuevas (sí/no), pérdida de fuerza (sí/no). Mientras no
  // existan, el criterio neural solo puede ser una confirmación del clínico —
  // que es exactamente el criterio 2 del documento de Manu, el que él mismo
  // marca como "especialmente importante".
  sin_empeorar: {
    label: 'No empeoró tras la sesión (lo confirma el clínico)', unidad: '', auto: false,
    pide: 'qué se vigila, en palabras',
  },
  confirmacion: {
    label: 'Lo confirma el clínico', unidad: '', auto: false,
    pide: 'qué tiene que observar',
  },
};

// ─── La forma de un criterio ───────────────────────────────────────────────
export const criterioVacio = (over = {}) => ({
  id: 'cr_' + Math.random().toString(36).slice(2, 8),
  eje: 'dolor',
  que: '',            // qué se mide, en palabras, para que se lea en el PDF
  metrica: 'eva',
  ref: '',            // qué movimiento / músculo / escala / prueba
  region: '',
  lado: null,         // 'derecho' | 'izquierdo' | 'bilateral' | null
  operador: '<=',     // '>=' '<=' '==' 'negativo' 'cumplido'
  umbral: null,
  porque: '',         // por qué este criterio en ESTE caso
  obligatorio: true,
  origen: 'ia',       // 'ia' | 'manu' — para ver quién puso cada uno
  ...over,
});

// ─── La escala de irradiación, que es ORDINAL ──────────────────────────────
// "no" < "proximal" < "hasta_codo" < "hasta_mano". El criterio neural compara
// la irradiación de esta sesión contra la anterior: si avanzó en la escala, no
// se cumple y la fase no avanza. Sin un orden, "cambió la irradiación" no dice
// si mejoró o empeoró, y era exactamente el problema de tenerlo como texto.
export const IRRADIACION = ['no', 'proximal', 'hasta_codo', 'hasta_mano'];
export const IRRADIACION_LABEL = {
  no: 'sin irradiación', proximal: 'proximal (hombro/brazo)',
  hasta_codo: 'hasta el codo', hasta_mano: 'hasta la mano',
};
const nivelIrradiacion = (v) => {
  const i = IRRADIACION.indexOf(v);
  return i < 0 ? null : i;
};

// ─── La unidad de cada escala funcional ────────────────────────────────────
// No todas se expresan igual y escribir "puntos" en todas es un error clínico
// que se lee en el PDF del paciente: el ODI se informa en porcentaje de
// discapacidad, el LEFS sobre 80, el DASH y el KOOS sobre 100. Un criterio que
// dice "ODI ≤ 20 puntos" no significa nada; "ODI ≤ 20%" sí.
// En el DASH y el ODI, MÁS alto es PEOR (son escalas de discapacidad). En el
// LEFS y el KOOS, más alto es MEJOR. Por eso el operador lo elige la IA por
// escala y no hay un default razonable.
const UNIDAD_ESCALA = {
  dash: '/100', odi: '%', lefs: '/80',
  koos_sintomas: '/100', koos_dolor: '/100', koos_avd: '/100',
  koos_sport: '/100', koos_qol: '/100',
};
export const DIRECCION_ESCALA = {
  dash: 'más alto = peor', odi: 'más alto = peor', lefs: 'más alto = mejor',
  koos_sintomas: 'más alto = mejor', koos_dolor: 'más alto = mejor',
  koos_avd: 'más alto = mejor', koos_sport: 'más alto = mejor', koos_qol: 'más alto = mejor',
};

const OPERADORES = {
  '>=': (v, u) => v >= u,
  '<=': (v, u) => v <= u,
  '==': (v, u) => v === u,
  '>':  (v, u) => v >  u,
  '<':  (v, u) => v <  u,
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

// ─── Lectura del valor de cada métrica ─────────────────────────────────────
// Devuelve null cuando el dato no está medido. Ese null es el que se convierte
// en 'pendiente' más abajo, y es la diferencia entre "le falta medir" y "no
// cumple".
function leerValor(cr, ctx) {
  const { ev = {}, sesiones = [] } = ctx || {};
  const region = cr.region || ctx?.region || ev.region || '';
  const ultima = sesiones[0] || null;

  switch (cr.metrica) {
    case 'rom_grados':
      return num(romGrados(ev.rom, cr.ref, region));

    case 'rom_pct':
      return calcROMpct(ev.rom, region);

    case 'eva': {
      if (cr.ref === 'movimiento') return num(ev.eva_movimiento);
      if (cr.ref === 'reposo') return num(ev.eva_reposo);
      // El EVA de la sesión es el que mide la respuesta al ejercicio, que es
      // lo que el criterio de dolor de una rehabilitación realmente vigila.
      if (cr.ref === 'durante_ejercicio' || cr.ref === 'post_sesion')
        return ultima ? num(ultima.eva_fin) : null;
      return num(ev.eva_movimiento ?? ev.eva_reposo);
    }

    case 'fuerza_mrc':
      return num((ev.fuerza || {})[cr.ref]);

    case 'dinamometria_pct': {
      const d = num(ev.dinamometria?.d), i = num(ev.dinamometria?.i);
      if (d == null || i == null || d === 0 || i === 0) return null;
      // El criterio se escribe siempre como "el afectado respecto del sano",
      // así que el lado afectado va arriba de la división.
      const afectado = cr.lado === 'izquierdo' ? i : d;
      const sano     = cr.lado === 'izquierdo' ? d : i;
      return Math.round(afectado / sano * 100);
    }

    case 'dn4': {
      const v = calcDN4(ev.dn4);
      // calcDN4 cuenta positivas: con el DN4 entero sin tocar da 0, y 0 no es
      // lo mismo que "no se hizo". Si no se registró ninguna respuesta, el
      // dato está pendiente.
      const contestado = ev.dn4 && Object.keys(ev.dn4).length > 0
        && Object.values(ev.dn4).some(x => x === true || x === false);
      return contestado ? v : null;
    }

    case 'escala': {
      const mapa = {
        dash: ev.dash_score, lefs: ev.lefs_score,
        koos_sintomas: ev.koos_sintomas, koos_dolor: ev.koos_dolor,
        koos_avd: ev.koos_avd, koos_sport: ev.koos_sport, koos_qol: ev.koos_qol,
      };
      if (cr.ref === 'odi') {
        const odi = ev.odi;
        if (!Array.isArray(odi) || odi.every(x => !x)) return null;
        return Math.round(odi.reduce((a, b) => a + (num(b) || 0), 0) / 50 * 100);
      }
      return num(mapa[cr.ref]);
    }

    case 'prueba': {
      // Los dos formatos que hay guardados en la base. Si leyera solo uno,
      // perdería la mitad de los resultados sin avisar.
      const lados = cr.lado && cr.lado !== 'bilateral'
        ? [cr.lado === 'izquierdo' ? 'Izquierdo' : 'Derecho']
        : ['Derecho', 'Izquierdo'];
      const vals = lados.map(L =>
        ev.testsEsp?.[`${region}::${cr.ref}_${L}`] ?? ev.testsEsp?.[`${cr.ref}_${L}`]
      ).filter(v => v === 'positivo' || v === 'negativo');
      if (!vals.length) return null;
      // Con un solo positivo, la prueba es positiva.
      return vals.includes('positivo') ? 'positivo' : 'negativo';
    }

    // ─── EL CRITERIO 2 DEL DOCUMENTO DE MANU, AHORA EXIGIBLE ───────────────
    // "No avanzar si aparecen: mayor irradiación distal, parestesias nuevas,
    // pérdida de fuerza, aumento persistente de síntomas después de la
    // sesión." Él lo marca como el criterio especialmente importante.
    // Devuelve 'estable' o 'empeoro', comparando la última sesión registrada
    // contra la anterior. Hace falta que el campo `neural` esté cargado en las
    // DOS: con una sola sesión no hay con qué comparar, y eso es 'pendiente',
    // nunca "estable por defecto". Dar por bueno lo que no se midió es
    // precisamente lo que hace que un paciente avance de fase con la
    // irradiación creciendo.
    case 'neural': {
      const conNeural = sesiones.filter(s2 => s2 && s2.neural);
      if (conNeural.length < 2) return null;
      const [ahora, antes] = conNeural;   // sesiones vienen de la más nueva
      const nAhora = nivelIrradiacion(ahora.neural.irradiacion);
      const nAntes = nivelIrradiacion(antes.neural.irradiacion);
      if (nAhora == null || nAntes == null) return null;
      // Cualquiera de las tres señales empeorando alcanza para no avanzar.
      const peor = nAhora > nAntes
        || (ahora.neural.parestesias && !antes.neural.parestesias)
        || (ahora.neural.perdida_fuerza && !antes.neural.perdida_fuerza);
      return peor ? 'empeoro' : 'estable';
    }

    default:
      return null;
  }
}

// ─── Evaluar un criterio ───────────────────────────────────────────────────
export function evaluarCriterio(cr, ctx) {
  const met = METRICAS[cr.metrica];
  const base = { id: cr.id, eje: cr.eje, que: cr.que, obligatorio: cr.obligatorio !== false };

  // Las que no se pueden automatizar: las confirma el clínico, y se dice.
  if (!met || met.auto === false) {
    const tildado = !!(ctx?.confirmaciones || {})[cr.id];
    return {
      ...base, auto: false,
      estado: tildado ? 'cumplido' : 'pendiente',
      valor: tildado ? 'confirmado por el clínico' : null,
      esperado: cr.que || met?.label || 'confirmación del clínico',
      detalle: tildado ? 'Confirmado a mano' : 'Requiere que lo confirmes vos',
    };
  }

  const valor = leerValor(cr, ctx);
  // La unidad de una escala depende de CUÁL escala es, no de la métrica.
  const unidad = cr.metrica === 'escala'
    ? (UNIDAD_ESCALA[cr.ref] || '')
    : (met.unidad || '');

  if (valor === null) {
    return {
      ...base, auto: true, estado: 'pendiente', valor: null,
      esperado: `${cr.operador} ${cr.umbral}${unidad}`,
      // Esta frase importa: le dice al clínico qué ir a medir, en lugar de
      // dejarlo adivinando por qué el criterio no avanza.
      detalle: cr.metrica === 'neural'
        ? 'Faltan dos sesiones con los síntomas neurales cargados para poder comparar'
        : `Falta medir: ${met.label}${cr.ref ? ` (${cr.ref})` : ''}`,
    };
  }

  // El eje neural se evalúa por estable/empeoró, no contra un umbral.
  if (cr.metrica === 'neural') {
    const bien = valor === 'estable';
    return {
      ...base, auto: true,
      estado: bien ? 'cumplido' : 'no_cumplido',
      valor: bien ? 'estable' : 'empeoró',
      esperado: 'sin empeorar',
      detalle: bien
        ? 'La irradiación, las parestesias y la fuerza no empeoraron respecto de la sesión anterior'
        : 'EMPEORÓ respecto de la sesión anterior: no avanzar de fase y revisar la dosis',
    };
  }

  // Las pruebas especiales se evalúan por positivo/negativo, no por umbral.
  if (cr.metrica === 'prueba') {
    const quiere = cr.operador === 'negativo' ? 'negativo' : 'positivo';
    return {
      ...base, auto: true,
      estado: valor === quiere ? 'cumplido' : 'no_cumplido',
      valor, esperado: quiere,
      detalle: `${cr.ref}: ${valor} (se busca ${quiere})`,
    };
  }

  const comp = OPERADORES[cr.operador];
  if (!comp) {
    return {
      ...base, auto: true, estado: 'pendiente', valor,
      esperado: `${cr.operador} ${cr.umbral}`,
      detalle: `Operador "${cr.operador}" no reconocido — revisá este criterio`,
    };
  }
  const umbral = num(cr.umbral);
  if (umbral === null) {
    return {
      ...base, auto: true, estado: 'pendiente', valor,
      esperado: 'sin umbral definido',
      detalle: 'Este criterio no tiene umbral: ponele uno para que se pueda exigir',
    };
  }

  const pasa = comp(valor, umbral);
  return {
    ...base, auto: true,
    estado: pasa ? 'cumplido' : 'no_cumplido',
    valor: `${valor}${unidad}`,
    esperado: `${cr.operador} ${umbral}${unidad}`,
    detalle: `${cr.que || met.label}: ${valor}${unidad} (se pide ${cr.operador} ${umbral}${unidad})`,
  };
}

// ─── Evaluar una fase entera ───────────────────────────────────────────────
// El veredicto es lo que habilita o no el pase de fase. Tres resultados y no
// dos, porque "le falta medir" y "no cumple" son cosas distintas y mezclarlas
// es lo que hacía que el pase se decidiera a ojo.
export function evaluarFase(criterios = [], ctx = {}) {
  const evaluados = criterios.map(cr => evaluarCriterio(cr, ctx));
  const oblig = evaluados.filter(c => c.obligatorio);
  const cumplidos = oblig.filter(c => c.estado === 'cumplido');
  const noCumplidos = oblig.filter(c => c.estado === 'no_cumplido');
  const pendientes = oblig.filter(c => c.estado === 'pendiente');

  let veredicto, motivo;
  if (!oblig.length) {
    veredicto = 'sin_criterios';
    motivo = 'Esta fase no tiene criterios obligatorios definidos';
  } else if (noCumplidos.length) {
    veredicto = 'no_avanza';
    motivo = `No cumple ${noCumplidos.length} de ${oblig.length}: ${noCumplidos.map(c => c.que || c.eje).join(', ')}`;
  } else if (pendientes.length) {
    veredicto = 'falta_medir';
    motivo = `Cumple todo lo medido, pero falta medir ${pendientes.length}: ${pendientes.map(c => c.que || c.eje).join(', ')}`;
  } else {
    veredicto = 'avanza';
    motivo = `Cumple los ${oblig.length} criterios obligatorios`;
  }

  return {
    veredicto, motivo, criterios: evaluados,
    // El porcentaje es solo para la barra de progreso de la pantalla. El que
    // decide es el veredicto: 4 de 5 criterios no habilita nada.
    pct: oblig.length ? Math.round(cumplidos.length / oblig.length * 100) : 0,
    cumplidos: cumplidos.length, total: oblig.length,
    autoEvaluables: evaluados.filter(c => c.auto).length,
  };
}

// ─── El semáforo de carga ──────────────────────────────────────────────────
// Es la regla que Manu usa dentro de la sesión, distinta del semáforo del
// cliente en el gym. Se queda acá porque es parte del método de rehab y no de
// la clasificación de negocio.
// La regla de fondo, en sus palabras: "el objetivo de rehabilitación es
// recuperar capacidad de carga, no conseguir que cada movimiento sea
// completamente asintomático desde el principio". Por eso 3-4/10 no frena
// nada por sí solo.
export const SEMAFORO_CARGA = [
  { k: 'verde',    rango: '0–2/10', color: '#16A34A', accion: 'Continuar',
    regla: 'Seguir con la progresión prevista.' },
  { k: 'amarillo', rango: '3–4/10', color: '#D97706', accion: 'Aceptable con vigilancia',
    regla: 'Se puede seguir si: no aumenta progresivamente, no aparece irradiación nueva, y vuelve al nivel basal después.' },
  { k: 'rojo',     rango: '≥5/10 o síntomas neurológicos nuevos', color: '#DC2626', accion: 'Reducir o cambiar y reevaluar',
    regla: 'Bajar la carga o cambiar el ejercicio. No se para todo: se ajusta la dosis.' },
];

export function semaforoDeCarga(eva, sintomasNeuralesNuevos = false) {
  const v = num(eva);
  if (sintomasNeuralesNuevos) return SEMAFORO_CARGA[2];
  if (v === null) return null;
  if (v <= 2) return SEMAFORO_CARGA[0];
  if (v <= 4) return SEMAFORO_CARGA[1];
  return SEMAFORO_CARGA[2];
}
