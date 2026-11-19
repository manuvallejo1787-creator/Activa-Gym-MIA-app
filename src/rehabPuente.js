// rehabPuente.js — EL PUENTE ENTRE EL RIEL DEL GYM Y LA BIBLIOTECA DE REHAB
//
// POR QUÉ EXISTE
// El 30/10, al conectar el escalón 2, aparecieron tres desconexiones que hasta
// ese momento no molestaban porque nada cruzaba de un lado al otro:
//
//   1. DOS VOCABULARIOS DE FASE, LOS DOS LLAMADOS `FASES_REHAB`.
//      · src/App.jsx:165   → aguda / subaguda / cronica — avanza por CALENDARIO
//                            (0–72 h, 3 días–6 sem, 6+ sem). Es la clave con la
//                            que está indexada REHAB_DB, la biblioteca real.
//      · src/criterios.js  → proteccion / carga_progresiva / retorno_funcion
//                            (R0/R1/R2) — avanza por CRITERIOS, tiene
//                            `criterios_avance_generico`, y se mapea a las
//                            fases del negocio (restaura/activa/potencia).
//
//      El de calendario está mal según el propio método: es el mismo error que
//      ya se corrigió dos veces esta semana —las 4 y 8 sesiones ejecutadas en
//      vez de 30 días, el test de fuerza por fase en vez de por fecha— y quedó
//      vivo en la biblioteca de ejercicios.
//
//      Lo correcto es remapear REHAB_DB a R0/R1/R2. Eso es la unificación que
//      Manu puso como siguiente trabajo. Mientras no esté, la traducción vive
//      ACÁ, en una sola línea, y no desparramada por la pantalla: cuando la
//      biblioteca se remapee se borra este mapa y nada más cambia.
//
//   2. ZONAS DEL PORTAL vs REGIONES DE REHAB. Nueve contra diez, y no
//      coinciden en el nombre ni en el corte.
//
//   3. QUÉ EJERCICIO DEL PLAN BLOQUEAR. Acá NO hay mapa automático y es
//      deliberado: cuál patrón carga una zona depende del cliente, del
//      ejercicio y del hallazgo. Lo que hay es una SUGERENCIA por palabra
//      clave, que el profesional confirma o cambia. Inventar la lista y
//      aplicarla sola sería la app decidiendo una conducta clínica.

// ── 1. FASE CLÍNICA (criterios) → CLAVE DE LA BIBLIOTECA (calendario) ─────
// La pantalla habla en R0/R1/R2 porque es el vocabulario del método. La
// biblioteca responde en aguda/subaguda/cronica porque es como está indexada.
// Esta es la única línea que sabe de las dos cosas.
export const FASE_CLINICA_A_LIBRERIA = {
  proteccion: 'aguda',
  carga_progresiva: 'subaguda',
  retorno_funcion: 'cronica',
};

// ── 2. ZONA DEL PORTAL → REGIÓN DE REHAB ──────────────────────────────────
// Las claves de zona las escribe el portal (`zonaClave`: zona + lado cuando es
// bilateral), así que el lado se descarta acá: la biblioteca de ejercicios no
// distingue hombro izquierdo de derecho.
//
// `cuello` es la única que cambia de nombre (REHAB_DB la llama `cervical`), y
// `esc` (cintura escapular) no tiene zona en el portal: se llega eligiéndola a
// mano, que es correcto — el cliente no reporta "cintura escapular".
const ZONA_A_REGION = {
  cuello: 'cervical', hombro: 'hombro', codo: 'codo', muneca: 'muneca',
  dorsal: 'dorsal', lumbar: 'lumbar', cadera: 'cadera',
  rodilla: 'rodilla', tobillo: 'tobillo',
};

export function regionDeZona(zona) {
  if (!zona) return '';
  const base = String(zona).split('_')[0];
  return ZONA_A_REGION[base] || '';
}

