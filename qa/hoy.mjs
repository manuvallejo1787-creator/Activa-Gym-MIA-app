// qa/hoy.mjs — la bandeja de Hoy y el resumen diario del riel
//
// POR QUÉ EXISTE
// `construirHoy` decide qué ve el centro al abrir la app y no tenía ni una
// prueba. Es la función con más reglas del sistema —unas veinte— y ya se le
// escapó en silencio el bug de los ítems de nivel "mantenimiento", que se
// descartaban al armar el retorno: TODOS los avisos previos al vencimiento
// nunca llegaban a la pantalla y nadie se dio cuenta porque la bandeja seguía
// mostrando cosas.
//
// El 30/10 se le conectó el riel, y eso trajo el riesgo concreto de duplicar:
// el disparador crea una incidencia por cada molestia reportada, así que la
// misma molestia podía salir dos veces —reporte crudo e incidencia con
// conducta— con dos lugares distintos donde cerrarla.
import { construirHoy, resumenRiel } from '../src/hoy.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };
const HOY = '2026-10-30';

const cli = (id, nombre, extra = {}) => ({ id, nombre, apellido: 'Prueba', activo: true, ...extra });
const inc = (id, estado, extra = {}) => ({
  id, gym_client_id: 'c1', zona: 'rodilla_izq', naturaleza: 'articular',
  origen: 'feedback', fecha: '2026-10-28', estado, ...extra,
});
const rep = (extra = {}) => ({
  id: 'f1', gym_client_id: 'c1', fecha: '2026-10-28', dolor: 5,
  dolor_zona: 'rodilla_izq', rpe_sesion: 7, ...extra,
});
// `gym` mínimo: sin plan ni screening para que no se disparen las otras reglas.
const GYM = [cli('c1', 'Maicol'), cli('c2', 'Ana')];
const B = (o = {}) => construirHoy({ gym: GYM, hoy: HOY, ...o });

console.log('\n1. Las incidencias del riel llegan a la bandeja');
{
  const H = B({ incidencias: [inc('i1', 'valoracion_pendiente')] });
  const it = H.visibles.find(x => x.key === 'riel:i1');
  ok(!!it, 'una valoración pendiente aparece en la bandeja');
  ok(it?.sev === 'critico', 'y es crítica: el patrón está bloqueado hasta que haya veredicto');
  ok(/Maicol/.test(it?.titulo || ''), 'con nombre y apellido, no con el id del cliente');
  ok(/Rodilla izq/.test(it?.titulo || ''), 'y la zona traducida, no "rodilla_izq"');
  ok(it?.estado === 'valoracion_pendiente', 'lleva el estado adentro: el resumen filtra por eso y no por el icono');
  ok(it?.accion?.tab === 'sala', 'y un botón que lleva a donde se resuelve');
}
{
  const H = B({ incidencias: [inc('i2', 'valoracion_hecha')] });
  ok(H.visibles.some(x => x.key === 'riel:i2' && x.sev === 'critico'),
    'una valorada sin rutear también es crítica: hay veredicto y el patrón sigue frenado');
}
{
  const H = B({ incidencias: [inc('i3', 'abierta', { naturaleza: 'nerviosa' })] });
  const it = H.visibles.find(x => x.key === 'riel:i3');
  ok(/nerviosa/.test(it?.porQue || ''), 'una nerviosa sin conducta explica que va directo a escalón 3');
}
{
  const H = B({ incidencias: [inc('i4', 'resuelta')] });
  ok(!H.visibles.some(x => x.key === 'riel:i4') && !H.ocultos.some(x => x.key === 'riel:i4'),
    'una resuelta no genera aviso');
}
{
  // El estado heredado tiene su propio aviso, armado desde la vista de Hoy.
  // Si el riel lo emitiera también habría dos renglones para una revisión.
  const H = B({ incidencias: [inc('i5', 'seguimiento', { fecha_revision: '2026-10-01' })] });
  ok(!H.visibles.some(x => x.key === 'riel:i5'),
    'seguimiento NO lo emite el riel: ya lo emite `incid_revision` desde la vista');
}
{
  const H = B({ gym: [cli('c1', 'Maicol', { activo: false }), cli('c2', 'Ana')],
    incidencias: [inc('i6', 'valoracion_pendiente')] });
  ok(!H.visibles.some(x => x.key === 'riel:i6'), 'un cliente de baja no genera avisos: no está entrenando');
}

console.log('\n2. El riel absorbe el reporte crudo que lo originó');
{
  const H = B({ reportes: [rep()], incidencias: [inc('i1', 'valoracion_pendiente')] });
  const todos = [...H.visibles, ...H.ocultos];
  ok(!todos.some(x => x.key === 'dolor_reporte:f1'),
    'el reporte no sale aparte: el aviso del riel es el que tiene escalón y conducta');
  ok(todos.some(x => x.key === 'riel:i1'), 'y el del riel sí sale');
}
{
  // Un reporte POSTERIOR a la última fecha de la incidencia es información
  // nueva que el disparador no alcanzó a rutear. Esconderlo sería perder el dato.
  const H = B({ reportes: [rep({ fecha: '2026-10-30' })], incidencias: [inc('i1', 'valoracion_pendiente')] });
  ok([...H.visibles, ...H.ocultos].some(x => x.key === 'dolor_reporte:f1'),
    'un reporte posterior a la incidencia sí se ve: es un dato que el riel todavía no tomó');
}
{
  const H = B({ reportes: [rep({ dolor_zona: 'lumbar' })], incidencias: [inc('i1', 'valoracion_pendiente')] });
  ok([...H.visibles, ...H.ocultos].some(x => x.key === 'dolor_reporte:f1'),
    'otra zona no queda absorbida: atender la rodilla no tapa los lumbares');
}
{
  const H = B({ reportes: [rep()], incidencias: [inc('i1', 'resuelta')] });
  ok([...H.visibles, ...H.ocultos].some(x => x.key === 'dolor_reporte:f1'),
    'con la incidencia cerrada, un reporte nuevo vuelve a contar');
}

