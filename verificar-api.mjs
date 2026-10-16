// verificar-api.mjs — correr ANTES de desplegar cualquier cambio en api/
//
//   node verificar-api.mjs
//
// POR QUÉ EXISTE
// El 16/10/2026 el portal estuvo devolviendo 500 a los clientes en plena
// sala. La causa: una edición partió el template literal de la consulta a
// PostgREST y los comentarios quedaron DENTRO de la URL:
//
//     sb(`ejecucion_registros?plan_id=in.(${idsList})          //
//        // LÍMITE: era 600 y el portal muestra 8 semanas.
//        ...
//
// Lo que se había corrido antes de desplegar, y por qué no lo vio ninguno:
//
//   node --check api/portal.js   -> dijo OK. Parsea el archivo como
//                                   CommonJS; para un archivo ESM hay que
//                                   usar --input-type=module.
//   npx vite build               -> dijo OK. El build de Vite no toca api/:
//                                   las funciones serverless no entran.
//   tests con jsdom              -> dijeron OK. Mockeaban fetch, así que
//                                   nunca ejecutaron api/portal.js.
//
// Este script cierra ese agujero: carga el módulo de verdad, EJECUTA el
// handler con fetch interceptado, y revisa cada URL que le manda a
// PostgREST. Una URL con saltos de línea o comentarios adentro falla acá.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const DIR = "api";
const archivos = fs.readdirSync(DIR).filter(f => f.endsWith(".js"));
let fallas = 0;
const fallo = (m) => { fallas++; console.log("  ✗ " + m); };

// ── 1) Sintaxis, parseando como MÓDULO ────────────────────────────────────
console.log("1) Sintaxis como módulo ES");
for (const f of archivos) {
  const p = path.join(DIR, f);
  try {
    execFileSync(process.execPath, ["--input-type=module", "--check"],
      { input: fs.readFileSync(p, "utf8"), stdio: ["pipe", "pipe", "pipe"] });
    console.log(`  · ${f}`);
  } catch (e) {
    fallo(`${f}: ${String(e.stderr || e.message).split("\n").find(l => /Error/.test(l)) || "no parsea"}`);
  }
}
if (fallas) { console.log(`\n${fallas} falla(s). No desplegar.`); process.exit(1); }

// ── 2) Ejecutar el handler del portal y revisar las URLs ──────────────────
console.log("\n2) Ejecución real de api/portal.js y forma de cada URL");
const urls = [];
globalThis.fetch = async (u) => {
  urls.push(String(u));
  const ruta = String(u).split("/rest/v1/")[1] || "";
  let body = [];
  if (ruta.startsWith("gym_clients"))
    body = [{ id: "cli_1", nombre: "Prueba", apellido: "X", nivel: "activa",
              portal_token: "TOKEN-DE-PRUEBA-32-CARACTERES", screening: {}, criterios_avance_estado: {} }];
  else if (ruta.startsWith("gym_planes"))
    body = [{ id: "plan_1", nombre: "Plan", estado: "activo",
              fecha_inicio: "2026-09-14", fecha_fin_estimada: "2027-01-03",
              dias: [{ id: "d1", name: "Sesion 1",
                       blocks: [{ name: "P", exercises: [{ exId: "e1" }] }] }] }];
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
};
process.env.SUPABASE_URL ||= "https://ejemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "clave-de-prueba";

const mod = await import(pathToFileURL(path.resolve(DIR, "portal.js")).href);
const res = {
  _s: 200, _j: null,
  status(c) { this._s = c; return this; },
  json(x) { this._j = x; return this; },
};
await mod.default({ method: "GET", query: { token: "TOKEN-DE-PRUEBA-32-CARACTERES" }, headers: {} }, res);

if (res._s >= 400) fallo(`el handler devolvió HTTP ${res._s}: ${JSON.stringify(res._j)}`);
else console.log(`  · el handler devolvió HTTP ${res._s}`);
console.log(`  · ${urls.length} consultas a PostgREST`);

for (const [i, u] of urls.entries()) {
  const mal = [];
  if (/[\n\r]/.test(u)) mal.push("tiene saltos de línea");
  if (/\s{3,}/.test(u)) mal.push("tiene indentación adentro");
  if (/\/\/[^/]/.test(u.replace(/^https?:\/\//, ""))) mal.push("tiene // de comentario");
  if (/\bsb\(/.test(u)) mal.push("tiene una llamada sb( adentro");
  try { new URL(u); } catch { mal.push("no es una URL válida"); }
  if (mal.length) {
    fallo(`consulta ${i + 1}: ${mal.join(" · ")}`);
    console.log("    " + u.slice(0, 180).replace(/\n/g, "\\n⏎") + (u.length > 180 ? "…" : ""));
  }
}
if (!urls.some(u => /[\n\r]/.test(u))) console.log("  · todas las URLs son de una sola línea");

// ── 3) La consulta de registros, en detalle ───────────────────────────────
// Es la que rompió el 16/10 y la que alimenta el calendario del portal.
const q = urls.find(u => /ejecucion_registros/.test(u));
if (!q) fallo("no se consultó ejecucion_registros");
else {
  console.log("\n3) Consulta de registros de ejecución");
  const sel = decodeURIComponent((q.match(/select=([^&]*)/) || [])[1] || "");
  const ord = decodeURIComponent((q.match(/order=([^&]*)/) || [])[1] || "");
  const lim = parseInt((q.match(/limit=(\d+)/) || [])[1] || "0", 10);
  const ok = (c, t) => console.log(`  ${c ? "·" : "✗"} ${t}`) || (c ? 0 : fallas++);
  ok(sel.split(",").includes("fecha"), `select incluye 'fecha'  (${sel.split(",").length} columnas)`);
  ok(/^fecha\./.test(ord), `ordena por fecha primero  (${ord})`);
  ok(lim >= 1000, `límite suficiente para un plan grande  (${lim})`);
}

console.log(fallas ? `\n${fallas} falla(s). NO DESPLEGAR.` : "\nTodo bien. Se puede desplegar.");
process.exit(fallas ? 1 : 0);
