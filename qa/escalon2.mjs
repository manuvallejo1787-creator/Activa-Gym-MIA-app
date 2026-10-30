// qa/escalon2.mjs — el bloque dirigido que no toca el plan
//
// POR QUÉ EXISTE
// El escalón 2 era una etiqueta. El estado `programa` se podía setear, cambiaba
// el texto de la tarjeta y liberaba el bloqueo del patrón — y no creaba ningún
// bloque dirigido en ningún plan. REHAB_DB tenía 10 regiones de ejercicios y lo
// único que hacía era imprimir un PDF desconectado del riel y del plan de gym.
//
// Lo que estas pruebas protegen es la decisión de Manu del 30/10: el bloque se
// inserta SIN borrar la rutina original. Si alguna vez la composición empieza a
// mutar el plan recibido, el día que falle el camino de vuelta el plan de un
// cliente queda con un bloque de rehab pegado para siempre — y nadie se
// enteraría, porque el plan se vería normal.
import { componerPlan, bloqueoDe, mensajeBloqueo, indexarReentradas } from '../src/superposicion.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

const PLAN = () => ({
  id: 'plan1', nombre: 'Bloque 1',
  dias: [
    { id: 'd1', name: 'Día 1 — Empuje', blocks: [
      { type: 'Principal', exercises: [{ exId: 'ex_press', params: { series: 4, reps: '8' } },
                                       { exId: 'ex_fondos', params: { series: 3, reps: '10' } }] },
    ] },
    { id: 'd2', name: 'Día 2 — Pierna', blocks: [
      { type: 'Principal', exercises: [{ exId: 'ex_sentadilla', params: { series: 4, reps: '6' } }] },
    ] },
  ],
});

const fila = (o = {}) => ({
  incidencia_id: 'inc1', gym_client_id: 'c1', estado: 'valoracion_pendiente',
  zona: 'hombro_der', escalon: 1, patron_bloqueado: ['ex_press'], patron_dias: [],
  bloque_dirigido: null, bloquea_carga: true, suma_bloque: false,
  motivo: 'molestia reportada en hombro_der', ...o,
});

const BLOQUE = {
  region: 'Hombro', fase: 'Protección', nota: 'Suspender si el dolor supera 4/10',
  exercises: [
    { exId: 'rh_a01', nombre: 'Isométrico rotadores externos', desc: 'Codo a 90°, banda', series: 3, reps: '10 × 5 seg', notas: 'sin dolor' },
    { exId: 'rh_a02', nombre: 'Pendular de Codman', desc: 'Tronco inclinado', series: 2, reps: '60 seg' },
  ],
};

console.log('\n1. LA REGLA QUE NO SE PUEDE ROMPER: el plan original no se muta');
{
  const original = PLAN();
  const copia = JSON.parse(JSON.stringify(original));
  const r = componerPlan({ plan: original, superposicion: [fila({ suma_bloque: true, bloque_dirigido: BLOQUE, estado: 'programa', bloquea_carga: false })] });
  ok(JSON.stringify(original) === JSON.stringify(copia),
    'componerPlan NO toca el plan que recibe: si lo mutara, un fallo del camino de vuelta dejaría el plan pegado para siempre');
  ok(r.plan !== original, 'devuelve un plan nuevo');
  ok(r.plan.dias[0].blocks.length === 2 && original.dias[0].blocks.length === 1,
    'el bloque se agregó en la copia y no en el original');
}

console.log('\n2. El ejercicio bloqueado queda VISIBLE y marcado, no borrado');
{
  const r = componerPlan({ plan: PLAN(), superposicion: [fila()] });
  const d1 = r.plan.dias[0].blocks[0].exercises;
  ok(d1.length === 2, 'el día sigue teniendo sus dos ejercicios: no se borra nada');
  ok(!!d1[0].bloqueado, 'el press queda marcado como bloqueado');
  ok(d1[0].bloqueado.zona === 'hombro_der', 'con la zona, para poder explicar el motivo');
  ok(d1[0].bloqueado.escalon === 1 && d1[0].bloqueado.estado === 'valoracion_pendiente',
    'y con el escalón y el estado del riel');
  ok(!d1[1].bloqueado, 'los fondos no quedan bloqueados: se bloquea el patrón indicado, no el día');
  ok(!r.plan.dias[1].blocks[0].exercises[0].bloqueado,
    'y la sentadilla del día 2 tampoco');
  ok(Object.keys(r.bloqueados).length === 1, 'el índice de bloqueados tiene una entrada');
}

