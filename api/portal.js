// api/portal.js — Portal del cliente (frontera de seguridad)
// El portal del cliente NUNCA toca Supabase directo. Pasa por acá.
// Esta función valida el token personal del cliente y usa la SERVICE ROLE KEY
// (solo en el servidor) para devolver/escribir EXCLUSIVAMENTE los datos de ese cliente.
//
// Variables de entorno necesarias en Vercel:
//   SUPABASE_URL                (ej: https://husokxkdwgpjwtgrijei.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (Supabase → Settings → API → service_role)

// Limpia barras finales y un /rest/v1 pegado de más, para evitar paths inválidos (PGRST125)
const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

async function sb(path, opts = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

// Valida el token y devuelve el cliente (o null)
async function clienteDeToken(token) {
  if (!token || typeof token !== "string" || token.length < 8) return null;
  const enc = encodeURIComponent(token);
  const rows = await sb(`gym_clients?portal_token=eq.${enc}&select=id,nombre,apellido,nivel,objetivo,periodizacion,periodizacion_inicio,periodizacion_fin,criterios_avance_estado,screening,fisio_paciente_id`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export default async function handler(req, res) {
  if (!URL || !KEY) {
    return res.status(500).json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel" });
  }

  try {
    // ── LECTURA: plan activo del cliente + registros ──
    if (req.method === "GET") {
      const token = req.query.token;
      const cli = await clienteDeToken(token);
      if (!cli) return res.status(403).json({ error: "Acceso no válido" });

      // Antes esto tomaba solo el plan 'activo' más reciente (limit=1). Si el
      // profesional arma varias sesiones por separado y las junta en bloque
      // para el PDF (función "Compilar bloque" del historial), esos planes
      // SIGUEN estando todos como 'activo' — nada los archiva automáticamente.
      // El portal terminaba mostrando solo el último, aunque el PDF sí las
      // mostraba todas juntas. Ahora el portal combina TODOS los planes
      // activos en un solo plan virtual, igual que hace el PDF.
      const planes = await sb(`gym_planes?gym_client_id=eq.${cli.id}&estado=eq.activo&select=id,nombre,fecha_inicio,fecha_fin_estimada,num_dias,dias,plazos,created_at&order=fecha_inicio.asc.nullslast,created_at.asc`);
      const planesActivos = Array.isArray(planes) ? planes : [];
      let plan = null;
      let logs = [];
      let nombres = {};
      let media = {};
      if (planesActivos.length) {
        const diasCombinados = [];
        planesActivos.forEach(p => {
          (p.dias || []).forEach(d => diasCombinados.push({ ...d, _planId: p.id }));
        });
        plan = {
          id: planesActivos.length === 1 ? planesActivos[0].id : "combinado",
          nombre: planesActivos.length === 1 ? planesActivos[0].nombre : planesActivos.map(p => p.nombre).join(" + "),
          fecha_inicio: planesActivos[0].fecha_inicio,
          fecha_fin_estimada: planesActivos[planesActivos.length - 1].fecha_fin_estimada,
          dias: diasCombinados,
        };
        const idsList = planesActivos.map(p => `"${p.id}"`).join(",");

        // Solo los ejercicios que REALMENTE están en el plan de este cliente.
        // Antes se pedían los 424 de la base en cada carga del portal, aunque
        // un plan típico use ~25. Eso hacía una respuesta de ~87 kB y, en free
        // tier con arranque en frío, la cadena de consultas superaba el tiempo
        // límite: Supabase devolvía "Bad Gateway" o "Failed to get project
        // config" de forma intermitente.
        const idsEjercicios = new Set();
        planesActivos.forEach(pl => (pl.dias || []).forEach(d =>
          (d.blocks || []).forEach(b => (b.exercises || []).forEach(e => {
            if (e && e.exId) idsEjercicios.add(e.exId);
          }))));

        // Las dos consultas restantes no dependen entre sí: van en paralelo.
        const [logsRes, ejs] = await Promise.all([
          sb(`ejecucion_registros?plan_id=in.(${idsList})&select=plan_id,dia_id,ejercicio_id,semana,peso_real,reps_real,rpe_real,series_detalle,updated_at&order=updated_at.desc&limit=600`),
          idsEjercicios.size
            ? sb(`ejercicios?id=in.(${[...idsEjercicios].map(i => `"${i}"`).join(",")})&select=id,nombre,media_url,media_tipo,media_desc`)
            : Promise.resolve([]),
        ]);
        logs = logsRes;
        (ejs || []).forEach(e => {
          nombres[e.id] = e.nombre;
          if (e.media_url) media[e.id] = { url: e.media_url, tipo: e.media_tipo || "imagen", desc: e.media_desc || "" };
        });
      }
      // Criterios de avance de la fase actual del cliente (plantilla, no editable acá)
      let criterios = [];
      if (cli.nivel) {
        const rows = await sb(`criterios_avance_template?fase=eq.${encodeURIComponent(cli.nivel)}&select=criterios`);
        criterios = Array.isArray(rows) && rows.length ? (rows[0].criterios || []) : [];
      }
      // Marca del centro (para que el portal use la paleta real, no una fija)
      let brand = null;
      try {
        const brandRows = await sb(`centro_config?id=eq.default&select=gym_name,gym_sub,logo_img,color_primary,color_bg`);
        if (Array.isArray(brandRows) && brandRows.length) brand = brandRows[0];
      } catch {}

      // Si el cliente está vinculado a un paciente de FisioActiva, resumen
      // clínico (objetivo + evolución EVA/ROM inicial vs. más reciente) para
      // mostrar en el portal — el mismo "antes y después" del checkpoint,
      // en versión compacta.
      let clinico = null;
      if (cli.fisio_paciente_id) {
        try {
          const evsRows = await sb(`fisio_evaluaciones?paciente_id=eq.${cli.fisio_paciente_id}&select=tipo,fecha,fase,objetivo,eva_reposo,rom_pct&order=fecha.asc`);
          if (Array.isArray(evsRows) && evsRows.length) {
            const inicial = evsRows.find(e => e.tipo === "inicial") || evsRows[0];
            const final = evsRows[evsRows.length - 1];
            clinico = {
              objetivo: final.objetivo || inicial.objetivo || "",
              fase: final.fase || null,
              evaInicial: inicial.eva_reposo, evaActual: final.eva_reposo,
              romInicial: inicial.rom_pct, romActual: final.rom_pct,
              tieneComparativa: evsRows.length >= 2,
            };
          }
        } catch {}
      }

      // Feedback de sesión (RPE) del cliente — alimenta el portal y, del otro
      // lado, el motor y la IA cuando se arma el plan siguiente.
      let feedback = [];
      try {
        feedback = await sb(`gym_sesion_feedback?gym_client_id=eq.${cli.id}&select=dia_id,semana,fecha,rpe_sesion,energia,dolor,nota&order=fecha.desc&limit=60`) || [];
      } catch {}

      return res.status(200).json({
        feedback,
        cliente: { nombre: cli.nombre, apellido: cli.apellido, nivel: cli.nivel, objetivo: cli.objetivo,
          periodizacion: cli.periodizacion, periodizacionInicio: cli.periodizacion_inicio, periodizacionFin: cli.periodizacion_fin,
          criteriosEstado: cli.criterios_avance_estado || {}, screening: cli.screening || {} },
        criterios, brand, plan, logs: logs || [], nombres, media, clinico,
      });
    }

    // ── ESCRITURA: el cliente registra lo que hizo ──
    if (req.method === "POST") {
      const b = req.body || {};
      const cli = await clienteDeToken(b.token);
      if (!cli) return res.status(403).json({ error: "Acceso no válido" });

      // ── RPE de la sesión ──────────────────────────────────────────────
      // Una fila por (cliente, día, semana): el índice único hace que se
      // renueve sola cada semana en vez de acumular duplicados.
      if (b.accion === "feedback") {
        if (!b.dia_id || !b.semana) return res.status(400).json({ error: "Faltan datos del feedback" });
        const n = (v, min, max) => {
          const x = parseInt(v);
          return isNaN(x) ? null : Math.max(min, Math.min(max, x));
        };
        const fila = {
          id: `${cli.id}__${b.dia_id}__w${b.semana}`,
          gym_client_id: cli.id,
          plan_id: b.plan_id || null,
          dia_id: b.dia_id,
          dia_nombre: b.dia_nombre || "",
          semana: parseInt(b.semana),
          fecha: new Date().toISOString().slice(0, 10),
          rpe_sesion: n(b.rpe_sesion, 1, 10),
          energia: n(b.energia, 1, 5),
          dolor: n(b.dolor, 0, 10),
          nota: (b.nota || "").toString().slice(0, 500),
          updated_at: new Date().toISOString(),
        };
        await sb(`gym_sesion_feedback?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(fila),
        });
        return res.status(200).json({ ok: true });
      }

      const { plan_id, dia_id, dia_nombre, ejercicio_id, ejercicio_nombre, semana } = b;
      if (!plan_id || !dia_id || !ejercicio_id || !semana) {
        return res.status(400).json({ error: "Faltan datos del registro" });
      }
      // El plan debe pertenecer a este cliente
      const owns = await sb(`gym_planes?id=eq.${encodeURIComponent(plan_id)}&gym_client_id=eq.${cli.id}&select=id`);
      if (!Array.isArray(owns) || !owns.length) {
        return res.status(403).json({ error: "El plan no corresponde a este cliente" });
      }

      const id = `${plan_id}__${dia_id}__${ejercicio_id}__w${semana}`;
      // ═══════════════════════════════════════════════════════════════════
      // ACTUALIZACIÓN PARCIAL — solo se escriben los campos que cambiaron.
      //
      // BUG QUE ESTO CORRIGE: antes se mandaba la fila COMPLETA en cada
      // guardado. El cliente escribía kg, pasaba a reps, y el guardado de reps
      // salía con el peso VIEJO (el primero todavía no había vuelto). El upsert
      // pisaba la fila entera: quedaban las reps y se borraban los kg. Lo mismo
      // con series_detalle (siempre iba []) y rpe_real (siempre iba '').
      //
      // Ahora el upsert solo incluye las columnas que corresponden. PostgREST,
      // con merge-duplicates, actualiza únicamente las columnas presentes en
      // el JSON: las demás quedan intactas aunque lleguen dos pedidos cruzados.
      //
      // Reglas:
      //  · b.campo === 'peso' | 'reps' → se escribe ESE campo, aunque venga
      //    vacío (el cliente lo borró a propósito).
      //  · Sin b.campo (portal viejo todavía abierto en algún celular) → solo
      //    se escribe lo que venga con valor. Un vacío NUNCA pisa un dato.
      //  · series_detalle solo si viene como array (carga por serie).
      // ═══════════════════════════════════════════════════════════════════
      const vacio = (v) => v === "" || v == null;
      const aNumero = (v) => { const n = Number(String(v).replace(",", ".")); return isNaN(n) ? null : n; };
      const row = {
        id,
        gym_client_id: cli.id,
        plan_id, dia_id,
        dia_nombre: dia_nombre || "",
        ejercicio_id,
        ejercicio_nombre: ejercicio_nombre || "",
        semana: parseInt(semana),
        updated_at: new Date().toISOString(),
      };
      const campo = b.campo;
      if (campo === "peso") row.peso_real = vacio(b.peso_real) ? null : aNumero(b.peso_real);
      else if (!campo && !vacio(b.peso_real)) row.peso_real = aNumero(b.peso_real);

      if (campo === "reps") row.reps_real = (b.reps_real ?? "").toString().trim();
      else if (!campo && !vacio(b.reps_real)) row.reps_real = b.reps_real.toString().trim();

      if (!vacio(b.rpe_real)) row.rpe_real = b.rpe_real.toString();

      if (Array.isArray(b.series_detalle)) {
        row.series_detalle = b.series_detalle.slice(0, 12).map((x, i) => ({
          s: i + 1,
          peso: (x && x.peso != null) ? String(x.peso) : "",
          reps: (x && x.reps != null) ? String(x.reps) : "",
        }));
        // El resumen se recalcula acá, en el servidor, desde el detalle:
        // no depende de lo que el celular haya calculado con datos viejos.
        const pesos = row.series_detalle.map(x => aNumero(x.peso)).filter(v => v != null && v > 0);
        const reps = row.series_detalle.map(x => aNumero(x.reps)).filter(v => v != null);
        if (pesos.length) row.peso_real = Math.max(...pesos);
        if (reps.length) row.reps_real = String(reps.reduce((a, c) => a + c, 0));
      }

      await sb(`ejecucion_registros?on_conflict=id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
