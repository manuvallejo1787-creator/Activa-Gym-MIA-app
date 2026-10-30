// incidencias.js — UNA SOLA DEFINICIÓN DE LOS ESTADOS DEL RIEL
//
// POR QUÉ EXISTE
// El 29/10/2026 la migración del riel agregó seis estados nuevos
// —en_sala, valoracion_pendiente, valoracion_hecha, programa, declinada,
// linea_base— y las incidencias que el disparador empezó a crear quedaron
// INVISIBLES en la app. No por un bug: porque cada pantalla tenía su propia
// lista blanca de estados conocidos y ninguna conocía los nuevos.
//
//   SalaDashboard.jsx   ['abierta','seguimiento'].includes(...)
//   App.jsx             e==='abierta' ? ... : e==='seguimiento' ? ... : false
//
// Dos listas en dos archivos, que ya se desincronizaron una vez y van a volver
// a hacerlo cada vez que el método agregue un estado. El arreglo no es agregar
// los seis a cada lista: es que haya un solo lugar que diga qué significa cada
// estado, y que las pantallas pregunten en lugar de decidir.
//
// LAS TRES PREGUNTAS QUE HACEN LAS PANTALLAS
//   pendiente  ¿requiere una acción HOY? → alimenta el badge de la app
//   vigente    ¿hay algo abierto sobre este cliente? → panel de sala
//   bloquea    ¿el patrón queda sustituido y sin progresar?
//
// Son distintas a propósito. Una derivación en curso está VIGENTE y BLOQUEA,
// pero no es PENDIENTE: la conducta ya se tomó y contarla haría que el badge
// nunca baje. Un badge que nunca baja se vuelve ruido y se empieza a ignorar,
// que es como mueren estos sistemas.

export const ESTADOS = {
  // Disparó y nadie definió conducta todavía. Es el único que entra sin
  // escalón asignado, y el que sí es pendiente puro.
  abierta:              { label: 'Sin conducta',          escalon: null, pendiente: true,  vigente: true,  bloquea: true  },
  // Escalón 0: el riel sustituyó el ejercicio y frenó la progresión. Ya tiene
  // conducta, así que no es pendiente. Se libera a las 4 sesiones ejecutadas
  // sin reporte nuevo en esa zona.
  en_sala:              { label: 'Ajuste en sala',        escalon: 0,    pendiente: false, vigente: true,  bloquea: true  },
  // Escalón 1 propuesto y todavía no ocurrido. Pendiente de verdad: alguien
  // tiene que hacer la valoración, y el patrón sigue bloqueado hasta que haya
  // veredicto. NO vence por tiempo: la app no premia la demora.
  valoracion_pendiente: { label: 'Valoración pendiente',  escalon: 1,    pendiente: true,  vigente: true,  bloquea: true  },
  // La valoración ocurrió y hay veredicto escrito. Sigue pendiente porque hay
  // que rutearla: baja a 0, sube a 2 o 3, o se marca línea de base.
  valoracion_hecha:     { label: 'Valorada, a rutear',    escalon: 1,    pendiente: true,  vigente: true,  bloquea: true  },
  // Escalón 2: bloque dirigido corriendo dentro del plan de gym.
  programa:             { label: 'Programa dirigido',     escalon: 2,    pendiente: false, vigente: true,  bloquea: false },
  // Escalón 3: en clínica.
  derivada:             { label: 'Derivada a clínica',    escalon: 3,    pendiente: false, vigente: true,  bloquea: true  },
  // Se propuso subir de escalón y el cliente dijo que no. La decisión ya se
  // tomó, así que no es pendiente — pero BLOQUEA, y eso es deliberado:
  // rechazar el escalonamiento vuelve el programa más conservador, no menos.
  // Se libera a las 8 sesiones ejecutadas sin reporte nuevo en esa zona.
  declinada:            { label: 'Escalón declinado',     escalon: 0,    pendiente: false, vigente: true,  bloquea: true  },
  // Crónico conocido: registra y no dispara. NO es vigente a propósito — el
  // sentido de marcar una línea de base es que deje de aparecer como hallazgo
  // abierto. Si siguiera contando, el caso de Raúl ensuciaría el panel para
  // siempre, que es justo lo que se vino a resolver.
  //
  // PERO sí vuelve a ser pendiente cuando vence su revisión. Una línea de base
  // es una decisión con fecha de caducidad —"esto es su normal, se revisa en 90
  // días"— y sin esto la caducidad quedaba escrita y sin consumir: el único
  // lugar donde se veía era el panel de sala, que hay que abrir para verlo.
  linea_base:           { label: 'Línea de base',         escalon: 0,    pendiente: { vence: 'revision_vence' }, vigente: false, bloquea: false },
  // Estado heredado del riel anterior, previo a los escalones. Se conserva
  // porque hay incidencias guardadas con él: pendiente sólo cuando venció su
  // fecha de revisión.
  seguimiento:          { label: 'En seguimiento',        escalon: 0,    pendiente: { vence: 'fecha_revision' }, vigente: true, bloquea: false },
  resuelta:             { label: 'Resuelta',              escalon: null, pendiente: false, vigente: false, bloquea: false },
};

