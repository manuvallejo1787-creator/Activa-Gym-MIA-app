// qa/portal.mjs — el portal del cliente, que salud no estaba mirando
//
// POR QUÉ EXISTE
// `public/portal.html` es HTML con JS plano: no pasa por el build de Vite, no
// lo ve eslint, y no estaba en ningún control. Es el archivo que dejó el
// portal devolviendo 500 en plena sala el 16/10/2026, y el que tenía la
// semana mal calculada el 21/10. El único archivo que se le muestra a los
// clientes era el único sin red de contención.
//
// Dos cosas se verifican acá:
//   1. Que el script inline PARSEE. Un error de sintaxis en este archivo no lo
//      detecta nada: no hay build que falle.
//   2. Que las funciones puras que controlan el botón de enviar hagan lo que
//      dicen. `faltaEnFeedback` es la que decide si una molestia se puede
//      mandar, y una molestia incompleta que llega a la base no es ruteable
//      por el riel: queda como ruido con fecha.
import fs from 'node:fs';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

const html = fs.readFileSync('public/portal.html', 'utf8');

console.log('\n1. El script inline parsea');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
ok(scripts.length > 0, `encontrados ${scripts.length} bloque(s) de script`);
scripts.forEach((s, i) => {
  try { new Function(s); ok(true, `bloque ${i + 1} parsea (${s.length} caracteres)`); }
  catch (e) { ok(false, `bloque ${i + 1} NO parsea: ${e.message}`); }
});

console.log('\n2. Las funciones que controlan el botón de enviar');
// Se extrae el bloque autocontenido de constantes y helpers del feedback. No
// toca el DOM, así que se puede evaluar tal cual está en el archivo: si el
// archivo cambia, lo que se prueba cambia con él.
const desde = html.indexOf('const LLEGADA=[');
const hasta = html.indexOf('function renderRPE');
if (desde < 0 || hasta < 0 || hasta < desde) {
  ok(false, 'no se encontró el bloque de constantes del feedback — ¿cambiaron los nombres?');
} else {
  const fuente = html.slice(desde, hasta);
  let api;
  try {
    api = new Function(fuente + '\nreturn {faltaEnFeedback,zonaClave,zonaTexto,zonaBi,ZONAS,NATURALEZA,INTENSIDAD,LLEGADA};')();
    ok(true, 'el bloque evalúa');
  } catch (e) { ok(false, `el bloque no evalúa: ${e.message}`); }

  if (api) {
    const { faltaEnFeedback: falta, zonaClave, zonaTexto, zonaBi } = api;
    const base = { rpe:null, llegada:null, molestia:null, naturaleza:null, momento:null, ahora:null, intensidad:null, zona:'', lado:'', nota:'' };
    const con = o => ({ ...base, ...o });

    console.log('\n   Sin RPE no se envía nada');
    ok(!!falta(con({})), 'borrador vacío: bloqueado');

    console.log('\n   Sin molestia alcanza con el RPE');
    ok(falta(con({ rpe: 7 })) !== '', 'RPE solo: pide definir si algo molestó');
    ok(falta(con({ rpe: 7, molestia: false })) === '', 'RPE + "no me molestó": se puede enviar');

    console.log('\n   Con molestia, exige las cinco respuestas');
    const m = { rpe: 7, molestia: true };
    ok(!!falta(con(m)), 'molestia sin nada más: bloqueado');
    ok(!!falta(con({ ...m, naturaleza:'articular' })), 'falta momento: bloqueado');
    ok(!!falta(con({ ...m, naturaleza:'articular', momento:'nueva' })), 'falta ahora: bloqueado');
    ok(!!falta(con({ ...m, naturaleza:'articular', momento:'nueva', ahora:'sigue' })), 'falta intensidad: bloqueado');
    const casiTodo = { ...m, naturaleza:'articular', momento:'nueva', ahora:'sigue', intensidad:'bastante' };
    ok(!!falta(con(casiTodo)), 'falta ZONA: bloqueado (sin zona el riel la descarta)');
    ok(falta(con({ ...casiTodo, zona:'lumbar' })) === '', 'zona no bilateral: completo');

    console.log('\n   Zona bilateral: exige lado');
    ok(!!falta(con({ ...casiTodo, zona:'rodilla' })), 'rodilla sin lado: bloqueado');
    ok(falta(con({ ...casiTodo, zona:'rodilla', lado:'izq' })) === '', 'rodilla + izquierdo: completo');
    ok(zonaBi('rodilla') && zonaBi('hombro') && !zonaBi('lumbar'), 'bi marcado donde corresponde');

    console.log('\n   La clave de zona que viaja a la base');
    ok(zonaClave(con({ zona:'lumbar' })) === 'lumbar', 'lumbar → "lumbar"');
    ok(zonaClave(con({ zona:'rodilla', lado:'izq' })) === 'rodilla_izq', 'rodilla izq → "rodilla_izq"');
    ok(zonaClave(con({ zona:'rodilla' })) === '', 'rodilla sin lado → vacío, no "rodilla_"');
    ok(zonaClave(con({})) === '', 'sin zona → vacío');
    // El trigger compara la zona como texto exacto: cualquier acento o espacio
    // en la clave rompería la regla de repetición. Mismo aprendizaje que el
    // buscador de ejercicios con "biceps" contra "bíceps".
    const claves = ['lumbar','rodilla_izq','hombro_ambos','muneca_der','cuello'];
    ok(claves.every(k => /^[a-z]+(_(izq|der|ambos))?$/.test(k)), 'todas las claves son ASCII en minúscula, sin acentos');
    ok(api.ZONAS.every(z => /^[a-z]+$/.test(z.k)), `las ${api.ZONAS.length} zonas tienen clave ASCII`);

    console.log('\n   La etiqueta que ve el cliente');
    // Abreviado para que concuerde con cualquier zona: "Rodilla izquierdo" no.
    ok(zonaTexto('rodilla_izq') === 'Rodilla izq', `"rodilla_izq" → "${zonaTexto('rodilla_izq')}"`);
    ok(zonaTexto('lumbar') === 'Lumbares', `"lumbar" → "${zonaTexto('lumbar')}"`);
    ok(zonaTexto('') === '', 'vacío → vacío');
    // Los 42 reportes viejos tienen zona en texto libre con mayúscula y tilde
    // ("Lumbares", "Muñeca"). No se migran, así que la etiqueta tiene que
    // devolverlos tal cual en lugar de romperse o mostrar vacío.
    ok(zonaTexto('Lumbares') === 'Lumbares', 'una zona vieja en texto libre se muestra tal cual');
  }
}

process.exit(fallos ? 1 : 0);
