// qa/promptSesion.mjs — el pedido que se le manda a la IA para armar una sesión
//
// POR QUÉ EXISTE
// El 04/11/2026 Manu reportó: "si le doy una instrucción particular a la IA
// para generar un plan, la ignora por completo". No era la IA: el pedido estaba
// armado para que la ignore, por dos causas medidas.
//
//   1. La instrucción era `Instrucciones adicionales: <texto>`, una línea sin
//      ninguna marca, en el MEDIO del pedido. Después venían ~300 líneas de
//      ejercicios y cinco bloques marcados OBLIGATORIA / ESTRICTAS / NUNCA /
//      DEBE / ÚNICAMENTE, y el pedido CERRABA con "Incluí 4-6 bloques en el
//      orden correcto". Las reglas permanentes de "Entrenar IA" sí llegaban con
//      el cartel de prioridad; la instrucción del momento, no.
//
//   2. La IA sólo veía 25 ejercicios por bloque: 292 de 434, 142 invisibles.
//      Y el pedido ordenaba "Usá ÚNICAMENTE los IDs listados. No inventes IDs."
//      Si la instrucción nombraba uno que ese día no entró en los 25, la IA
//      tenía dos órdenes contradictorias y ganaba la prohibición.
//
// ESTAS PRUEBAS FIJAN LO QUE NO PUEDE VOLVER A ROMPERSE. El control 2.1 es el
// más importante: que la instrucción esté DESPUÉS de todas las reglas duras.
// El día que alguien agregue una sección al final del pedido, la instrucción
// vuelve al medio y el problema de Manu vuelve sin que nadie lo note.
import { armarPromptSesion, listaEjerciciosIA, ejerciciosNombrados,
         bloqueInstruccion } from '../src/promptSesion.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// Un catálogo que imita el real: 94 accesorios eran el caso que rompía.
const EXS = [
  { id: 'ex_sent', nombre: 'Sentadilla trasera con barra', bloque: 'fuerza' },
  { id: 'ex_pm',   nombre: 'Peso muerto convencional',     bloque: 'fuerza' },
  { id: 'ex_hip',  nombre: 'Hip thrust con barra',         bloque: 'fuerza' },
  { id: 'ex_mov1', nombre: 'Cat camel',                    bloque: 'movilidad' },
  { id: 'ex_act1', nombre: 'Puente de glúteo',             bloque: 'activacion' },
  { id: 'ex_card', nombre: 'Cinta trote continuo',         bloque: 'cardio' },
  ...Array.from({ length: 94 }, (_, i) => ({
    id: `ex_acc_${i}`, nombre: `Accesorio numero ${i}`, bloque: 'accesorios' })),
];
const CLI = { nombre: 'Maicol', apellido: 'Prueba', nivel: 'activa', objetivo: 'fuerza',
  semaforo: 'verde', screening: { peso: 88 }, restricciones: 'ninguna' };
const PER = { nombre: 'Lineal', fases: [
  { nombre: 'Acumulación', reps: '8-12', intensidad: '65-75%', rir: '3' },
  { nombre: 'Fuerza', reps: '3-5', intensidad: '85-90%', rir: '1' }] };
const P = (o = {}) => armarPromptSesion({ cliente: CLI, periodizacion: PER, tests: [], exs: EXS, ...o });

console.log('\n1. TODOS los ejercicios llegan: el tope de 25 era una bomba');
{
  const t = P();
  ok(EXS.every(e => t.includes(e.id)), `los ${EXS.length} ejercicios están en el pedido`);
  ok(t.includes('ex_acc_93'), 'incluido el accesorio 94, que con el tope de 25 nunca llegaba');
  const n = listaEjerciciosIA(EXS).split('\n').filter(l => / = /.test(l)).length;
  ok(n === EXS.length, `la lista tiene ${n} renglones de ejercicio y no 25 por bloque`);
  ok(/BLOQUE "fuerza"/.test(t) && /BLOQUE "accesorios"/.test(t), 'siguen agrupados por bloque');
}

