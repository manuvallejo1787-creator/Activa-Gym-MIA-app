// planificacion.js — Sistemas de periodización + Tests de fuerza máxima
// Fuente única de verdad para toda la planificación a largo plazo

// ─── TESTS DE FUERZA MÁXIMA ──────────────────────────────────────────────
// Se aplican cada 4 meses. Estiman 1RM con fórmula de Brzycki o Epley.
export const TESTS_FUERZA = [
  {
    id: 'squat',
    nombre: 'Sentadilla trasera',
    patron: 'Empuje bilateral piernas',
    protocolo: 'Calentar con 40%, 60%, 80% del 1RM estimado × 3 reps cada uno. Luego intentos máximos con 3-5 min de descanso. Máximo 3 intentos al peso máximo.',
    referencia: { masculino: 1.5, femenino: 1.0 },
    unidad: '× peso corporal',
    nivel: { debil: 0.8, promedio: 1.2, bueno: 1.5, elite: 2.0 },
  },
  {
    id: 'deadlift',
    nombre: 'Peso muerto convencional',
    patron: 'Bisagra bilateral',
    protocolo: 'Mismo protocolo de calentamiento progresivo. Evaluar técnica antes de cargas máximas. Usar cinturón solo en intentos máximos si el cliente lo usa habitualmente.',
    referencia: { masculino: 1.75, femenino: 1.25 },
    unidad: '× peso corporal',
    nivel: { debil: 1.0, promedio: 1.5, bueno: 1.75, elite: 2.5 },
  },
  {
    id: 'bench',
    nombre: 'Press pecho en banco plano',
    patron: 'Empuje horizontal',
    protocolo: 'Calentamiento: 50%, 70%, 85% × 3. Luego máximos con 3-5 min descanso. Escápulas retraídas y deprimidas. Evaluador como spotter obligatorio.',
    referencia: { masculino: 1.0, femenino: 0.7 },
    unidad: '× peso corporal',
    nivel: { debil: 0.5, promedio: 0.8, bueno: 1.0, elite: 1.5 },
  },
  {
    id: 'press_mil',
    nombre: 'Press militar con barra',
    patron: 'Empuje vertical',
    protocolo: 'De pie, sin impulso de piernas. Calentamiento progresivo 50-70-85%. Core activado durante todo el movimiento.',
    referencia: { masculino: 0.7, femenino: 0.45 },
    unidad: '× peso corporal',
    nivel: { debil: 0.35, promedio: 0.55, bueno: 0.7, elite: 1.0 },
  },
  {
    id: 'hip_thrust',
    nombre: 'Hip thrust con barra',
    patron: 'Empuje de cadera',
    protocolo: 'Banco estable. Calentamiento progresivo. Pausa de 1 seg arriba en el máximo. Evaluar extensión completa y neutro lumbar.',
    referencia: { masculino: 1.5, femenino: 1.5 },
    unidad: '× peso corporal',
    nivel: { debil: 0.8, promedio: 1.2, bueno: 1.5, elite: 2.2 },
  },
  {
    id: 'pull_ups',
    nombre: 'Dominadas sin peso / lastradas',
    patron: 'Tirón vertical',
    protocolo: 'BASE sin peso: registrar máx. repeticiones con peso corporal (agarre prono, rango completo). Si el cliente completa >8 reps con buena técnica, agregar lastre progresivo para estimar 1RM. Si no llega a 1 rep, registrar asistencia negativa (excéntrico) como referencia.',
    referencia: { masculino: 0.3, femenino: 0.1 },
    unidad: 'lastre adicional × peso corporal',
    nivel: { debil: 0, promedio: 0.2, bueno: 0.5, elite: 0.8 },
    nota_sin_peso: true,
  },
  {
    id: 'remo_apoyo',
    nombre: 'Remo con apoyo en pecho (remo a caballo)',
    patron: 'Tirón horizontal',
    protocolo: 'Pecho apoyado en banco inclinado (o seal row en banco alto). El apoyo es lo que hace válido el test: elimina el impulso de tronco y saca la espalda baja como limitante. NO testear a 1 rep: usar 4-6 reps máximas limpias, rango completo, sin despegar el pecho del banco, y estimar el 1RM con la fórmula. Si en la ejecución hay body english o se levanta el pecho, el dato no sirve para comparar.',
    referencia: { masculino: 1.0, femenino: 0.65 },
    unidad: '× peso corporal',
    nivel: { debil: 0.5, promedio: 0.75, bueno: 1.0, elite: 1.3 },
    referencial: true,
  },
];