console.log('\n3. patron_dias: vacío es TODOS los días');
{
  // Un dolor de rodilla no distingue entre el día de pierna y el día full body.
  const r = componerPlan({ plan: PLAN(), superposicion: [fila({ patron_bloqueado: ['ex_press', 'ex_sentadilla'] })] });
  ok(!!r.plan.dias[0].blocks[0].exercises[0].bloqueado, 'bloquea en el día 1');
  ok(!!r.plan.dias[1].blocks[0].exercises[0].bloqueado, 'y también en el día 2');
}
{
  const r = componerPlan({ plan: PLAN(), superposicion: [fila({ patron_bloqueado: ['ex_press', 'ex_sentadilla'], patron_dias: ['d2'] })] });
  ok(!r.plan.dias[0].blocks[0].exercises[0].bloqueado, 'con patron_dias acotado NO bloquea el día 1');
  ok(!!r.plan.dias[1].blocks[0].exercises[0].bloqueado, 'y sí el día 2');
}

console.log('\n4. El bloque dirigido va AL FINAL del día, después de la rutina');
{
  const r = componerPlan({ plan: PLAN(), superposicion: [
    fila({ estado: 'programa', escalon: 2, bloquea_carga: false, suma_bloque: true, bloque_dirigido: BLOQUE }),
  ] });
  const blocks = r.plan.dias[0].blocks;
  ok(blocks.length === 2, 'se agregó un bloque');
  ok(blocks[0].type === 'Principal', 'la rutina original queda primera');
  ok(blocks[1].dirigido === true, 'y el dirigido último: "a continuación", no en lugar de');
  ok(/Hombro/.test(blocks[1].type) && /Protección/.test(blocks[1].type),
    'el título dice región y fase');
  ok(blocks[1].exercises.length === 2, 'con sus dos ejercicios');
  ok(blocks[1].exercises[0].params.reps === '10 × 5 seg',
    'y sus parámetros tal como se prescribieron');
  ok(blocks[1].notaBloque === 'Suspender si el dolor supera 4/10', 'y la indicación del bloque');
  ok(blocks[1].incidenciaId === 'inc1', 'atado a la incidencia que lo originó');
}
{
  // Los ejercicios de REHAB_DB no están en la tabla `ejercicios`: el portal
  // pinta `DATA.nombres[exId]` y sin esto mostraría "rh_a01" al cliente.
  const r = componerPlan({ plan: PLAN(), superposicion: [
    fila({ estado: 'programa', bloquea_carga: false, suma_bloque: true, bloque_dirigido: BLOQUE }),
  ] });
  ok(r.nombres.rh_a01 === 'Isométrico rotadores externos',
    'devuelve los nombres a inyectar: los de rehab viven en el código, no en la base');
  ok(r.nombres.rh_a02 === 'Pendular de Codman', 'los dos');
}
{
  const r = componerPlan({ plan: PLAN(), superposicion: [
    fila({ estado: 'programa', bloquea_carga: false, suma_bloque: true,
           bloque_dirigido: { ...BLOQUE, exercises: [] } }),
  ] });
  ok(r.plan.dias[0].blocks.length === 1,
    'un bloque dirigido sin ejercicios no agrega un bloque vacío al plan');
}

console.log('\n5. Bloquear y agregar a la vez: el caso del escalón 2 real');
{
  // El press bloqueado y el bloque de hombro agregado, en la misma pasada.
  const r = componerPlan({ plan: PLAN(), superposicion: [
    fila({ bloquea_carga: true, patron_bloqueado: ['ex_press'] }),
    fila({ incidencia_id: 'inc2', estado: 'programa', escalon: 2, bloquea_carga: false,
           suma_bloque: true, bloque_dirigido: BLOQUE }),
  ] });
  const d1 = r.plan.dias[0];
  ok(!!d1.blocks[0].exercises[0].bloqueado, 'el press queda bloqueado');
  ok(d1.blocks[1].dirigido === true, 'y el bloque dirigido aparece a continuación');
  ok(d1.blocks[0].exercises.length === 2, 'sin perder ningún ejercicio de la rutina');
}

