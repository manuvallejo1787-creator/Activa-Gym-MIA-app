// qa/altaClinica.mjs — la transición de clínica a sala
//
// POR QUÉ EXISTE
// Manu, 19/11/2026: "la IA debe poder reconocer que un cliente estaba en
// tratamiento —qué lesión trataba y qué estuvo haciendo, leyendo su plan
// clínico— para que al transferirlo a la planificación en sala contemple esas
// cosas y las añada de preventivo".
//
// `fisio_planes_clinicos.fases_detalle` ya guardaba, por región: el tejido
// lesionado, la EVA inicial, las tres fases clínicas con su objetivo, sus
// criterios de salida, su dosificación y sus ejercicios, y el rango de semanas
// de cada una. Y NADIE lo leía al planificar en sala.
//
// LA PRUEBA QUE MÁS IMPORTA ES LA 2: que NUNCA se arrastre R0. Arrastrar
// isometrías submáximas y crioterapia a un plan de gimnasio es arrastrar lo
// que se hace cuando NO se puede cargar, justo cuando ya se puede.
import { resumenClinico, faseVigente, semanaDeTratamiento, bloquePreventivo,
         textoClinicoParaIA, candidatosASala, repartirPreventivos } from '../src/altaClinica.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// Imita la forma real de fases_detalle, verificada contra la base el 19/11.
const fase = (f, badge, label, desde, hasta, ejs, extra = {}) => ({
  fase: f, badge, label, semanaDesde: desde, semanaHasta: hasta, semanas: hasta - desde + 1,
  objetivo: `objetivo de ${label}`,
  criterios: [`criterio 1 de ${badge}`, `criterio 2 de ${badge}`],
  dosis: { series: 3, reps: '8-15', descanso: '90 seg', carga: 'progresiva',
           intencion: `intención de ${badge}`, frecuencia: '3/sem' },
  ejercicios: ejs.map((n, i) => ({ id: `prot_hombro_${f}_${i}`, nombre: n, region: 'hombro', fase: f, origen: 'catálogo' })),
  ...extra,
});
const REGION = {
  region: 'hombro', tejido: 'Lesión supraespinoso', eva: '10', fechaEval: '2026-09-01',
  objetivo: 'volver a press sobre cabeza', faseInicial: 'proteccion', evaluacionId: 'ev1',
  fases: [
    fase('proteccion', 'R0', 'Protección / Fase Aguda', 1, 5,
      ['Péndulo de Codman', 'Isométrico de hombro en posición neutra', 'Crioterapia post-actividad']),
    fase('carga_progresiva', 'R1', 'Carga Progresiva', 6, 10,
      ['Rotación externa con banda', 'Scaption en plano escapular', 'Y/T/W en banco inclinado', 'Retracción escapular con banda']),
    fase('retorno_funcion', 'R2', 'Retorno Funcional', 11, 12,
      ['Press de hombro con mancuerna', 'Rotación externa a 90° abducción', 'Entrenamiento excéntrico manguito']),
  ],
};
const PLAN = (o = {}) => ({ id: 'planc1', paciente_id: 'pac1', fecha_inicio: '2026-09-08',
  semanas: 12, estado: 'activo', fases_detalle: [REGION], ...o });

console.log('\n1. En qué semana de tratamiento está');
{
  ok(semanaDeTratamiento('2026-09-08', '2026-09-08') === 1, 'el día de inicio es la semana 1');
  ok(semanaDeTratamiento('2026-09-08', '2026-09-14') === 1, 'el día 7 sigue siendo la semana 1');
  ok(semanaDeTratamiento('2026-09-08', '2026-09-15') === 2, 'el día 8 ya es la semana 2');
  ok(semanaDeTratamiento('2026-09-08', '2026-11-19') === 11, 'el 19/11 es la semana 11 de ese plan');
  ok(semanaDeTratamiento(null, '2026-11-19') === null, 'sin fecha de inicio no inventa una semana');
  ok(semanaDeTratamiento('2026-12-01', '2026-11-19') === null, 'una fecha futura no da semana negativa');
}

