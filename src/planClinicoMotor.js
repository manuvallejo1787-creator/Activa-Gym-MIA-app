// ═══════════════════════════════════════════════════════════════════════════
// planClinicoMotor.js — PLANES CLÍNICOS POR HORIZONTE TEMPORAL
//
// QUÉ RESUELVE
// Armar un plan de rehabilitación a corto / medio / largo plazo, derivado de
// la evaluación clínica, con fases, criterios de salida y prescripción de
// ejercicios por fase, conectable a las sesiones individuales.
//
// POR QUÉ EL PLAZO NO ES UNA ELECCIÓN LIBRE
// El plazo lo determina el tejido, no la preferencia. Un plan de 4 semanas
// para una tendinopatía es un error con interfaz linda: la remodelación del
// colágeno tendinoso no se acelera por poner una fecha más corta. Por eso el
// motor PROPONE el horizonte según el tejido y AVISA cuando la elección lo
// contradice, en lugar de dejar armar algo biológicamente imposible.
//
// HALLAZGO QUE MOTIVÓ PARTE DE ESTE MÓDULO
// PROT_SESION (10 regiones × 3 fases de ejercicios) se consultaba con la fase
// de NEGOCIO (restaura/activa/potencia) cuando sus claves son las fases
// CLÍNICAS (aguda/subaguda/cronica). prot['restaura'] nunca existió: el
// catálogo jamás devolvió un ejercicio. Acá se consulta con la clave correcta.
// ═══════════════════════════════════════════════════════════════════════════

import { FASES_REHAB, generarProtocoloRehab } from "./criterios.js";

// ─── Catálogo de ejercicios de rehabilitación por región y fase clínica ───
// Movido desde FisioActiva.jsx para romper el ciclo de imports
// (PlanClinico ← FisioActiva ← PlanClinico).
export const PROT_SESION = {
  cervical:{ aguda:['Isométrico cervical anterior','Isométrico cervical posterior','Retracción cervical en supino','Movilización escapular activa','Respiración diafragmática'], subaguda:['Chin tuck dinámico sentado','Rotación cervical activa-asistida','Flexión-extensión cervical activa','Inclinación lateral activa','Estiramiento trapecio superior','Deep neck flexor (DNF) progresivo'], cronica:['Chin tuck con banda de resistencia','Fortalecimiento extensores cervicales','Propiocepción cervical con laser pointer','Fortalecimiento postural global','Estabilización cervical en cuadrupedia'] },
  hombro:  { aguda:['Péndulo de Codman','Isométrico de hombro en posición neutra','Rotación externa isométrica 0° abd','Control escapular en reposo','Crioterapia post-actividad'], subaguda:['Polea de hombro (flexión asistida)','Rotación externa con banda (neutro)','Scaption en plano escapular','Estiramiento cápsula posterior','Retracción escapular con banda','Y/T/W en banco inclinado'], cronica:['Press de hombro con mancuerna','Remo vertical en polea','Push-up plus (protracción)','Rotación externa a 90° abducción','Entrenamiento excéntrico manguito'] },
  codo:    { aguda:['Inmovilización relativa + elevación','Isométrico de flexores de codo','Movilización activa de muñeca','Crioterapia + compresión'], subaguda:['Flexo-extensión de codo activa','Pronosupinación activa','Excéntrico extensores de muñeca','Excéntrico flexores de muñeca','Estiramiento extensores antebrazo','Fortalecimiento agarre progresivo'], cronica:['Curl de bíceps con mancuerna','Extensión de tríceps en polea','Fortalecimiento global antebrazo','Ejercicios funcionales de empuje/tracción'] },
  muneca:  { aguda:['Reposo relativo + ortesis funcional','Movilización activa dedos','Isométrico muñeca en neutro','Crioterapia + elevación'], subaguda:['Flexo-extensión muñeca activa','Desviación radial-cubital activa','Pronosupinación progresiva','Fortalecimiento agarre con pelota'], cronica:['Fortalecimiento muñeca con banda','Ejercicios propioceptivos de muñeca','Fortalecimiento funcional de pinza'] },
  esc:     { aguda:['Isométrico escapular suave','Retracción escapular pasiva','Respiración diafragmática','Control postural cervical'], subaguda:['Retracción escapular con banda','Remo con foco escapular','Serrato anterior (serratus push-up)','Y/T/W bajo peso'], cronica:['Press hombro con mancuerna','Remo en polea alta','Fortalecimiento postural integrado','Planificación funcional sobre la cabeza'] },
  columna: { aguda:['Respiración diafragmática','Movilización suave en descarga','Isométrico lumbar en neutro','Educación postural'], subaguda:['Cat-camel en cuadrupedia','Bird-dog progresivo','Puente de glúteo básico','Estiramiento cadena posterior'], cronica:['Peso muerto con barra','Sentadilla goblet','Plancha anterior y lateral','Fortalecimiento funcional integrado'] },
  lumbar:  { aguda:['Respiración diafragmática','Decúbito con almohada bajo rodillas','Movilización suave en descarga','Retracción abdominal suave'], subaguda:['Cat-camel en cuadrupedia','Bird-dog progresivo','Puente de glúteo bilateral','Estiramiento piriforme y psoas'], cronica:['Peso muerto rumano progresivo','Sentadilla goblet','Dead bug avanzado','Fortalecimiento funcional lumbar'] },
  cadera:  { aguda:['Isométrico de glúteo','Movilización activa en descarga','Retracción abdominal suave','Crioterapia si hay inflamación'], subaguda:['Clamshell con banda','Puente de glúteo unilateral','Estiramiento psoas y TFL','Sentadilla parcial con banda'], cronica:['Hip thrust con barra','Sentadilla búlgara','Peso muerto unilateral','Trabajo funcional de cadera'] },
  rodilla: { aguda:['Isométrico cuádriceps','Elevación pierna extendida','Movilización rotuliana suave','Crioterapia + compresión + elevación'], subaguda:['Sentadilla parcial','TKE (extensión terminal de rodilla)','Curl de isquiotibiales','Propiocepción básica bipodal'], cronica:['Sentadilla completa progresiva','Peso muerto rumano','Saltos reactivos progresivos','Fortalecimiento funcional de rodilla'] },
  tobillo: { aguda:['RICE: reposo relativo + hielo + compresión + elevación','Movilización activa del tobillo','Alfabeto con el pie','Peroneales isométricos'], subaguda:['Ejercicios de fuerza peroneales con banda','Elevaciones de talón en escalón','Propiocepción bipodal en superficie estable','Estiramiento del gemelo y sóleo'], cronica:['Propiocepción unipodal en inestable','Salto y aterrizaje progresivo','Fortalecimiento funcional tobillo','Deporte-específico'] },
};