// ─── FÓRMULAS DE ESTIMACIÓN DE 1RM ──────────────────────────────────────────
// epley_brzycki: promedio Epley+Brzycki — estándar para cargas altas, ≤12 reps
// lombardi: 1RM = peso × reps^0.10 — confiable hasta ~25 reps, ideal para
//   principiantes y adultos mayores (cargas livianas, muchas repeticiones, sin
//   llegar al fallo máximo → menor riesgo de lesión)
export const FORMULAS_1RM = {
  brzycki: {
    label: 'Brzycki',
    sub: 'Más conservadora · ideal principiantes, hasta 10–12 reps',
    maxReps: 12,
    recomendado: 'Principiantes y reacondicionamiento: estima algo más bajo, margen de seguridad mayor',
  },
  epley: {
    label: 'Epley',
    sub: 'Algo más alta · intermedios/avanzados, hasta 12 reps',
    maxReps: 12,
    recomendado: 'Clientes con experiencia y buena técnica con cargas pesadas',
  },
  epley_brzycki: {
    label: 'Epley + Brzycki (promedio)',
    sub: 'Promedio de ambas · uso general, hasta 12 reps',
    maxReps: 12,
    recomendado: 'Opción intermedia equilibrada cuando no querés decidir entre una u otra',
  },
  lombardi: {
    label: 'Lombardi',
    sub: 'Cargas livianas, hasta 25 reps · principiantes / adultos mayores',
    maxReps: 25,
    recomendado: 'Principiantes, adultos mayores, evaluación segura sin cargas máximas',
  },
};

export const calcular1RM = (peso, reps, formula = 'epley_brzycki') => {
  if (!peso || !reps || reps < 1) return null;
  if (reps === 1) return Math.round(peso);

  if (formula === 'lombardi') {
    if (reps > 25) return null; // fuera de rango confiable
    return Math.round(peso * Math.pow(reps, 0.10));
  }

  if (reps > 12) return null; // poco confiable con muchas reps para estas fórmulas
  const brzycki = peso * (36 / (37 - reps));
  const epley   = peso * (1 + 0.0333 * reps);

  if (formula === 'brzycki') return Math.round(brzycki);
  if (formula === 'epley')   return Math.round(epley);
  // epley_brzycki (promedio) — también respalda registros antiguos
  return Math.round((brzycki + epley) / 2);
};

export const nivelFuerza = (test, rm1, pesoCorporal) => {
  if (!test || !rm1 || !pesoCorporal) return null;
  const n = test.nivel;
  if (!n) return null;
  // For pull-ups: ratio = additional weight / bodyweight
  // A person completing reps with bodyweight (0 lastre) is Principiante minimum
  if (test.id === 'pull_ups') {
    const lastre = rm1 - pesoCorporal; // rm1 includes bodyweight for pull-ups
    const ratio = Math.max(lastre / pesoCorporal, 0);
    if (ratio >= n.elite)    return { label: 'Elite',       color: '#7C3AED' };
    if (ratio >= n.bueno)    return { label: 'Avanzado',    color: '#16A34A' };
    if (ratio >= n.promedio) return { label: 'Intermedio',  color: '#D97706' };
    return { label: 'Principiante', color: '#CC0000' }; // any completed rep = Principiante
  }
  const ratio = rm1 / pesoCorporal;
  if (ratio >= n.elite)   return { label: 'Elite',    color: '#7C3AED' };
  if (ratio >= n.bueno)   return { label: 'Avanzado', color: '#16A34A' };
  if (ratio >= n.promedio)return { label: 'Intermedio',color: '#D97706' };
  if (ratio >= n.debil)   return { label: 'Principiante',color: '#CC0000' };
  return { label: 'Por debajo del promedio', color: '#DC2626' };
};