console.log('\n2. NUNCA SE ARRASTRA R0 — la prueba que más importa');
{
  // Semana 11 → R2. Es el caso real del plan que Manu tiene cargado.
  const f = faseVigente(REGION, '2026-09-08', '2026-11-19');
  ok(f.badge === 'R2', `en la semana 11 la fase vigente es R2 (dio ${f.badge})`);
  ok(!f.ejercicios.some(e => /Crioterapia|Codman|Isométrico/.test(e.nombre)),
    'y sus ejercicios NO son los de protección');
}
{
  const f = faseVigente(REGION, '2026-09-08', '2026-10-15');
  ok(f.badge === 'R1', `en la semana 6 la fase vigente es R1 (dio ${f.badge})`);
}
{
  // Plan terminado: se arrastra la ÚLTIMA fase, no la primera.
  const f = faseVigente(REGION, '2026-01-01', '2026-11-19');
  ok(f.badge === 'R2', 'terminado el plan se arrastra la última fase, no se vuelve a R0');
}
{
  // Barrido: en NINGUNA semana, ni antes ni mucho después, puede salir R0
  // como fase a arrastrar al gimnasio una vez pasada su propia ventana.
  const malas = [];
  for (let sem = 6; sem <= 40; sem++) {
    const hoy = new Date(new Date('2026-09-08T12:00') .getTime() + (sem - 1) * 7 * 864e5)
      .toISOString().slice(0, 10);
    const f = faseVigente(REGION, '2026-09-08', hoy);
    if (f.badge === 'R0') malas.push(sem);
  }
  ok(malas.length === 0, `pasada su ventana, R0 no vuelve a aparecer en ninguna semana (apareció en: ${malas.join(', ') || 'ninguna'})`);
}
{
  ok(faseVigente({ fases: [] }, '2026-09-08') === null, 'una región sin fases devuelve null');
  ok(faseVigente({}, null) === null, 'y una región vacía tampoco explota');
}

console.log('\n3. El resumen que leen la IA y el preventivo');
{
  const [r] = resumenClinico({ planes: [PLAN()], pacienteId: 'pac1', hoy: '2026-11-19' });
  ok(!!r, 'devuelve una entrada por región');
  ok(r.tejido === 'Lesión supraespinoso', 'con el tejido tratado');
  ok(r.faseBadge === 'R2', 'y la fase vigente');
  ok(r.semanaActual === 11 && r.semanasTotales === 12, 'y en qué semana de cuántas va');
  ok(r.pasoElPlazo === false, 'y que todavía no pasó el plazo');
  ok(r.criterios.length === 2, 'con los criterios para avanzar');
  ok(r.ejercicios.length === 3, 'y los ejercicios de ESA fase');
  ok(r.regionRehab === 'hombro', 'y la región traducida a la biblioteca de rehab');
}
{
  const [r] = resumenClinico({ planes: [PLAN({ fecha_inicio: '2026-01-01' })], pacienteId: 'pac1', hoy: '2026-11-19' });
  ok(r.pasoElPlazo === true, 'un plan que pasó su plazo lo declara: es el único dato objetivo que hay');
}
{
  ok(resumenClinico({ planes: [PLAN()], pacienteId: 'OTRO' }).length === 0,
    'el plan de otro paciente no se mezcla');
  ok(resumenClinico({}).length === 0, 'sin planes devuelve vacío');
  ok(resumenClinico({ planes: [{ id: 'x' }] }).length === 0, 'un plan sin fases_detalle se ignora');
  ok(resumenClinico({ planes: [PLAN({ fases_detalle: [{ fases: [] }] })] }).length === 0,
    'una región sin nombre se ignora');
}

console.log('\n4. El bloque preventivo');
{
  const [r] = resumenClinico({ planes: [PLAN()], pacienteId: 'pac1', hoy: '2026-11-19' });
  const b = bloquePreventivo(r);
  ok(!!b, 'se arma el bloque');
  ok(b.origen === 'alta_clinica', 'marcado como venido del alta clínica');
  ok(b.exercises.length === 3, 'con sus ejercicios');
  ok(b.exercises[0].nombre === 'Press de hombro con mancuerna',
    'el NOMBRE viaja adentro: estos ejercicios no están en la tabla `ejercicios`');
  ok(/Lesión supraespinoso/.test(b.nota), 'la nota dice qué tejido se trató');
  ok(/mantener mientras el tejido consolida/.test(b.nota), 'y por qué sigue');
  ok(b.planId === 'planc1', 'queda atado al plan clínico que lo originó');
}
{
  // EL TOPE: un preventivo que no se termina no previene nada.
  const r = { region: 'hombro', faseLabel: 'R1', dosis: {},
    ejercicios: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, nombre: `Ej ${i}` })) };
  ok(bloquePreventivo(r).exercises.length === 3,
    'se topea en 3 ejercicios: el preventivo va ADEMÁS del entreno, no en su lugar');
  ok(bloquePreventivo(r, 2).exercises.length === 2, 'y el tope es editable');
}
{
  ok(bloquePreventivo({ ejercicios: [] }) === null, 'sin ejercicios no hay bloque');
  ok(bloquePreventivo(null) === null, 'ni con un resumen nulo');
}