// ─── Horizontes ────────────────────────────────────────────────────────────
export const HORIZONTES = {
  corto: { k: 'corto', label: 'Corto plazo', rango: '≤ 4 semanas', semanasMin: 1,  semanasMax: 4,  color: '#DC2626',
    uso: 'Cuadro agudo, control de síntomas, o un bloque puntual dentro de un proceso más largo.' },
  medio: { k: 'medio', label: 'Medio plazo', rango: '4 a 12 semanas', semanasMin: 5, semanasMax: 12, color: '#D97706',
    uso: 'La mayoría de los procesos musculoesqueléticos: recuperar ROM, carga y control motor.' },
  largo: { k: 'largo', label: 'Largo plazo', rango: '> 12 semanas', semanasMin: 13, semanasMax: 52, color: '#16A34A',
    uso: 'Tendinopatías crónicas, post-quirúrgicos, cartílago, retorno deportivo completo.' },
};

// ─── Plazos biológicos de referencia por tejido ────────────────────────────
// Rangos orientativos de reparación/remodelación tisular. NO son garantías
// clínicas: son el piso biológico por debajo del cual un plan no es realista.
// Se usan para proponer el horizonte y detectar contradicciones.
export const PLAZOS_TEJIDO = [
  { re: /tendin|tendón|tendon|epicondil|epitrocle|aquiles|rotulian|supraespinoso|manguito/i,
    semanas: [12, 24], horizonte: 'largo',
    nota: 'Tejido tendinoso: la remodelación del colágeno requiere carga progresiva sostenida. 12 semanas es el piso, no la meta.' },
  { re: /post[- ]?quir|cirug|operad|reconstru|ligamentoplast|lca|menisc/i,
    semanas: [24, 48], horizonte: 'largo',
    nota: 'Post-quirúrgico: el plazo lo fija el protocolo del cirujano y la maduración del injerto, no la evolución sintomática.' },
  { re: /cartílag|cartilag|condral|condropat|artrosis|artros/i,
    semanas: [12, 24], horizonte: 'largo',
    nota: 'Cartílago: capacidad de reparación muy limitada. El objetivo es tolerancia a la carga, no curación estructural.' },
  { re: /ligament|esguince|inestabil/i,
    semanas: [6, 12], horizonte: 'medio',
    nota: 'Ligamento: reparación en 6-12 semanas según grado. La propiocepción se trabaja desde el inicio.' },
  { re: /radiculopat|neuropat|nervio|neural|compresión radicular|ciátic|ciatic|túnel|tunel/i,
    semanas: [8, 16], horizonte: 'medio',
    nota: 'Tejido nervioso: la regeneración axonal avanza ~1 mm/día. Si hay déficit motor, el plazo se alarga.' },
  { re: /muscul|desgarro|contractura|distensión|distension|elongaci/i,
    semanas: [3, 6], horizonte: 'medio',
    nota: 'Músculo: buena vascularización, reparación en 3-6 semanas según grado. Retorno guiado por criterios, no por calendario.' },
  { re: /bursi|sinovi|capsuli|inflamat/i,
    semanas: [4, 8], horizonte: 'medio',
    nota: 'Proceso inflamatorio: el control de síntomas es rápido, pero hay que resolver la causa mecánica o recidiva.' },
  { re: /fractur|óse|ose|estrés|estres/i,
    semanas: [8, 16], horizonte: 'medio',
    nota: 'Hueso: consolidación en 6-12 semanas; la carga progresiva posterior suma varias semanas más.' },
  { re: /fasci|plantar/i,
    semanas: [8, 16], horizonte: 'medio',
    nota: 'Fascia: respuesta lenta a la carga. Los plazos cortos suelen terminar en recidiva.' },
];

