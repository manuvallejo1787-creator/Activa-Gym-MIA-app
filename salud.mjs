// salud.mjs — el análisis de salud que exige el estándar de desarrollo
//
//   npm run salud
//
// POR QUÉ EXISTE
// La norma dice que después de cada intervención se corre un análisis
// completo, y que nada debe quedar desconectado. Mientras eso vivió en
// "acordarse de correr las cosas", se salteó exactamente el día que había
// apuro: el 28/10/2026 el build estaba verde y la app igual mostraba un
// screening vacío. Un control que depende de la memoria de alguien no es un
// control.
//
// Este script junta todo en un comando y termina con código distinto de cero
// si algo falla, así que no se puede saltear por apuro: o pasa, o no se
// despliega.
//
// QUÉ CORRE
//   1. eslint              — identificadores inexistentes y hooks mal puestos
//   2. verificar-api.mjs   — ejecuta de verdad los handlers de api/
//   3. vite build          — que compile
//   4. qa/*.mjs            — arneses de lógica contra datos reales
//   5. interconexión       — exports sin usar, tablas que se escriben y
//                            nadie lee, build.json emitido
//   6. base de datos       — sólo si hay credenciales de servicio en el
//                            entorno; si no, imprime el SQL a correr
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const V = '\x1b[32m', R = '\x1b[31m', A = '\x1b[33m', G = '\x1b[90m', X = '\x1b[0m'
let fallas = 0, avisos = 0
const etapa = (n, t) => console.log(`\n${G}── ${n}. ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}${X}`)
const bien  = m => console.log(`  ${V}✓${X} ${m}`)
const mal   = m => { fallas++; console.log(`  ${R}✗${X} ${m}`) }
const aviso = m => { avisos++; console.log(`  ${A}!${X} ${m}`) }

const correr = (cmd, args) => {
  try { execFileSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' }); return { ok: true, out: '' } }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') } }
}

// ── 1. eslint ──────────────────────────────────────────────────────────────
etapa(1, 'eslint: identificadores y hooks')
{
  const r = correr('npx', ['eslint', 'src/'])
  // eslint sale con 1 por errores Y por warnings si hay --max-warnings; acá
  // sólo importan los errores, que son los que rompen la pantalla.
  const errores = (r.out.match(/(\d+) error/) || [])[1]
  if (!r.ok && errores && +errores > 0) { mal(`${errores} error(es) de eslint`); console.log(r.out.trim()) }
  else bien('sin errores (no-undef, rules-of-hooks)')
}

// ── 2. api/ ────────────────────────────────────────────────────────────────
etapa(2, 'verificar-api: los handlers se ejecutan de verdad')
{
  const r = correr('node', ['verificar-api.mjs'])
  if (!r.ok) { mal('verificar-api falló'); console.log(r.out.trim()) } else bien('api/ responde y sus URLs a PostgREST están bien formadas')
}

// ── 3. build ───────────────────────────────────────────────────────────────
etapa(3, 'vite build')
{
  const r = correr('npx', ['vite', 'build'])
  if (!r.ok) { mal('el build falló'); console.log(r.out.trim()) } else bien('compila')
}

// ── 4. arneses de lógica ───────────────────────────────────────────────────
etapa(4, 'qa/: arneses de lógica contra datos reales')
{
  const dir = 'qa'
  const archivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort() : []
  if (!archivos.length) aviso('no hay arneses en qa/')
  for (const f of archivos) {
    const r = correr('node', [path.join(dir, f)])
    if (!r.ok) { mal(`qa/${f}`); console.log(r.out.trim()) } else bien(`qa/${f}`)
  }
}