// Normaliza el estado de una incidencia.
// Las guardadas antes de los estados traían sólo el booleano `resuelto`, y una
// que llegue con un estado desconocido —de una versión más nueva, o un dato
// escrito a mano— se trata como `abierta`: ante la duda, que se vea. Un
// hallazgo invisible es peor que uno mal clasificado.
export function estadoDe(inc = {}) {
  const e = inc.estado || (inc.resuelto ? 'resuelta' : 'abierta');
  return ESTADOS[e] ? e : 'abierta';
}

export const metaEstado = (inc) => ESTADOS[estadoDe(inc)];
export const etiquetaEstado = (inc) => metaEstado(inc).label;

// ¿Requiere una acción hoy? `hoy` se inyecta para poder probarlo.
//
// Dos estados son pendientes POR FECHA y cada uno guarda la suya en una columna
// distinta: `seguimiento` en `fecha_revision` (heredada del riel viejo) y
// `linea_base` en `revision_vence` (la que escribe marcarLineaBase). Son dos
// nombres para lo mismo y es una deuda del esquema, no un criterio; mientras
// exista, el estado dice cuál es la suya en lugar de que esta función adivine.
export function esPendiente(inc = {}, hoy = new Date().toISOString().slice(0, 10)) {
  const p = metaEstado(inc).pendiente;
  if (p && typeof p === 'object' && p.vence) {
    const f = inc[p.vence];
    return !!(f && String(f).slice(0, 10) <= hoy);
  }
  return !!p;
}

// La fecha por la que esta incidencia vence, si vence por fecha. La consume la
// bandeja de Hoy para poder decir hace cuántos días, no sólo que venció.
export function fechaVence(inc = {}) {
  const p = metaEstado(inc).pendiente;
  return (p && typeof p === 'object' && p.vence) ? (inc[p.vence] || null) : null;
}

// ¿Hay algo abierto sobre este cliente?
export const esVigente = (inc = {}) => metaEstado(inc).vigente;

// ¿El patrón queda sustituido y sin progresar?
export const bloqueaPatron = (inc = {}) => metaEstado(inc).bloquea;

// El escalón efectivo. La columna `escalon` manda cuando está; si no, se
// deduce del estado, que es el caso de las incidencias viejas.
export function escalonDe(inc = {}) {
  if (Number.isInteger(inc.escalon)) return inc.escalon;
  const e = metaEstado(inc).escalon;
  return e == null ? 0 : e;
}

// El umbral de sesiones ejecutadas que libera el patrón —4 en escalón 0, 8 en
// declinada— vive en la columna `sesiones_umbral`. La función que lo lee se
// agrega cuando exista el contador de sesiones sin reporte que lo consume:
// dejarla escrita de antemano sería código muerto, y el estándar es explícito
// en que nada quede sin conectar.

// ── EL VOCABULARIO DE LA ZONA Y LA NATURALEZA ─────────────────────────────
// Las claves las escribe el portal (`zonaClave`: zona + lado cuando es
// bilateral) y las leen la bandeja de Hoy, el panel de sala y el riel. Hasta
// ahora cada pantalla hacía `String(zona).replace(/_/g,' ')`, que devuelve
// "rodilla izq" y "muneca der": sin tildes y sin mayúscula, porque la clave
// nunca fue texto para mostrar. Con tres lugares haciendo lo mismo mal, la
// traducción va donde ya viven los estados.
const ZONAS = {
  cuello: 'Cuello', hombro: 'Hombro', codo: 'Codo', muneca: 'Muñeca',
  dorsal: 'Espalda alta', lumbar: 'Lumbares', cadera: 'Cadera',
  rodilla: 'Rodilla', tobillo: 'Tobillo',
};
const LADOS = { izq: 'izq', der: 'der', ambos: 'ambos lados' };