console.log('\n3. La línea de base: callar es su función, vencer es un aviso');
{
  const H = B({ reportes: [rep()],
    incidencias: [inc('i1', 'linea_base', { revision_vence: '2026-12-01' })] });
  const todos = [...H.visibles, ...H.ocultos];
  ok(!todos.some(x => x.key === 'dolor_reporte:f1'),
    'con línea de base vigente, la molestia reportada no grita: ya se decidió que es su normal');
  ok(!todos.some(x => x.key === 'base_vencida:i1'), 'y no hay aviso de revalorar');
  ok(H.riel.cronicos.length === 1, 'pero se cuenta como crónico en silencio');
  ok(H.grupos.some(g => g.key === 'g_cronicos'),
    'y aparece en un renglón agrupado: marcar una línea de base no puede sentirse como perder el dato');
}
{
  const H = B({ incidencias: [inc('i1', 'linea_base', { revision_vence: '2026-10-01' })] });
  const it = [...H.visibles, ...H.ocultos].find(x => x.key === 'base_vencida:i1');
  ok(!!it, 'vencida la revisión, la línea de base vuelve a pedir acción');
  ok(/29 días/.test(it?.detalle || ''), 'y dice hace cuántos días, no solo que venció');
  ok(H.riel.cronicos.length === 0, 'y deja de contarse como silenciada');
}

console.log('\n4. El contador del riel y el resumen que sale de la app');
{
  const H = B({ incidencias: [
    inc('i1', 'valoracion_pendiente'),
    inc('i2', 'valoracion_hecha', { gym_client_id: 'c2', zona: 'lumbar' }),
    inc('i3', 'abierta', { gym_client_id: 'c2', zona: 'hombro_der' }),
    inc('i4', 'linea_base', { gym_client_id: 'c2', zona: 'tobillo_izq', revision_vence: '2026-10-20' }),
    inc('i5', 'en_sala', { gym_client_id: 'c2', zona: 'codo_izq' }),
  ] });
  ok(H.riel.pendientes === 4, 'cuenta las cuatro que piden acción y no el ajuste en sala');
  const txt = resumenRiel(H, { centro: 'Activa' });
  ok(/^\*Riel — /.test(txt), 'el resumen arranca con la fecha y el centro');
  ok(/\*Valoraciones pendientes\* \(1\)/.test(txt), 'lista las valoraciones pendientes con su conteo');
  ok(/\*Valoradas, falta rutear\* \(1\)/.test(txt), 'y las que faltan rutear');
  ok(/\*Crónicos a revalorar\* \(1\)/.test(txt), 'y los crónicos vencidos');
  ok(!/Ajuste en sala/.test(txt), 'el ajuste en sala NO va al resumen: no hay nada que hacer hoy con eso');
  ok(txt.split('\n').every(l => l.length < 200), 'ningún renglón es ilegible en un celular');
}
{
  const txt = resumenRiel(B({ incidencias: [] }));
  ok(/Sin valoraciones pendientes/.test(txt),
    'sin nada pendiente el resumen lo dice: un resumen vacío que no se puede mandar no sirve de constancia');
}
{
  // Postergar un aviso lo saca de la bandeja Y del resumen. Si siguiera en el
  // resumen, postergar no haría nada para quien lo recibe.
  const H = B({ incidencias: [inc('i1', 'valoracion_pendiente')],
    descartes: [{ item_key: 'riel:i1', estado: 'descartado', hasta: '2026-11-30' }] });
  ok(H.riel.pendientes === 0, 'un aviso postergado no entra al resumen');
}

console.log('\n5. La bandeja sin riel sigue funcionando igual');
{
  const H = B({ reportes: [rep()] });
  ok([...H.visibles, ...H.ocultos].some(x => x.key === 'dolor_reporte:f1'),
    'sin incidencias, el reporte crudo es el único aviso de la molestia');
  ok(H.riel.pendientes === 0 && H.riel.cronicos.length === 0, 'y el resumen del riel queda vacío sin romperse');
}
{
  const H = construirHoy({ hoy: HOY });
  ok(H.todoAlDia === true, 'sin ningún dato la bandeja dice que no hay nada, no se cae');
  ok(resumenRiel(H) !== '', 'y el resumen se puede generar igual');
  ok(resumenRiel(null) === '', 'un resumen sin bandeja devuelve vacío en lugar de explotar');
}

console.log(fallos === 0 ? '\n✅ hoy.js: todo pasa\n' : `\n❌ hoy.js: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
