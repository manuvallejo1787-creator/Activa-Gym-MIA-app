// promptSesion.js — EL PEDIDO QUE SE LE MANDA A LA IA PARA ARMAR UNA SESIÓN
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE ESTE ARCHIVO
// ═══════════════════════════════════════════════════════════════════════════
// El 04/11/2026 Manu reportó: "si le doy una instrucción particular a la IA
// para generar un plan, la ignora por completo". No era la IA: el pedido estaba
// armado para que la ignore. Dos causas medidas, no supuestas:
//
//   1. LA INSTRUCCIÓN ERA LA LÍNEA CON MENOS PESO DEL PEDIDO.
//      Aparecía como `Instrucciones adicionales: <texto>`, una línea sin
//      ninguna marca, en el MEDIO del pedido. Después venían ~300 líneas de
//      ejercicios y cinco bloques marcados OBLIGATORIA / ESTRICTAS / NUNCA /
//      DEBE / ÚNICAMENTE, y el pedido CERRABA con "Incluí 4-6 bloques en el
//      orden correcto". Lo último que lee un modelo pesa de más.
//
//      Las reglas permanentes de "Entrenar IA" sí llegaban con el cartel
//      "obligatorias, tienen prioridad sobre criterios genéricos". La
//      instrucción del momento no llevaba nada: peleaba desarmada.
//
//   2. LA IA SÓLO VEÍA 25 EJERCICIOS DE CADA BLOQUE. De 434 cargados le
//      llegaban 292 — 142 invisibles. De los 94 accesorios, 25. Y cuáles 25
//      era arbitrario: la consulta ordena sólo por bloque, así que dentro del
//      bloque el orden lo decide la base y puede cambiar entre cargas.
//      Al mismo tiempo el pedido ordenaba "Usá ÚNICAMENTE los IDs listados
//      arriba. No inventes IDs." Si la instrucción nombraba un ejercicio que
//      ese día no entró en los 25, la IA tenía dos órdenes contradictorias y
//      ganaba la prohibición: le habíamos prohibido obedecer.
//
//      Mandar los 434 cuesta ~1.600 tokens más que mandar 292. El tope era
//      una economía falsa que compraba una clase entera de fallas silenciosas.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA DECISIÓN DE MANU (04/11)
// ═══════════════════════════════════════════════════════════════════════════
// La instrucción del momento SÍ puede romper la estructura fija de la sesión,
// pero sólo si se pide explícitamente. O sea: "sin cardio" o "solo fuerza"
// tienen que funcionar. Lo que no puede hacer nunca es inventar un ejercicio
// que no existe en la base, porque el id iría a un plan que después nadie
// puede ejecutar.
//
// QUEDA PENDIENTE, Y ES DEUDA ANOTADA: que el razonamiento diga qué parte del
// método se rompió. Manu eligió no incluirlo. El riesgo: en tres semanas abre
// una sesión vieja sin activación y no puede saber si fue porque la pidió así
// o porque la IA se equivocó.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UN MÓDULO APARTE Y NO TEXTO INLINE EN AIActiva.jsx
// ═══════════════════════════════════════════════════════════════════════════
// Estaba inline, así que la única forma de verificar que la instrucción
// llegaba —y con qué peso— era generar una sesión de verdad y mirar el
// resultado a ojo. Eso no es una prueba. Acá es una función que devuelve un
// texto, y qa/promptSesion.mjs verifica que la instrucción esté al final, con
// prioridad declarada, y que todos los ejercicios lleguen.

// Normalización para comparar nombres de ejercicios sin que las tildes
// arruinen el match: la base mezcla "Bíceps" con "Biceps".
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

// ── LA LISTA DE EJERCICIOS ────────────────────────────────────────────────
// TODOS, agrupados por bloque. Sin tope.
//
// `destacar` son los ejercicios que la instrucción del profesional nombra: van
// marcados para que la IA los encuentre entre 434 líneas. No alcanza con que
// estén presentes si quedan sepultados.
export function listaEjerciciosIA(exs = [], destacar = []) {
  const porBloque = {};
  (exs || []).forEach(e => {
    if (!e || !e.id) return;
    const b = e.bloque || 'sin_bloque';
    (porBloque[b] = porBloque[b] || []).push(e);
  });
  const marcados = new Set(destacar || []);
  return Object.entries(porBloque).map(([bloque, lista]) =>
    `\n### BLOQUE "${bloque}" (solo estos IDs van en bloques type="${bloque}"):\n` +
    lista.map(e => `${e.id} = ${e.nombre}${marcados.has(e.id) ? '   ⟵ NOMBRADO EN LA INSTRUCCIÓN' : ''}`).join('\n')
  ).join('\n');
}