// ─── SISTEMAS DE PERIODIZACIÓN ───────────────────────────────────────────
export const PERIODIZACIONES = {

  lineal: {
    id: 'lineal',
    nombre: 'Periodización Lineal Clásica',
    autor: 'Tudor Bompa',
    descripcion: 'Incremento progresivo de la intensidad y reducción del volumen a lo largo del tiempo. Ideal para principiantes e intermedios que buscan fuerza o hipertrofia básica.',
    duracion: '12–16 semanas',
    fases: [
      { nombre: 'Adaptación anatómica', semanas: '1–4', volumen: 'Alto', intensidad: 'Baja', reps: '15–20', rir: '4–5', objetivo: 'Preparar articulaciones y tendones. Aprender patrones de movimiento.' },
      { nombre: 'Hipertrofia', semanas: '5–9', volumen: 'Alto', intensidad: 'Moderada', reps: '8–12', rir: '2–3', objetivo: 'Máxima ganancia de masa muscular.' },
      { nombre: 'Fuerza', semanas: '10–13', volumen: 'Moderado', intensidad: 'Alta', reps: '4–6', rir: '1–2', objetivo: 'Convertir la hipertrofia en fuerza funcional.' },
      { nombre: 'Pico / Test', semanas: '14–16', volumen: 'Bajo', intensidad: 'Máxima', reps: '1–3', rir: '0–1', objetivo: 'Expresar la fuerza máxima. TEST DE 1RM.' },
    ],
    compatible_fases: ['activa', 'potencia', 'rinde'],
    indicado_para: 'Principiantes e intermedios. Primer ciclo de fuerza. Post-rehabilitación.',
    no_indicado: 'Atletas avanzados que necesitan variabilidad.',
  },

  dup: {
    id: 'dup',
    nombre: 'Periodización Ondulante Diaria (DUP)',
    autor: 'Rhea, Ball, Phillips — 2002',
    descripcion: 'Varía volumen e intensidad entre sesiones dentro de la misma semana. Produce mayores ganancias que la lineal clásica por mayor frecuencia de estímulos distintos.',
    duracion: '8–16 semanas (cíclico)',
    fases: [
      { nombre: 'Día de fuerza', semanas: 'Lunes', volumen: 'Bajo', intensidad: 'Alta', reps: '3–5', rir: '1', objetivo: 'Desarrollar fuerza máxima y densidad neural.' },
      { nombre: 'Día de hipertrofia', semanas: 'Miércoles', volumen: 'Moderado', intensidad: 'Moderada', reps: '8–10', rir: '2', objetivo: 'Máxima tensión mecánica y estrés metabólico.' },
      { nombre: 'Día de resistencia/volumen', semanas: 'Viernes', volumen: 'Alto', intensidad: 'Baja', reps: '12–15', rir: '3', objetivo: 'Volumen acumulado. Capacidad aeróbica muscular.' },
    ],
    compatible_fases: ['activa', 'potencia', 'rinde'],
    indicado_para: 'Intermedios y avanzados. Quienes entrenan 3–5 veces por semana.',
    no_indicado: 'Principiantes — demasiada variabilidad sin base técnica.',
  },

  bloque: {
    id: 'bloque',
    nombre: 'Periodización por Bloques (Verkhoshansky / Issurin)',
    autor: 'Yuri Verkhoshansky, Vladimir Issurin',
    descripcion: 'Concentra capacidades específicas en bloques secuenciales: Acumulación → Transmutación → Realización. Cada bloque tiene un objetivo único y prepara al siguiente.',
    duracion: '12–24 semanas',
    fases: [
      { nombre: 'Acumulación (ACC)', semanas: '4–6 sem', volumen: 'Muy alto', intensidad: 'Baja-moderada', reps: '8–15', rir: '3–4', objetivo: 'Construcción de base: volumen muscular, capacidad aeróbica, técnica.' },
      { nombre: 'Transmutación (TRN)', semanas: '3–4 sem', volumen: 'Moderado', intensidad: 'Alta', reps: '4–8', rir: '1–2', objetivo: 'Convertir el volumen en fuerza específica. Ejercicios más complejos.' },
      { nombre: 'Realización (REA)', semanas: '2–3 sem', volumen: 'Bajo', intensidad: 'Muy alta', reps: '1–4', rir: '0–1', objetivo: 'Expresión máxima. Competición o TEST DE 1RM.' },
      { nombre: 'Recuperación / Deload', semanas: '1 sem', volumen: 'Muy bajo', intensidad: 'Baja', reps: '10–15', rir: '4–5', objetivo: 'Recuperación supercompensada. Preparar el siguiente ciclo.' },
    ],
    compatible_fases: ['potencia', 'rinde'],
    indicado_para: 'Atletas intermedios-avanzados. Deportistas con objetivos de rendimiento.',
    no_indicado: 'Principiantes. Personas en fase RESTAURA o ACTIVA.',
  },

  atr: {
    id: 'atr',
    nombre: 'Sistema ATR (Acumulación–Transformación–Realización)',
    autor: 'Viru & Issurin',
    descripcion: 'Variante del bloque pensada para deportes de equipo y contextos de fitness de alto rendimiento. Ciclos más cortos (2–4 semanas) con mayor frecuencia de test y adaptación.',
    duracion: '6–12 semanas (ciclos repetidos)',
    fases: [
      { nombre: 'Acumulación', semanas: '2–3 sem', volumen: 'Alto', intensidad: 'Moderada', reps: '10–15', rir: '3', objetivo: 'Volumen de base. Trabajo aeróbico. Hipertrofia general.' },
      { nombre: 'Transformación', semanas: '2–3 sem', volumen: 'Moderado', intensidad: 'Alta', reps: '5–8', rir: '1–2', objetivo: 'Fuerza específica. Potencia. Transferencia funcional.' },
      { nombre: 'Realización', semanas: '1–2 sem', volumen: 'Bajo', intensidad: 'Máxima', reps: '1–4', rir: '0', objetivo: 'Rendimiento pico. Test o competición.' },
    ],
    compatible_fases: ['potencia', 'rinde'],
    indicado_para: 'Deportistas. Clientes con objetivos de rendimiento deportivo específico.',
    no_indicado: 'Sin base de fuerza previa.',
  },

  conjugado: {
    id: 'conjugado',
    nombre: 'Método Conjugado (Westside Barbell)',
    autor: 'Louie Simmons',
    descripcion: 'Desarrolla simultáneamente velocidad, fuerza máxima e hipertrofia mediante la alternancia de días de esfuerzo máximo y esfuerzo dinámico. Alta densidad de entrenamiento.',
    duracion: 'Continuo (sin fases definidas)',
    fases: [
      { nombre: 'Día de Esfuerzo Máximo (ME)', semanas: '2×/semana', volumen: 'Bajo', intensidad: 'Máxima (95–100%)', reps: '1–3', rir: '0', objetivo: 'Fuerza máxima absoluta. Rotación del ejercicio principal cada semana.' },
      { nombre: 'Día de Esfuerzo Dinámico (DE)', semanas: '2×/semana', volumen: 'Moderado', intensidad: 'Baja (50–70%) + VELOCIDAD', reps: '2–3 × 8–12 series', rir: 'N/A', objetivo: 'Desarrollo de potencia y velocidad de barra. Máxima aceleración.' },
      { nombre: 'Trabajo accesorio', semanas: 'Todos los días', volumen: 'Alto', intensidad: 'Moderada', reps: '8–15', rir: '2–3', objetivo: 'Corregir debilidades. Hipertrofia complementaria. Prevención de lesiones.' },
    ],
    compatible_fases: ['rinde'],
    indicado_para: 'Levantadores avanzados. Deportistas de fuerza.',
    no_indicado: 'Principiantes e intermedios. Requiere dominio técnico alto.',
  },

  hst: {
    id: 'hst',
    nombre: 'HST — Hypertrophy Specific Training',
    autor: 'Bryan Haycock',
    descripcion: 'Basado en los mecanismos mecánicos de la hipertrofia: frecuencia alta, progresión de carga, y descarga estratégica cada 8 semanas. Ideal para hipertrofia pura.',
    duracion: '8 semanas + 2 semanas deload estratégico',
    fases: [
      { nombre: 'Fase 15 reps', semanas: '2 sem', volumen: 'Alto', intensidad: 'Baja', reps: '15', rir: '3–4', objetivo: 'Preparar tendones. Alta frecuencia (3×/sem). Estimulo metabólico.' },
      { nombre: 'Fase 10 reps', semanas: '2 sem', volumen: 'Moderado-alto', intensidad: 'Moderada', reps: '10', rir: '2', objetivo: 'Tensión mecánica + estrés metabólico. Máxima hipertrofia.' },
      { nombre: 'Fase 5 reps', semanas: '2 sem', volumen: 'Moderado', intensidad: 'Alta', reps: '5', rir: '1', objetivo: 'Fuerza + hipertrofia miofibrilar.' },
      { nombre: 'Negativas / Strategik Deconditioning', semanas: '2 sem', volumen: 'Variable', intensidad: 'Variable', reps: '3–5 negativas', rir: '0', objetivo: 'Maximizar tensión excéntrica o deload completo para resensibilizar.' },
    ],
    compatible_fases: ['activa', 'potencia'],
    indicado_para: 'Objetivo principal de hipertrofia. Intermedios.',
    no_indicado: 'Rendimiento deportivo como objetivo primario.',
  },

  triphasic: {
    id: 'triphasic',
    nombre: 'Entrenamiento Trifásico',
    autor: 'Cal Dietz',
    descripcion: 'Entrena cada fase de la contracción muscular de forma aislada: excéntrica, isométrica y concéntrica. Mejora la transmisión de fuerza y reduce lesiones.',
    duracion: '9–12 semanas',
    fases: [
      { nombre: 'Fase Excéntrica', semanas: '3–4 sem', volumen: 'Moderado', intensidad: 'Alta', reps: '3–5 (tempo 6-2-1)', rir: '1', objetivo: 'Desarrollar fuerza excéntrica. Protección de tejidos. Stiffness muscular.' },
      { nombre: 'Fase Isométrica', semanas: '3–4 sem', volumen: 'Moderado', intensidad: 'Alta', reps: '3–5 (pausa 3–6 seg)', rir: '1', objetivo: 'Fuerza en el ángulo específico. Activación neuromuscular máxima.' },
      { nombre: 'Fase Concéntrica', semanas: '3–4 sem', volumen: 'Moderado-bajo', intensidad: 'Alta-máxima', reps: '2–5 (explosivo)', rir: '0–1', objetivo: 'Expresión de potencia y velocidad. Transfer deportivo.' },
    ],
    compatible_fases: ['potencia', 'rinde'],
    indicado_para: 'Deportistas de potencia. Prevención y retorno deportivo avanzado.',
    no_indicado: 'Sin base técnica sólida en los ejercicios principales.',
  },

  fitness_general: {
    id: 'fitness_general',
    nombre: 'Planificación de Fitness General (Ondulante Semanal)',
    autor: 'Adaptación ACTIVA Integra',
    descripcion: 'Diseñada para clientes con objetivo de salud, composición corporal y fitness general. Ondulación semanal entre estímulos de fuerza, hipertrofia y capacidad metabólica.',
    duracion: '12 semanas (renovable)',
    fases: [
      { nombre: 'Semana de fuerza base', semanas: 'Semanas 1, 4, 7, 10', volumen: 'Moderado', intensidad: 'Alta', reps: '5–6', rir: '2', objetivo: 'Mantener y desarrollar fuerza funcional.' },
      { nombre: 'Semana de hipertrofia', semanas: 'Semanas 2, 5, 8, 11', volumen: 'Alto', intensidad: 'Moderada', reps: '10–12', rir: '2', objetivo: 'Composición corporal y masa muscular.' },
      { nombre: 'Semana metabólica', semanas: 'Semanas 3, 6, 9, 12', volumen: 'Alto', intensidad: 'Baja-moderada', reps: '15–20 / circuitos', rir: '3', objetivo: 'Capacidad cardiorrespiratoria y quema calórica.' },
    ],
    compatible_fases: ['activa', 'potencia'],
    indicado_para: 'Clientes de fitness general. Nivel N1 ACTIVA y N2 POTENCIA.',
    no_indicado: 'Deportistas con objetivos de rendimiento específico.',
  },

  perdida_grasa: {
    id: 'perdida_grasa',
    nombre: 'Planificación para Pérdida de Grasa (PHAT modificado)',
    autor: 'Layne Norton — Adaptación ACTIVA',
    descripcion: 'Combina fuerza y volumen con trabajo metabólico para maximizar el gasto calórico preservando masa muscular. Déficit calórico moderado como condición necesaria.',
    duracion: '12–16 semanas',
    fases: [
      { nombre: 'Base de fuerza', semanas: '1–4', volumen: 'Moderado', intensidad: 'Alta', reps: '4–6', rir: '2', objetivo: 'Preservar masa muscular en déficit calórico.' },
      { nombre: 'Hipertrofia + metabólico', semanas: '5–10', volumen: 'Alto', intensidad: 'Moderada', reps: '10–15 + finisher', rir: '2–3', objetivo: 'Máximo gasto calórico + preservación muscular.' },
      { nombre: 'Pico metabólico', semanas: '11–14', volumen: 'Muy alto', intensidad: 'Baja', reps: 'Circuitos 15–20', rir: '3', objetivo: 'Máximo déficit calórico. Cardio HIIT 2×/sem.' },
      { nombre: 'Consolidación', semanas: '15–16', volumen: 'Bajo', intensidad: 'Moderada', reps: '8–10', rir: '2', objetivo: 'Estabilizar peso. Evitar rebote.' },
    ],
    compatible_fases: ['activa', 'potencia'],
    indicado_para: 'Objetivo principal de composición corporal.',
    no_indicado: 'Fase RESTAURA. Personas con trastornos alimentarios.',
  },
};