console.log('\n5. Lo que lee la IA');
{
  const rs = resumenClinico({ planes: [PLAN()], pacienteId: 'pac1', hoy: '2026-11-19' });
  const t = textoClinicoParaIA(rs);
  ok(/TRATAMIENTO CLÍNICO DE ESTE CLIENTE/.test(t), 'tiene su propio encabezado');
  ok(/HOMBRO — Lesión supraespinoso/.test(t), 'nombra la región Y el tejido');
  ok(/R2 Retorno Funcional/.test(t), 'y la fase en que quedó');
  ok(/semana 11 de 12/.test(t), 'y en qué semana va');
  ok(/Estuvo haciendo: Press de hombro con mancuerna/.test(t),
    'y QUÉ ESTUVO HACIENDO, que es lo que Manu pidió textualmente');
  ok(/Criterios para avanzar de fase/.test(t), 'y qué falta para avanzar');
  ok(/trabajo PREVENTIVO de esas regiones/.test(t), 'le ordena incluir preventivo');
  ok(/aunque el cliente ya esté habilitado/.test(t),
    'incluso con el alta dada: el tejido sigue consolidando');
  ok(/NO elijas ejercicios que reproduzcan el gesto agresor/.test(t), 'y qué NO hacer');
  ok(/variante más estable/.test(t), 'con la salida cuando el patrón es inevitable');
  ok(/no en su lugar/.test(t), 'y que el preventivo no reemplaza el entrenamiento');
}
{
  ok(textoClinicoParaIA([]) === '', 'sin tratamiento no agrega nada al pedido');
  ok(textoClinicoParaIA(null) === '', 'ni con la lista nula');
  ok(textoClinicoParaIA([null]) === '', 'ni con entradas nulas');
}

console.log('\n6. Varias regiones a la vez — el caso real tiene 4');
{
  const multi = PLAN({ fases_detalle: [
    REGION,
    { ...REGION, region: 'cervical', tejido: 'Cervicalgia mecánica' },
    { ...REGION, region: 'codo', tejido: 'Epicondilitis' },
  ] });
  const rs = resumenClinico({ planes: [multi], pacienteId: 'pac1', hoy: '2026-11-19' });
  ok(rs.length === 3, 'devuelve las 3 regiones');
  const t = textoClinicoParaIA(rs);
  ok(/CERVICAL/.test(t) && /CODO/.test(t) && /HOMBRO/.test(t), 'y las 3 llegan al pedido');
  const bs = rs.map(r => bloquePreventivo(r)).filter(Boolean);
  ok(bs.length === 3, 'con un bloque preventivo cada una');
  ok(bs.reduce((s, b) => s + b.exercises.length, 0) === 9,
    '9 ejercicios preventivos en total — por eso el tope por región importa');
}

