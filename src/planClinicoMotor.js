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
    // Rango de EVA tolerable DURANTE el ejercicio, estructurado.
    // Antes esto vivía solo dentro de `intencion`, en prosa: no se podía
    // mostrar en la sesión ni comparar contra el EVA registrado.
    eva: { max: 2, techo: 3, ventana24h: 0,
      regla: 'Hasta 2/10 durante el ejercicio. Por encima de 3/10 se baja la dosis o se cambia el ejercicio. A las 24 h debe volver al nivel previo.' },
  },
  carga_progresiva: {
    series: 3, reps: '8-15', carga: 'Progresiva · excéntrico lento (3-4 seg)',
    frecuencia: '3-4 veces/semana', descanso: '90 seg',
    intencion: 'Reintroducir carga y restaurar control motor.',
    eva: { max: 3, techo: 5, ventana24h: 1,
      regla: 'Hasta 3/10 durante el ejercicio es aceptable si baja en 24 h. Entre 4 y 5/10 se tolera solo si a las 24 h volvió al nivel previo. Por encima de 5/10 se interrumpe.' },
  },
  retorno_funcion: {
    series: 4, reps: '6-10', carga: 'Pesado-lento y específico del objetivo',
    frecuencia: '2-3 veces/semana', descanso: '120-150 seg',
    intencion: 'Capacidad funcional del gesto objetivo, sin compensaciones ni dolor residual.',
    eva: { max: 4, techo: 5, ventana24h: 1,
      regla: 'Hasta 4/10 durante el trabajo pesado-lento. No debe quedar dolor residual al día siguiente por encima del nivel previo.' },
  },
};

// Semáforo del EVA registrado contra el rango de la fase.
// Se usa durante la sesión: el profesional ve en el momento si el número que
// acaba de anotar está dentro de lo prescrito, no después al revisar la ficha.
export function evaluarEva(fase, valor) {
  const d = DOSIS_FASE[fase]; const v = valor == null || valor === '' ? null : parseInt(valor);
  if (!d || !d.eva || v == null || isNaN(v)) return null;
  const { max, techo } = d.eva;
  if (v <= max)   return { nivel: 'ok',      color: '#16A34A', texto: `Dentro del rango de la fase (≤${max}/10)` };
  if (v <= techo) return { nivel: 'limite',  color: '#D97706', texto: `Sobre el objetivo (${max}/10) pero bajo el techo (${techo}/10). Verificar a las 24 h.` };
  return { nivel: 'excedido', color: '#DC2626', texto: `Por encima del techo de la fase (${techo}/10). Bajar dosis o cambiar el ejercicio.` };
}

// Comparación EVA inicio vs fin dentro de una misma sesión.
export function deltaEva(fase, ini, fin) {
  const a = ini == null || ini === '' ? null : parseInt(ini);
  const b = fin == null || fin === '' ? null : parseInt(fin);
  if (a == null || b == null || isNaN(a) || isNaN(b)) return null;
  const d = b - a;
  if (d <= -2) return { d, color: '#16A34A', texto: `Bajó ${Math.abs(d)} puntos en la sesión` };
  if (d <= 0)  return { d, color: '#16A34A', texto: d === 0 ? 'Se mantuvo' : 'Bajó 1 punto' };
  if (d <= 2)  return { d, color: '#D97706', texto: `Subió ${d} punto${d>1?'s':''}: aceptable si vuelve en 24 h` };
  return { d, color: '#DC2626', texto: `Subió ${d} puntos: la dosis de hoy fue excesiva` };
}

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

