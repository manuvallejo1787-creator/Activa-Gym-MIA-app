// qa/reentrada.mjs — cómo vuelve un patrón que estuvo bloqueado
//
// POR QUÉ EXISTE
// El 30/10, leyendo planificacion.js:717, apareció que el historial de
// `sugerirPeso` no tiene NINGÚN límite de fecha: ordena por updated_at, agarra
// el primero, y si ese día el cliente completó las reps, PROGRESA
// (peso*1.025 o +2,5 kg).
//
// Con el riel del 29/10 eso dejó de ser teórico. `tg_liberar_patron` libera un
// patrón bloqueado a las 4 sesiones (8 si el escalonamiento fue declinado) sin
// que nadie intervenga. La primera carga sugerida al volver era la de antes
// del dolor, más 2,5 kg, después de dos o tres semanas sin entrenar ese
// patrón. Lo construí yo el día anterior y no lo vi.
//
// Estas pruebas fijan las tres cosas que pueden volver a romperse:
//   1. que la carga base sea la PREVIA al bloqueo y no la de la reentrada
//   2. que no progrese durante la reentrada
//   3. que la reentrada termine sola y no quede pegada
import { sugerirPeso } from '../src/planificacion.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// Press banca: patrón con test, para que la cadena no se vaya por otra rama.
// Sin test en `testsCliente`, la fuente cae al historial, que es lo que se prueba.
const EJ = 'Press banca con barra';
const EXID = 'ex_press_banca';
const h = (fecha, peso, reps = 8) => ({
  ejercicio_id: EXID, ejercicio_nombre: EJ, peso_real: peso, reps_real: reps,
  fecha, updated_at: fecha + 'T20:00:00Z',
});
const calc = (historial, reentrada) =>
  sugerirPeso(EJ, [], null, 8, { exId: EXID, historial, reentrada, pesoCorporal: 88 });

console.log('\n1. Sin reentrada: el comportamiento de siempre');
{
  const r = calc([h('2026-10-01', 80)], null);
  ok(r.fuente === 'historial', 'sin regla de reentrada la fuente sigue siendo el historial');
  ok(r.pesoSugerido > 80, 'y progresa porque completó las reps (es el comportamiento correcto fuera de un bloqueo)');
}

console.log('\n2. Primera sesión de vuelta: la carga previa al bloqueo, al 60%');
{
  // 80 kg el 1/10 → molestia → bloqueo → liberado el 25/10 sin cargas en medio.
  const r = calc([h('2026-10-01', 80)],
    { pct: 60, sesiones_req: 2, sesiones_hechas: 0, liberado_el: '2026-10-25', zona: 'Hombro der' });
  ok(r.fuente === 'reentrada', 'la fuente es la reentrada, no el historial');
  ok(r.pesoSugerido === 47.5, `48 kg redondeado a 2,5: 60% de 80 (dio ${r.pesoSugerido})`);
  ok(r.pesoPrevio === 80, 'guarda la carga previa para poder explicar de dónde sale');
  ok(r.pctReentrada === 60, 'y el porcentaje aplicado');
  ok(r.sesionesRestantes === 2, 'dice cuántas sesiones de reentrada quedan');
  ok(/Hombro der/.test(r.explicacion), 'y de qué zona vino el bloqueo');
  ok(/No subir carga/.test(r.cierreSet || ''),
    'avisa explícito que no se sube aunque complete las reps: al 60% completarlas es lo esperado');
}

console.log('\n3. EL BUG QUE ESTO EVITA: el 60% sobre el 60%');
{
  // Segunda sesión. El cliente ya cargó los 47,5 kg de la reentrada el 26/10.
  // Si la base fuera "la última carga a secas", el 80% caería sobre 47,5 → 38 kg:
  // la reentrada bajaría la carga en vez de subirla.
  const hist = [h('2026-10-26', 47.5), h('2026-10-01', 80)];
  const r = calc(hist, { pct: 60, sesiones_req: 2, sesiones_hechas: 1, liberado_el: '2026-10-25' });
  ok(r.pesoPrevio === 80, 'la base sigue siendo la carga PREVIA al bloqueo, no la de la reentrada');
  ok(r.pctReentrada === 80, 'rampa: con pct 60 y 2 sesiones, la segunda va al 80%');
  ok(r.pesoSugerido === 65, `65 kg: 80% de 80 (dio ${r.pesoSugerido})`);
  ok(r.pesoSugerido > 47.5, 'y sube respecto de la sesión anterior, que es el sentido de una rampa');
}