// ── 5. interconexión ───────────────────────────────────────────────────────
// "Nada debe quedar desconectado": material o información que no se conecta
// a otro punto, o que no es esencial en uso.
etapa(5, 'interconexión: nada suelto')
{
  const fuentes = []
  const caminar = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) caminar(p)
      else if (/\.(js|jsx|mjs)$/.test(e.name)) fuentes.push(p)
    }
  }
  for (const d of ['src', 'api', 'qa']) if (fs.existsSync(d)) caminar(d)
  const texto = Object.fromEntries(fuentes.map(f => [f, fs.readFileSync(f, 'utf8')]))

  // 5a. Exports que nadie importa.
  const exportados = []
  for (const [f, t] of Object.entries(texto)) {
    for (const m of t.matchAll(/^export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm))
      exportados.push({ f, nombre: m[1] })
    for (const m of t.matchAll(/^export\s*\{([^}]+)\}/gm))
      for (const n of m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean))
        exportados.push({ f, nombre: n })
  }
  // Hay que distinguir DOS casos que al principio este control confundía, y
  // confundirlos lo volvía ruidoso — un control ruidoso se empieza a ignorar:
  //   · MUERTO          — no se menciona en ninguna parte, ni en su archivo.
  //                       Eso es material sin conectar: falla.
  //   · SOBRE-EXPORTADO — se usa dentro de su propio archivo pero nadie lo
  //                       importa. Sobra la palabra `export`, nada más: avisa.
  // Se cuenta sin comentarios, para que una mención en una línea de comentario
  // no mantenga vivo a un export que ya no se usa.
  const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const limpio = Object.fromEntries(Object.entries(texto).map(([f, t]) => [f, sinComentarios(t)]))
  const muertos = [], sobre = []
  for (const { f, nombre } of exportados) {
    const re = new RegExp(`\\b${nombre.replace(/\$/g, '\\$')}\\b`, 'g')
    const externos = Object.entries(limpio)
      .filter(([g]) => g !== f)
      .reduce((n, [, t]) => n + (t.match(re) || []).length, 0)
    // En su propio archivo, la declaración cuenta una vez: se descuenta.
    const propias = (limpio[f].match(re) || []).length
    const internos = Math.max(0, propias - 1)
    if (externos === 0 && internos === 0) muertos.push({ f, nombre })
    else if (externos === 0) sobre.push({ f, nombre })
  }
  // DEUDA ACEPTADA — no bloquea, pero se imprime en CADA corrida.
  //
  // No es una lista de silencio: es una lista de pendientes con nombre, fecha
  // y motivo. Un control que se puede apagar deja de ser un control, así que
  // estos siguen apareciendo hasta que Manu decida conectarlos o descartarlos.
  // Son los dos casos del 29/10/2026 que NO son código muerto sino función
  // construida y nunca enchufada, que es justo lo que el estándar apunta.
  const DEUDA = {
    PROMPT_INTERPRETACION: 'prompt de la capa interpretativa, escrito y nunca llamado — conectar o descartar (29/10/2026)',
    brandHeaderHTML: 'encabezado unificado para los 6 PDFs; hoy cada uno arma el suyo — aplicar o descartar (29/10/2026)',
  }
  const bloquean = muertos.filter(h => !DEUDA[h.nombre])
  const enDeuda  = muertos.filter(h => DEUDA[h.nombre])
  if (bloquean.length) {
    mal(`${bloquean.length} export(s) sin una sola referencia en todo el repo:`)
    for (const h of bloquean) console.log(`      ${h.nombre}  (${h.f})`)
  } else bien(`los ${exportados.length} exports no tienen código muerto nuevo`)
  for (const h of enDeuda) aviso(`deuda · ${h.nombre} (${h.f}): ${DEUDA[h.nombre]}`)
  for (const n of Object.keys(DEUDA))
    if (!muertos.some(h => h.nombre === n))
      aviso(`deuda saldada · ${n} ya se usa: sacarlo de la lista DEUDA en salud.mjs`)
  if (sobre.length) aviso(`${sobre.length} export(s) usados sólo dentro de su archivo: sobra el \`export\` (no bloquea)`)

  // 5b. Tablas que se escriben y nadie lee.
  // Información que entra y nadie usa es justamente lo que la norma prohíbe.
  const tablas = {}
  for (const t of Object.values(texto)) {
    // La cola va en un LOOKAHEAD, no en el match: con `([\s\S]{0,120})`
    // normal, matchAll consume esos 120 caracteres y se traga el `.from()`
    // siguiente. En db.js hay varios consecutivos, así que `hoy_descartes`
    // aparecía como "se escribe y nadie lee" cuando se lee en la línea de
    // arriba. Primer falso positivo de este control, y el motivo por el que
    // vale calibrarlo antes de confiar en él.
    for (const m of t.matchAll(/\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)(?=([\s\S]{0,120}))/g)) {
      const [, tabla, cola] = m
      tablas[tabla] ??= { lee: false, escribe: false }
      if (/\.select\(/.test(cola)) tablas[tabla].lee = true
      if (/\.(insert|upsert|update|delete)\(/.test(cola)) tablas[tabla].escribe = true
    }
    // api/ habla PostgREST por URL, no por el cliente de Supabase.
    for (const m of t.matchAll(/sb\(\s*[`'"]([a-z_0-9]+)[?`'"]/g)) {
      tablas[m[1]] ??= { lee: false, escribe: false }
      tablas[m[1]].lee = true
    }
  }
  const ciegas = Object.entries(tablas).filter(([, v]) => v.escribe && !v.lee).map(([k]) => k)
  if (ciegas.length) mal(`tabla(s) que se escriben y nadie lee: ${ciegas.join(', ')}`)
  else bien(`las ${Object.keys(tablas).length} tablas referenciadas se leen y se escriben de forma coherente`)

  // 5c. build.json: sin él, el aviso de versión vieja no puede funcionar.
  if (fs.existsSync('dist/build.json')) {
    const b = JSON.parse(fs.readFileSync('dist/build.json', 'utf8'))
    if (b?.build) bien(`dist/build.json emitido (build ${b.build})`)
    else mal('dist/build.json existe pero no trae el campo "build"')
  } else mal('falta dist/build.json — el aviso de versión vieja queda inerte')
}

// ── 6. base de datos ───────────────────────────────────────────────────────
etapa(6, 'base de datos: RLS, publicación de Realtime, datos sueltos')
{
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    aviso('sin SUPABASE_SERVICE_KEY en el entorno: estos controles quedan pendientes.')
    console.log(`${G}      Correr salud.sql contra la base. Detecta:
        · tablas con RLS activo y CERO políticas (quedan inertes en
          producción: fue el caso de screening_bandas el 20/10)
        · tablas que la app espera ver en vivo y no están en la
          publicación supabase_realtime
        · columnas con 100% de valores nulos (información que nadie llena)${X}`)
  } else {
    bien('credenciales presentes — los controles de base corren en salud.sql')
  }
}

// ── Veredicto ──────────────────────────────────────────────────────────────
console.log()
if (fallas) {
  console.log(`${R}✗ ${fallas} falla(s)${X}${avisos ? ` · ${A}${avisos} aviso(s)${X}` : ''} — NO desplegar`)
  process.exit(1)
}
console.log(`${V}✓ Salud OK${X}${avisos ? ` · ${A}${avisos} aviso(s)${X}` : ''} — se puede desplegar`)
