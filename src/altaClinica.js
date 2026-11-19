// altaClinica.js — LA TRANSICIÓN DE CLÍNICA A SALA
//
// ═══════════════════════════════════════════════════════════════════════════
// QUÉ CIERRA
// ═══════════════════════════════════════════════════════════════════════════
// Manu, 19/11/2026: "La transición de clínica a sala tiene que ser natural,
// intuitiva y práctica. La IA debe poder reconocer que un cliente estaba en
// tratamiento —qué lesión trataba y qué estuvo haciendo, leyendo su plan
// clínico— para que al transferirlo a la planificación de los entrenamientos
// en sala contemple esas cosas y las añada de preventivo."
//
// Lo que había: `fisio_planes_clinicos.fases_detalle` guarda, por región, el
// tejido lesionado, la EVA inicial, las tres fases clínicas (R0/R1/R2) con su
// objetivo, sus criterios de salida, su dosificación y sus ejercicios, y el
// rango de semanas de cada una. Todo eso ya estaba escrito en la base.
//
// Y NADIE LO LEÍA al planificar en sala. El planificador y el pedido a la IA
// no sabían que el cliente había estado en tratamiento. Es el mismo patrón que
// el puente de fases: la información existía, en prosa, y no se consumía.
//
// ═══════════════════════════════════════════════════════════════════════════
// QUÉ FASE SE ARRASTRA, Y POR QUÉ NO LA PRIMERA
// ═══════════════════════════════════════════════════════════════════════════
// Se arrastra la fase VIGENTE según la semana de tratamiento, y si el plan ya
// terminó, la última. Nunca R0.
//
// Clínicamente: lo que hay que mantener al pasar a sala es el trabajo que
// SACÓ a la persona de la lesión —la tolerancia a la carga del tejido, el
// excéntrico, el control motor de R1/R2— no la analgesia de R0. Arrastrar
// isometrías submáximas y crioterapia a un plan de gimnasio sería arrastrar lo
// que se hace cuando NO se puede cargar, justo cuando ya se puede.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ REUSA EL BLOQUE DIRIGIDO DEL ESCALÓN 2
// ═══════════════════════════════════════════════════════════════════════════
// El preventivo se entrega con la MISMA forma que `bloque_dirigido`
// (src/superposicion.js, 30/10): región, fase, nota y ejercicios
// desnormalizados con nombre adentro. Dos razones:
//
//   1. Los ejercicios del protocolo clínico no están en la tabla `ejercicios`
//      —son ids como `prot_hombro_retorno_funcion_0`— y el portal no importa
//      el bundle de la app. El nombre tiene que viajar dentro del jsonb, que
//      es exactamente el problema que ya se resolvió en el escalón 2.
//   2. La maquinaria que inserta un bloque en el plan SIN tocar el plan
//      original ya existe, está probada (48 controles) y se deshace sola. Un
//      segundo mecanismo paralelo sería una segunda cosa que puede fallar.
import { regionDeZona } from './rehabPuente.js';

const DIA = 864e5;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const diasEntre = (a, b) => {
  if (!a || !b) return null;
  const d = Math.round((new Date(b + 'T12:00') - new Date(String(a).slice(0, 10) + 'T12:00')) / DIA);
  return Number.isFinite(d) ? d : null;
};

// ── EN QUÉ SEMANA DE TRATAMIENTO ESTÁ ─────────────────────────────────────
// Semana 1 es la de `fecha_inicio`. Se usa para saber qué fase está vigente.
export function semanaDeTratamiento(fechaInicio, hoy = hoyISO()) {
  const d = diasEntre(fechaInicio, hoy);
  if (d == null || d < 0) return null;
  return Math.floor(d / 7) + 1;
}

