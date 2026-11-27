// verificar-arranque.mjs — QUE LA APP ABRA, NO SOLO QUE COMPILE
//
// ═══════════════════════════════════════════════════════════════════════════
// EL 27/11/2026 SALUD DIJO "SE PUEDE DESPLEGAR" Y LA APP NO ABRÍA
// ═══════════════════════════════════════════════════════════════════════════
// Pantalla de error en producción: "Cannot access 'vincularCliente' before
// initialization". Y antes de desplegarlo: eslint limpio, vite build en verde,
// 14 arneses pasando, "✓ Salud OK — se puede desplegar".
//
// Ninguna de esas cosas abre la aplicación.
//
// La causa: una variable nombrada en la lista de dependencias de un useCallback
// declarado 472 líneas ANTES que ella. Una dependencia se evalúa durante el
// render y no cuando la función se llama, así que React lee el nombre antes de
// que exista. El compilador no lo ve —el código es sintácticamente válido— y
// eslint tampoco, porque agregar esa dependencia es exactamente lo que la regla
// exhaustive-deps recomienda hacer.
//
// Un error así solo aparece EJECUTANDO. Por eso esto levanta el build en un
// Chromium de verdad y mira si la app arranca.
//
// QUÉ SE CONSIDERA FALLA
//  · cualquier error de página o de consola al cargar
//  · que el contenedor de la app quede vacío (pantalla en blanco)
//  · que se vea el cartel de "Error al cargar la aplicación"
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const PUERTO = 4199;
const req = createRequire(import.meta.url);

let pw;
try { pw = req('playwright'); }
catch {
  // Sin navegador no se puede verificar. Se avisa y NO se bloquea el
  // despliegue: un control que no puede correr no debería trabar el trabajo,
  // pero tiene que decir en voz alta que no corrió.
  console.log('⚠ playwright no está disponible: NO se pudo verificar que la app arranque.');
  console.log('  El build compila, pero nadie comprobó que abra. Verificalo a mano antes de desplegar.');
  process.exit(0);
}

if (!existsSync('dist/index.html')) {
  console.log('✗ No hay dist/: corré el build antes que esto.');
  process.exit(1);
}

// ── QUE NO SE PRUEBE UN BUILD VIEJO ───────────────────────────────────────
// Encontrado probando este mismo control el 27/11: se reintrodujo el bug a
// propósito, el build falló, y esto igual dijo "✓ arranca" — porque estaba
// abriendo el dist/ de la compilación ANTERIOR. Un control que da verde
// contra un artefacto viejo es peor que no tener control: da confianza falsa
// justo cuando algo se rompió.
{
  const masNuevo = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
    const ruta = join(dir, e.name);
    return Math.max(max, e.isDirectory() ? masNuevo(ruta) : statSync(ruta).mtimeMs);
  }, 0);
  const fuente = Math.max(masNuevo('src'), statSync('index.html').mtimeMs);
  const build = statSync('dist/index.html').mtimeMs;
  if (fuente > build) {
    const seg = Math.round((fuente - build) / 1000);
    console.log(`✗ El dist/ es más viejo que el código (por ${seg}s): se estaría probando un build anterior.`);
    console.log('  Compilá de nuevo antes de verificar el arranque.');
    process.exit(1);
  }
}

const servidor = spawn('npx', ['vite', 'preview', '--port', String(PUERTO)],
  { stdio: 'ignore', detached: false });

const limpiar = () => { try { servidor.kill('SIGKILL'); } catch { /* ya murió */ } };
process.on('exit', limpiar);

let codigo = 1;
try {
  // Esperar a que el servidor responda, en lugar de dormir un tiempo fijo:
  // una espera fija falla el día que la máquina está lenta y pasa el día que
  // está rápida, que es la peor clase de prueba.
  let vivo = false;
  for (let i = 0; i < 40 && !vivo; i++) {
    try { const r = await fetch(`http://localhost:${PUERTO}/`); vivo = r.ok; }
    catch { await new Promise(r => setTimeout(r, 250)); }
  }
  if (!vivo) { console.log('✗ El servidor de preview no levantó.'); process.exit(1); }

  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage();
  const problemas = [];
  pagina.on('pageerror', e => problemas.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') problemas.push(m.text().split('\n')[0]); });

  await pagina.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await pagina.waitForTimeout(2500);

  const visible = await pagina.evaluate(() => ({
    texto: (document.body.innerText || '').trim(),
    raiz: (document.getElementById('root')?.innerHTML || '').length,
  }));

  await navegador.close();

  // Se desduplican: un mismo error de React se repite varias veces y no aporta.
  const unicos = [...new Set(problemas)];
  if (unicos.length) {
    console.log('✗ LA APP NO ARRANCA LIMPIA. Errores al cargar:');
    unicos.slice(0, 6).forEach(p => console.log('   · ' + p));
  } else if (visible.raiz < 200) {
    console.log(`✗ PANTALLA EN BLANCO: el contenedor de la app quedó con ${visible.raiz} caracteres.`);
  } else if (/Error al cargar la aplicación/i.test(visible.texto)) {
    console.log('✗ Se ve el cartel de "Error al cargar la aplicación".');
    console.log('   ' + visible.texto.slice(0, 200));
  } else {
    console.log(`✓ Arranca y pinta (${visible.raiz} caracteres en pantalla, sin errores de consola).`);
    codigo = 0;
  }
} catch (e) {
  console.log('✗ No se pudo verificar el arranque: ' + e.message);
} finally {
  limpiar();
}
process.exit(codigo);
