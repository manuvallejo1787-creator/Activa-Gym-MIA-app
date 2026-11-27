// qa/fisioCriterios.mjs — LOS CRITERIOS DE AVANCE SE PUEDEN EXIGIR
//
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE MANU REPORTÓ EL 27/11/2026
// "Los criterios de avance no están bien establecidos, y no los contempla la
// programación."
// La causa medida: la IA devolvía `criterios_alta_fase: ["frase","frase"]`.
// Texto libre que solo se pinta. El pase de fase se decidía a ojo.
//
// EL CONTROL QUE MÁS IMPORTA, Y ESTÁ ABAJO:
// que un dato SIN MEDIR devuelva 'pendiente' y nunca 'no_cumplido'. Si se
// confunden, un paciente al que no le midieron la fuerza queda trabado en
// protección para siempre y nadie entiende por qué. Es la misma regla que ya
// tenía el bloque determinista del analizador: "sin medir" es medición
// pendiente, jamás un mal resultado.
import { evaluarCriterio, evaluarFase, criterioVacio, semaforoDeCarga,
         EJES, METRICAS, SEMAFORO_CARGA, DIRECCION_ESCALA, IRRADIACION } from '../src/fisioCriterios.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// ─── El caso real que trajo Manu: paciente de 60 años, hombro + cervical +
// codo + muñeca, ULTT y ULFT positivos, trabajo de cocina y costura.
const EV = {
  region: 'hombro',
  eva_reposo: '4', eva_movimiento: '7',
  rom: { hombro: { 'Abducción': { grados: '95', funcional: false, eva: '6' },
                   'Flexión':   { grados: '120', funcional: true,  eva: '4' } } },
  fuerza: { 'Abductores hombro': '4', 'Rotadores externos': '3' },
  dinamometria: { d: '18', i: '27' },
  dn4: { q1: true, q2: true, q3: true, q4: false, q5: true, q6: false, q7: false },
  dash_score: '58',
  testsEsp: { 'hombro::Empty Can (Jobe)_Derecho': 'positivo',
              'hombro::Yocum Test_Derecho': 'positivo',
              'ULTT (Tensión Neural MMSS)_Derecho': 'positivo' },
};
const CTX = { ev: EV, region: 'hombro', sesiones: [{ eva_inicio: 5, eva_fin: 3 }], confirmaciones: {} };

console.log('\n1. LA REGLA QUE NO SE NEGOCIA — sin medir es "pendiente", no "no cumple"');
{
  // Fuerza de un músculo que nadie midió.
  const r = evaluarCriterio(criterioVacio({
    eje: 'fuerza', metrica: 'fuerza_mrc', ref: 'Supraespinoso derecho',
    operador: '>=', umbral: 4, que: 'Fuerza del supraespinoso',
  }), CTX);
  ok(r.estado === 'pendiente', `fuerza sin medir → "${r.estado}" (tiene que ser pendiente, NO no_cumplido)`);
  ok(/Falta medir/.test(r.detalle), 'y el detalle dice QUÉ ir a medir, en lugar de dejarlo adivinando');
}
{
  // El DN4 en cero no es lo mismo que el DN4 sin hacer.
  const sinHacer = evaluarCriterio(criterioVacio({
    eje: 'neural', metrica: 'dn4', operador: '<=', umbral: 3, que: 'DN4 bajo el umbral neuropático',
  }), { ...CTX, ev: { ...EV, dn4: {} } });
  ok(sinHacer.estado === 'pendiente', 'DN4 sin contestar → pendiente, no "0/7 cumplido"');
  const todoNo = evaluarCriterio(criterioVacio({
    eje: 'neural', metrica: 'dn4', operador: '<=', umbral: 3, que: 'DN4 bajo el umbral',
  }), { ...CTX, ev: { ...EV, dn4: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false } } });
  ok(todoNo.estado === 'cumplido', 'DN4 contestado todo "no" → 0/7, cumplido: eso SÍ es una medición');
}
{
  const sinUmbral = evaluarCriterio(criterioVacio({
    eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro',
    operador: '>=', umbral: null, que: 'Abducción',
  }), CTX);
  ok(sinUmbral.estado === 'pendiente', 'un criterio sin umbral no se cuenta como cumplido');
  ok(/ponele un umbral|sin umbral/i.test(sinUmbral.detalle + sinUmbral.esperado),
    'y dice que le falta el umbral: así no se cuela un criterio que no se puede exigir');
}