// Fases clínicas ↔ claves del catálogo de ejercicios PROT_SESION
export const FASE_A_PROT = { proteccion: 'aguda', carga_progresiva: 'subaguda', retorno_funcion: 'cronica' };
export const PROT_A_FASE = { aguda: 'proteccion', subaguda: 'carga_progresiva', cronica: 'retorno_funcion' };

// Parámetros de dosificación por fase clínica.
// Referencias habituales: isometría analgésica 30-45 s en fase aguda;
// excéntricos y carga progresiva en subaguda; trabajo pesado-lento y
// pliometría en retorno funcional.
export const DOSIS_FASE = {
  proteccion: {
    series: 3, reps: '30-45 seg', carga: 'Isométrica submáxima (~40-70% MVC)',
    frecuencia: 'Diario o 2 veces/día', descanso: '60 seg',
    intencion: 'Analgesia y protección. No buscar adaptación, buscar tolerancia.',
  },
  carga_progresiva: {
    series: 3, reps: '8-15', carga: 'Progresiva · excéntrico lento (3-4 seg)',
    frecuencia: '3-4 veces/semana', descanso: '90 seg',
    intencion: 'Reintroducir carga y restaurar control motor. El dolor durante el ejercicio hasta 3/10 es aceptable si baja en 24 h.',
  },
  retorno_funcion: {
    series: 4, reps: '6-10', carga: 'Pesado-lento y específico del objetivo',
    frecuencia: '2-3 veces/semana', descanso: '120-150 seg',
    intencion: 'Capacidad funcional del gesto objetivo, sin compensaciones ni dolor residual.',
  },
};

const norm = (s) => (s || '').toLowerCase();

