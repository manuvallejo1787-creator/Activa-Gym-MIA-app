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

// Patrón dominante de cada día, para no repetir el mismo estímulo dos días
// seguidos. El reparto sigue la lógica de frecuencia 2 por patrón en la semana.
const ROTACION_DIAS = {
  2: [['empuje', 'tren inferior'], ['tracción', 'tren inferior']],
  3: [['empuje', 'tren inferior'], ['tracción', 'zona media'], ['tren inferior', 'empuje']],
  4: [['empuje'], ['tren inferior'], ['tracción'], ['tren inferior']],
  5: [['empuje'], ['tren inferior'], ['tracción'], ['tren inferior'], ['zona media', 'funcional']],
};

// Los déficits del screening se traducen a patrones a priorizar.
// Verificado contra los 6 patrones que realmente se miden en el gym.
const DEFICIT_A_PATRON = {
  'Sentadilla':                  ['tren inferior', 'rodilla', 'sentadilla'],
  'Bisagra de cadera':           ['bisagra', 'cadera', 'isquio'],
  'Zancada':                     ['unilateral', 'zancada', 'tren inferior'],
  'Sentadilla a una pierna':     ['unilateral', 'propioc', 'glúteo'],
  'Dead bug':                    ['zona media', 'antiextensión', 'core'],
  'Bird dog':                    ['zona media', 'antirrotación', 'core'],
};

const norm = (s) => (s || '').toLowerCase();

// ─── Selección de ejercicios para un bloque ────────────────────────────────
// Ordena por: prioridad de déficit → coincidencia con el patrón del día →
// nivel adecuado a la fase. Excluye lo bloqueado por restricción y degrada
// a la regresión cuando hay advertencia.
function elegirEjercicios({ bloque, cantidad, exs, cliente, checkRestriction, patronesDia, patronesDeficit, faseCliente, yaUsados }) {
  const nivelObjetivo = faseCliente === 'restaura' ? 'Principiante'
                      : faseCliente === 'activa' ? 'Intermedio' : 'Avanzado';
  const ordenNivel = { Principiante: 0, Intermedio: 1, Avanzado: 2 };

  const candidatos = exs
    .filter(e => e.bloque === bloque)
    .filter(e => !yaUsados.has(e.id))
    .map(e => {
      const restr = checkRestriction ? checkRestriction(e, cliente) : null;
      if (restr === 'block') return null;

      let score = 0;
      const texto = norm(e.nombre) + ' ' + norm(e.patron) + ' ' + norm(e.musculos);

      // 1) Déficits detectados en la evaluación — el peso más alto
      patronesDeficit.forEach((p, i) => {
        if (texto.includes(norm(p))) score += 100 - i * 5;
      });
      // 2) Patrón dominante del día
      patronesDia.forEach(p => { if (texto.includes(norm(p))) score += 30; });
      // 3) Cercanía al nivel de la fase
      score -= Math.abs((ordenNivel[e.nivel] ?? 1) - ordenNivel[nivelObjetivo]) * 12;
      // 4) Una advertencia no descarta, pero baja la prioridad
      if (restr === 'warn') score -= 45;

      return { ex: e, score, restr };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return candidatos.slice(0, cantidad);
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
  const rotacion = ROTACION_DIAS[nDias] || ROTACION_DIAS[3];

  const dias = [];
  for (let d = 0; d < nDias; d++) {
    const patronesDia = rotacion[d % rotacion.length] || [];
    const yaUsados = new Set();   // sin repetir ejercicio dentro del mismo día
    const blocks = bloques.map((tipo, i) => {
      const params = paramsDeBloque(tipo, fasePer);
      const elegidos = elegirEjercicios({
        bloque: tipo, cantidad: cupos[tipo] ?? 2, exs, cliente, checkRestriction,
        patronesDia, patronesDeficit, faseCliente: fase, yaUsados,
      });
      elegidos.forEach(c => yaUsados.add(c.ex.id));

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
      name: `Día ${d + 1} — ${patronesDia.join(' / ') || 'general'}`,
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
      cobertura: {
        totalEj, conPeso, conAviso,
        pctConPeso: totalEj ? Math.round(conPeso / totalEj * 100) : 0,
        bloquesVacios: bloques.filter(b => !dias[0]?.blocks.some(x => x.type === b)),
      },
      listoParaAplicar: bloqueantes.length === 0,
    },
  };
}