console.log('\n2. Las métricas leen el dato que corresponde');
{
  const rom = evaluarCriterio(criterioVacio({
    eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro',
    operador: '>=', umbral: 150, que: 'Abducción activa de hombro',
  }), CTX);
  ok(rom.estado === 'no_cumplido' && /95/.test(rom.valor),
    `abducción 95° contra umbral 150° → no cumple, y muestra el valor real (${rom.valor})`);

  const romOk = evaluarCriterio(criterioVacio({
    eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro',
    operador: '>=', umbral: 90, que: 'Abducción activa',
  }), CTX);
  ok(romOk.estado === 'cumplido', 'y con umbral 90° cumple');
}
{
  // El formato VIEJO de ROM (un número suelto) tiene que seguir leyéndose:
  // hay evaluaciones guardadas así y no se pueden perder.
  const viejo = evaluarCriterio(criterioVacio({
    eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro',
    operador: '>=', umbral: 100, que: 'Abducción',
  }), { ...CTX, ev: { ...EV, rom: { 'Abducción': '140' } } });
  ok(viejo.estado === 'cumplido' && /140/.test(viejo.valor),
    'el formato viejo de ROM (número suelto) se sigue leyendo: las evaluaciones antiguas no se pierden');
}
{
  const din = evaluarCriterio(criterioVacio({
    eje: 'fuerza', metrica: 'dinamometria_pct', lado: 'derecho',
    operador: '>=', umbral: 90, que: 'Prensión derecha vs izquierda',
  }), CTX);
  ok(din.estado === 'no_cumplido' && /6[0-9]%/.test(din.valor),
    `prensión 18/27 kg → ${din.valor}, no cumple el 90% (el documento de Manu pide ≥90% del lado sano)`);

  // Y el lado importa: si el afectado fuera el izquierdo, el porcentaje se da vuelta.
  const izq = evaluarCriterio(criterioVacio({
    eje: 'fuerza', metrica: 'dinamometria_pct', lado: 'izquierdo',
    operador: '>=', umbral: 90, que: 'Prensión izquierda vs derecha',
  }), CTX);
  ok(parseInt(izq.valor) > 100, `con el afectado del otro lado da ${izq.valor}: el lado no es cosmético`);
}
{
  const dash = evaluarCriterio(criterioVacio({
    eje: 'funcion', metrica: 'escala', ref: 'dash',
    operador: '<=', umbral: 20, que: 'DASH (discapacidad del miembro superior)',
  }), CTX);
  ok(dash.estado === 'no_cumplido' && /58/.test(dash.valor), 'DASH 58 contra umbral ≤20 → no cumple');

  const odi = evaluarCriterio(criterioVacio({
    eje: 'funcion', metrica: 'escala', ref: 'odi', operador: '<=', umbral: 20, que: 'ODI',
  }), { ...CTX, ev: { ...EV, odi: [3, 2, 3, 2, 3, 2, 3, 2, 2, 3] } });
  ok(odi.estado === 'no_cumplido' && odi.valor === '50%',
    `ODI de 25/50 → ${odi.valor}: en PORCENTAJE, que es como se informa el ODI. "50 puntos" no significa nada y se lee en el PDF del paciente`);
  ok(dash.valor === '58/100', `y el DASH se informa sobre 100 (${dash.valor}), no en porcentaje`);
  const lefs = evaluarCriterio(criterioVacio({
    eje: 'funcion', metrica: 'escala', ref: 'lefs', operador: '>=', umbral: 60, que: 'LEFS',
  }), { ...CTX, ev: { ...EV, lefs_score: '52' } });
  ok(lefs.valor === '52/80', `y el LEFS sobre 80 (${lefs.valor}): cada escala con su unidad real`);
  ok(DIRECCION_ESCALA.dash === 'más alto = peor' && DIRECCION_ESCALA.lefs === 'más alto = mejor',
    'y queda escrito que en DASH/ODI más alto es peor y en LEFS/KOOS es mejor: si se invierte el operador, el criterio dice lo contrario de lo que se busca');

  const odiVacio = evaluarCriterio(criterioVacio({
    eje: 'funcion', metrica: 'escala', ref: 'odi', operador: '<=', umbral: 20, que: 'ODI',
  }), { ...CTX, ev: { ...EV, odi: Array(10).fill(0) } });
  ok(odiVacio.estado === 'pendiente', 'ODI todo en cero → pendiente: nadie lo contestó, no es un 0% real');
}

