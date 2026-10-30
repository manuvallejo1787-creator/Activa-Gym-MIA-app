// qa/api409.mjs — el rechazo del patrón bloqueado, ejecutando el handler REAL
//
// POR QUÉ EXISTE Y POR QUÉ ASÍ
// La barrera que importa del escalón 2 es el 409 del servidor, no el candado
// del portal: un portal cacheado manda el POST igual, y cachés viejos del
// portal son un problema OBSERVADO acá — es la razón por la que existe
// PORTAL_V. Si la única barrera estuviera en el cliente, el patrón que el riel
// bloqueó seguiría recibiendo carga sin que nadie se enterara.
//
// Lo ideal sería un POST contra el despliegue. No se puede desde este entorno:
// la red sale por lista blanca y vercel.app no está, y el fetch de Vercel es
// sólo GET. Así que se ejecuta el handler de verdad —`import` de
// api/portal.js— con `fetch` simulado devolviendo las formas que PostgREST
// devolvería. Eso ejercita el camino real del código: la consulta a
// gym_superposicion, `bloqueoDe`, el status y el cuerpo de la respuesta.
//
// Lo único que no cubre es el transporte HTTP, y eso ya está verificado por
// separado: el GET del mismo despliegue respondió 200 con `portalV` correcto
// contra un token de cliente real.
//
// EL FALLO QUE ESTO ATRAPA
// Que alguien toque el orden de las validaciones del POST y el rechazo quede
// después del upsert: el registro se guardaría y DESPUÉS se devolvería 409.
// El cliente vería el aviso y el dato quedaría igual en la base.
import path from "node:path";
import { pathToFileURL } from "node:url";

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

const TOKEN = 'TOKEN-DE-PRUEBA-32-CARACTERES';
const CLI = { id: 'cli_1', nombre: 'Prueba', apellido: 'X', nivel: 'activa',
  portal_token: TOKEN, screening: {}, criterios_avance_estado: {} };

// Las escrituras que el handler intenta. Si acá aparece un ejecucion_registros
// cuando se esperaba un rechazo, el dato se guardó igual que siempre.
let escrituras = [];

