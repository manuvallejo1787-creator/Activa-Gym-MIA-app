// qa/dueno.mjs — QUE UN PLAN NO LE CAMBIE DE DUEÑO
//
// ═══════════════════════════════════════════════════════════════════════════
// EL INCIDENTE DEL 20/11/2026
// ═══════════════════════════════════════════════════════════════════════════
// Manu: "La app me está borrando rutinas ya hechas de la nada. Está borrando
// tests de fuerza también. Vanesa Sagasti tenía un entreno ya hecho con su
// rutina y también tenía test de fuerza y ya no está".
//
// No las borraba: las REASIGNABA. Medido en la base:
//   · plan_1794948157234_4y8bm figuraba a nombre de Melanie Hellbusch
//   · pero tenía 11 cargas del portal de Vanesa Sagasti y 6 de Natalia Morales
//   · UN plan, TRES clientas. Gana la última que guarda; las otras lo pierden.
//   · el mismo patrón en agosto (Valeria Vidal / Annabella Romaniello), así que
//     venía de antes y no de un despliegue reciente
//
// LA CAUSA: App.jsx hacía `const id = session.planId || genId('plan')`, y
// ninguno de los OCHO lugares que cambiaban el cliente de la sesión limpiaba
// el id del plan. Guardás el plan de A → el id queda pegado → cambiás a B →
// guardás → el upsert por id pisa la fila y el plan pasa a ser de B.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA PRUEBA SE EQUIVOCÓ LA PRIMERA VEZ
// ═══════════════════════════════════════════════════════════════════════════
// La escribí buscando "const savePlan" en db.js y midiendo hasta el siguiente
// "const deletePlan". Hay CINCO funciones llamadas savePlan en ese archivo, y
// medí la primera: una ventana de 4 líneas de otro módulo. Daba ocho fallos
// con el arreglo correctamente puesto.
// LA LECCIÓN: buscar por nombre de función en un archivo que reusa nombres
// mide cualquier cosa. Hay que anclar en el módulo (`export function useX`) y
// recién ahí buscar adentro. Por eso abajo todo pasa por localizar(hook).
//
// Y el error tapaba algo peor: al ir a ver cuál era la savePlan correcta
// aparecieron SEIS tablas con el mismo upsert por id, no una. Las seis ahora
// pasan por verificarDueno.
import fs from 'node:fs';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };
const app = fs.readFileSync('src/App.jsx', 'utf8');
const db = fs.readFileSync('src/db.js', 'utf8');

// Acota la búsqueda a UN módulo, para no medir la función homónima de otro.
const localizar = (hook) => {
  const i = db.indexOf(`export function ${hook}`);
  if (i < 0) return '';
  const j = db.indexOf('\nexport function ', i + 10);
  return db.slice(i, j < 0 ? db.length : j);
};