// ─── CALCULADORA DE DURACIÓN DE SESIÓN ──────────────────────────────────
// Calcula el tiempo total estimado de una sesión basado en:
// sets × reps × tempo + descansos + transiciones

// ─── CALCULADORA DE DURACIÓN DE SESIÓN ──────────────────────────────────
// Estima el tiempo real sumando, ejercicio por ejercicio:
//   trabajo = series × (reps × cadencia)   [modo reps]
//   trabajo = series × duración_seg         [modo tiempo: isométricos, cardio]
//   + pausas entre series  + transiciones entre ejercicios y bloques
//   + calentamiento y vuelta a la calma

export const parseTempo = (tempoStr) => {
  // "2-0-1" → excéntrica 2s + pausa 0s + concéntrica 1s = 3s/rep ; "3-1-2" → 6s/rep
  if (!tempoStr) return 3; // por defecto 3s/rep
  const parts = String(tempoStr).split('-').map(Number).filter(n => !isNaN(n));
  if (parts.length >= 2) return parts.reduce((a, b) => a + b, 0);
  return 3;
};

export const parseReps = (repsStr) => {
  // "10-12" → promedio 11 ; "12" → 12
  if (!repsStr) return 10;
  const str = String(repsStr).replace(/–|—/g, '-');
  if (str.includes('-')) {
    const [a, b] = str.split('-').map(s => parseInt(s)).filter(n => !isNaN(n));
    if (a != null && b != null) return Math.round((a + b) / 2);
  }
  const n = parseInt(str);
  return isNaN(n) ? 10 : n;
};