console.log('\n2. LA INSTRUCCIÓN VA AL FINAL Y CON PRIORIDAD — el arreglo');
{
  const t = P({ instrucciones: 'sin cardio, solo fuerza' });
  const pos = t.indexOf('INSTRUCCIÓN DEL PROFESIONAL PARA ESTA SESIÓN');
  ok(pos > 0, 'la instrucción tiene su propio bloque');
  // EL CONTROL QUE MÁS IMPORTA: después de la instrucción no puede quedar
  // NINGUNA regla dura. Si alguien agrega una sección al final del pedido, la
  // instrucción vuelve al medio y el problema de Manu vuelve en silencio.
  const duras = ['REGLAS ESTRICTAS', 'ESTRUCTURA DE LA SESIÓN', 'EJERCICIOS DISPONIBLES',
    'CARGAS — NO LAS CALCULES VOS', 'Respondé ÚNICAMENTE', 'REGLAS DEL PROFESIONAL'];
  const despues = duras.filter(d => t.indexOf(d) > pos);
  ok(despues.length === 0,
    `ninguna regla dura queda después de la instrucción (quedaron: ${despues.join(', ') || 'ninguna'})`);
  ok(/MÁXIMA PRIORIDAD/.test(t), 'declara máxima prioridad, como las reglas de "Entrenar IA"');
  ok(/prioridad SOBRE TODO lo anterior/.test(t), 'y que manda sobre todo lo anterior');
  ok(t.trim().endsWith(t.slice(pos).trim()), 'y el pedido TERMINA con la instrucción');
  ok(t.includes('"sin cardio, solo fuerza"'), 'el texto del profesional va entre comillas, literal');
}

console.log('\n3. Sacar y agregar bloques: lo que Manu pidió el 04/11');
{
  const t = P({ instrucciones: 'sin cardio' });
  ok(/Si pide SACAR un bloque/.test(t), 'el pedido autoriza explícitamente sacar un bloque');
  ok(/Si pide AGREGAR un bloque/.test(t), 'y agregar uno');
  ok(/El ORDEN no se altera/.test(t),
    'pero el ORDEN sigue fijo: se cambia qué bloques entran, no la secuencia');
  ok(!/ESTRUCTURA OBLIGATORIA/.test(t),
    'y ya no dice "ESTRUCTURA OBLIGATORIA", que era la orden que le ganaba a Manu');
}

console.log('\n4. Lo único que la instrucción NO puede hacer');
{
  const t = P({ instrucciones: 'incluí la prensa inclinada 45 grados' });
  ok(/Inventar un id de ejercicio que no esté en la lista/.test(t),
    'inventar un ejercicio que no existe sigue prohibido, incluso para cumplir la instrucción');
  ok(/elegí el más parecido de la lista/.test(t),
    'y dice qué hacer en su lugar: no puede quedar en silencio');
  ok(/decilo en el\s+razonamiento/.test(t), 'y que lo aclare en el razonamiento');
}

console.log('\n5. Un ejercicio nombrado se encuentra entre 100 renglones');
{
  const ids = ejerciciosNombrados('incluí hip thrust y sacá el peso muerto', EXS);
  ok(ids.includes('ex_hip'), 'detecta "Hip thrust con barra" con sólo "hip thrust"');
  ok(ids.includes('ex_pm'),
    'y "Peso muerto convencional" con sólo "peso muerto": nadie escribe el nombre de catálogo');
  ok(!ids.includes('ex_sent'), 'y no arrastra la sentadilla, que no se nombró');
}
{
  // EL FALSO POSITIVO QUE EL MÍNIMO DE 8 CARACTERES EVITA.
  const corto = [{ id: 'p1', nombre: 'Press banca con barra', bloque: 'fuerza' },
                 { id: 'p2', nombre: 'Press militar', bloque: 'fuerza' }];
  ok(ejerciciosNombrados('sin press', corto).length === 0,
    '"sin press" no marca las variantes de press: 5 letras no alcanzan para saber cuál');
  ok(ejerciciosNombrados('sin press banca', corto).map(x=>x).join() === 'p1',
    'pero "press banca" sí marca la de banca, y sólo ésa');
}
{
  // Un prefijo ambiguo marca TODAS las variantes, y es lo correcto para quitar.
  const varios = [{ id: 'm1', nombre: 'Peso muerto convencional', bloque: 'fuerza' },
                  { id: 'm2', nombre: 'Peso muerto rumano', bloque: 'fuerza' },
                  { id: 'm3', nombre: 'Sentadilla trasera', bloque: 'fuerza' }];
  const ids = ejerciciosNombrados('sin peso muerto', varios);
  ok(ids.length === 2 && ids.includes('m1') && ids.includes('m2'),
    '"sin peso muerto" marca las DOS variantes: casi seguro quiso decir todas');
  ok(!ids.includes('m3'), 'y no la sentadilla');
}
{
  const t = P({ instrucciones: 'sacá la sentadilla' });
  ok(/ex_sent = Sentadilla trasera con barra\s+⟵/.test(t),
    '"sacá la sentadilla" alcanza para marcar "Sentadilla trasera con barra"');
}
{
  const ids = ejerciciosNombrados('inclui hip thrust', EXS);
  ok(ids.includes('ex_hip'), 'y lo detecta sin tildes: la base mezcla "Bíceps" con "Biceps"');
  const t = P({ instrucciones: 'inclui hip thrust' });
  ok(/ex_hip = Hip thrust con barra\s+⟵ NOMBRADO EN LA INSTRUCCIÓN/.test(t),
    'queda MARCADO en la lista: no alcanza con que esté si queda sepultado entre 100 renglones');
  ok(/La instrucción nombra estos ejercicios/.test(t) && /ex_hip/.test(t.slice(t.indexOf('MÁXIMA PRIORIDAD'))),
    'y se repite en el bloque de prioridad');
}
{
  ok(ejerciciosNombrados('', EXS).length === 0, 'sin instrucción no nombra nada');
  ok(ejerciciosNombrados('más unilateral', EXS).length === 0,
    'una instrucción de énfasis no nombra ejercicios y no marca nada');
  ok(ejerciciosNombrados('hip thrust', []).length === 0, 'sin catálogo no explota');
}

