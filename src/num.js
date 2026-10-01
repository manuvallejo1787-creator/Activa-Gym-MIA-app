// num.js — Separación entre cómo se GUARDA un número y cómo se MUESTRA.
//
// Por qué existe este archivo:
// Los campos numéricos del screening se guardan como texto dentro de un JSON.
// En la base convivían "90.5" y "90,5" según quién y desde dónde los cargó.
// parseFloat("90,5") devuelve 90 — trunca, no redondea, y siempre hacia abajo.
// Con 66 clientes cargados eso significaba pesos, IMC y porcentajes de grasa
// sistemáticamente por debajo del valor real, y una barra de recomposición
// imposible: medio kilo de error fijo sobre un cambio semanal de un kilo.
//
// Regla: SE GUARDA CON PUNTO (único formato que lee JavaScript).
//        SE MUESTRA CON COMA (que es como se escribe en Uruguay).
//        SE ACEPTA CUALQUIERA DE LOS DOS al tipear.

// Texto -> número. Acepta coma o punto. Devuelve null si no hay número.
export const aNumero = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const limpio = String(v).trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
};

// Cualquier cosa -> texto canónico para guardar (con punto).
// Si no es un número no se toca: así un campo de texto libre que pase por
// acá no se destruye.
export const aGuardar = (v) => {
  const n = aNumero(v);
  if (n == null) return v == null ? '' : String(v);
  return String(n);
};

// Número o texto -> cómo se ve en pantalla, con coma.
// decimales: null = los que tenga; un número = fuerza esa cantidad.
export const aTexto = (v, decimales = null) => {
  const n = aNumero(v);
  if (n == null) return v == null ? '' : String(v);
  const s = decimales == null ? String(n) : n.toFixed(decimales);
  return s.replace('.', ',');
};

// Para inputs mientras el usuario tipea: deja la coma visible y no pelea con
// el cursor. Solo filtra lo que no puede ser parte de un número.
export const normalizarTipeo = (v) =>
  String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\./g, ',').replace(/(,.*),/g, '$1');

// Rangos fisiológicos para detectar valores imposibles. No se corrigen solos:
// se listan para revisión humana, porque "1,75" en talla puede ser metros mal
// tipeados o 175 cm, y adivinar sería inventar un dato clínico.
export const RANGOS = {
  peso:        [25, 250],
  talla:       [100, 230],
  imc:         [10, 70],
  pctGrasa:    [3, 65],
  per_cintura: [40, 200], per_cadera: [50, 200], per_cintura_escapular: [50, 200],
  per_brazo_d: [15, 70],  per_brazo_i: [15, 70],
  per_muslo_d: [25, 100], per_muslo_i: [25, 100],
  per_pantorrilla_d: [20, 70], per_pantorrilla_i: [20, 70],
};

export const fueraDeRango = (campo, valor) => {
  const r = RANGOS[campo]; const n = aNumero(valor);
  if (!r || n == null) return false;
  return n < r[0] || n > r[1];
};

// Mensaje de advertencia para un valor fuera de rango. Devuelve null si está
// bien. No bloquea la carga: hay excepciones reales (un atleta, un niño), y un
// campo que no deja escribir es peor que uno que avisa.
export const avisoRango = (campo, valor) => {
  const r = RANGOS[campo]; const n = aNumero(valor);
  if (!r || n == null) return null;
  if (n < r[0] || n > r[1]) return `Fuera del rango habitual (${aTexto(r[0])}–${aTexto(r[1])}). Revisá el valor.`;
  return null;
};

// IMC desde peso (kg) y talla (cm). La talla va SIEMPRE en centímetros:
// el índice cintura-talla divide cintura entre talla con los valores crudos,
// así que mezclar metros da un número sin sentido que igual pasa el umbral.
export const calcularIMC = (peso, tallaCm) => {
  const p = aNumero(peso), t = aNumero(tallaCm);
  if (p == null || t == null || t <= 0) return null;
  if (t < 50) return null;   // casi seguro cargado en metros: no se adivina
  return Math.round((p / Math.pow(t / 100, 2)) * 10) / 10;
};
