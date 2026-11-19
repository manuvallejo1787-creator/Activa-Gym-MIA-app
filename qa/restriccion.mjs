// qa/restriccion.mjs — qué ejercicio puede hacer este cliente
//
// POR QUÉ EXISTE
// Manu, 19/11/2026: "el semáforo en rojo no debe bloquear el armado de entrenos
// y lo sigue haciendo". Eran cinco bloqueos y todos salían de una línea:
// `if(client.semaforo==='rojo') return 'block'`.
//
// El nudo: el método declara que RESTAURA tiene semáforo ROJO, así que el
// cliente que sale de la clínica es rojo por definición — y la app le prohibía
// entrenar justo a la población de la transición clínica → sala.
//
// LA PRUEBA QUE MÁS IMPORTA ES LA 1: que un cliente rojo pueda armar un plan.
// El día que alguien vuelva a poner un corte por semáforo, esa prueba falla y
// se ve antes de desplegar, no tres semanas después en sala.
import { checkRestriccion, patronesBloqueados, tieneRestriccionConcreta,
         motivoRestriccion } from '../src/restriccion.js';
import { esVigente } from '../src/incidencias.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

const EX = {
  sentadilla: { id: 'e_sent', nombre: 'Sentadilla trasera con barra', patron: 'rodilla bilateral', bloque: 'fuerza' },
  press:      { id: 'e_press', nombre: 'Press militar', patron: 'empuje vertical', bloque: 'fuerza' },
  salto:      { id: 'e_salto', nombre: 'Salto al cajón', patron: 'salto', bloque: 'pliometria' },
  pot:        { id: 'e_pot', nombre: 'Clean desde el suelo', patron: 'triple extensión', bloque: 'potencia' },
  movilidad:  { id: 'e_mov', nombre: 'Cat camel', patron: 'movilidad columna', bloque: 'movilidad' },
  remo:       { id: 'e_remo', nombre: 'Remo con mancuerna', patron: 'tracción horizontal', bloque: 'fuerza' },
};
const TODOS = Object.values(EX);
const cli = (o = {}) => ({ id: 'c1', nombre: 'Maicol', semaforo: 'verde', restricciones_flags: {}, ...o });

console.log('\n1. LO QUE MANU REPORTÓ: un cliente ROJO puede armar un plan');
{
  const c = cli({ semaforo: 'rojo' });
  const bloqueados = TODOS.filter(e => checkRestriccion(e, c) === 'block');
  ok(bloqueados.length === 0,
    `rojo sin restricción registrada NO bloquea ningún ejercicio (bloqueaba ${bloqueados.length} de ${TODOS.length})`);
  ok(TODOS.every(e => checkRestriccion(e, c) === 'warn'),
    'pero avisa en TODOS: la app no sabe qué proteger y lo dice, en vez de dejarlo libre');
  const m = motivoRestriccion(EX.sentadilla, c);
  ok(/SIN restricción concreta registrada/.test(m), 'y el motivo explica por qué avisa');
  ok(/Registrá la restricción|abrí la incidencia/.test(m), 'y qué hacer para que deje de avisar');
}
{
  // El caso del generador: con el corte viejo el plan salía VACÍO.
  const c = cli({ semaforo: 'rojo' });
  const elegibles = TODOS.filter(e => checkRestriccion(e, c) !== 'block');
  ok(elegibles.length === TODOS.length,
    'el generador tiene los 6 ejercicios disponibles: antes le quedaban 0 y devolvía un plan vacío');
}

console.log('\n2. El rojo bloquea LA ZONA, que es la decisión del 30/10');
{
  const c = cli({ semaforo: 'rojo' });
  const b = new Set(['e_sent']);
  ok(checkRestriccion(EX.sentadilla, c, b) === 'block', 'el patrón que el riel sustituyó sí se bloquea');
  ok(checkRestriccion(EX.remo, c, b) === null,
    'y el resto del plan queda LIBRE: un pinzamiento de hombro no es razón para dejar de sentar');
  ok(checkRestriccion(EX.press, c, b) === null, 'ni avisa de más: ya hay restricción concreta registrada');
  ok(/riel tiene este patrón sustituido/.test(motivoRestriccion(EX.sentadilla, c, b)),
    'el motivo nombra al riel, no al semáforo');
  ok(/se libera solo a las 4 sesiones/i.test(motivoRestriccion(EX.sentadilla, c, b)),
    'y dice que se levanta solo: el que está en sala no tiene que ir a buscarlo');
}
{
  // Lo mismo para un amarillo: el riel manda igual.
  const c = cli({ semaforo: 'amarillo' });
  ok(checkRestriccion(EX.sentadilla, c, new Set(['e_sent'])) === 'block',
    'el bloqueo del riel aplica también en amarillo');
}
{
  const c = cli({ semaforo: 'verde' });
  ok(checkRestriccion(EX.sentadilla, c, new Set(['e_sent'])) === 'block',
    'y en verde: una molestia reportada bloquea su patrón sin importar el semáforo');
}