export const parseDescanso = (descansoStr) => {
  // "90s" → 90 ; "2 min" → 120 ; "1:30" → 90
  if (!descansoStr) return 90;
  const s = String(descansoStr).toLowerCase();
  const mmss = s.match(/(\d+):(\d{1,2})/);
  if (mmss) return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
  const minMatch = s.match(/(\d+)\s*min/);
  const secMatch = s.match(/(\d+)\s*s/);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  if (secMatch) return parseInt(secMatch[1]);
  const n = parseInt(s);
  return isNaN(n) ? 90 : n;
};

// Convierte un valor de tiempo a SEGUNDOS: "45s", "30 seg", "2 min", "1:30", "90"
export const parseTiempo = (str) => {
  if (str == null) return 0;
  const s = String(str).toLowerCase().trim();
  if (!s) return 0;
  const mmss = s.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
  const min = s.match(/(\d+(?:[.,]\d+)?)\s*min/);
  const seg = s.match(/(\d+)\s*(?:seg|s)\b/);
  let total = 0, matched = false;
  if (min) { total += Math.round(parseFloat(min[1].replace(',', '.')) * 60); matched = true; }
  if (seg) { total += parseInt(seg[1]); matched = true; }
  if (matched) return total;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n); // número solo → segundos
};

// ¿El ejercicio se mide por tiempo? (flag explícito o el valor trae seg/min/mm:ss)
export const esModoTiempo = (params) => {
  if (!params) return false;
  if (params.modo === 'tiempo') return true;
  if (params.modo === 'reps') return false;
  const v = (params.duracion ?? params.reps ?? '').toString().toLowerCase();
  return /seg|min|\d+:\d{2}/.test(v);
};

// Duración (segundos) de UN ejercicio, incluyendo pausas entre series
export const calcularDuracionEjercicio = (params) => {
  if (!params) return 0;
  const series   = parseInt(params.series) || 3;
  const descanso = parseDescanso(params.descanso);
  let trabajo;
  if (esModoTiempo(params)) {
    const durSeg = parseTiempo(params.duracion ?? params.reps); // segundos por serie
    trabajo = series * durSeg;
  } else {
    const reps  = parseReps(params.reps);
    const tempo = parseTempo(params.tempo); // segundos por repetición
    trabajo = series * reps * tempo;
  }
  const pausas = Math.max(0, series - 1) * descanso;
  return trabajo + pausas;
};