console.log('\n7. Candidatos a pasar de la clínica a la sala');
{
  // El caso real: Natalia Cabrera, semana 11 de 12, cuatro regiones, y NO es
  // cliente del gimnasio. Sin esto, toda la transición no se dispara para el
  // único caso que existe en la base.
  const pacs = [{ id: 'pac1', nombre: 'Natalia', apellido: 'Cabrera' }];
  const c = candidatosASala({ planes: [PLAN()], pacientes: pacs, clientes: [], hoy: '2026-11-19' });
  ok(c.length === 1, 'aparece el paciente que está por terminar y no es cliente del gym');
  ok(c[0].nombre === 'Natalia Cabrera', 'con su nombre');
  ok(c[0].semanasRestantes === 1 && c[0].termino === false, 'y cuántas semanas le faltan');
  ok(c[0].clinico.length === 1, 'con el resumen clínico ya calculado para ver qué se arrastra');
}
{
  const ya = [{ id: 'c1', fisio_paciente_id: 'pac1' }];
  ok(candidatosASala({ planes: [PLAN()], clientes: ya, hoy: '2026-11-19' }).length === 0,
    'un paciente que YA tiene su cliente del gym no se ofrece');
}
{
  // Semana 3 de 12: está en tratamiento. Ofrecer pasarlo a sala ahora sería
  // apurar un alta que no dio el fisio.
  ok(candidatosASala({ planes: [PLAN()], clientes: [], hoy: '2026-09-22' }).length === 0,
    'en plena mitad del tratamiento NO se ofrece: no se apura un alta');
}
{
  const c = candidatosASala({ planes: [PLAN({ fecha_inicio: '2026-01-01' })], clientes: [], hoy: '2026-11-19' });
  ok(c.length === 1 && c[0].termino === true, 'un plan que ya terminó sí se ofrece, marcado como terminado');
}
{
  ok(candidatosASala({}).length === 0, 'sin planes no hay candidatos');
  ok(candidatosASala({ planes: [PLAN({ semanas: null })], clientes: [] }).length === 0,
    'un plan sin duracion no se puede evaluar y no se inventa');
  ok(candidatosASala({ planes: [PLAN()], clientes: [], hoy: '2026-11-19', avisoSemanas: 0 }).length === 0,
    'la ventana del aviso es editable');
}

console.log('\n8. REPARTIR EL PREVENTIVO ENTRE LOS DÍAS — el caso real lo rompía');
{
  // Natalia Cabrera tiene 4 regiones. Con 3 por región eran 12 ejercicios al
  // principio de CADA día: una sesión entera de preventivo antes de entrenar.
  const bs = ['hombro','codo','cervical','muneca'].map(r => ({
    region: r, exercises: [{ exId: r+'1' }, { exId: r+'2' }, { exId: r+'3' }] }));
  const porDia = repartirPreventivos(bs, 3, 2);
  ok(porDia.length === 3, 'devuelve un reparto por día');
  ok(porDia.every(d => d.length <= 2), `ningún día lleva más de 2 bloques (llevaron ${porDia.map(d=>d.length).join('/')})`);
  const total = porDia.reduce((n,d)=>n+d.length,0);
  ok(total === 4, 'y las 4 regiones se reparten: ninguna se pierde');
  const ejsPorDia = porDia.map(d => d.reduce((n,b)=>n+b.exercises.length,0));
  ok(Math.max(...ejsPorDia) <= 6, `el día más cargado lleva ${Math.max(...ejsPorDia)} ejercicios preventivos, no 12`);
  const cubiertas = new Set(porDia.flat().map(b=>b.region));
  ok(cubiertas.size === 4, 'y la semana cubre las cuatro zonas tratadas');
}
{
  // Con 1 región y 3 días, no se repite para rellenar.
  const porDia = repartirPreventivos([{ region:'hombro', exercises:[{exId:'a'}] }], 3, 2);
  ok(porDia[0].length === 1 && porDia[1].length === 0 && porDia[2].length === 0,
    'una sola región va a un día y los otros quedan sin preventivo: no se repite para rellenar');
}
{
  // Más bloques que capacidad: el que no entra en su día va al primero libre,
  // así no se pierde una región por el orden en que vino.
  const bs = Array.from({length:5},(_,i)=>({region:'r'+i, exercises:[{exId:'e'+i}]}));
  const porDia = repartirPreventivos(bs, 2, 2);
  ok(porDia.flat().length === 4, 'con 2 días y tope 2 entran 4 de 5');
  ok(porDia.every(d=>d.length<=2), 'y ninguno se pasa del tope');
}
{
  ok(repartirPreventivos([], 3).length === 3, 'sin preventivos devuelve días vacíos');
  ok(repartirPreventivos(null, 3).every(d=>d.length===0), 'con la lista nula tampoco explota');
  ok(repartirPreventivos([{region:'x',exercises:[]}], 3).flat().length === 0,
    'un bloque sin ejercicios no ocupa lugar');
  ok(repartirPreventivos([{region:'x',exercises:[{exId:'a'}]}], 0).length === 1,
    'con 0 días devuelve al menos uno en lugar de un array vacío');
}

console.log(fallos === 0 ? '\n✅ alta clínica: todo pasa\n' : `\n❌ alta clínica: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