// ── QUÉ EJERCICIOS NOMBRA LA INSTRUCCIÓN ──────────────────────────────────
//
// POR NOMBRE PARCIAL, NO COMPLETO. La primera versión exigía el nombre entero
// y lo cazó el arnés: "sacá el peso muerto" NO detectaba "Peso muerto
// convencional". Nadie escribe el nombre completo de catálogo — se escribe
// "sin peso muerto", "incluí hip thrust", "sacá la sentadilla".
//
// CÓMO: de cada nombre se arman sus prefijos por PALABRA ("Peso muerto
// convencional" → "peso muerto", "peso muerto convencional") y se busca
// cualquiera de ellos en el texto del profesional.
//
// MÍNIMO 8 CARACTERES, y es lo que evita los falsos positivos: "press" (5) no
// matchea solo, así que "sin press" no marca las doce variantes de press;
// "press banca" (11) sí. "peso muerto" (11) y "hip thrust" (10) pasan.
//
// SI UN PREFIJO MATCHEA VARIOS EJERCICIOS, SE MARCAN TODOS, y es deliberado:
// "sacá el peso muerto" casi seguro significa todas las variantes de peso
// muerto, no una. Para una instrucción de quitar, marcar todas es lo correcto;
// para una de incluir, la IA elige una de las marcadas. Adivinar cuál quiso
// sería peor que mostrarle las candidatas.
export function ejerciciosNombrados(instrucciones = '', exs = []) {
  const t = norm(instrucciones);
  if (!t) return [];
  return (exs || [])
    .filter(e => {
      if (!e || !e.id || !e.nombre) return false;
      const palabras = norm(e.nombre).split(' ').filter(Boolean);
      let acum = '';
      for (const p of palabras) {
        acum = acum ? `${acum} ${p}` : p;
        if (acum.length >= 8 && t.includes(acum)) return true;
      }
      return false;
    })
    .map(e => e.id);
}

// ── EL BLOQUE DE LA INSTRUCCIÓN ───────────────────────────────────────────
// Va AL FINAL del pedido y con prioridad declarada, que es el arreglo del
// problema que Manu reportó. El texto dice explícitamente qué puede y qué no
// puede hacer, porque "tiene prioridad" a secas dejaría abierta la puerta a
// que invente ejercicios inexistentes.
export function bloqueInstruccion(instrucciones = '', nombrados = []) {
  const t = String(instrucciones || '').trim();
  if (!t) return '';
  return `
═══════════════════════════════════════════════════════════════
INSTRUCCIÓN DEL PROFESIONAL PARA ESTA SESIÓN — MÁXIMA PRIORIDAD
═══════════════════════════════════════════════════════════════
"${t}"

Esta instrucción tiene prioridad SOBRE TODO lo anterior, incluida la
estructura obligatoria de bloques y la cantidad de bloques sugerida.
Concretamente:
- Si pide SACAR un bloque (ej. "sin cardio", "solo fuerza"), lo sacás,
  aunque la estructura de arriba lo liste.
- Si pide AGREGAR un bloque (ej. "agregale pliometría"), lo agregás en la
  posición que le corresponde según el orden de arriba.
- Si pide un énfasis, un volumen o un ejercicio puntual, lo aplicás aunque
  contradiga lo que elegirías por criterio genérico.

LO ÚNICO QUE NO PODÉS HACER, ni para cumplir esta instrucción:
- Inventar un id de ejercicio que no esté en la lista de arriba. Si pide algo
  que no existe en la base, elegí el más parecido de la lista y decilo en el
  razonamiento.
${nombrados.length ? `
La instrucción nombra estos ejercicios, que SÍ están en la lista y están
marcados con ⟵ : ${nombrados.join(', ')}. Incluilos.` : ''}`;
}