const TRANSICION_EJERCICIO = 40;   // seg de armado/cambio entre ejercicios
const TRANSICION_BLOQUE    = 60;   // seg entre bloques
const CALENTAMIENTO_SEG    = 5 * 60;
const VUELTA_CALMA_SEG     = 5 * 60;

export const calcularDuracionBloque = (bloque) => {
  const ejercicios = bloque.exercises || [];
  if (!ejercicios.length) return 0; // bloque vacío no suma tiempo
  let total = 0;
  ejercicios.forEach((be, i) => {
    total += calcularDuracionEjercicio(be.params || bloque.params);
    if (i < ejercicios.length - 1) total += TRANSICION_EJERCICIO;
  });
  return total;
};

export const calcularDuracionSesion = (blocks) => {
  const vacio = { total: 0, totalMin: 0, calentamiento: 0, ejercicios: 0, transiciones: 0, vueltaCalma: 0, breakdown: [] };
  if (!blocks || blocks.length === 0) return vacio;

  const breakdown = blocks.map(b => {
    const seg = calcularDuracionBloque(b);
    return { bloque: b.type, label: b.type, nEx: (b.exercises || []).length,
             segundos: seg, minutos: Math.round(seg / 60 * 10) / 10 };
  });

  const tiempoEjercicios = breakdown.reduce((s, b) => s + b.segundos, 0);
  if (tiempoEjercicios === 0) return vacio; // sin ejercicios cargados → 0 real

  const bloquesConTrabajo = breakdown.filter(b => b.segundos > 0).length;
  const tiempoTransiciones = Math.max(0, bloquesConTrabajo - 1) * TRANSICION_BLOQUE;
  const total = CALENTAMIENTO_SEG + tiempoEjercicios + tiempoTransiciones + VUELTA_CALMA_SEG;

  return {
    total: Math.round(total),
    totalMin: Math.round(total / 60),
    calentamiento: Math.round(CALENTAMIENTO_SEG / 60),
    ejercicios: Math.round(tiempoEjercicios / 60),
    transiciones: Math.round(tiempoTransiciones / 60),
    vueltaCalma: Math.round(VUELTA_CALMA_SEG / 60),
    breakdown,
  };
};

// Color semáforo según duración
export const colorDuracion = (minutos) => {
  if (minutos <= 45) return { color: '#16A34A', label: 'Óptima' };
  if (minutos <= 70) return { color: '#D97706', label: 'Larga' };
  return { color: '#DC2626', label: 'Muy larga' };
};

// ─── MAPEO EJERCICIO → TEST DE FUERZA ────────────────────────────────────
// Mapea palabras clave del nombre del ejercicio al test de 1RM más relevante
const EXERCISE_TEST_MAP = [
  { testId: 'remo_apoyo', keywords: ['remo con apoyo','remo apoyo','remo a caballo','chest supported','chest-supported','seal row','t-bar','remo t','remo con barra','remo pendlay','remo mancuerna','remo con mancuerna','barbell row','bent over row','bent-over row','dumbbell row'] },
  { testId: 'squat',    keywords: ['sentadilla','squat','goblet','búlgara','bulgara','pistol','front squat'] },
  { testId: 'deadlift', keywords: ['peso muerto','deadlift','romanian','rdl','rumano','stiff','sumo','trap bar','hex bar'] },
  { testId: 'bench',    keywords: ['press pecho','press banca','bench press','banca','pecho','press inclinado','press declinado','aperturas'] },
  { testId: 'press_mil',keywords: ['press militar','press hombro','overhead','push press','push jerk','arnold','deltoid','press vertical'] },
  { testId: 'hip_thrust',keywords: ['hip thrust','puente de glúteo','glute bridge','empuje de cadera','hip extension'] },
  { testId: 'pull_ups', keywords: ['dominada','pull-up','chin-up','jalón','jalon','pulldown','remo vertical'] },
];

export const getTestIdForExercise = (nombreEjercicio) => {
  if (!nombreEjercicio) return null;
  const nombre = nombreEjercicio.toLowerCase();
  for (const { testId, keywords } of EXERCISE_TEST_MAP) {
    if (keywords.some(kw => nombre.includes(kw))) return testId;
  }
  return null;
};

// ─── TABLA % 1RM POR REPETICIONES (Prilepin adaptado) ────────────────────
// reps → porcentaje del 1RM que permite completarlas con buena técnica
const REPS_TO_PCT_1RM = {
  1: 100, 2: 97, 3: 93, 4: 90, 5: 87, 6: 85,
  7: 83,  8: 80, 9: 77, 10: 75, 11: 73, 12: 70,
  15: 65, 20: 60, 25: 55, 30: 50,
};