// ── 3. QUÉ EJERCICIOS DEL PLAN SUGERIR BLOQUEAR ───────────────────────────
// Por palabra clave sobre el nombre del ejercicio. Es una SUGERENCIA: la
// pantalla la deja marcada y el profesional la cambia. La app no decide sola
// qué patrón frenar.
//
// Las listas son generosas a propósito —de más antes que de menos— porque el
// costo de sugerir un ejercicio que no hacía falta es un toque para
// desmarcarlo, y el de no sugerirlo es un patrón que sigue cargando la zona
// que duele.
const PATRONES_POR_REGION = {
  cervical: [/encogimiento|shrug|trapecio/i, /press.*(militar|hombro|vertical)|overhead|arnold|push ?press/i,
             /remo.*(alto|menton)|upright/i],
  hombro:   [/press.*(banca|plano|inclinado|declinado|pecho|militar|hombro|vertical)|bench|overhead|arnold|push ?press/i,
             /apertura|fly|cruce|pec ?deck/i, /elevaci[oó]n.*(lateral|frontal)|lateral raise/i,
             /dominada|pull ?up|jal[oó]n|pulldown/i, /fondo|dip|paralelas/i,
             /arrancada|snatch|clean|cargada|env[ií]on|jerk/i],
  codo:     [/curl|b[ií]ceps/i, /tr[ií]ceps|extensi[oó]n.*codo|franc[eé]s|patada|kickback|copa/i,
             /fondo|dip|paralelas/i, /press.*(cerrado|close)/i],
  muneca:   [/curl.*mu[nñ]eca|wrist/i, /agarre|grip|farmer|caminata.*granjero/i,
             /dominada|pull ?up|colgado|hang/i],
  dorsal:   [/remo|row/i, /peso muerto|deadlift|trap ?bar|sumo/i, /pull ?over/i,
             /buenos d[ií]as|good ?morning/i],
  lumbar:   [/peso muerto|deadlift|trap ?bar|sumo|rumano|rdl/i, /sentadilla|squat/i,
             /buenos d[ií]as|good ?morning/i, /remo con barra|barbell row/i,
             /press.*(militar|vertical)|overhead/i, /hiperextensi[oó]n|extensi[oó]n lumbar|back ?extension/i,
             /arrancada|snatch|clean|cargada/i],
  cadera:   [/sentadilla|squat/i, /peso muerto|deadlift|rumano|rdl|trap ?bar|sumo/i,
             /hip thrust|empuje de cadera|puente/i, /zancada|lunge|estocada|b[uú]lgara|split/i,
             /abducci[oó]n|abductor|aductor/i, /prensa/i],
  rodilla:  [/sentadilla|squat/i, /prensa/i, /zancada|lunge|estocada|b[uú]lgara|split/i,
             /extensi[oó]n.*(rodilla|cuadr[ií]ceps)|leg ?extension/i, /salto|jump|pliom[eé]tr/i,
             /subida al (caj[oó]n|banco)|step ?up/i],
  tobillo:  [/gemelo|s[oó]leo|elevaci[oó]n.*(talon|punta)|calf/i, /salto|jump|pliom[eé]tr|cuerda/i,
             /sentadilla|squat/i, /zancada|lunge|estocada/i, /trote|corr|sprint|cinta/i],
  esc:      [/remo|row/i, /dominada|pull ?up|jal[oó]n|pulldown/i,
             /press.*(militar|hombro|vertical)|overhead/i, /face ?pull|tir[oó]n a la cara/i],
};

// Devuelve los exIds del plan que conviene bloquear para esa zona.
// `ejercicios` es [{exId, nombre}] — los del plan activo del cliente, ya
// resueltos a nombre, porque el plan guarda sólo el id.
export function sugerirPatronBloqueado(zona, ejercicios = []) {
  const region = regionDeZona(zona);
  const pats = PATRONES_POR_REGION[region] || [];
  if (!pats.length) return [];
  const out = [];
  (ejercicios || []).forEach(e => {
    if (!e || !e.exId || !e.nombre) return;
    if (pats.some(re => re.test(e.nombre)) && !out.includes(e.exId)) out.push(e.exId);
  });
  return out;
}

// Todos los ejercicios de los planes activos de un cliente, con su nombre
// resuelto y sin repetidos. Lo usa la pantalla para ofrecer qué bloquear.
// `planes` son filas de gym_planes; `nombrePorId` resuelve el id al nombre.
export function ejerciciosDelPlan(planes = [], nombrePorId = () => '') {
  const vistos = new Set();
  const out = [];
  (planes || []).forEach(p => (p.dias || []).forEach(d => (d.blocks || []).forEach(b =>
    (b.exercises || []).forEach(e => {
      if (!e || !e.exId || vistos.has(e.exId)) return;
      vistos.add(e.exId);
      out.push({ exId: e.exId, nombre: nombrePorId(e.exId) || e.exId, diaId: d.id, diaNombre: d.name || '' });
    }))));
  return out;
}

// Arma el jsonb que se guarda en gym_incidencias.bloque_dirigido.
// DESNORMALIZADO a propósito: los ejercicios de REHAB_DB viven en el código y
// el portal no importa el bundle de la app. Si mañana la biblioteca cambia, el
// bloque que el cliente ya tiene asignado no cambia abajo de sus pies — que es
// lo correcto para una prescripción.
export function armarBloqueDirigido({ region, faseClinica, faseLabel, ejercicios = [], nota = '', dias = [] } = {}) {
  const exs = (ejercicios || [])
    .filter(e => e && e.exId)
    .map(e => ({
      exId: e.exId, nombre: e.nombre || e.exId, desc: e.desc || '',
      series: e.series || 3, reps: e.reps || e.param || '', notas: e.notas || '',
    }));
  if (!exs.length) return null;   // un bloque sin ejercicios no es un bloque
  return {
    region: region || 'rehab',
    fase: faseLabel || faseClinica || '',
    fase_clinica: faseClinica || '',
    nota: nota || '',
    dias: dias || [],
    exercises: exs,
  };
}