function montarFetch({ bloqueado = null } = {}) {
  escrituras = [];
  globalThis.fetch = async (u, opts = {}) => {
    const s = String(u);
    const ruta = s.split('/rest/v1/')[1] || '';
    const metodo = (opts.method || 'GET').toUpperCase();
    if (metodo !== 'GET') escrituras.push({ ruta: ruta.split('?')[0], metodo });

    let body = [];
    if (ruta.startsWith('gym_clients')) body = [CLI];
    else if (ruta.startsWith('gym_planes')) body = [{ id: 'plan_1', nombre: 'Plan', estado: 'activo',
      fecha_inicio: '2026-09-14', fecha_fin_estimada: '2027-01-03',
      dias: [{ id: 'd1', name: 'Sesion 1', blocks: [{ exercises: [{ exId: 'e1' }] }] }] }];
    else if (ruta.startsWith('gym_superposicion')) body = bloqueado ? [bloqueado] : [];
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

process.env.SUPABASE_URL ||= 'https://ejemplo.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'clave-de-prueba';
const mod = await import(pathToFileURL(path.resolve('api/portal.js')).href);

const nuevaRes = () => ({ _s: 200, _j: null,
  status(c) { this._s = c; return this; }, json(x) { this._j = x; return this; } });

const postear = async (ejercicio_id, cfg) => {
  montarFetch(cfg);
  const res = nuevaRes();
  await mod.default({
    method: 'POST', query: {}, headers: {},
    body: { token: TOKEN, plan_id: 'plan_1', dia_id: 'd1', dia_nombre: 'Sesion 1',
      ejercicio_id, ejercicio_nombre: 'Press', semana: 1, campo: 'peso',
      peso_real: '80', fecha: '2026-10-30' },
  }, res);
  return res;
};

const FILA = {
  incidencia_id: 'inc_x', zona: 'hombro_der', escalon: 1, estado: 'valoracion_pendiente',
  patron_bloqueado: ['e1'], patron_dias: [], motivo: 'molestia al empujar',
  bloquea_carga: true,
};

console.log('\n1. El ejercicio bloqueado se rechaza con 409 y se explica');
{
  const r = await postear('e1', { bloqueado: FILA });
  ok(r._s === 409, `devuelve 409 y no 200 ni 403 (dio ${r._s})`);
  ok(r._j?.error === 'patron_bloqueado', 'con un código que el portal puede distinguir');
  ok(/hombro der/.test(r._j?.mensaje || ''), 'el mensaje nombra la zona en texto, sin guión bajo');
  ok(/bloque dirigido/.test(r._j?.mensaje || ''), 'y le dice al cliente qué hacer en su lugar');
  ok(!/error/i.test(r._j?.mensaje || ''),
    'y NO dice "error": el cliente reportó una molestia y el centro tomó una conducta');
  ok(r._j?.escalon === 1 && r._j?.estado === 'valoracion_pendiente',
    'viaja el escalón y el estado, para poder diagnosticar sin abrir la base');
  // EL CONTROL QUE IMPORTA: nada se escribió.
  const guardo = escrituras.some(e => e.ruta.startsWith('ejecucion_registros'));
  ok(!guardo, 'NO escribió en ejecucion_registros: el rechazo va ANTES del upsert');
}

console.log('\n2. Un ejercicio libre del mismo plan se guarda normal');
{
  const r = await postear('e_otro', { bloqueado: FILA });
  ok(r._s === 200, `devuelve 200 (dio ${r._s})`);
  ok(escrituras.some(e => e.ruta.startsWith('ejecucion_registros')),
    'y sí escribe: bloquear un patrón no puede frenar el resto de la sesión');
}

console.log('\n3. Sin bloqueo, todo pasa como antes');
{
  const r = await postear('e1', { bloqueado: null });
  ok(r._s === 200, 'sin fila en gym_superposicion el mismo ejercicio se guarda');
  ok(escrituras.some(e => e.ruta.startsWith('ejecucion_registros')), 'y la escritura ocurre');
}

console.log('\n4. patron_dias acotado: sólo rechaza en el día que corresponde');
{
  const r = await postear('e1', { bloqueado: { ...FILA, patron_dias: ['d_otro'] } });
  ok(r._s === 200, 'el POST a d1 pasa cuando el bloqueo es de otro día');
  const r2 = await postear('e1', { bloqueado: { ...FILA, patron_dias: ['d1'] } });
  ok(r2._s === 409, 'y se rechaza cuando el bloqueo incluye d1');
}

console.log('\n5. `programa` no rechaza: el escalón 2 es trabajo, no freno');
{
  const r = await postear('e1', { bloqueado: { ...FILA, estado: 'programa', bloquea_carga: false } });
  ok(r._s === 200, 'con bloquea_carga en false la carga se guarda');
}

console.log('\n6. Si la verificación falla, NO se pierde el registro del cliente');
{
  // Perder la carga del cliente es peor que dejar pasar una serie en un patrón
  // sustituido. Se simula que la consulta a la vista revienta.
  escrituras = [];
  globalThis.fetch = async (u, opts = {}) => {
    const s = String(u); const ruta = s.split('/rest/v1/')[1] || '';
    if ((opts.method || 'GET').toUpperCase() !== 'GET') escrituras.push({ ruta: ruta.split('?')[0] });
    if (ruta.startsWith('gym_superposicion')) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
    let body = [];
    if (ruta.startsWith('gym_clients')) body = [CLI];
    else if (ruta.startsWith('gym_planes')) body = [{ id: 'plan_1', dias: [] }];
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
  const res = nuevaRes();
  await mod.default({ method: 'POST', query: {}, headers: {},
    body: { token: TOKEN, plan_id: 'plan_1', dia_id: 'd1', ejercicio_id: 'e1',
      ejercicio_nombre: 'Press', semana: 1, campo: 'peso', peso_real: '80', fecha: '2026-10-30' } }, res);
  ok(res._s === 200, `con la vista caída el guardado sigue (dio ${res._s})`);
  ok(escrituras.some(e => e.ruta.startsWith('ejecucion_registros')), 'y el registro del cliente se escribe');
}

console.log(fallos === 0 ? '\n✅ rechazo 409: todo pasa\n' : `\n❌ rechazo 409: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