console.log('\n3. Las pruebas especiales: los DOS formatos guardados');
{
  // Formato nuevo, con región adelante.
  const jobe = evaluarCriterio(criterioVacio({
    eje: 'clinico', metrica: 'prueba', ref: 'Empty Can (Jobe)', region: 'hombro',
    lado: 'derecho', operador: 'negativo', que: 'Jobe negativo',
  }), CTX);
  ok(jobe.estado === 'no_cumplido' && jobe.valor === 'positivo',
    'formato con región ("hombro::Jobe_Derecho") se lee');

  // Formato viejo, sin región. Si leyera solo uno, perdería la mitad en silencio.
  const ultt = evaluarCriterio(criterioVacio({
    eje: 'neural', metrica: 'prueba', ref: 'ULTT (Tensión Neural MMSS)', region: 'hombro',
    lado: 'derecho', operador: 'negativo', que: 'ULTT negativo',
  }), CTX);
  ok(ultt.valor === 'positivo',
    'formato viejo (sin región) TAMBIÉN se lee: no se pierde la mitad de los resultados sin avisar');

  const nunca = evaluarCriterio(criterioVacio({
    eje: 'clinico', metrica: 'prueba', ref: 'Spurling', region: 'cervical',
    operador: 'negativo', que: 'Spurling negativo',
  }), CTX);
  ok(nunca.estado === 'pendiente', 'una prueba que no se hizo → pendiente, no "negativo por defecto"');
}

console.log('\n4. Lo que NO se puede automatizar se dice, no se finge');
{
  const neural = criterioVacio({
    id: 'cr_neural', eje: 'neural', metrica: 'sin_empeorar',
    que: 'Sin aumento de irradiación distal ni parestesias nuevas tras la sesión',
  });
  const sinTildar = evaluarCriterio(neural, CTX);
  ok(sinTildar.auto === false, 'el eje neural queda marcado como NO automático');
  ok(sinTildar.estado === 'pendiente', 'y sin tildar queda pendiente, no cumplido');
  ok(/confirmes vos|clínico/i.test(sinTildar.detalle), 'y dice que lo tenés que confirmar vos');

  const tildado = evaluarCriterio(neural, { ...CTX, confirmaciones: { cr_neural: true } });
  ok(tildado.estado === 'cumplido' && /mano/i.test(tildado.detalle),
    'tildado pasa a cumplido, pero queda registrado que fue a mano y no medido');
}
{
  // Esto es deuda honesta, no un olvido: la sesión clínica guarda `respuesta`
  // como texto libre, así que el criterio neural no se puede leer de ahí.
  const noAuto = Object.entries(METRICAS).filter(([, m]) => m.auto === false).map(([k]) => k);
  ok(noAuto.length === 2 && noAuto.includes('sin_empeorar') && noAuto.includes('confirmacion'),
    `solo 2 métricas son manuales (${noAuto.join(', ')}): el resto se mide de verdad`);
  const auto = Object.entries(METRICAS).filter(([, m]) => m.auto).length;
  ok(auto === 9, `${auto} métricas se evalúan solas contra la evaluación guardada, incluido el eje neural`);
}