// ═══════════════════════════════════════════════════════════════════════════
// 6) CONSTRUCTOR DE SESIÓN CLÍNICA
// Misma lógica que el del gym: toma lo ya decidido (el plan por horizonte y
// la fase que corresponde a la fecha) y arma la sesión con dosis concretas.
//
// La diferencia con el gym es la unidad de trabajo: en fase de protección la
// isometría se prescribe en SEGUNDOS, no en repeticiones. El generador elige
// la unidad según la dosis de la fase en lugar de forzar reps a todo.
// ═══════════════════════════════════════════════════════════════════════════
// Clasificación del ítem del catálogo. Sin esto, la dosis de la fase se
// aplicaba a TODO: "Crioterapia post-actividad → 3×30-45 seg · isométrica
// submáxima al 40-70% MVC" es un sinsentido clínico, y un estiramiento no se
// prescribe con RIR ni con carga progresiva.
export function tipoItemRehab(nombre) {
  const n = (nombre || '').toLowerCase();
  // Los acrónimos y palabras cortas van anclados: sin \b, "tens" matcheaba
  // dentro de "ex-tens-ores" y un excéntrico de muñeca se clasificaba como
  // modalidad pasiva.
  if (/crioterapia|termoterapia|\btens\b|\bcalor\b|\bfrio\b|\bfr[ií]o\b|ultrasonido|vendaje|kinesiotap|masaje|liberaci[oó]n miofascial|punci[oó]n|educaci[oó]n|higiene postural|reposo relativo|reposo absoluto|\brice\b|control de carga|inmovilizaci[oó]n|ortesis|dec[uú]bito|almohada/.test(n))
    return 'modalidad';
  // "movilización" no entraba por buscar solo "movilidad": una movilización
  // rotuliana suave salía prescrita como isométrico al 40-70% MVC. Lo mismo la
  // respiración diafragmática y el alfabeto con el pie.
  if (/estiramiento|elongaci[oó]n|movilidad|moviliza|deslizamiento neural|neurodin|p[eé]ndulo|respiraci[oó]n|alfabeto/.test(n))
    return 'movilidad';
  return 'ejercicio';
}

// Dosis propia de lo que no es ejercicio de fuerza.
const DOSIS_NO_EJERCICIO = {
  modalidad:  { series: '', reps: '', tiempo: '10-15 min', carga: 'Sin carga', descanso: '' },
  movilidad:  { series: '2-3', reps: '', tiempo: '30-45 seg', carga: 'Sin carga · hasta tensión, sin dolor', descanso: '20 seg' },
};