// ═══════════════════════════════════════════════════════════════════════════
// 1) HORIZONTE SUGERIDO A PARTIR DEL TEJIDO Y DEL DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════════════════════
export function sugerirHorizonte({ tejido = '', diagnostico = '', motivo = '', evolucion = '', eva = null }) {
  const texto = `${tejido} ${diagnostico} ${motivo}`;
  const match = PLAZOS_TEJIDO.find(p => p.re.test(texto));

  const cronico = /crónic|cronic|meses|año|recidiv|recurrent/i.test(`${evolucion} ${motivo} ${diagnostico}`);
  const razones = [];

  let horizonte = match?.horizonte || 'medio';
  let semanas = match ? Math.round((match.semanas[0] + match.semanas[1]) / 2) : 8;

  if (match) razones.push(match.nota);
  else razones.push('Sin tejido tipificado en la evaluación: se asume un proceso musculoesquelético de medio plazo. Cargá el tejido en el paso 1 de la evaluación para afinar el plazo.');

  if (cronico && horizonte === 'medio') {
    horizonte = 'largo'; semanas = Math.max(semanas, 14);
    razones.push('La evolución declarada es crónica o recidivante: el plazo se extiende — un cuadro de meses no se resuelve en semanas.');
  }
  if (eva != null && parseFloat(eva) >= 7) {
    razones.push(`EVA ${eva}/10: la fase de protección va a consumir más semanas de lo habitual antes de poder cargar.`);
    semanas += 2;
  }

  return {
    horizonte, semanas,
    rangoTejido: match?.semanas || null,
    tejidoDetectado: match ? texto.match(match.re)?.[0] : null,
    razones,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) REPARTO DE SEMANAS ENTRE LAS TRES FASES CLÍNICAS
// Un EVA alto alarga protección; un ROM bajo alarga carga progresiva.
// ═══════════════════════════════════════════════════════════════════════════
export function repartirFases({ semanas = 12, eva = null, romPct = null, faseInicial = 'proteccion' }) {
  const total = Math.max(1, semanas);
  const e = eva != null ? parseFloat(eva) : null;
  const r = romPct != null ? parseFloat(romPct) : null;

  // Pesos base 25/45/30, ajustados por la severidad medida
  let w = { proteccion: 0.25, carga_progresiva: 0.45, retorno_funcion: 0.30 };
  if (e != null) {
    if (e >= 7)      w = { proteccion: 0.40, carga_progresiva: 0.40, retorno_funcion: 0.20 };
    else if (e <= 2) w = { proteccion: 0.12, carga_progresiva: 0.48, retorno_funcion: 0.40 };
  }
  if (r != null && r < 70) {
    w.carga_progresiva += 0.10; w.retorno_funcion -= 0.10;
  }

  // Si el paciente ya está en una fase avanzada, las anteriores no se planifican
  const orden = ['proteccion', 'carga_progresiva', 'retorno_funcion'];
  const desde = Math.max(0, orden.indexOf(faseInicial));
  const activas = orden.slice(desde);
  const sumaActivas = activas.reduce((s, k) => s + w[k], 0);

  let acum = 0;
  const fases = activas.map((k, i) => {
    const prop = w[k] / sumaActivas;
    let n = i === activas.length - 1 ? total - acum : Math.max(1, Math.round(total * prop));
    if (n < 1) n = 1;
    const desdeSem = acum + 1;
    acum += n;
    const meta = FASES_REHAB.find(f => f.k === k);
    return {
      fase: k,
      label: meta?.label || k,
      badge: meta?.badge || '',
      color: meta?.color || '#666',
      emoji: meta?.emoji || '',
      semanaDesde: desdeSem,
      semanaHasta: Math.min(acum, total),
      semanas: n,
      objetivo: meta?.objetivo_clinico || '',
      dosis: DOSIS_FASE[k],
    };
  });
  // Corrección de redondeo
  if (fases.length) fases[fases.length - 1].semanaHasta = total;
  return fases;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) PRESCRIPCIÓN DE EJERCICIOS POR FASE
// Lee PROT_SESION con la clave CORRECTA (aguda/subaguda/cronica) y suma los
// ejercicios personalizados del paciente para esa región y fase.
// ═══════════════════════════════════════════════════════════════════════════
export function prescribirEjercicios({ region, fase, protSesion = {}, custom = [] }) {
  const regionKey = (region || '').replace(/\s+/g, '_');
  const prot = protSesion[regionKey] || protSesion[region] || {};
  const claveProt = FASE_A_PROT[fase] || 'subaguda';
  const base = (prot[claveProt] || []).map((nombre, i) => ({
    id: `prot_${region}_${fase}_${i}`, nombre, origen: 'catálogo', fase, region,
  }));
  const propios = (custom || [])
    .filter(c => (c.region === region || !c.region) && (c.fase === fase || c.fase === claveProt || !c.fase))
    .map(c => ({ id: c.id, nombre: c.nombre, origen: 'propio', fase, region, param: c.param, notas: c.notas }));
  return {
    ejercicios: [...base, ...propios],
    dosis: DOSIS_FASE[fase],
    claveCatalogo: claveProt,
    sinCatalogo: base.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) GENERADOR DEL PLAN CLÍNICO
// ═══════════════════════════════════════════════════════════════════════════
export function generarPlanClinico({
  paciente, evaluaciones = [], regionesSel = null,
  horizonteElegido = null, semanasElegidas = null,
  sesionesContratadas = 0, protSesion = {}, custom = [],
  genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
}) {
  const avisos = [], bloqueantes = [];
  const ultimaPorRegion = {};
  (evaluaciones || []).forEach(e => {
    const regs = (e.regiones && e.regiones.length) ? e.regiones : [e.region || 'lumbar'];
    regs.forEach(r => {
      if (!ultimaPorRegion[r] || (e.fecha || '') >= (ultimaPorRegion[r].fecha || '')) ultimaPorRegion[r] = e;
    });
  });

  const regiones = regionesSel && regionesSel.length ? regionesSel : Object.keys(ultimaPorRegion);
  if (!regiones.length) bloqueantes.push('El paciente no tiene evaluaciones cargadas. Sin evaluación no hay plan: primero evaluá.');

  // ── Horizonte por región, derivado del tejido ──────────────────────────
  const porRegion = regiones.map(rk => {
    const ev = ultimaPorRegion[rk] || {};
    const tejido = ev.tejidos?.[rk] || ev.tejidoSospechado || '';
    const eva = ev.eva_movimiento ?? ev.eva_mov ?? ev.eva_reposo ?? null;
    const sug = sugerirHorizonte({
      tejido, diagnostico: ev.diagnosticoPT || '', motivo: ev.motivo || '',
      evolucion: ev.evolucion || '', eva,
    });
    return {
      region: rk, evaluacionId: ev.id || null, fechaEval: ev.fecha || null,
      tejido, eva, romPct: ev.rom_pct ?? null,
      faseInicial: ev.faseRehab || 'proteccion',
      objetivo: ev.objetivo || '',
      sugerencia: sug,
    };
  });

  // El horizonte del plan lo manda la región más exigente
  const PESO_H = { corto: 1, medio: 2, largo: 3 };
  const masExigente = porRegion.reduce((a, b) =>
    (PESO_H[b.sugerencia.horizonte] > PESO_H[a?.sugerencia.horizonte || 'corto'] ? b : a), null);
  const horizonteSugerido = masExigente?.sugerencia.horizonte || 'medio';
  const semanasSugeridas = Math.max(...porRegion.map(r => r.sugerencia.semanas), 4);

  const horizonte = horizonteElegido || horizonteSugerido;
  const H = HORIZONTES[horizonte] || HORIZONTES.medio;
  let semanas = semanasElegidas || Math.min(Math.max(semanasSugeridas, H.semanasMin), H.semanasMax);

  // ── Contradicción entre el plazo elegido y el plazo biológico ──────────
  if (PESO_H[horizonte] < PESO_H[horizonteSugerido]) {
    const r = masExigente;
    bloqueantes.push(
      `Elegiste ${H.label.toLowerCase()} (${semanas} sem) pero ${r.region} sugiere ${HORIZONTES[horizonteSugerido].label.toLowerCase()}` +
      (r.sugerencia.rangoTejido ? ` (${r.sugerencia.rangoTejido[0]}-${r.sugerencia.rangoTejido[1]} semanas)` : '') +
      `. ${r.sugerencia.razones[0]}`);
  }
  porRegion.forEach(r => r.sugerencia.razones.forEach(z => { if (!avisos.includes(z)) avisos.push(z); }));

  // ── Fases y prescripción por región ────────────────────────────────────
  const detalle = porRegion.map(r => {
    const fases = repartirFases({ semanas, eva: r.eva, romPct: r.romPct, faseInicial: r.faseInicial });
    const criterios = generarProtocoloRehab(r.region, r.tejido, r.objetivo, r.eva, r.romPct);
    return {
      ...r,
      fases: fases.map(f => {
        const presc = prescribirEjercicios({ region: r.region, fase: f.fase, protSesion, custom });
        if (presc.sinCatalogo) avisos.push(`Sin ejercicios de catálogo para ${r.region} en fase ${f.label}. Cargá los tuyos en Rehab.`);
        return {
          ...f,
          criterios: criterios.find(c => c.k === f.fase)?.criterios || [],
          ejercicios: presc.ejercicios,
        };
      }),
    };
  });

  // ── Presupuesto de sesiones ────────────────────────────────────────────
  const sesionesPorSemana = horizonte === 'corto' ? 2 : horizonte === 'medio' ? 1.5 : 1;
  const sesionesNecesarias = Math.ceil(semanas * sesionesPorSemana * Math.min(regiones.length, 2) / Math.min(regiones.length, 2));
  const estimadas = Math.ceil(semanas * sesionesPorSemana);
  if (sesionesContratadas > 0 && estimadas > sesionesContratadas) {
    bloqueantes.push(
      `El plan necesita ~${estimadas} sesiones y hay ${sesionesContratadas} contratadas. ` +
      `Faltan ${estimadas - sesionesContratadas}: hay que reducir el plazo, bajar la frecuencia o contratar más.`);
  }

  return {
    plan: {
      id: genId('planc'),
      paciente_id: paciente?.id,
      nombre: `Plan clínico ${H.label.toLowerCase()} · ${semanas} semanas`,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      semanas,
      horizonte,
      sesiones_presupuestadas: sesionesContratadas || estimadas,
      regiones: detalle.map(d => ({
        region: d.region, rol: 'independiente', diagnostico: d.tejido,
        fase_inicial: d.faseInicial, fase_objetivo: 'retorno_funcion',
        evaluacion_id: d.evaluacionId,
      })),
      fases_detalle: detalle,
      objetivo_general: detalle.map(d => d.objetivo).filter(Boolean).join(' · '),
      estado: 'activo',
      notas: '',
    },
    diagnostico: {
      horizonteSugerido, semanasSugeridas, horizonteElegido: horizonte,
      sesionesEstimadas: estimadas, sesionesPorSemana,
      avisos, bloqueantes,
      listoParaAplicar: bloqueantes.length === 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) CONEXIÓN CON LA SESIÓN INDIVIDUAL
// Dada una fecha, devuelve en qué semana del plan está, qué fase corresponde
// a cada región y qué ejercicios están prescritos para hoy.
// ═══════════════════════════════════════════════════════════════════════════
export function prescripcionDeHoy(plan, fecha = new Date()) {
  if (!plan?.fecha_inicio) return null;
  const inicio = new Date(plan.fecha_inicio + 'T12:00');
  const f = typeof fecha === 'string' ? new Date(fecha + 'T12:00') : fecha;
  const semana = Math.floor((f - inicio) / (7 * 864e5)) + 1;

  if (semana < 1) return { semana, fueraDePlan: true, motivo: `El plan arranca el ${plan.fecha_inicio}.` };
  if (semana > plan.semanas) return { semana, fueraDePlan: true, motivo: `El plan terminó en la semana ${plan.semanas}. Corresponde reevaluar y replanificar.` };

  const regiones = (plan.fases_detalle || []).map(d => {
    const faseHoy = (d.fases || []).find(x => semana >= x.semanaDesde && semana <= x.semanaHasta);
    return faseHoy ? {
      region: d.region, fase: faseHoy.fase, label: faseHoy.label, color: faseHoy.color,
      badge: faseHoy.badge, semanaDeFase: semana - faseHoy.semanaDesde + 1, totalFase: faseHoy.semanas,
      dosis: faseHoy.dosis, ejercicios: faseHoy.ejercicios || [], criterios: faseHoy.criterios || [],
    } : null;
  }).filter(Boolean);

  return { semana, fueraDePlan: false, totalSemanas: plan.semanas, regiones };
}