// ── EL PEDIDO COMPLETO ────────────────────────────────────────────────────
export function armarPromptSesion({
  cliente = {}, periodizacion = null, faseIndex = 0, tests = [], exs = [],
  historial = [], reglas = [], ejecucion = [], instrucciones = '',
} = {}) {
  const totalFases = periodizacion?.fases?.length || 0;
  const idx = Math.min(Math.max(faseIndex, 0), Math.max(totalFases - 1, 0));
  const faseActiva = periodizacion?.fases?.[idx];
  const esAdelanto = idx > 0;
  const rm1s = tests?.map(t => `${t.test_nombre}: ${t.rm1_real || t.rm1_calculado || 'sin dato'} kg`).join(', ') || 'sin tests registrados';

  const reglasActivas = (reglas || []).filter(r => r.activo && ['entrenamiento', 'general'].includes(r.ambito));
  const reglasTxt = reglasActivas.length
    ? `\nREGLAS DEL PROFESIONAL (obligatorias, tienen prioridad sobre criterios genéricos):\n${reglasActivas.map(r => `- ${r.regla}`).join('\n')}\n`
    : '';
  const ejemplos = (historial || []).filter(p => p.es_ejemplo).slice(0, 2);
  const recientes = (historial || []).filter(p => !p.es_ejemplo).slice(0, 3);
  const histTxt = (ejemplos.length || recientes.length)
    ? `\nHISTORIAL DE PLANES DE ESTE CLIENTE (para progresar, NO repetir igual):\n` +
      ejemplos.map(p => `★ EJEMPLO (${p.fecha_inicio || ''}, ${p.estado}): ${p.resumen || p.nombre}`).join('\n') +
      (ejemplos.length ? '\n' : '') +
      recientes.map(p => `· ${p.fecha_inicio || ''} (${p.estado}): ${p.resumen || p.nombre}`).join('\n') +
      `\nProgresá respecto a lo ya realizado: variá estímulos, subí dificultad donde corresponda y respetá la continuidad.\n`
    : '';
  const ejecTxt = (ejecucion || []).length
    ? `\nCARGAS REALES QUE EL CLIENTE EJECUTÓ (registradas por él, semana a semana — son el dato MÁS importante para progresar):\n${ejecucion.map(e => `- ${e}`).join('\n')}\nUsá estas cargas reales para calibrar el nuevo plan: si progresó, subí; si se estancó o bajó, ajustá volumen/intensidad. No prescribas a ciegas.\n`
    : '';

  const nombrados = ejerciciosNombrados(instrucciones, exs);

  return `Generá una sesión de entrenamiento en JSON para este cliente:

Cliente: ${cliente?.nombre} ${cliente?.apellido}
Nivel Método Activa: ${cliente?.nivel?.toUpperCase()} — ${cliente?.objetivo || 'objetivo general'}
Semáforo: ${cliente?.semaforo}
Peso corporal: ${cliente?.screening?.peso || 'no registrado'} kg
Restricciones: ${cliente?.restricciones || 'ninguna'}
Periodización activa: ${periodizacion?.nombre || 'sin plan'}
Fase actual: ${faseActiva ? `Fase ${idx + 1}/${totalFases} — ${faseActiva.nombre} — ${faseActiva.reps} reps, ${faseActiva.intensidad}, RIR ${faseActiva.rir}` : 'no definida'}
${esAdelanto ? `⚠ El profesional está ADELANTANDO trabajo: esta sesión NO es de la fase inicial del plan, es la fase ${idx + 1} de ${totalFases}. Prescribí acorde a los parámetros de ESA fase específica (reps/intensidad/RIR de arriba), no a los de una fase de adaptación inicial.\n` : ''}Tests de fuerza 1RM: ${rm1s}
${reglasTxt}${histTxt}${ejecTxt}
ESTRUCTURA DE LA SESIÓN (orden de bloques):
1. movilidad → 2. activacion → 3. fuerza/potencia/pliometria (principal) → 4. accesorios → 5. zona_media/prev_rehab → 6. cardio/flex_recovery
Una sesión típica usa 4-6 bloques siguiendo ese flujo. El ORDEN no se altera.
Qué bloques entran sí se puede cambiar, pero SÓLO si la instrucción del
profesional —al final de este pedido— lo pide explícitamente.

EJERCICIOS DISPONIBLES — AGRUPADOS POR BLOQUE.
Un ejercicio SOLO puede ir en un bloque de su mismo tipo. NUNCA pongas un ejercicio de fuerza en movilidad ni viceversa.
${listaEjerciciosIA(exs, nombrados)}

CARGAS — NO LAS CALCULES VOS:
- NO incluyas pesos. La carga de cada ejercicio la calcula el motor determinista del sistema aplicando un coeficiente de transferencia biomecánica sobre el test del patrón.
- Motivo: un 1RM de press banca con barra NO se traslada a unas aperturas con mancuernas, ni una sentadilla trasera a una búlgara, ni un peso muerto convencional a un rumano. Mismo músculo no es misma carga: cambian el brazo de palanca, la estabilidad requerida y si es uni o bilateral.
- Tu trabajo es ELEGIR bien los ejercicios y justificar la selección. Usá los 1RM solo para razonar el nivel del cliente, nunca para prescribir kilos.

REGLAS ESTRICTAS:
- El "type" de cada bloque DEBE ser uno de: movilidad, activacion, zona_media, prev_rehab, potencia, pliometria, fuerza, accesorios, cardio, flex_recovery, propiocepcion, funcional.
- Cada "exId" dentro de un bloque DEBE pertenecer al grupo de ese bloque (mismo tipo). Si el ejercicio "sentadilla" está listado bajo BLOQUE "fuerza", solo puede ir en un bloque type="fuerza".
- Usá ÚNICAMENTE los IDs exactos listados arriba. No inventes IDs.
- Respetá el orden: movilidad y activación al inicio, fuerza/potencia en el medio, cardio/recovery al final.

Respondé ÚNICAMENTE con este JSON (sin texto extra):
{
  "nombre": "nombre descriptivo de la sesión",
  "objetivo_sesion": "descripción breve del objetivo",
  "blocks": [
    {
      "type": "uno de los tipos válidos",
      "params": { "series": "3", "reps": "10-12", "rpe": "7", "tempo": "2-0-1", "descanso": "90s" },
      "exercises": [
        { "exId": "id_exacto_de_ese_bloque", "anotacion": "indicación técnica breve, específica para este cliente" }
      ]
    }
  ],
  "razonamiento": "explicación breve (2-3 líneas)"
}
${bloqueInstruccion(instrucciones, nombrados)}`;
}