console.log('\n4. La reentrada termina sola');
{
  const hist = [h('2026-10-28', 65), h('2026-10-26', 47.5), h('2026-10-01', 80)];
  // Cumplidas las 2 sesiones, la vista gym_reentrada deja de devolver la fila:
  // la app recibe `reentrada: null` y vuelve la progresión normal.
  const r = calc(hist, null);
  ok(r.fuente === 'historial', 'cumplida la reentrada, la fuente vuelve a ser el historial');
  ok(r.pesoSugerido > 65, 'y progresa desde la última carga real, no desde la previa al bloqueo');
}
{
  // Defensa en profundidad: si por un error la fila llegara con las sesiones
  // ya cumplidas, igual no debe aplicar reentrada.
  const r = calc([h('2026-10-01', 80)], { pct: 60, sesiones_req: 2, sesiones_hechas: 2, liberado_el: '2026-10-25' });
  ok(r.fuente === 'historial', 'con las sesiones cumplidas no aplica reentrada aunque llegue la fila');
}

console.log('\n5. Casos borde: no inventar una reentrada');
{
  const r = calc([], { pct: 60, sesiones_req: 2, sesiones_hechas: 0, liberado_el: '2026-10-25' });
  ok(r.fuente !== 'reentrada',
    'sin historial no hay carga previa: cae a la estimación conservadora en lugar de inventar un número');
}
{
  // Todas las cargas son POSTERIORES a la liberación: no hay previa al bloqueo.
  const r = calc([h('2026-10-26', 50)], { pct: 60, sesiones_req: 2, sesiones_hechas: 0, liberado_el: '2026-10-25' });
  ok(r.fuente === 'historial', 'sin ninguna carga previa a la liberación cae al historial normal');
}
{
  // Filas viejas sin `fecha` (la consulta no la pedía hasta el 30/10): se usa
  // updated_at como respaldo. Sin respaldo, '' <= '2026-10-25' daba verdadero y
  // dejaba pasar justo las cargas de la reentrada.
  const viejo = { ejercicio_id: EXID, ejercicio_nombre: EJ, peso_real: 80, reps_real: 8, updated_at: '2026-10-01T20:00:00Z' };
  const r = calc([viejo], { pct: 60, sesiones_req: 2, sesiones_hechas: 0, liberado_el: '2026-10-25' });
  ok(r.fuente === 'reentrada' && r.pesoPrevio === 80,
    'una fila sin `fecha` cae a updated_at y la reentrada funciona igual');
}
{
  const r = calc([h('2026-10-01', 80)], { pct: 100, sesiones_req: 1, sesiones_hechas: 0, liberado_el: '2026-10-25' });
  ok(r.pesoSugerido === 80, 'pct 100 devuelve la carga previa exacta: la regla es editable hasta anularse');
}
{
  const r = calc([h('2026-10-01', 80)], { pct: 60, sesiones_req: 0, sesiones_hechas: 0, liberado_el: '2026-10-25' });
  ok(r.fuente === 'historial', 'sesiones_req 0 desactiva la reentrada sin romper nada');
}

console.log('\n6. Mancuernas: la reentrada respeta el modo por mano');
{
  const r = sugerirPeso('Apertura con mancuernas', [], null, 10, {
    exId: 'ex_apertura', pesoCorporal: 88,
    historial: [{ ejercicio_id: 'ex_apertura', peso_real: 14, reps_real: 10, fecha: '2026-10-01', updated_at: '2026-10-01T20:00:00Z' }],
    reentrada: { pct: 60, sesiones_req: 2, sesiones_hechas: 0, liberado_el: '2026-10-25' },
  });
  ok(r.fuente === 'reentrada', 'aplica también a un ejercicio por mano');
  ok(/mancuerna/.test(r.unidad || ''), `la unidad es por mancuerna, no kg totales (dio "${r.unidad}")`);
  ok(Number.isInteger(r.pesoSugerido), `redondea al entero y no a 2,5 (dio ${r.pesoSugerido})`);
}

console.log(fallos === 0 ? '\n✅ reentrada: todo pasa\n' : `\n❌ reentrada: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