const getPctFor1RM = (reps) => {
  const n = parseInt(reps);
  if (isNaN(n) || n < 1) return null;
  // Exact match
  if (REPS_TO_PCT_1RM[n]) return REPS_TO_PCT_1RM[n];
  // Interpolate
  const keys = Object.keys(REPS_TO_PCT_1RM).map(Number).sort((a,b)=>a-b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (n >= keys[i] && n <= keys[i+1]) {
      const t = (n - keys[i]) / (keys[i+1] - keys[i]);
      return Math.round(REPS_TO_PCT_1RM[keys[i]] * (1-t) + REPS_TO_PCT_1RM[keys[i+1]] * t);
    }
  }
  return null;
};

// ─── % SOBRE 1RM EN FUNCIÓN DE LAS REPS (INVERSA DE LA FÓRMULA DEL TEST) ──
// Cada fórmula de estimación de 1RM tiene su propia relación reps↔%.
// Para que el % sea COHERENTE con la fórmula usada en el test del cliente,
// invertimos la misma fórmula con la que se calculó ese 1RM:
//   Epley:    1RM = w·(1+0.0333·r)  → %1RM = 100 / (1 + 0.0333·r)
//   Brzycki:  1RM = w·36/(37-r)     → %1RM = (37 - r) / 36 · 100
//   Lombardi: 1RM = w·r^0.10        → %1RM = 100 · r^(-0.10)
// 'epley_brzycki' = promedio de las dos primeras (igual que calcular1RM).
export const pctFromReps = (reps, formula = 'epley_brzycki') => {
  const n = parseInt(reps);
  if (isNaN(n) || n < 1) return null;
  if (n === 1) return 100;

  if (formula === 'lombardi') {
    if (n > 25) return null;            // fuera de rango confiable
    return Math.round(100 * Math.pow(n, -0.10));
  }
  if (n > 15) return null;              // poco confiable con muchas reps
  const epley   = 100 / (1 + 0.0333 * n);
  const brzycki = ((37 - n) / 36) * 100;
  if (formula === 'brzycki') return Math.round(brzycki);
  if (formula === 'epley')   return Math.round(epley);
  return Math.round((epley + brzycki) / 2); // epley_brzycki (promedio / legacy)
};

// Peso de trabajo para N reps a partir del 1RM y la fórmula del test
export const pesoParaReps = (rm1, reps, formula = 'epley_brzycki') => {
  const pct = pctFromReps(reps, formula);
  if (!rm1 || pct == null) return null;
  return Math.round(rm1 * pct / 100 / 2.5) * 2.5; // redondeo a 2.5 kg
};

// ─── PARSE REPS DE UNA FASE DE PERIODIZACIÓN ────────────────────────────
// "8–12" → average 10; "1–3" → 2; "3–5" → 4
const parseRepsFromPhase = (repsStr) => {
  if (!repsStr) return null;
  const str = repsStr.replace('–','-').replace('—','-');
  if (str.includes('-')) {
    const parts = str.split('-').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (parts.length >= 2) return Math.round((parts[0] + parts[1]) / 2);
  }
  const n = parseInt(str);
  return isNaN(n) ? null : n;
};

// ─── SUGERENCIA DE PESO PRINCIPAL ────────────────────────────────────────
// Dado un ejercicio, los tests del cliente y la fase activa del plan,
// devuelve un objeto con la sugerencia de peso y los cálculos
// repsEntered: reps escritas en el ejercicio del constructor (tienen prioridad).
// El % se calcula SIEMPRE invirtiendo la fórmula con la que se midió el 1RM
// del cliente (Epley+Brzycki o Lombardi), guardada en cada test.
export const sugerirPeso = (nombreEjercicio, testsCliente = [], fasePlan = null, repsEntered = null) => {
  // Ejercicios por tiempo (isométricos, cardio) no se rigen por % de 1RM
  if (repsEntered != null && /seg|min|\d+:\d{2}/.test(String(repsEntered).toLowerCase())) return null;
  const testId = getTestIdForExercise(nombreEjercicio);
  if (!testId || !testsCliente.length) return null;

  // Buscar el test más reciente para ese ejercicio
  const testData = testsCliente
    .filter(t => t.test_id === testId)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (!testData.length) return null;

  const last = testData[0];
  const rm1 = parseFloat(last.rm1_real || last.rm1_calculado);
  if (!rm1 || isNaN(rm1)) return null;

  // Fórmula con la que se estimó ESTE 1RM
  const formula = last.formula || 'epley_brzycki';
  const formulaLabel = FORMULAS_1RM[formula]?.label || 'Epley + Brzycki';

  // 1) Reps objetivo: prioridad ABSOLUTA a las reps ingresadas en el ejercicio.
  //    Si no hay, se toman las de la fase del plan. Si tampoco, 10 por defecto.
  let repsTarget = null;
  let fuenteReps = null;
  const repsFromEntered = parseRepsFromPhase(repsEntered != null ? String(repsEntered) : '');
  if (repsFromEntered) { repsTarget = repsFromEntered; fuenteReps = 'ingresadas'; }
  else if (fasePlan?.reps) { repsTarget = parseRepsFromPhase(fasePlan.reps); fuenteReps = 'plan'; }
  if (!repsTarget) { repsTarget = 10; fuenteReps = 'default'; }

  // 2) % sobre 1RM derivado de las reps con la MISMA fórmula del test
  let pct = pctFromReps(repsTarget, formula);
  let pctFueraRango = false;
  if (pct == null) {                       // reps fuera del rango confiable de la fórmula
    pct = getPctFor1RM(repsTarget) || 70;  // respaldo: tabla genérica Prilepin
    pctFueraRango = true;
  }

  // 3) Peso para ese % + banda práctica (±1 rep)
  const round25 = (x) => Math.round(x / 2.5) * 2.5;
  const pesoSugerido = round25(rm1 * pct / 100);
  const pctAlta = pctFromReps(Math.max(1, repsTarget - 1), formula) || (pct + 3); // 1 rep menos = más carga
  const pctBaja = pctFromReps(repsTarget + 1, formula) || (pct - 3);              // 1 rep más = menos carga
  const pesoMax = round25(rm1 * pctAlta / 100);
  const pesoMin = round25(rm1 * pctBaja / 100);

  const dias = Math.floor((new Date() - new Date(last.fecha)) / 86400000);

  return {
    testId,
    rm1,
    rm1Fecha: last.fecha,
    formula,
    formulaLabel,
    reps: repsTarget,
    fuenteReps,                 // 'ingresadas' | 'plan' | 'default'
    pct,                        // % del 1RM que representan esas reps
    pctFueraRango,
    pesoSugerido,
    pesoRango: `${pesoMin}–${pesoMax} kg`,
    repsTarget: `${repsTarget}`,
    rir: fasePlan?.rir || null,
    intensidad: fasePlan?.intensidad || null,
    diasDesdeTest: dias,
    testVencido: dias > 120,
  };
};