console.log('\n6. Sin instrucción, nada cambia respecto de antes');
{
  const t = P();
  ok(!/MÁXIMA PRIORIDAD/.test(t), 'no aparece el bloque de prioridad');
  ok(!/Instrucciones adicionales/.test(t),
    'ni la línea vieja: se saca del medio en lugar de quedar duplicada');
  ok(/REGLAS ESTRICTAS/.test(t) && /Respondé ÚNICAMENTE/.test(t), 'el resto del pedido sigue igual');
  ok(bloqueInstruccion('') === '' && bloqueInstruccion('   ') === '',
    'una instrucción vacía o en blanco no agrega un bloque fantasma');
}

console.log('\n7. Lo que ya funcionaba sigue funcionando');
{
  const t = P({ reglas: [{ activo: true, ambito: 'entrenamiento', regla: 'Nunca más de 3 series las primeras 2 semanas' }] });
  ok(/Nunca más de 3 series/.test(t), 'las reglas permanentes de "Entrenar IA" siguen llegando');
  ok(/obligatorias, tienen prioridad sobre criterios genéricos/.test(t), 'con su cartel de prioridad');
}
{
  const t = P({ reglas: [{ activo: false, ambito: 'entrenamiento', regla: 'Regla apagada' }] });
  ok(!/Regla apagada/.test(t), 'una regla desactivada no se manda');
}
{
  const t = P({ reglas: [{ activo: true, ambito: 'nutricion', regla: 'Regla de otro ambito' }] });
  ok(!/Regla de otro ambito/.test(t), 'ni una de otro ámbito');
}
{
  const t = P({ faseIndex: 1 });
  ok(/ADELANTANDO trabajo/.test(t), 'el aviso de fase adelantada sigue');
  ok(/Fase 2\/2 — Fuerza/.test(t), 'con la fase correcta y no la inicial');
}
{
  const t = P({ ejecucion: ['Sentadilla: 100 kg x 5 (sem 3)'] });
  ok(/CARGAS REALES QUE EL CLIENTE EJECUTÓ/.test(t), 'las cargas reales del portal siguen llegando');
}
{
  const t = P({ historial: [{ es_ejemplo: true, nombre: 'Plan modelo', estado: 'activo' }] });
  ok(/★ EJEMPLO/.test(t), 'y los planes marcados como ejemplo');
}

console.log('\n8. No explota con datos faltantes');
{
  ok(armarPromptSesion().length > 100, 'sin ningún argumento devuelve un pedido, no un error');
  ok(armarPromptSesion({ exs: null, instrucciones: 'sin cardio' }).includes('MÁXIMA PRIORIDAD'),
    'sin catálogo la instrucción llega igual');
  ok(listaEjerciciosIA([{ nombre: 'sin id' }]) === '', 'un ejercicio sin id se ignora');
  ok(/BLOQUE "sin_bloque"/.test(listaEjerciciosIA([{ id: 'x', nombre: 'Suelto' }])),
    'uno sin bloque cae en "sin_bloque" en lugar de desaparecer');
}

console.log(fallos === 0 ? '\n✅ pedido de sesión: todo pasa\n' : `\n❌ pedido de sesión: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