export function generarSesionClinica({
  plan, fecha = new Date().toISOString().slice(0, 10),
  protSesion = {}, custom = [], regionesSel = null,
  genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
}) {
  const avisos = [];
  const pres = prescripcionDeHoy(plan, fecha);
  if (!pres) return { ejercicios: [], criterios: [], avisos: ['El paciente no tiene plan clínico activo. Armá el plan por horizonte primero.'], pres: null };
  if (pres.fueraDePlan) return { ejercicios: [], criterios: [], avisos: [pres.motivo], pres };

  const regiones = (pres.regiones || []).filter(r => !regionesSel || !regionesSel.length || regionesSel.includes(r.region));
  if (!regiones.length) avisos.push('Ninguna región del plan cae en esta semana.');

  const ejercicios = [], criterios = [];
  regiones.forEach(r => {
    // Dosis del TERCIO de la fase, no la plana. Sin esto todas las sesiones de
    // una misma fase salían idénticas: ocho veces 3×8-15 entre la semana 6 y
    // la 13 no es progresión, es el mismo estímulo repetido.
    const dTercio = dosisDeFase(r.fase, r.semanaDeFase, r.totalFase);
    const d = { ...(r.dosis || {}), ...dTercio };
    // ¿La fase se prescribe por tiempo o por repeticiones?
    const porTiempo = /seg|min/i.test(String(d.reps || ''));
    const lista = r.ejercicios && r.ejercicios.length
      ? r.ejercicios
      : prescribirEjercicios({ region: r.region, fase: r.fase, protSesion, custom }).ejercicios;

    if (!lista.length) avisos.push(`Sin ejercicios de catálogo para ${r.region} en fase ${r.label}. Cargalos en Rehab o agregalos a mano.`);

    lista.forEach(e => {
      const tipo = tipoItemRehab(e.nombre);
      const alt = DOSIS_NO_EJERCICIO[tipo];
      ejercicios.push({
        id: genId('ej'),
        nombre: e.nombre,
        region: r.region,
        fase: r.fase,
        faseLabel: r.label,
        tipo,
        series: alt ? alt.series : String(d.series ?? 3),
        reps:   alt ? alt.reps   : (porTiempo ? '' : String(d.reps ?? '10-12')),
        tiempo: alt ? alt.tiempo : (porTiempo ? String(d.reps ?? '30-45 seg') : ''),
        carga:  alt ? alt.carga  : (d.carga || ''),
        descanso: alt ? alt.descanso : (d.descanso || ''),
        notas: '',
        activo: true,
        editado: false,
        origen: e.origen || 'catálogo',
      });
    });

    (r.criterios || []).forEach(c => {
      if (!criterios.some(x => x.texto === c)) criterios.push({ id: genId('cr'), texto: c, cumplido: false, region: r.region });
    });
  });

  return {
    ejercicios, criterios, avisos, pres,
    resumen: regiones.map(r => {
      const dt = dosisDeFase(r.fase, r.semanaDeFase, r.totalFase);
      return `${r.region}: ${r.label} · ${dt.tercioLabel} (sem ${r.semanaDeFase}/${r.totalFase}) · ${dt.series}×${dt.reps}`;
    }).join(' · '),
    semana: pres.semana, totalSemanas: pres.totalSemanas,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) SESIONES PREDISEÑADAS DE TODO EL PLAN
//
// Hasta ahora la sesión se armaba el día que tocaba: el profesional abría el
// formulario y apretaba "armar desde el plan". Eso sirve para improvisar, no
// para planificar: no se podía ver el plan completo de antemano, ni ajustar la
// sesión 7 estando en la 3, ni saber cuántas sesiones quedaban.
//
// Acá se genera la grilla entera. Cada sesión queda con su semana, su fase,
// sus ejercicios con dosis y EL RANGO DE EVA DE SU FASE PEGADO, de modo que al
// abrirla durante el tratamiento el rango esté visible sin tener que
// recordarlo ni ir a buscarlo.
//
// Todo es editable después: `editado: true` marca lo que tocó el profesional
// para que un regenerado no le pise el criterio clínico.
// ═══════════════════════════════════════════════════════════════════════════
// Frecuencia de CONSULTAS por fase, por defecto.
//
// Ojo con la distinción, que antes estaba colapsada en un solo número:
//   · la `frecuencia` de DOSIS_TERCIO es el PROGRAMA DOMICILIARIO — lo que el
//     paciente hace solo en casa ("diario", "3-4 veces/semana");
//   · esto de acá es cuántas veces lo ves VOS en la clínica.
// En protección el paciente hace isometría a diario pero no viene a diario:
// viene más seguido que en retorno a la función, porque hay que vigilar la
// respuesta del tejido y ajustar. Al final del proceso se espacia.
export const CONSULTAS_FASE = { proteccion: 2, carga_progresiva: 2, retorno_funcion: 1 };

export function generarSesionesPlan({
  plan, protSesion = {}, custom = [], sesionesPorSemana = null,
  consultasPorFase = null,
  genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
}) {
  const avisos = [];
  if (!plan?.fecha_inicio) return { sesiones: [], avisos: ['El plan no tiene fecha de inicio.'] };
  const semanas = parseInt(plan.semanas) || 0;
  if (!semanas) return { sesiones: [], avisos: ['El plan no tiene cantidad de semanas definida.'] };

  // Consultas por semana, POR FASE. Repartir parejo contradecía la
  // prescripción en los extremos: dejaba la misma frecuencia de control en
  // protección (donde hay que vigilar la respuesta del tejido semana a semana)
  // que en retorno a la función (donde el paciente ya trabaja solo).
  const frec = { ...CONSULTAS_FASE, ...(plan.consultas_por_fase || {}), ...(consultasPorFase || {}) };
  // sesionesPorSemana fuerza un valor único para todas las fases: se respeta
  // porque a veces lo impone la agenda o el convenio, no la clínica.
  if (sesionesPorSemana) Object.keys(frec).forEach(k => { frec[k] = sesionesPorSemana; });

  // Tope por sesiones contratadas. Sin esto el generador producía una sesión
  // por semana durante TODO el horizonte: 18 sesiones para 16 contratadas, o
  // peor, un plan de 40 semanas con 20 sesiones pagas. El plan clínico puede
  // durar más que las sesiones compradas —eso es normal— pero hay que decirlo
  // en vez de prediseñar trabajo que nadie pagó.
  const tope = parseInt(plan.sesiones_presupuestadas) || 0;

  const sesiones = [];
  let n = 0;
  for (let sem = 1; sem <= semanas; sem++) {
    // La fecha del lunes de esa semana, para que prescripcionDeHoy resuelva
    // la fase de cada región igual que lo hace en la sesión real.
    const f = new Date(new Date(plan.fecha_inicio + 'T12:00').getTime() + (sem - 1) * 7 * 864e5);
    const fechaSem = f.toISOString().slice(0, 10);
    const base = generarSesionClinica({ plan, fecha: fechaSem, protSesion, custom, genId });
    if (!base.pres || base.pres.fueraDePlan) continue;

    // Fase dominante de esta semana, para saber cuántas consultas van.
    const fasesSem = (base.pres.regiones || []).map(r => r.fase);
    const ordenF = ['proteccion', 'carga_progresiva', 'retorno_funcion'];
    const faseSemana = ordenF.find(x => fasesSem.includes(x)) || fasesSem[0] || 'carga_progresiva';
    const porSemana = Math.max(1, parseInt(frec[faseSemana]) || 2);

    for (let k = 1; k <= porSemana; k++) {
      if (tope && n >= tope) break;
      n++;
      // Fase dominante de la sesión: si hay varias regiones, la más conservadora
      // manda sobre el rango de EVA. Mezclar una región en protección con otra
      // en retorno a la función y usar el techo de la segunda sería prescribir
      // dolor sobre un tejido que todavía no lo tolera.
      const fases = (base.pres.regiones || []).map(r => r.fase);
      const orden = ['proteccion', 'carga_progresiva', 'retorno_funcion'];
      const faseDom = orden.find(x => fases.includes(x)) || fases[0] || 'carga_progresiva';
      const evaFase = (DOSIS_FASE[faseDom] || {}).eva || null;

      sesiones.push({
        n,
        semana: sem,
        sesionDeLaSemana: k,
        fase: faseDom,
        faseLabel: (base.pres.regiones || []).find(r => r.fase === faseDom)?.label || faseDom,
        tercio: (()=>{ const rr=(base.pres.regiones||[]).find(r=>r.fase===faseDom);
          return rr ? tercioDeFase(rr.semanaDeFase, rr.totalFase) : null; })(),
        regiones: (base.pres.regiones || []).map(r => ({ region: r.region, fase: r.fase, label: r.label,
          semanaDeFase: r.semanaDeFase, totalFase: r.totalFase,
          tercio: tercioDeFase(r.semanaDeFase, r.totalFase) })),
        // El rango de EVA viaja DENTRO de la sesión: al abrirla, el techo de la
        // fase está ahí sin depender de que nadie lo recuerde.
        eva: evaFase ? { max: evaFase.max, techo: evaFase.techo, regla: evaFase.regla } : null,
        // El programa domiciliario es la `frecuencia` de la dosis del tercio:
        // qué tiene que hacer el paciente entre esta consulta y la siguiente.
        domiciliario: (() => {
          const rr = (base.pres.regiones || []).find(r => r.fase === faseDom);
          return rr ? (dosisDeFase(rr.fase, rr.semanaDeFase, rr.totalFase).frecuencia || '') : '';
        })(),
        consultasSemana: porSemana,
        ejercicios: (base.ejercicios || []).map(e => ({ ...e, id: genId('ej'), activo: true, editado: false })),
        criterios: (base.criterios || []).map(c => ({ ...c, id: genId('cr') })),
        objetivo: (base.pres.regiones || []).map(r => r.objetivo).filter(Boolean).join(' · '),
        notas: '',
        editado: false,
        estado: 'pendiente',   // pendiente | hecha | salteada
      });
    }
  }

  if (!sesiones.length) avisos.push('No se generó ninguna sesión: revisá fecha de inicio, semanas y regiones del plan.');
  const ultSem = sesiones.length ? sesiones[sesiones.length - 1].semana : 0;
  if (tope && ultSem < semanas) {
    avisos.push(`Las ${tope} sesiones contratadas alcanzan hasta la semana ${ultSem} de ${semanas}. ` +
      `Desde la semana ${ultSem + 1} el plan sigue pero sin sesiones asignadas: hay que contratar más o pasar a trabajo autónomo supervisado.`);
  }
  // Cuántas consultas pide el plan según la frecuencia por fase, contra las
  // contratadas: es la conversación comercial antes de empezar, no después.
  let necesarias = 0;
  (plan.fases_detalle || []).forEach(d => (d.fases || []).forEach(f => {
    necesarias += (parseInt(f.semanas) || 0) * (parseInt(frec[f.fase]) || 2);
  }));
  const regs = (plan.fases_detalle || []).length || 1;
  necesarias = Math.round(necesarias / regs);
  if (tope && necesarias > tope) {
    avisos.push(`La frecuencia por fase pide ${necesarias} consultas y hay ${tope} contratadas. ` +
      `Faltan ${necesarias - tope}: o se contratan, o se baja la frecuencia en alguna fase.`);
  }
  return { sesiones, avisos, frecuencia: frec, consultasNecesarias: necesarias,
    total: sesiones.length, cubreHastaSemana: ultSem, semanasPlan: semanas };
}

// Cuál es la sesión que toca: la primera pendiente. Devuelve también el avance,
// para que el profesional vea en qué punto del plan está sin contar a mano.
export function sesionQueToca(sesionesPlan = [], realizadas = []) {
  const hechas = new Set((realizadas || []).map(s => s.sesion_plan_n).filter(x => x != null));
  const lista = (sesionesPlan || []).map(s => ({ ...s, estado: hechas.has(s.n) ? 'hecha' : s.estado }));
  const toca = lista.find(s => s.estado === 'pendiente') || null;
  return {
    toca, lista,
    hechas: lista.filter(s => s.estado === 'hecha').length,
    total: lista.length,
    pendientes: lista.filter(s => s.estado === 'pendiente').length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8) PROGRESIÓN DENTRO DE LA FASE — DOSIS POR TERCIO
//
// DOSIS_FASE tiene UNA dosis por fase, y eso generaba ocho sesiones idénticas
// de "sentadilla parcial 3×8-15" entre las semanas 6 y 13. Un tendón que
// tolera esa dosis en la semana 6 necesita más en la 13 o deja de adaptarse.
//
// Cada fase se parte en tercios: inicio, medio y final. El tercio sale de la
// posición de la sesión DENTRO de su fase, no del plan completo, así que una
// fase de 2 semanas y otra de 8 progresan las dos.
//
// Estos nueve valores son una propuesta de referencia, no un dogma. Están para
// editarse: un tendón rotuliano y un manguito rotador no progresan igual.
// ═══════════════════════════════════════════════════════════════════════════
export const DOSIS_TERCIO = {
  proteccion: {
    inicio: { series: 3, reps: '20-30 seg', carga: 'Isométrica 40-50% MVC',
      descanso: '60 seg', frecuencia: 'Diario o 2 veces/día',
      intencion: 'Entrar sin provocar. Buscar la contracción tolerada, no la máxima.' },
    medio:  { series: 3, reps: '30-45 seg', carga: 'Isométrica 50-60% MVC',
      descanso: '60 seg', frecuencia: 'Diario',
      intencion: 'Sostener más tiempo con la misma indolencia. Ya debería haber analgesia post-isométrica.' },
    final:  { series: 4, reps: '45-60 seg', carga: 'Isométrica 60-70% MVC',
      descanso: '45-60 seg', frecuencia: 'Diario',
      intencion: 'Máxima isometría tolerada. Preparar el tejido para aceptar movimiento con carga.' },
  },
  carga_progresiva: {
    inicio: { series: 3, reps: '12-15', carga: 'Carga baja · excéntrico lento 4 seg · RIR 4-5',
      descanso: '90 seg', frecuencia: '3-4 veces/semana',
      intencion: 'Reintroducir el movimiento completo con poca carga y mucho control del descenso.' },
    medio:  { series: 3, reps: '8-12', carga: 'Carga media · excéntrico 3 seg · RIR 3',
      descanso: '90 seg', frecuencia: '3-4 veces/semana',
      intencion: 'Subir carga manteniendo el control. Acá es donde el tejido gana capacidad.' },
    final:  { series: 4, reps: '6-10', carga: 'Carga alta · tempo controlado · RIR 2',
      descanso: '120 seg', frecuencia: '3 veces/semana',
      intencion: 'Carga cercana a la del gesto objetivo, todavía en ambiente controlado.' },
  },
  retorno_funcion: {
    inicio: { series: 4, reps: '6-8', carga: 'Pesado-lento · RIR 3',
      descanso: '120 seg', frecuencia: '2-3 veces/semana',
      intencion: 'Fuerza máxima en rango completo, sin componente de velocidad todavía.' },
    medio:  { series: 4, reps: '5-6', carga: 'Pesado-lento · RIR 2 · introducir velocidad',
      descanso: '150 seg', frecuencia: '2-3 veces/semana',
      intencion: 'Sumar intención de velocidad al trabajo pesado. Primer contacto con lo reactivo.' },
    final:  { series: 4, reps: '3-6', carga: 'Específico del gesto · pliométrico si corresponde',
      descanso: '150-180 seg', frecuencia: '2 veces/semana',
      intencion: 'Replicar la demanda real del deporte o la tarea. Criterio de alta, no de progreso.' },
  },
};

// Qué tercio de la fase es esta sesión. Con fases cortas se reparte igual:
// una fase de 2 semanas da inicio y final, no tres tercios imposibles.
export function tercioDeFase(semanaDeFase, totalFase) {
  const sem = parseInt(semanaDeFase) || 1;
  const tot = parseInt(totalFase) || 1;
  if (tot <= 1) return 'medio';
  if (tot === 2) return sem === 1 ? 'inicio' : 'final';
  const p = (sem - 1) / tot;
  return p < 1 / 3 ? 'inicio' : p < 2 / 3 ? 'medio' : 'final';
}

export const TERCIO_LABEL = { inicio: 'Inicio de fase', medio: 'Medio de fase', final: 'Final de fase' };

// Dosis efectiva: la del tercio si existe, con respaldo a la dosis plana de la
// fase para no romper nada que ya la consumiera.
export function dosisDeFase(fase, semanaDeFase, totalFase) {
  const t = tercioDeFase(semanaDeFase, totalFase);
  const d = (DOSIS_TERCIO[fase] || {})[t];
  if (!d) return { ...(DOSIS_FASE[fase] || {}), tercio: t, tercioLabel: TERCIO_LABEL[t] };
  return { ...d, eva: (DOSIS_FASE[fase] || {}).eva || null, tercio: t, tercioLabel: TERCIO_LABEL[t] };
}