// ─── SUGERENCIAS PARA UN BLOQUE COMPLETO ─────────────────────────────────
export const sugerirPesosBloque = (exercises, exsDB, testsCliente, fasePlan) => {
  return exercises.map(be => {
    const ex = exsDB.find(e => e.id === be.exId);
    if (!ex) return { exId: be.exId, sugerencia: null };
    const reps = be.params?.reps ?? null;   // reps reales del ejercicio en el constructor
    const sugerencia = sugerirPeso(ex.nombre, testsCliente, fasePlan, reps);
    return { exId: be.exId, nombre: ex.nombre, sugerencia };
  }).filter(x => x.sugerencia !== null);
};

// ─── PLAZOS DEL PLAN (cronograma de fases con fechas) ────────────────────
// Convierte la cadena de semanas de cada fase en una duración en semanas.
//   "1–4" / "5–9" → rango absoluto → (fin - inicio + 1) semanas
//   "4–6 sem" / "2 sem" → duración explícita → promedio / valor
//   "Lunes" / "2×/semana" / "Semanas 1, 4, 7…" → no temporal (null)
export const durSemanasFase = (semanasStr) => {
  if (!semanasStr) return null;
  const str = String(semanasStr).replace(/–|—/g, '-').trim();
  const tieneSem = /sem/i.test(str);
  const rango = str.match(/(\d+)\s*-\s*(\d+)/);
  if (rango) {
    const a = parseInt(rango[1]), b = parseInt(rango[2]);
    return tieneSem ? Math.round((a + b) / 2) : (b - a + 1);
  }
  const uno = str.match(/(\d+)/);
  if (uno && (tieneSem || /^\d+$/.test(str))) return parseInt(uno[1]);
  return null;
};

// Devuelve el cronograma completo del plan: total de semanas, fechas por fase
// y fecha de finalización estimada (si se pasa fecha de inicio ISO YYYY-MM-DD).
export const planTimeline = (periodizacion, fechaInicioISO) => {
  if (!periodizacion) return null;
  const fechaInicio = fechaInicioISO ? new Date(fechaInicioISO + 'T00:00:00') : null;
  const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmt = (d) => d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });

  let cursor = 1;            // semana de inicio de la próxima fase
  let secuencial = true;     // ¿todas las fases tienen duración temporal?
  const fases = periodizacion.fases.map(f => {
    const dur = durSemanasFase(f.semanas);
    if (dur == null) {
      secuencial = false;
      return { nombre: f.nombre, semanasLabel: f.semanas, dur: null, objetivo: f.objetivo,
               reps: f.reps, intensidad: f.intensidad, rir: f.rir, volumen: f.volumen };
    }
    const semIni = cursor;
    const semFin = cursor + dur - 1;
    const fIni = fechaInicio ? fmt(addDias(fechaInicio, (semIni - 1) * 7)) : null;
    const fFin = fechaInicio ? fmt(addDias(fechaInicio, semFin * 7 - 1)) : null;
    cursor = semFin + 1;
    return { nombre: f.nombre, semanasLabel: f.semanas, dur, semIni, semFin, fIni, fFin,
             objetivo: f.objetivo, reps: f.reps, intensidad: f.intensidad, rir: f.rir, volumen: f.volumen };
  });
  const totalSemanas = secuencial ? (cursor - 1) : null;
  const fechaFin = (secuencial && fechaInicio) ? fmt(addDias(fechaInicio, totalSemanas * 7 - 1)) : null;
  return {
    nombre: periodizacion.nombre,
    autor: periodizacion.autor,
    duracionTexto: periodizacion.duracion,
    fases, secuencial, totalSemanas,
    fechaInicio: fechaInicio ? fmt(fechaInicio) : null,
    fechaFin,
  };
};