console.log('\n4b. EL CRITERIO NEURAL — de tilde a medición');
{
  // EL CRITERIO 2 DEL DOCUMENTO DE MANU, el que él marca como "especialmente
  // importante": no avanzar si aparece mayor irradiación distal, parestesias
  // nuevas o pérdida de fuerza. Era una tilde de confianza porque la sesión
  // guardaba la respuesta como texto libre.
  const cr = criterioVacio({ eje: 'neural', metrica: 'neural', que: 'Síntomas neurales sin empeorar' });

  const estable = evaluarCriterio(cr, { ...CTX, sesiones: [
    { neural: { irradiacion: 'proximal', parestesias: false, perdida_fuerza: false } },
    { neural: { irradiacion: 'proximal', parestesias: false, perdida_fuerza: false } },
  ]});
  ok(estable.estado === 'cumplido' && estable.valor === 'estable',
    'misma irradiación entre dos sesiones → cumplido');

  const peor = evaluarCriterio(cr, { ...CTX, sesiones: [
    { neural: { irradiacion: 'hasta_mano', parestesias: false, perdida_fuerza: false } },
    { neural: { irradiacion: 'hasta_codo', parestesias: false, perdida_fuerza: false } },
  ]});
  ok(peor.estado === 'no_cumplido',
    'LA ESCALA ES ORDINAL: la irradiación pasó del codo a la mano → no cumple, la fase no avanza');
  ok(/no avanzar de fase y revisar la dosis/i.test(peor.detalle), 'y dice qué hacer');

  const mejor = evaluarCriterio(cr, { ...CTX, sesiones: [
    { neural: { irradiacion: 'proximal' } }, { neural: { irradiacion: 'hasta_mano' } },
  ]});
  ok(mejor.estado === 'cumplido',
    'y si la irradiación RETROCEDE en la escala, cumple: el orden distingue mejorar de empeorar, que como texto libre era indistinguible');

  const parest = evaluarCriterio(cr, { ...CTX, sesiones: [
    { neural: { irradiacion: 'proximal', parestesias: true } },
    { neural: { irradiacion: 'proximal', parestesias: false } },
  ]});
  ok(parest.estado === 'no_cumplido',
    'parestesias nuevas con la misma irradiación → tampoco avanza: cualquiera de las tres señales alcanza');

  const fuerza = evaluarCriterio(cr, { ...CTX, sesiones: [
    { neural: { irradiacion: 'no', perdida_fuerza: true } },
    { neural: { irradiacion: 'no', perdida_fuerza: false } },
  ]});
  ok(fuerza.estado === 'no_cumplido', 'y pérdida de fuerza nueva tampoco, aun sin irradiación');
}
{
  const cr = criterioVacio({ eje: 'neural', metrica: 'neural', que: 'Síntomas neurales' });
  const unaSola = evaluarCriterio(cr, { ...CTX, sesiones: [{ neural: { irradiacion: 'no' } }] });
  ok(unaSola.estado === 'pendiente',
    'EL CONTROL QUE IMPORTA: con UNA sola sesión no hay con qué comparar → pendiente, nunca "estable por defecto". Dar por bueno lo que no se midió es lo que hace avanzar de fase a un paciente con la irradiación creciendo');
  ok(/dos sesiones con los síntomas neurales cargados/.test(unaSola.detalle),
    'y dice exactamente qué falta cargar');

  const sinCampo = evaluarCriterio(cr, { ...CTX, sesiones: [{ eva_fin: 3 }, { eva_fin: 4 }] });
  ok(sinCampo.estado === 'pendiente',
    'las 42 sesiones viejas, sin el campo cargado, quedan pendientes y no bloquean a nadie');

  const basura = evaluarCriterio(cr, { ...CTX, sesiones: [
    { neural: { irradiacion: 'cualquier_cosa' } }, { neural: { irradiacion: 'no' } }]});
  ok(basura.estado === 'pendiente',
    'un valor fuera de la escala queda pendiente en lugar de compararse mal (la base además lo rechaza)');

  ok(METRICAS.neural.auto === true,
    'y la métrica queda marcada como automática: el criterio 2 dejó de ser una tilde de confianza');
  ok(IRRADIACION.length === 4 && IRRADIACION[0] === 'no' && IRRADIACION[3] === 'hasta_mano',
    `la escala tiene ${IRRADIACION.length} niveles de menor a mayor: ${IRRADIACION.join(' < ')}`);
}

