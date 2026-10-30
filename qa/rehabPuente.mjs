// qa/rehabPuente.mjs — el puente entre el riel del gym y la biblioteca de rehab
//
// POR QUÉ EXISTE
// Este archivo es la cicatriz de tres desconexiones que aparecieron el 30/10 al
// conectar el escalón 2, y las pruebas están para que no se cierren mal:
//
//   · dos vocabularios de fase llamados los dos `FASES_REHAB`, uno por
//     calendario (el de la biblioteca) y otro por criterios (el del método)
//   · nueve zonas del portal contra diez regiones de rehab, con otro corte
//   · ningún mapa de zona → ejercicio del plan, que es correcto: eso lo decide
//     el profesional, y lo que hay acá es una sugerencia
//
// La prueba que más importa es la 4: que `sugerirPatronBloqueado` SUGIERA y no
// decida. El día que alguien la convierta en la lista definitiva, la app estará
// tomando una conducta clínica sola.
import { FASE_CLINICA_A_LIBRERIA, regionDeZona, sugerirPatronBloqueado,
         ejerciciosDelPlan, armarBloqueDirigido } from '../src/rehabPuente.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

console.log('\n1. Las dos fases: la pantalla habla por criterios, la biblioteca responde por calendario');
{
  // Las claves de la izquierda son las de criterios.js (R0/R1/R2); las de la
  // derecha, las que indexan REHAB_DB en App.jsx:165.
  ok(FASE_CLINICA_A_LIBRERIA.proteccion === 'aguda', 'R0 protección → aguda');
  ok(FASE_CLINICA_A_LIBRERIA.carga_progresiva === 'subaguda', 'R1 carga progresiva → subaguda');
  ok(FASE_CLINICA_A_LIBRERIA.retorno_funcion === 'cronica', 'R2 retorno funcional → crónica');
  ok(Object.keys(FASE_CLINICA_A_LIBRERIA).length === 3,
    'las tres y nada más: si aparece una cuarta clave hay que mirar de dónde salió');
}

console.log('\n2. Zona del portal → región de rehab');
{
  ok(regionDeZona('rodilla_izq') === 'rodilla', 'el lado se descarta: la biblioteca no distingue izquierda de derecha');
  ok(regionDeZona('rodilla_der') === 'rodilla', 'ni el otro lado');
  ok(regionDeZona('hombro_ambos') === 'hombro', 'ni "ambos"');
  ok(regionDeZona('lumbar') === 'lumbar', 'una zona sin lado pasa directo');
  ok(regionDeZona('cuello') === 'cervical', 'cuello → cervical: la única que cambia de nombre');
  ok(regionDeZona('muneca_izq') === 'muneca', 'muñeca sin tilde en la clave, como la escribe el portal');
  ok(regionDeZona('') === '' && regionDeZona(null) === '', 'sin zona devuelve vacío, no explota');
  ok(regionDeZona('inventada') === '', 'una zona desconocida no inventa una región');
  // Las 9 zonas del portal tienen que tener región, o el escalón 2 quedaría
  // inalcanzable para la que falte.
  const ZONAS_PORTAL = ['cuello','hombro','codo','muneca','dorsal','lumbar','cadera','rodilla','tobillo'];
  const sinRegion = ZONAS_PORTAL.filter(z => !regionDeZona(z));
  ok(sinRegion.length === 0, `las 9 zonas del portal tienen región de rehab (faltan: ${sinRegion.join(', ') || 'ninguna'})`);
}

console.log('\n3. Los ejercicios del plan, sin repetidos');
{
  const planes = [{
    id: 'p1', dias: [
      { id: 'd1', name: 'Empuje', blocks: [{ exercises: [{ exId: 'a' }, { exId: 'b' }] }] },
      { id: 'd2', name: 'Pierna', blocks: [{ exercises: [{ exId: 'c' }, { exId: 'a' }] }] },
    ],
  }];
  const nom = { a: 'Press banca con barra', b: 'Remo con barra', c: 'Sentadilla trasera' };
  const out = ejerciciosDelPlan(planes, id => nom[id]);
  ok(out.length === 3, 'tres ejercicios distintos aunque el press aparezca en dos días');
  ok(out[0].nombre === 'Press banca con barra', 'con el nombre resuelto y no el id');
  ok(out[0].diaNombre === 'Empuje', 'y el día donde apareció primero');
  ok(ejerciciosDelPlan([], () => '').length === 0, 'sin planes devuelve vacío');
  ok(ejerciciosDelPlan(null).length === 0, 'planes null no rompe');
  const sinNombre = ejerciciosDelPlan(planes, () => '');
  ok(sinNombre[0].nombre === 'a', 'sin nombre resuelto cae al id: mejor el id que vacío');
}