// ── QUÉ FASE CLÍNICA ESTÁ VIGENTE PARA ESA REGIÓN ─────────────────────────
// Por el rango de semanas que guarda cada fase. Si la semana actual pasó el
// final del plan, devuelve la ÚLTIMA fase: el tratamiento terminó y lo que
// corresponde mantener es el trabajo con el que terminó, no el del principio.
export function faseVigente(regionDetalle = {}, fechaInicio = null, hoy = hoyISO()) {
  const fases = Array.isArray(regionDetalle.fases) ? regionDetalle.fases : [];
  if (!fases.length) return null;
  const sem = semanaDeTratamiento(fechaInicio, hoy);
  if (sem == null) return fases[fases.length - 1];
  const dentro = fases.find(f =>
    Number.isFinite(f.semanaDesde) && Number.isFinite(f.semanaHasta) &&
    sem >= f.semanaDesde && sem <= f.semanaHasta);
  return dentro || fases[fases.length - 1];
}

// ── EL RESUMEN CLÍNICO, UNA ENTRADA POR REGIÓN ────────────────────────────
// Es lo que consumen el pedido a la IA y el bloque preventivo. Se calcula una
// vez y lo leen los dos, para que no se desincronicen: si cada uno lo
// derivara por su cuenta, el preventivo podría traer ejercicios de una fase y
// el texto de la IA describir otra.
export function resumenClinico({ planes = [], pacienteId = null, hoy = hoyISO() } = {}) {
  const propios = (planes || []).filter(p =>
    p && (!pacienteId || p.paciente_id === pacienteId) && Array.isArray(p.fases_detalle));
  const out = [];
  propios.forEach(plan => {
    plan.fases_detalle.forEach(reg => {
      if (!reg || !reg.region) return;
      const f = faseVigente(reg, plan.fecha_inicio, hoy);
      if (!f) return;
      const sem = semanaDeTratamiento(plan.fecha_inicio, hoy);
      const total = plan.semanas || null;
      out.push({
        planId: plan.id,
        estadoPlan: plan.estado || '',
        region: reg.region,
        regionRehab: regionDeZona(reg.region) || reg.region,
        tejido: reg.tejido || '',
        evaInicial: reg.eva ?? null,
        objetivoRegion: reg.objetivo || '',
        fechaEval: reg.fechaEval || null,
        fechaInicio: plan.fecha_inicio || null,
        semanaActual: sem,
        semanasTotales: total,
        // ¿El tratamiento ya terminó por calendario? No es lo mismo que el
        // alta clínica —que la decide el fisio por criterios— pero es el único
        // dato objetivo que hay, y se devuelve como tal.
        pasoElPlazo: !!(sem && total && sem > total),
        fase: f.fase || '',
        faseBadge: f.badge || '',
        faseLabel: f.label || '',
        faseObjetivo: f.objetivo || '',
        criterios: Array.isArray(f.criterios) ? f.criterios : [],
        dosis: f.dosis || {},
        ejercicios: (Array.isArray(f.ejercicios) ? f.ejercicios : [])
          .filter(e => e && e.id && e.nombre)
          .map(e => ({ id: e.id, nombre: e.nombre, region: e.region || reg.region })),
      });
    });
  });
  return out;
}

// ── EL BLOQUE PREVENTIVO PARA EL PLAN DE SALA ─────────────────────────────
// Misma forma que `bloque_dirigido` del escalón 2, así que lo inserta la
// maquinaria que ya está probada y se deshace sola.
//
// TOPE DE 3 EJERCICIOS POR REGIÓN, y es una decisión, no un detalle: el
// preventivo va ADEMÁS del entrenamiento, no en su lugar. Las fases clínicas
// traen hasta 6 ejercicios, y meter 6 de hombro más 6 de cervical al final de
// una sesión de fuerza da una sesión que nadie termina — y un preventivo que
// no se hace no previene nada.
export function bloquePreventivo(res, tope = 3) {
  if (!res || !res.ejercicios || !res.ejercicios.length) return null;
  const d = res.dosis || {};
  return {
    region: res.region,
    fase: res.faseLabel || res.fase || '',
    fase_clinica: res.fase || '',
    origen: 'alta_clinica',
    planId: res.planId || null,
    nota: [
      res.tejido ? `Tejido tratado: ${res.tejido}.` : '',
      d.intencion || '',
      'Viene del plan clínico: mantener mientras el tejido consolida.',
    ].filter(Boolean).join(' '),
    dias: [],
    exercises: res.ejercicios.slice(0, tope).map(e => ({
      exId: e.id,
      nombre: e.nombre,
      desc: res.faseObjetivo || '',
      series: d.series || 2,
      reps: d.reps || '',
      descanso: d.descanso || '',
      notas: d.carga || '',
    })),
  };
}