console.log('\n5. El veredicto de fase — tres resultados, no dos');
{
  const todoCumple = [
    criterioVacio({ eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro', operador: '>=', umbral: 90, que: 'Abducción' }),
    criterioVacio({ eje: 'dolor', metrica: 'eva', ref: 'post_sesion', operador: '<=', umbral: 3, que: 'EVA post sesión' }),
  ];
  const v1 = evaluarFase(todoCumple, CTX);
  ok(v1.veredicto === 'avanza', `todo cumplido → "${v1.veredicto}"`);

  const conPendiente = [...todoCumple,
    criterioVacio({ eje: 'fuerza', metrica: 'fuerza_mrc', ref: 'Supraespinoso', operador: '>=', umbral: 4, que: 'Fuerza supraespinoso' })];
  const v2 = evaluarFase(conPendiente, CTX);
  ok(v2.veredicto === 'falta_medir',
    'con un criterio sin medir → "falta_medir", que NO es lo mismo que "no_avanza"');
  ok(/Fuerza supraespinoso/.test(v2.motivo), 'y el motivo nombra qué falta medir');

  const conNoCumple = [...todoCumple,
    criterioVacio({ eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro', operador: '>=', umbral: 170, que: 'Abducción completa' })];
  const v3 = evaluarFase(conNoCumple, CTX);
  ok(v3.veredicto === 'no_avanza', 'con uno que no cumple → "no_avanza"');
  ok(/Abducción completa/.test(v3.motivo), 'y nombra cuál');

  ok(evaluarFase([], CTX).veredicto === 'sin_criterios',
    'una fase sin criterios no dice "avanza": dice que no tiene criterios');
}
{
  // EL CONTROL DE FONDO: no cumplir pesa más que faltar medir. Si el orden
  // fuera el otro, un criterio incumplido quedaría tapado por uno sin medir y
  // el pase de fase diría "solo falta medir".
  const mezcla = [
    criterioVacio({ eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro', operador: '>=', umbral: 170, que: 'Abducción' }),
    criterioVacio({ eje: 'fuerza', metrica: 'fuerza_mrc', ref: 'Nadie midió esto', operador: '>=', umbral: 4, que: 'Fuerza' }),
  ];
  ok(evaluarFase(mezcla, CTX).veredicto === 'no_avanza',
    'con uno incumplido Y uno sin medir gana "no_avanza": lo incumplido no queda tapado');
}
{
  // Un criterio no obligatorio informa pero no traba.
  const conOpcional = [
    criterioVacio({ eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro', operador: '>=', umbral: 90, que: 'Abducción' }),
    criterioVacio({ eje: 'funcion', metrica: 'escala', ref: 'dash', operador: '<=', umbral: 10, que: 'DASH excelente', obligatorio: false }),
  ];
  const v = evaluarFase(conOpcional, CTX);
  ok(v.veredicto === 'avanza' && v.total === 1,
    'un criterio opcional que no cumple no traba el pase, y no cuenta en el total');
  ok(v.criterios.length === 2, 'pero sigue apareciendo en la lista, para que se vea');
}
{
  const v = evaluarFase([
    criterioVacio({ eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro', operador: '>=', umbral: 90, que: 'A' }),
    criterioVacio({ eje: 'rom', metrica: 'rom_grados', ref: 'Abducción', region: 'hombro', operador: '>=', umbral: 170, que: 'B' }),
  ], CTX);
  ok(v.pct === 50, `el porcentaje es 50% con 1 de 2, pero el veredicto sigue siendo "${v.veredicto}": 4 de 5 no habilita nada`);
}

console.log('\n6. El semáforo de carga de la sesión');
{
  ok(semaforoDeCarga(1).k === 'verde', 'EVA 1 → verde');
  ok(semaforoDeCarga(3).k === 'amarillo', 'EVA 3 → amarillo');
  ok(semaforoDeCarga(4).k === 'amarillo', 'EVA 4 → amarillo (el límite es 4, no 3)');
  ok(semaforoDeCarga(5).k === 'rojo', 'EVA 5 → rojo');
  ok(semaforoDeCarga(1, true).k === 'rojo',
    'EVA 1 CON síntomas neurológicos nuevos → rojo: el síntoma neural manda sobre el número');
  ok(semaforoDeCarga(null) === null, 'sin EVA no inventa un color');
  ok(/no se para todo|ajusta la dosis/i.test(SEMAFORO_CARGA[2].regla),
    'el rojo dice reducir y reevaluar, no "parar todo": el objetivo es recuperar capacidad de carga');
}

console.log('\n7. La forma del criterio es estable');
{
  const c = criterioVacio();
  const campos = ['id', 'eje', 'que', 'metrica', 'ref', 'region', 'lado', 'operador', 'umbral', 'porque', 'obligatorio', 'origen'];
  const faltan = campos.filter(k => !(k in c));
  ok(!faltan.length, `el criterio trae los ${campos.length} campos (faltan: ${faltan.join(', ') || 'ninguno'})`);
  ok(c.origen === 'ia', 'y arranca marcado como puesto por la IA, para distinguir lo que edita Manu');
  ok(criterioVacio().id !== criterioVacio().id, 'cada criterio nace con id propio');
  ok(Object.keys(EJES).length === 7, `hay ${Object.keys(EJES).length} ejes disponibles, los 5 del documento más carga y juicio clínico`);
  ok(Object.values(EJES).every(e => e.label && e.orden), 'cada eje tiene etiqueta y orden para mostrarse');
}

console.log(fallos === 0 ? '\n✅ criterios de avance: todo pasa\n' : `\n❌ criterios de avance: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