console.log('\n6. El rechazo de la escritura, que es la barrera que importa');
{
  const sup = [fila()];
  ok(!!bloqueoDe(sup, 'ex_press', 'd1'), 'un ejercicio bloqueado se detecta');
  ok(!bloqueoDe(sup, 'ex_fondos', 'd1'), 'uno que no está en el patrón, no');
  ok(!bloqueoDe(sup, null, 'd1'), 'sin ejercicio_id no bloquea nada');
  ok(!!bloqueoDe(sup, 'ex_press'), 'sin día indicado alcanza con que la fila bloquee');
}
{
  // `programa` NO bloquea: tiene el bloque dirigido corriendo, que es trabajo
  // específico, no ausencia de trabajo. La vista lo decide con bloquea_carga.
  const sup = [fila({ estado: 'programa', bloquea_carga: false, suma_bloque: true, bloque_dirigido: BLOQUE })];
  ok(!bloqueoDe(sup, 'ex_press', 'd1'),
    'en programa la carga NO se rechaza: el escalón 2 es trabajo dirigido, no un freno');
}
{
  const sup = [fila({ patron_dias: ['d2'] })];
  ok(!bloqueoDe(sup, 'ex_press', 'd1'), 'respeta patron_dias en el rechazo igual que en la composición');
  ok(!!bloqueoDe(sup, 'ex_press', 'd2'), 'y bloquea en el día que corresponde');
}
{
  const m = mensajeBloqueo(fila());
  ok(/hombro der/.test(m), 'el mensaje al cliente nombra la zona en texto, sin guión bajo');
  ok(/bloque dirigido/.test(m), 'y le dice qué hacer en su lugar');
  ok(!/error/i.test(m),
    'y NO dice "error": el cliente reportó una molestia y el centro tomó una conducta');
}

console.log('\n7. Casos borde: la superposición no puede tirar el portal');
{
  ok(componerPlan({}).plan === undefined, 'sin plan devuelve sin plan, no explota');
  ok(componerPlan({ plan: PLAN() }).plan.dias.length === 2, 'sin superposición el plan pasa igual');
  ok(Object.keys(componerPlan({ plan: PLAN(), superposicion: null }).bloqueados).length === 0,
    'superposición null no rompe');
  ok(componerPlan({ plan: { id: 'x' }, superposicion: [fila()] }).plan.id === 'x',
    'un plan sin días pasa tal cual');
  const conNulos = componerPlan({ plan: PLAN(), superposicion: [null, fila()] });
  ok(Object.keys(conNulos.bloqueados).length === 1, 'una fila nula se ignora sin tirar el resto');
  ok(bloqueoDe(null, 'ex_press', 'd1') === null, 'bloqueoDe con lista nula devuelve null');
}
{
  // Dos incidencias bloqueando el MISMO ejercicio: un solo motivo en pantalla.
  const r = componerPlan({ plan: PLAN(), superposicion: [
    fila({ incidencia_id: 'a', zona: 'hombro_der' }),
    fila({ incidencia_id: 'b', zona: 'hombro_izq' }),
  ] });
  ok(r.plan.dias[0].blocks[0].exercises[0].bloqueado.incidenciaId === 'a',
    'gana la primera: dos motivos para un ejercicio no ayudan a nadie en un celular');
}

console.log('\n8. El índice de reentradas');
{
  const idx = indexarReentradas([
    { ejercicio_id: 'ex_press', incidencia_id: 'inc1', zona: 'hombro_der',
      liberado_el: '2026-10-25', pct: '60', sesiones_req: 2, sesiones_hechas: 1, sesiones_restantes: 1 },
  ]);
  ok(idx.ex_press.pct === 60, 'el pct llega como número, no como texto de PostgREST');
  ok(idx.ex_press.sesiones_restantes === 1, 'y las sesiones que faltan');
  ok(Object.keys(indexarReentradas([])).length === 0, 'lista vacía da índice vacío');
  ok(Object.keys(indexarReentradas(null)).length === 0, 'null también');
  ok(Object.keys(indexarReentradas([{ pct: 60 }])).length === 0, 'una fila sin ejercicio_id se ignora');
}

console.log(fallos === 0 ? '\n✅ escalón 2: todo pasa\n' : `\n❌ escalón 2: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
