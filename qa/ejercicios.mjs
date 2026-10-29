// qa/ejercicios.mjs — guardar un ejercicio y encontrarlo después
//
// POR QUÉ EXISTE
// Dos bugs encadenados, encontrados el 28/10/2026:
//
// 1. `saveEjercicio` escribía en Supabase y no tocaba el estado de la
//    pantalla: la lista se actualizaba SÓLO si volvía el evento de Realtime
//    por websocket. Si ese websocket no se establece, el ejercicio queda
//    guardado y la lista no cambia. El usuario no ve nada, vuelve a guardar,
//    y como el id se genera en cada alta el reintento crea OTRO registro.
//
// 2. El buscador comparaba texto crudo, así que escribir "biceps" no
//    encontraba "Curl bíceps en banco Scott con mancuernas". El ejercicio
//    parecía no existir y se creaba de nuevo.
//
// Las huellas quedaron en la tabla: "Face pull isometrico con banda" cargado
// el 04/09 a las 02:34 y 02:37, "Sentadilla bulgara ipsilateral" el 30/05 a
// las 07:35 y 07:38, y el Curl bíceps partido en dos ids con 31 y 10
// ejecuciones — su progresión sigue partida y ninguna lectura la ve completa.
//
// Este arnés reproduce la lógica de los dos arreglos. Si vuelve a depender
// del websocket, o el buscador vuelve a ser sensible a los acentos, falla.

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// Copia textual de `clave` en App.jsx
const clave = n => (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

console.log('\n1. Buscador insensible a acentos, signos y mayúsculas');
const NOMBRES = [
  'Curl bíceps en banco Scott con mancuernas',   // el nativo ac12
  'Curl biceps en banco Scott con mancuernas',   // la copia que nació del bug
  'Estiramiento de rotadores externos de muñeca',
  'Remo en TRX', 'Sentadilla salto con barra',
];
const buscar = q => { const k = clave(q); return NOMBRES.filter(n => clave(n).includes(k)); };
ok(buscar('biceps').length === 2, '"biceps" sin acento encuentra los DOS Curl bíceps (antes: uno)');
ok(buscar('bíceps').length === 2, '"bíceps" con acento también encuentra los dos');
ok(buscar('muneca').length === 1, '"muneca" sin ñ encuentra "muñeca"');
ok(buscar('BANCO SCOTT').length === 2, 'mayúsculas y espacios no rompen');
ok(buscar('trx').length === 1, 'minúsculas encuentran "TRX"');
ok(buscar('').length === NOMBRES.length, 'búsqueda vacía no filtra');
ok(clave(undefined) === '' && clave(null) === '', 'nombre o músculos ausentes no explotan');

console.log('\n2. Guardar actualiza la lista sin esperar el websocket');
const guardar = (p, ex) => p.some(e => e.id === ex.id) ? p.map(e => e.id === ex.id ? ex : e) : [...p, ex];
let exs = [{ id: 'a', nombre: 'Uno' }, { id: 'b', nombre: 'Dos' }];
exs = guardar(exs, { id: 'c', nombre: 'Sentadilla salto con barra' });
ok(exs.length === 3 && exs[2].id === 'c', 'el alta aparece al confirmar la escritura');
exs = guardar(exs, { id: 'b', nombre: 'Dos editado' });
ok(exs.length === 3 && exs.find(e => e.id === 'b').nombre === 'Dos editado', 'la edición se refleja y no duplica');

console.log('\n3. El eco de Realtime no duplica lo que ya está');
const onInsert = (p, row) => p.some(e => e.id === row.id)
  ? p.map(e => e.id === row.id ? row : e) : [...p, row];
const antes = exs.length;
exs = onInsert(exs, { id: 'c', nombre: 'Sentadilla salto con barra' });
ok(exs.length === antes, 'INSERT de algo ya presente NO agrega una segunda fila');
exs = onInsert(exs, { id: 'd', nombre: 'Otro' });
ok(exs.length === antes + 1, 'INSERT de algo nuevo sí agrega: Realtime sigue sirviendo');

console.log('\n4. Aviso de nombre repetido en el alta');
const base = [{ id: 'ac12', nombre: 'Curl bíceps en banco Scott con mancuernas', bloque: 'accesorios' }];
const repe = n => base.find(e => clave(e.nombre) === clave(n));
ok(!!repe('Curl biceps en banco Scott con mancuernas'), 'detecta el repetido escrito sin acento');
ok(!repe('Curl martillo con mancuernas'), 'no molesta con un ejercicio realmente distinto');

process.exit(fallos ? 1 : 0);
