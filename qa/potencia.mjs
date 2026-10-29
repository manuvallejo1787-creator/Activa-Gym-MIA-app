// qa/potencia.mjs — ventanas de carga de los ejercicios balísticos
//
// POR QUÉ EXISTE
// "Sentadilla salto con barra" caía en la regla genérica /sentadilla|squat/
// con coeficiente 1.00 y confianza ALTA, y después pctFromReps le aplicaba el
// % por repeticiones: el bloque potencia pide 3-5 reps, promedio 4, 90%.
// Sobre los 1RM reales de la base eso prescribía 122 kg a la espalda de un
// cliente de 88 kg para saltar y caer.
//
// Los números de este arnés son los 1RM reales de Maicol (sentadilla 135 kg,
// peso corporal 88,35) y su press militar. Si alguien vuelve a enrutar un
// balístico por la cadena de repeticiones, esto falla.
import { sugerirPeso } from '../src/planificacion.js';
import { resolverTransferencia } from '../src/transferencia.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

const TESTS = [
  { test_id: 'squat',     fecha: '2026-10-01', rm1_calculado: 135, rm1_real: 0, formula: 'epley_brzycki' },
  { test_id: 'press_mil', fecha: '2026-10-01', rm1_calculado: 50,  rm1_real: 0, formula: 'epley_brzycki' },
];
const FASE_POTENCIA = { reps: '3-5' };
const S = (n, o = {}) => sugerirPeso(n, TESTS, FASE_POTENCIA, null, { pesoCorporal: 88.35, sexo: 'm', ...o });

console.log('\n1. Salto con barra: 20-30% del 1RM de sentadilla');
let r = S('Sentadilla salto con barra');
ok(r.fuente === 'potencia', 'sale por la rama de potencia, no por test + repeticiones');
ok(r.pesoSugerido === 27.5, `arranca en 27,5 kg y no en 122 (dio ${r.pesoSugerido})`);
ok(/40/.test(r.pesoRango || ''), `el techo del rango es ~40 kg (dio "${r.pesoRango}")`);
ok(r.pct === undefined, 'NO aplica porcentaje por repeticiones');
ok(!!r.cierreSet, 'trae la regla de cierre de serie por caída de rendimiento');

console.log('\n2. Variantes de nombre que tienen que caer en la misma regla');
for (const n of ['Sentadilla con salto', 'Jump squat con barra', 'Salto en sentadilla con barra'])
  ok(S(n).fuente === 'potencia', `"${n}"`);

console.log('\n3. Salto con mancuernas: 5-10% del peso corporal, por mano');
r = S('Salto con mancuernas');
ok(r.modo === 'por_mano', 'por mano, no carga total: la mancuerna cuelga al costado');
ok(r.pesoSugerido === 4, `4 kg por mano (dio ${r.pesoSugerido})`);
ok(S('Salto con mancuernas', { pesoCorporal: null }).pesoSugerido === null, 'sin peso corporal no inventa número');

console.log('\n4. Clean & press: el techo lo pone el press, no la cargada');
r = S('Clean y press con barra');
ok(r.testId === 'press_mil', `ancla en press militar (dio ${r.testId})`);
ok(r.pesoSugerido === 30, `30 kg, 60% de 50 (dio ${r.pesoSugerido})`);

console.log('\n5. Clean solo: no hay test de clean en el sistema');
r = S('Power clean');
ok(r.fuente === 'potencia' && r.pesoSugerido === null, 'no da número');
ok(/no .*mide|a mano/i.test(r.motivo || ''), 'explica que falta el test');

console.log('\n6. Sin carga externa');
for (const n of ['Box jump al cajón', 'Salto vertical CMJ', 'Lanzamiento de balón medicinal'])
  ok(S(n).modo === 'corporal' && S(n).pesoSugerido === null, `"${n}"`);

console.log('\n7. La fuerza no se tocó');
r = sugerirPeso('Sentadilla trasera con barra', TESTS, { reps: '8-12' }, null, { pesoCorporal: 88.35, sexo: 'm' });
ok(r.fuente === 'test' && r.pct > 0, `sigue por test × % (${r.pct}% → ${r.pesoSugerido} kg)`);
ok(!resolverTransferencia('Sentadilla trasera con barra').pot, 'la sentadilla común no es balística');
ok(!resolverTransferencia('Prensa 45°').pot, 'la prensa tampoco');

process.exit(fallos ? 1 : 0);