console.log('\n4. LA SUGERENCIA DE QUÉ BLOQUEAR — sugiere, no decide');
const PLAN_REAL = [
  { exId: 'e1', nombre: 'Press banca con barra' },
  { exId: 'e2', nombre: 'Sentadilla trasera con barra' },
  { exId: 'e3', nombre: 'Peso muerto rumano' },
  { exId: 'e4', nombre: 'Curl de bíceps con mancuernas' },
  { exId: 'e5', nombre: 'Elevación lateral' },
  { exId: 'e6', nombre: 'Prensa de piernas' },
  { exId: 'e7', nombre: 'Extensión de rodilla en máquina' },
  { exId: 'e8', nombre: 'Elevación de talones de pie' },
  { exId: 'e9', nombre: 'Remo con barra' },
  { exId: 'e10', nombre: 'Plancha frontal' },
];
{
  const r = sugerirPatronBloqueado('hombro_der', PLAN_REAL);
  ok(r.includes('e1'), 'hombro: sugiere el press de banca');
  ok(r.includes('e5'), 'y la elevación lateral');
  ok(!r.includes('e2') && !r.includes('e6'), 'y NO la sentadilla ni la prensa');
  ok(!r.includes('e10'), 'ni la plancha');
}
{
  const r = sugerirPatronBloqueado('rodilla_izq', PLAN_REAL);
  ok(r.includes('e2') && r.includes('e6') && r.includes('e7'),
    'rodilla: sentadilla, prensa y extensión de rodilla');
  ok(!r.includes('e1') && !r.includes('e4'), 'y no el press ni el curl');
}
{
  const r = sugerirPatronBloqueado('lumbar', PLAN_REAL);
  ok(r.includes('e3'), 'lumbares: el peso muerto rumano');
  ok(r.includes('e2'), 'y la sentadilla');
  ok(r.includes('e9'), 'y el remo con barra, que carga el erector en isometría');
}
{
  const r = sugerirPatronBloqueado('codo_der', PLAN_REAL);
  ok(r.includes('e4'), 'codo: el curl de bíceps');
  ok(!r.includes('e2'), 'y nada de pierna');
}
{
  const r = sugerirPatronBloqueado('tobillo_izq', PLAN_REAL);
  ok(r.includes('e8'), 'tobillo: la elevación de talones');
  ok(r.includes('e2'), 'y la sentadilla, que necesita dorsiflexión');
}
{
  ok(sugerirPatronBloqueado('', PLAN_REAL).length === 0, 'sin zona no sugiere nada');
  ok(sugerirPatronBloqueado('inventada', PLAN_REAL).length === 0, 'una zona desconocida no sugiere nada');
  ok(sugerirPatronBloqueado('rodilla', []).length === 0, 'sin ejercicios en el plan no sugiere nada');
  ok(sugerirPatronBloqueado('rodilla', [{ exId: 'x' }]).length === 0,
    'un ejercicio sin nombre no se sugiere: no se adivina por el id');
  // La sugerencia NUNCA puede ser todo el plan: eso dejaría al cliente sin
  // nada que hacer y es señal de que una expresión quedó demasiado abierta.
  ['hombro_der','rodilla_izq','lumbar','codo_der','tobillo_izq','cadera','cuello','muneca_izq','dorsal']
    .forEach(z => {
      const r = sugerirPatronBloqueado(z, PLAN_REAL);
      ok(r.length < PLAN_REAL.length, `${z}: sugiere ${r.length} de ${PLAN_REAL.length}, no todo el plan`);
    });
}

console.log('\n5. El jsonb que se guarda');
{
  const b = armarBloqueDirigido({
    region: 'Hombro', faseClinica: 'proteccion', faseLabel: 'Protección / Fase Aguda',
    nota: 'Suspender si el dolor supera 4/10',
    ejercicios: [{ exId: 'rh_a01', nombre: 'Isométrico rotadores externos', desc: 'Codo a 90°', param: '3×10 · 5 seg' }],
  });
  ok(b.region === 'Hombro' && b.fase_clinica === 'proteccion',
    'guarda la región y la fase CLÍNICA, no sólo la etiqueta');
  ok(b.exercises[0].reps === '3×10 · 5 seg', '`param` de la biblioteca se guarda como `reps`');
  ok(b.exercises[0].series === 3, 'con series por defecto en 3');
  ok(b.exercises[0].nombre === 'Isométrico rotadores externos',
    'y el NOMBRE adentro: los de rehab no están en la tabla ejercicios y el portal no importa el bundle');
  ok(b.nota === 'Suspender si el dolor supera 4/10', 'y la indicación del bloque');
  ok(Array.isArray(b.dias) && b.dias.length === 0, 'días vacío = todos los días');
}
{
  ok(armarBloqueDirigido({ region: 'Hombro', ejercicios: [] }) === null,
    'sin ejercicios devuelve null: un bloque vacío no es un bloque');
  ok(armarBloqueDirigido({}) === null, 'sin nada, null');
  ok(armarBloqueDirigido({ ejercicios: [{ nombre: 'sin id' }] }) === null,
    'un ejercicio sin exId no cuenta: el portal lo indexa por id');
}

console.log(fallos === 0 ? '\n✅ puente de rehab: todo pasa\n' : `\n❌ puente de rehab: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