console.log('\n1. CAPA 1 — cambiar de cliente limpia el plan en curso');
{
  ok(/const vincularCliente\s*=\s*useCallback/.test(app),
    'existe una sola función que cambia de cliente');
  const fn = app.slice(app.indexOf('const vincularCliente'), app.indexOf('const resetPlan'));
  ok(/planId:null/.test(fn), 'y limpia el id del plan');
  ok(/planNombre:''/.test(fn), 'y el nombre del plan');
  ok(/planEsEjemplo:false/.test(fn), 'y la marca de ejemplo');
  ok(/p\.clienteId===nuevoId\)return p/.test(fn),
    'y NO limpia nada si es el mismo cliente: volver a elegir al mismo no puede perder el trabajo en curso');
}
{
  // EL CONTROL QUE MÁS IMPORTA. Cualquier cambio de cliente que no limpie el
  // id del plan reintroduce el incidente. Si alguien agrega el noveno lugar,
  // esto falla antes de desplegar.
  const sospechosos = [];
  const re = /setSession\s*\(\s*p\s*=>\s*\(?\{[^}]*clienteId\s*:/g;
  let m;
  while ((m = re.exec(app))) {
    const trozo = app.slice(m.index, m.index + 900);
    const cierra = trozo.indexOf('}));');
    const cuerpo = cierra > 0 ? trozo.slice(0, cierra) : trozo;
    if (/clienteId\s*:\s*nuevoId/.test(cuerpo)) continue;      // es vincularCliente
    if (/planId\s*:\s*null/.test(cuerpo)) continue;             // limpia, está bien
    sospechosos.push(app.slice(0, m.index).split('\n').length);
  }
  ok(sospechosos.length === 0,
    `ningún cambio de cliente se olvida de limpiar el plan (sospechosos: ${sospechosos.join(', ') || 'ninguno'})`);
}
{
  ok(/const id=session\.planId\|\|genId\('plan'\)/.test(app),
    'guardar sigue reusando el id para EDITAR el mismo plan, que es lo correcto');
}
{
  // Nutrición lleva su propio cliente, aparte del de la sesión.
  const nut = fs.readFileSync('src/Nutricion.jsx', 'utf8');
  const cambios = (nut.match(/setSelClientId\(/g) || []).length;
  const limpian = (nut.match(/setSelClientId\([^)]*\);\s*setPlanActivo\(null\)/g) || []).length;
  ok(cambios === limpian,
    `nutrición limpia su plan en todos sus cambios de cliente (${limpian} de ${cambios})`);
}

console.log('\n2. CAPA 2 — la guarda de dueño, escrita UNA vez');
{
  ok(/const verificarDueno\s*=\s*async/.test(db),
    'hay una sola función de guarda y no seis copias: el séptimo lugar es una línea, no un olvido');
  const g = db.slice(db.indexOf('const verificarDueno'), db.indexOf('export function useGymClients'));
  ok(/if\s*\(!id\s*\|\|\s*!duenoActual/.test(g),
    'sin id es un alta nueva y no verifica nada: un plan nuevo no puede fallar por esto');
  ok(/maybeSingle\(\)/.test(g), 'usa maybeSingle: que no haya fila previa NO es un error');
  ok(/if\s*\(!previo\s*\|\|\s*!previo\[columnaDueno\]\)\s*return/.test(g),
    'una fila sin dueño registrado tampoco bloquea');
  ok(/throw new Error\(/.test(g), 'y ante dueño distinto corta en lugar de pisar');
}

console.log('\n3. LAS SEIS TABLAS — ninguna queda sin guarda');
{
  // Encontradas al investigar el incidente: seis lugares guardan con upsert
  // por id, no uno. Nutrición y periodización tenían el MISMO agujero latente.
  const esperadas = [
    ['useFuerzaTests',    'fuerza_tests',           'gym_client_id', 'los tests de fuerza'],
    ['usePlanesCliente',  'planes_periodizacion',   'gym_client_id', 'los planes de periodización'],
    ['useGymPlanes',      'gym_planes',             'gym_client_id', 'las rutinas de sala'],
    ['useCustomTests',    'fuerza_tests_custom',    'gym_client_id', 'los tests personalizados'],
    ['useNutricionPlanes','gym_planes_nutricion',   'gym_client_id', 'los planes de nutrición'],
    ['usePlanesClinicos', 'fisio_planes_clinicos',  'paciente_id',   'los planes clínicos'],
  ];
  for (const [hook, tabla, col, nombre] of esperadas) {
    const mod = localizar(hook);
    ok(mod.includes(`verificarDueno('${tabla}','${col}'`), `${nombre} tienen guarda`);
    const idxG = mod.indexOf(`verificarDueno('${tabla}'`);
    const idxU = mod.indexOf(`from('${tabla}').upsert`);
    ok(idxG > 0 && idxU > 0 && idxG < idxU,
      `${nombre}: la guarda va ANTES de escribir (si fuera después, la fila ya estaría robada)`);
  }
}
{
  // El control de cierre: que no aparezca una SÉPTIMA tabla sin guarda.
  const tablas = new Set();
  for (const m of db.matchAll(/from\('([a-z_]+)'\)\.upsert\([^)]*onConflict:'id'/g)) tablas.add(m[1]);
  const conGuarda = new Set([...db.matchAll(/verificarDueno\('([a-z_]+)'/g)].map(m => m[1]));
  // Bibliotecas compartidas por todo el centro: no tienen una columna de dueño,
  // así que nadie puede quedarse con la fila de otro. Van clasificadas a mano y
  // no detectadas automáticamente: así una tabla nueva obliga a decidir si es de
  // un cliente o de todos, en lugar de colarse sin guarda por parecerse a estas.
  const SIN_DUENO = {
    alimentos_custom:        'biblioteca de alimentos del centro',
    ia_conocimiento:         'base de conocimiento de la IA',
    rehab_ejercicios_custom: 'biblioteca de ejercicios de rehabilitación',
  };
  const sinGuarda = [...tablas].filter(t => !conGuarda.has(t) && !SIN_DUENO[t]);
  ok(sinGuarda.length === 0,
    `ninguna tabla nueva guarda por id sin verificar dueño (sin clasificar: ${sinGuarda.join(', ') || 'ninguna'})`);
  const fantasmas = Object.keys(SIN_DUENO).filter(t => !tablas.has(t));
  ok(fantasmas.length === 0,
    `la lista de bibliotecas compartidas no tiene entradas muertas (${fantasmas.join(', ') || 'ninguna'})`);
}

console.log('\n4. El mensaje le sirve a quien está en sala, no a un programador');
{
  const g = db.slice(db.indexOf('const verificarDueno'), db.indexOf('export function useGymClients'));
  const msg = g.slice(g.indexOf('throw new Error'));
  ok(/No se guardó nada/.test(msg),
    'dice que NO se guardó nada: lo primero que hay que saber es si se perdió el trabajo');
  ok(/Tocá "Nuevo"/.test(msg), 'y dice qué hacer para salir del problema');
  ok(!/upsert|onConflict|gym_client_id|maybeSingle/i.test(msg),
    'y lo dice sin tecnicismos: lo lee un entrenador en el piso');
  ok(/\$\{queEs\}/.test(msg),
    'y nombra qué se estaba guardando (plan, test, plan clínico) en lugar de un "registro" genérico');
}

console.log(fallos === 0 ? '\n✅ dueño de los datos: todo pasa\n' : `\n❌ dueño de los datos: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
