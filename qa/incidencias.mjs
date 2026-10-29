// qa/incidencias.mjs — los estados del riel y qué significa cada uno
//
// POR QUÉ EXISTE
// La migración del 29/10 agregó seis estados y las incidencias que el
// disparador empezó a crear quedaron INVISIBLES en la app. No por un bug de
// código: porque cada pantalla tenía su propia lista blanca de estados y
// ninguna conocía los nuevos.
//
//   SalaDashboard.jsx   ['abierta','seguimiento'].includes(i.estado||'abierta')
//   App.jsx             e==='abierta' ? true : e==='seguimiento' ? ... : false
//
// Peor: el handler de conducta tenía un `else` que trataba como 'resuelta'
// cualquier estado que no fuera seguimiento ni derivada, así que agregar los
// botones nuevos sin tocarlo habría hecho que "Pedir valoración" marcara la
// incidencia como RESUELTA — la conducta opuesta a la pedida, sin rastro.
//
// Este arnés fija las tres preguntas que las pantallas hacen y que antes cada
// una respondía por su cuenta.
import {
  ESTADOS, estadoDe, esPendiente, esVigente, bloqueaPatron,
  escalonDe, etiquetaEstado, accionesDe, TRANSICIONES, ordenarIncidencias,
} from '../src/incidencias.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };
const HOY = '2026-10-29';

console.log('\n1. Los estados que el disparador crea existen y se ven');
// Son los tres que fn_riel_desde_feedback escribe al insertar.
for (const e of ['abierta', 'valoracion_pendiente', 'en_sala']) {
  ok(!!ESTADOS[e], `${e} está definido`);
  ok(esVigente({ estado: e }), `${e} es VIGENTE: aparece en el panel de sala`);
}
ok(esPendiente({ estado: 'valoracion_pendiente' }, HOY), 'valoracion_pendiente requiere acción: entra al badge');
ok(esPendiente({ estado: 'abierta' }, HOY), 'abierta requiere acción');
ok(!esPendiente({ estado: 'en_sala' }, HOY), 'en_sala NO requiere acción: ya tiene conducta');

console.log('\n2. El badge no cuenta lo que ya tiene conducta');
// Un badge que nunca baja se vuelve ruido y se empieza a ignorar.
for (const e of ['derivada', 'programa', 'declinada', 'linea_base', 'resuelta']) {
  ok(!esPendiente({ estado: e }, HOY), `${e} no infla el badge`);
}

console.log('\n3. La línea de base sale del panel sin dejar de existir');
ok(!esVigente({ estado: 'linea_base' }), 'linea_base NO es vigente: el crónico conocido deja de ensuciar el panel');
ok(!bloqueaPatron({ estado: 'linea_base' }), 'y no bloquea el patrón: está evaluada');
ok(!esVigente({ estado: 'resuelta' }), 'resuelta tampoco');

console.log('\n4. Declinar vuelve el programa más conservador, no menos');
ok(bloqueaPatron({ estado: 'declinada' }), 'declinada BLOQUEA el patrón');
ok(!esPendiente({ estado: 'declinada' }, HOY), 'pero no es pendiente: la decisión ya se tomó');
ok(esVigente({ estado: 'declinada' }), 'y sigue vigente: consta que se propuso y se rechazó');

console.log('\n5. Estados viejos y basura');
ok(estadoDe({ resuelto: true }) === 'resuelta', 'una incidencia vieja con sólo `resuelto:true`');
ok(estadoDe({ resuelto: false }) === 'abierta', 'una vieja sin resolver');
ok(estadoDe({}) === 'abierta', 'sin nada');
// Ante la duda, que se vea: un hallazgo invisible es peor que uno mal
// clasificado.
ok(estadoDe({ estado: 'inventado_x' }) === 'abierta', 'un estado desconocido cae en abierta, no desaparece');
ok(esVigente({ estado: 'inventado_x' }), 'y por lo tanto se ve');
ok(esPendiente({ estado: 'seguimiento', fecha_revision: '2026-10-28' }, HOY), 'seguimiento vencido: pendiente');
ok(!esPendiente({ estado: 'seguimiento', fecha_revision: '2026-12-01' }, HOY), 'seguimiento a futuro: no');
ok(!esPendiente({ estado: 'seguimiento' }, HOY), 'seguimiento sin fecha: no pendiente');