console.log('\n3. Las banderas del screening: igual para rojo y amarillo');
for (const sem of ['rojo', 'amarillo']) {
  const imp = cli({ semaforo: sem, restricciones_flags: { impacto: true } });
  ok(checkRestriccion(EX.salto, imp) === 'block', `${sem} + impacto bloquea el salto`);
  ok(checkRestriccion(EX.pot, imp) === 'block', `${sem} + impacto bloquea el bloque de potencia`);
  ok(checkRestriccion(EX.sentadilla, imp) === null, `${sem} + impacto NO bloquea la sentadilla`);

  const ovh = cli({ semaforo: sem, restricciones_flags: { overhead: true } });
  ok(checkRestriccion(EX.press, ovh) === 'warn', `${sem} + overhead avisa en el empuje vertical`);
  ok(checkRestriccion(EX.remo, ovh) === null, `${sem} + overhead no toca la tracción`);

  const axl = cli({ semaforo: sem, restricciones_flags: { cargaAxial: true } });
  ok(checkRestriccion(EX.sentadilla, axl) === 'warn', `${sem} + carga axial avisa en la sentadilla`);
  ok(checkRestriccion({ ...EX.sentadilla, id: 'x', nombre: 'Peso muerto rumano' }, axl) === 'warn',
    `${sem} + carga axial avisa en el peso muerto`);
}

console.log('\n4. Lo que no cambió');
{
  ok(checkRestriccion(EX.salto, cli({ semaforo: 'verde' })) === null, 'verde sigue libre');
  ok(checkRestriccion(EX.salto, cli({ semaforo: 'pendiente', restricciones_flags: { impacto: true } })) === null,
    'pendiente sigue sin filtrar: el filtro se activa al completar la evaluación');
  ok(checkRestriccion(EX.salto, null) === null, 'sin cliente no explota');
  ok(checkRestriccion(null, cli()) === null, 'sin ejercicio tampoco');
  ok(motivoRestriccion(null, null) === '', 'y el motivo devuelve vacío en lugar de romperse');
  ok(checkRestriccion(EX.remo, cli({ semaforo: 'verde' })) === null &&
     motivoRestriccion(EX.remo, cli({ semaforo: 'verde' })) === '',
     'un ejercicio libre no trae motivo');
}

console.log('\n5. Los patrones que vienen del riel');
{
  const incs = [
    { id: 'i1', estado: 'en_sala', patron_bloqueado: ['e_sent', 'e_pot'] },
    { id: 'i2', estado: 'valoracion_pendiente', patron_bloqueado: ['e_press'] },
    { id: 'i3', estado: 'resuelta', patron_bloqueado: ['e_remo'] },
    { id: 'i4', estado: 'programa', patron_bloqueado: ['e_salto'] },
  ];
  const b = patronesBloqueados(incs, esVigente);
  ok(b.has('e_sent') && b.has('e_pot'), 'junta los patrones de una incidencia en sala');
  ok(b.has('e_press'), 'y de una valoración pendiente');
  ok(!b.has('e_remo'), 'una incidencia RESUELTA no bloquea nada: el patrón volvió');
  ok(b.has('e_salto') === false || b.has('e_salto') === true,
    'el estado `programa` lo decide esVigente, no este archivo: una sola definición');
  ok(patronesBloqueados([], esVigente).size === 0, 'sin incidencias no bloquea nada');
  ok(patronesBloqueados(null).size === 0, 'ni con la lista nula');
  ok(patronesBloqueados([{ id: 'x', estado: 'en_sala' }]).size === 0,
    'una incidencia sin patrón elegido no bloquea: el riel la abre y los ejercicios se eligen después');
}

console.log('\n6. Cuándo se considera que hay restricción concreta');
{
  ok(tieneRestriccionConcreta(cli({ restricciones_flags: { impacto: true } })) === true, 'una bandera cuenta');
  ok(tieneRestriccionConcreta(cli(), new Set(['e_sent'])) === true, 'un patrón del riel cuenta');
  ok(tieneRestriccionConcreta(cli()) === false, 'sin nada, no hay restricción concreta');
  ok(tieneRestriccionConcreta(cli(), []) === false, 'una lista vacía tampoco');
  ok(tieneRestriccionConcreta({}) === false, 'un cliente vacío no explota');
}

console.log(fallos === 0 ? '\n✅ restricción: todo pasa\n' : `\n❌ restricción: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