// ── EL TEXTO QUE LEE LA IA ────────────────────────────────────────────────
// Va al pedido de generación de sesión. Dice QUÉ se trató, EN QUÉ FASE quedó,
// QUÉ se estuvo haciendo y QUÉ falta para avanzar — que es exactamente lo que
// Manu pidió que la IA pudiera reconocer.
//
// Vive acá y no armado en la pantalla para que el arnés verifique que nombra
// el tejido y la fase: un texto que dijera sólo "tuvo una lesión de hombro" no
// alcanza para que la IA agregue el preventivo correcto.
export function textoClinicoParaIA(resumenes = []) {
  const rs = (resumenes || []).filter(Boolean);
  if (!rs.length) return '';
  const bloques = rs.map(r => {
    const partes = [`▸ ${String(r.region).toUpperCase()}${r.tejido ? ` — ${r.tejido}` : ''}`];
    partes.push(`  Fase clínica actual: ${r.faseBadge ? r.faseBadge + ' ' : ''}${r.faseLabel || r.fase}` +
      (r.semanaActual && r.semanasTotales ? ` (semana ${r.semanaActual} de ${r.semanasTotales})` : '') +
      (r.pasoElPlazo ? ' — el plan clínico ya pasó su plazo previsto' : ''));
    if (r.faseObjetivo) partes.push(`  Objetivo de esa fase: ${r.faseObjetivo}`);
    if (r.dosis?.intencion) partes.push(`  Intención de la carga: ${r.dosis.intencion}`);
    if (r.ejercicios.length) {
      partes.push(`  Estuvo haciendo: ${r.ejercicios.map(e => e.nombre).join(', ')}`);
    }
    if (r.criterios.length) {
      partes.push(`  Criterios para avanzar de fase: ${r.criterios.join(' · ')}`);
    }
    return partes.join('\n');
  });

  return `
TRATAMIENTO CLÍNICO DE ESTE CLIENTE — LEELO ANTES DE ELEGIR EJERCICIOS.
Este cliente estuvo (o está) en tratamiento en la clínica. Esto sale de su plan
clínico, no de una suposición:

${bloques.join('\n\n')}

QUÉ HACER CON ESTO AL ARMAR LA SESIÓN:
- Incluí trabajo PREVENTIVO de esas regiones en el bloque prev_rehab o
  activacion, aunque el cliente ya esté habilitado para entrenar: el tejido
  sigue consolidando después del alta.
- NO elijas ejercicios que reproduzcan el gesto agresor de esas regiones como
  trabajo principal. Si el patrón es inevitable para el objetivo del cliente,
  usá la variante más estable (unilateral apoyado, máquina guiada, rango
  parcial) y decilo en el razonamiento.
- Si los criterios de avance de arriba todavía no se cumplen, prescribí como si
  siguiera en esa fase clínica, no como si estuviera de alta.
- El preventivo va ADEMÁS del entrenamiento, no en su lugar: 2-3 ejercicios por
  región, no más. Un preventivo que no se termina no previene nada.
`;
}

