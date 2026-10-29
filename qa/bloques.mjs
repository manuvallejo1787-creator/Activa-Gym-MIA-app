// qa/bloques.mjs — el orden de los bloques del constructor de sesiones
//
// POR QUÉ EXISTE
// No había forma de reordenar un bloque: para cambiar la distribución que
// propone la IA había que BORRARLO y crearlo de nuevo en otra posición, y con
// eso se perdían sus ejercicios, sus parámetros y las cargas sugeridas.
// Reordenar es la operación más común al revisar un plan propuesto y era la
// única que obligaba a rehacer trabajo.
//
// Al arreglarlo apareció un bug latente en el mismo lugar: `position` es el
// número que se imprime en el PDF del plan, y no se normalizaba nunca.
// Borrar un bloque dejaba hueco (1, 2, 4, 5) y así salía impreso; insertar en
// una posición ocupada dejaba dos bloques con el mismo número.
//
// Lo que se prueba acá es la invariante: después de CUALQUIER operación, las
// posiciones son 1..n, sin huecos ni repetidos, y no se perdió ni se duplicó
// ningún bloque. Esa última parte es la que importa: un reordenamiento que
// pierde un bloque con sus ejercicios es peor que no poder reordenar.

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// Copias textuales de App.jsx
const renumerar = bs => bs.slice().sort((a, b) => a.position - b.position)
  .map((b, i) => b.position === i + 1 ? b : { ...b, position: i + 1 });

const addBlock = (blocks, type, pos) => {
  if (blocks.length >= 7) return blocks;
  const nb = { id: 'n' + Date.now() + Math.random(), type, position: parseInt(pos) - 0.5, exercises: [] };
  return renumerar([...blocks, nb]);
};
const removeBlock = (blocks, id) => renumerar(blocks.filter(b => b.id !== id));
const moveBlock = (blocks, id, dir) => {
  const bs = blocks.slice().sort((a, b) => a.position - b.position);
  const i = bs.findIndex(b => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= bs.length) return blocks;
  [bs[i], bs[j]] = [bs[j], bs[i]];
  return renumerar(bs.map((b, k) => ({ ...b, position: k + 1 })));
};

// La invariante que todo tiene que cumplir siempre.
const sano = bs => {
  const pos = bs.map(b => b.position).sort((a, b) => a - b);
  return pos.every((p, i) => p === i + 1);
};
const tipos = bs => bs.slice().sort((a, b) => a.position - b.position).map(b => b.type).join('>');

// La distribución que propone la IA para la fase RINDE.
const inicial = ['movilidad', 'activacion', 'potencia', 'pliometria', 'fuerza']
  .map((type, i) => ({ id: 'b' + i, type, position: i + 1, exercises: [{ exId: 'ex' + i }] }));

console.log('\n1. Punto de partida');
ok(sano(inicial), 'posiciones 1..5');
ok(tipos(inicial) === 'movilidad>activacion>potencia>pliometria>fuerza', tipos(inicial));

console.log('\n2. Subir y bajar conserva todos los bloques y sus ejercicios');
let bs = moveBlock(inicial, 'b4', -1);   // fuerza sube
ok(sano(bs), 'posiciones siguen 1..5');
ok(bs.length === 5, 'no se perdió ningún bloque');
ok(tipos(bs) === 'movilidad>activacion>potencia>fuerza>pliometria', tipos(bs));
ok(bs.every(b => b.exercises.length === 1), 'cada bloque conserva su ejercicio');

bs = moveBlock(bs, 'b4', -1);            // fuerza sube otra vez
bs = moveBlock(bs, 'b4', -1);
ok(tipos(bs) === 'movilidad>fuerza>activacion>potencia>pliometria', `tres subidas: ${tipos(bs)}`);
ok(sano(bs) && bs.length === 5, 'sigue sano y completo');

console.log('\n3. En las puntas no hace nada, y no rompe nada');
const primero = bs.slice().sort((a, b) => a.position - b.position)[0].id;
const ultimo  = bs.slice().sort((a, b) => a.position - b.position)[4].id;
ok(tipos(moveBlock(bs, primero, -1)) === tipos(bs), 'subir el primero: sin cambios');
ok(tipos(moveBlock(bs, ultimo, 1)) === tipos(bs), 'bajar el último: sin cambios');
ok(moveBlock(bs, 'inexistente', -1).length === 5, 'un id que no existe no pierde bloques');

console.log('\n4. Bajar deshace lo que subió (reversibilidad)');
const antes = tipos(bs);
ok(tipos(moveBlock(moveBlock(bs, 'b4', 1), 'b4', -1)) === antes, 'bajar y subir vuelve al mismo orden');

console.log('\n5. Borrar NO deja hueco (el número que se imprime en el PDF)');
bs = removeBlock(inicial, 'b2');          // saca potencia, que estaba en 3
ok(sano(bs), 'posiciones 1..4 sin hueco — antes quedaba 1,2,4,5');
ok(bs.length === 4 && !bs.some(b => b.type === 'potencia'), 'se fue el que correspondía');

console.log('\n6. Insertar en una posición ocupada empuja, no duplica');
bs = addBlock(inicial, 'zona_media', 3);  // donde estaba potencia
ok(sano(bs), 'posiciones 1..6 sin repetidos — antes quedaban dos en 3');
ok(bs.length === 6, 'entró el bloque nuevo');
ok(tipos(bs) === 'movilidad>activacion>zona_media>potencia>pliometria>fuerza',
   `el nuevo queda EN la posición pedida y empuja al otro: ${tipos(bs)}`);

console.log('\n7. Insertar al principio y al final');
ok(tipos(addBlock(inicial, 'cardio', 1)).startsWith('cardio>'), 'posición 1 queda primero');
ok(tipos(addBlock(inicial, 'cardio', 6)).endsWith('>cardio'), 'posición 6 queda último');
ok(sano(addBlock(inicial, 'cardio', 1)) && sano(addBlock(inicial, 'cardio', 6)), 'las dos quedan sanas');

console.log('\n8. Tope de 7 bloques');
let siete = inicial;
for (const t of ['cardio', 'zona_media']) siete = addBlock(siete, t, 99);
ok(siete.length === 7, 'llega a 7');
ok(addBlock(siete, 'funcional', 1).length === 7, 'el octavo no entra');

console.log('\n9. Normaliza un plan guardado con posiciones sucias');
// Planes viejos ya guardados pueden traer huecos o repetidos de los dos bugs
// anteriores. Cualquier operación los tiene que dejar sanos, no arrastrarlos.
const sucio = [
  { id: 's1', type: 'movilidad',  position: 1, exercises: [] },
  { id: 's2', type: 'activacion', position: 3, exercises: [] },
  { id: 's3', type: 'fuerza',     position: 3, exercises: [] },
  { id: 's4', type: 'cardio',     position: 9, exercises: [] },
];
ok(!sano(sucio), 'el plan de entrada está sucio (3 repetido, hueco hasta 9)');
ok(sano(renumerar(sucio)), 'renumerar lo deja 1..4');
ok(sano(moveBlock(sucio, 's4', -1)), 'mover también lo limpia');
ok(sano(removeBlock(sucio, 's1')), 'borrar también lo limpia');
ok(renumerar(sucio).length === 4, 'sin perder ninguno');

process.exit(fallos ? 1 : 0);