export function zonaTexto(zona) {
  if (!zona) return 'zona sin especificar';
  const [base, lado] = String(zona).split('_');
  const z = ZONAS[base] || (base.charAt(0).toUpperCase() + base.slice(1));
  return lado && LADOS[lado] ? `${z} ${LADOS[lado]}` : z;
}

export const NATURALEZAS = { muscular: 'muscular', articular: 'articular', nerviosa: 'nerviosa' };
export const naturalezaTexto = (n) => NATURALEZAS[n] || null;

// ── QUÉ SE PUEDE HACER DESDE CADA ESTADO ──────────────────────────────────
// Antes las pantallas ofrecían siempre los mismos tres botones —resuelta,
// seguimiento, derivada— y por eso el escalón 1 no existía en la práctica: el
// riel saltaba de "sustituye" a "frena y deriva", y 8 de las 10 incidencias
// que había se cerraron sin derivación porque la única salida disponible era
// la más pesada.
//
// El ruteo es MONÓTONO, igual que el resto del método: de un estado sólo se
// puede ir a los que están acá. No hay forma de bajar de escalón sin pasar por
// una valoración, y eso es deliberado: bajar requiere veredicto, nunca
// silencio ni tiempo.
export const ACCIONES = {
  valoracion_pendiente: { label: '🔍 Pedir valoración',   tono: 'ambar' },
  valoracion_hecha:     { label: '✓ Valoración hecha',    tono: 'azul'  },
  programa:             { label: '📋 Programa dirigido',  tono: 'azul'  },
  derivada:             { label: '🏥 Derivar a clínica',  tono: 'azul'  },
  // El estado que faltaba y que más datos va a dar: hoy `derivado_fisio:false`
  // + `resuelta` significa lo mismo para "no hacía falta" que para "se lo
  // propuse y no quiso", y 8 de 10 incidencias están en ese limbo.
  declinada:            { label: '✗ Se lo propuse, no quiso', tono: 'rojo' },
  // Saca al crónico conocido del ruido sin dejar de registrarlo.
  linea_base:           { label: '📌 Crónico conocido',   tono: 'gris'  },
  seguimiento:          { label: '👁 Seguir',              tono: 'ambar' },
  resuelta:             { label: '✓ Resuelta',            tono: 'verde' },
};

export const TRANSICIONES = {
  abierta:              ['valoracion_pendiente', 'derivada', 'seguimiento', 'resuelta'],
  en_sala:              ['valoracion_pendiente', 'resuelta'],
  // Desde una valoración pendiente no se puede "resolver" de una: o se hizo,
  // o el cliente la declinó, o hay que derivar. Cerrarla sin veredicto es
  // exactamente lo que dejaba el hallazgo sin resolver y sin constancia.
  valoracion_pendiente: ['valoracion_hecha', 'declinada', 'derivada'],
  valoracion_hecha:     ['programa', 'derivada', 'linea_base', 'resuelta'],
  programa:             ['derivada', 'resuelta'],
  derivada:             ['resuelta'],
  // Un escalón declinado se puede retomar si el cliente cambia de idea.
  declinada:            ['valoracion_pendiente', 'derivada', 'resuelta'],
  // Una línea de base no se "resuelve": se vuelve a valorar si cambió algo.
  linea_base:           ['valoracion_pendiente'],
  seguimiento:          ['valoracion_pendiente', 'derivada', 'resuelta'],
  resuelta:             [],
};

export const accionesDe = (inc = {}) =>
  (TRANSICIONES[estadoDe(inc)] || []).map(k => ({ k, ...ACCIONES[k] }));

// Ordena para mostrar: primero lo que requiere acción, después por escalón
// más alto, y al final lo más reciente.
// Tres niveles y no dos: pendiente, después vigente, y al final lo cerrado.
// Con dos niveles, una resuelta de escalón 3 quedaba por encima de una activa
// de escalón 0 — en la práctica no se veía porque la lista llega filtrada por
// `esVigente`, pero un orden que depende de que alguien haya filtrado antes
// está mal definido.
export function ordenarIncidencias(lista = [], hoy) {
  const nivel = (i) => esPendiente(i, hoy) ? 0 : esVigente(i) ? 1 : 2;
  return lista.slice().sort((a, b) => {
    const n = nivel(a) - nivel(b);
    if (n !== 0) return n;
    const e = escalonDe(b) - escalonDe(a);
    if (e !== 0) return e;
    return String(b.fecha || '').localeCompare(String(a.fecha || ''));
  });
}