console.log('\n6. El escalón');
ok(escalonDe({ escalon: 3 }) === 3, 'la columna manda');
ok(escalonDe({ estado: 'derivada' }) === 3, 'sin columna se deduce del estado (incidencias viejas)');
ok(escalonDe({ estado: 'valoracion_pendiente' }) === 1, 'valoracion_pendiente es escalón 1');
ok(escalonDe({}) === 0, 'sin nada, 0');
ok(escalonDe({ escalon: 0 }) === 0, 'un 0 explícito no se confunde con ausente');

console.log('\n7. Las acciones dependen del estado — el bug que esto previene');
const acc = e => accionesDe({ estado: e }).map(a => a.k);
// Antes los tres botones eran siempre resuelta/seguimiento/derivada y por eso
// el escalón 1 no existía: el riel saltaba de "sustituye" a "frena y deriva",
// y 8 de 10 incidencias se cerraron sin derivación porque la única salida
// disponible era la más pesada.
ok(acc('valoracion_pendiente').includes('declinada'), 'desde valoracion_pendiente se puede DECLINAR');
ok(acc('valoracion_pendiente').includes('valoracion_hecha'), 'y marcarla hecha');
ok(!acc('valoracion_pendiente').includes('resuelta'),
   'pero NO resolverla de una: cerrar sin veredicto es lo que dejaba el hallazgo sin resolver');
ok(acc('valoracion_hecha').includes('linea_base'), 'desde valoracion_hecha se puede marcar crónico conocido');
ok(!acc('abierta').includes('linea_base'),
   'una línea de base NO se puede marcar sin valorar primero: silenciar sin mirar es el error a evitar');
ok(acc('resuelta').length === 0, 'una resuelta no ofrece acciones');
ok(acc('linea_base').length === 1 && acc('linea_base')[0] === 'valoracion_pendiente',
   'una línea de base sólo se puede revalorar, no "resolver"');
ok(acc('derivada').length === 1 && acc('derivada')[0] === 'resuelta', 'de clínica sólo se sale con el alta');

console.log('\n8. Toda transición apunta a un estado que existe, y toda acción tiene etiqueta');
for (const [desde, hacia] of Object.entries(TRANSICIONES)) {
  ok(!!ESTADOS[desde], `${desde} es un estado definido`);
  const malos = hacia.filter(h => !ESTADOS[h]);
  ok(malos.length === 0, `desde ${desde} todos los destinos existen${malos.length ? ': ' + malos.join(', ') : ''}`);
  const sinLabel = accionesDe({ estado: desde }).filter(a => !a.label);
  ok(sinLabel.length === 0, `desde ${desde} todas las acciones tienen etiqueta`);
}
// Todo estado tiene que ser alcanzable, o es código muerto en forma de dato.
const alcanzables = new Set(['abierta', 'en_sala', 'valoracion_pendiente', ...Object.values(TRANSICIONES).flat()]);
const huerfanos = Object.keys(ESTADOS).filter(e => !alcanzables.has(e));
ok(huerfanos.length === 0, `no hay estados inalcanzables${huerfanos.length ? ': ' + huerfanos.join(', ') : ''}`);

console.log('\n9. El orden de la lista pone primero lo que hay que hacer');
const lista = [
  { id: 'a', estado: 'resuelta',             escalon: 3, fecha: '2026-10-28' },
  { id: 'b', estado: 'en_sala',              escalon: 0, fecha: '2026-10-27' },
  { id: 'c', estado: 'valoracion_pendiente', escalon: 1, fecha: '2026-10-20' },
  { id: 'd', estado: 'abierta',              escalon: 3, fecha: '2026-10-25' },
];
const orden = ordenarIncidencias(lista, HOY).map(i => i.id);
ok(orden[0] === 'd', `primero la de escalón 3 sin conducta (dio ${orden.join('>')})`);
ok(orden[1] === 'c', 'después la valoración pendiente');
// Tres niveles: la resuelta va ÚLTIMA aunque tenga el escalón más alto. Con
// dos niveles quedaba por encima de la activa de escalón 0.
ok(orden[2] === 'b', 'después la activa de escalón 0');
ok(orden[3] === 'a', 'la resuelta al final, pese a ser escalón 3');
ok(orden.length === 4, 'no se pierde ninguna');
ok(ordenarIncidencias([], HOY).length === 0, 'lista vacía no explota');

process.exit(fallos ? 1 : 0);