// ── CANDIDATOS A PASAR DE LA CLÍNICA A LA SALA ────────────────────────────
//
// EL AGUJERO QUE ESTO CIERRA, encontrado el 19/11 al mirar la base real:
// el ÚNICO plan clínico cargado es de Natalia Cabrera, que está en la semana
// 11 de 12 con cuatro regiones tratadas… y NO es cliente del gimnasio ni está
// vinculada a ninguno. O sea que toda la transición construida hoy no podía
// dispararse para el único caso que existe.
//
// Y no había forma de pasar un paciente de la clínica a cliente del gimnasio:
// ninguna pantalla lo hacía. Es exactamente la población que Manu describió en
// octubre —"clientes de afuera que usan clínica y luego son candidatos a seguir
// en el gym"— y la app no tenía por dónde.
//
// POR QUÉ APARECE SOLO Y NO HAY QUE IR A BUSCARLO
// Un paciente que termina su tratamiento y no pasa a sala se pierde en
// silencio: nadie abre la ficha de un paciente dado de alta. El aviso tiene que
// venir a buscar al profesional, no al revés — mismo criterio que el resumen
// diario del escalón 1.
//
// CUÁNDO SE AVISA: cuando falta `avisoSemanas` o menos para el final del plan,
// o cuando ya terminó. Antes de eso el paciente está en tratamiento y ofrecer
// pasarlo a sala sería apurar un alta que no dio el fisio.
export function candidatosASala({ planes = [], pacientes = [], clientes = [],
                                  hoy = hoyISO(), avisoSemanas = 2 } = {}) {
  const vinculados = new Set((clientes || []).map(c => c && c.fisio_paciente_id).filter(Boolean));
  const out = [];
  (planes || []).forEach(plan => {
    if (!plan || !plan.paciente_id || !Array.isArray(plan.fases_detalle)) return;
    if (vinculados.has(plan.paciente_id)) return;        // ya tiene su cliente
    const sem = semanaDeTratamiento(plan.fecha_inicio, hoy);
    const total = plan.semanas || null;
    if (sem == null || !total) return;
    const faltan = total - sem;
    if (faltan > avisoSemanas) return;                   // todavía en tratamiento
    const pac = (pacientes || []).find(p => p && p.id === plan.paciente_id);
    out.push({
      pacienteId: plan.paciente_id,
      nombre: pac ? `${pac.nombre} ${pac.apellido || ''}`.trim() : (plan.nombre || 'Paciente'),
      planId: plan.id,
      semanaActual: sem,
      semanasTotales: total,
      semanasRestantes: Math.max(0, faltan),
      termino: faltan <= 0,
      regiones: plan.fases_detalle.map(r => r && r.region).filter(Boolean),
      // El resumen ya calculado, para que el que confirma vea qué se arrastra
      // antes de confirmar y no después.
      clinico: resumenClinico({ planes: [plan], pacienteId: plan.paciente_id, hoy }),
    });
  });
  return out;
}

// ── REPARTIR EL PREVENTIVO ENTRE LOS DÍAS ─────────────────────────────────
//
// EL PROBLEMA QUE ESTO ARREGLA, encontrado el 19/11 probando contra el plan
// real: Natalia Cabrera tiene CUATRO regiones tratadas (hombro, codo, cervical,
// muñeca). Con el tope de 3 por región eso daba 12 ejercicios preventivos al
// principio de CADA día — una sesión entera de preventivo antes de empezar a
// entrenar. El tope por región no alcanzaba y lo vi recién con datos reales:
// con una o dos regiones nunca se nota.
//
// LA SOLUCIÓN ES REPARTIR, NO RECORTAR. Si se recortara a las primeras dos
// regiones, las otras dos no se trabajarían nunca. Repartidas en rueda entre
// los días, la semana cubre las cuatro y ninguna sesión se vuelve impracticable:
// con 4 regiones y 3 días, el día 1 lleva hombro y codo, el 2 cervical y
// muñeca, el 3 hombro y codo otra vez.
//
// `tope` es por DÍA, no por región: es lo que determina si la sesión se
// termina, y una sesión que no se termina no entrena ni previene.
export function repartirPreventivos(bloques = [], nDias = 3, topePorDia = 2) {
  const bs = (bloques || []).filter(b => b && Array.isArray(b.exercises) && b.exercises.length);
  const dias = Math.max(1, nDias | 0);
  const porDia = Array.from({ length: dias }, () => []);
  if (!bs.length) return porDia;
  // Rueda: el bloque i va al día i % dias. Con menos bloques que días, algunos
  // días quedan sin preventivo, que es correcto — no se repite para rellenar.
  bs.forEach((b, i) => {
    const d = i % dias;
    if (porDia[d].length < topePorDia) porDia[d].push(b);
    else {
      // El día que le tocaba está lleno: va al primero con lugar. Así no se
      // pierde una región por el orden en que vino.
      const libre = porDia.findIndex(x => x.length < topePorDia);
      if (libre >= 0) porDia[libre].push(b);
    }
  });
  return porDia;
}
