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
  const rows = await sb(`gym_clients?portal_token=eq.${enc}&select=id,nombre,apellido,nivel,objetivo,periodizacion,periodizacion_inicio,periodizacion_fin,criterios_avance_estado,screening`);
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
        logs = await sb(`ejecucion_registros?plan_id=in.(${idsList})&select=plan_id,dia_id,ejercicio_id,semana,peso_real,reps_real,rpe_real,updated_at`);
        const ejs = await sb(`ejercicios?select=id,nombre,media_url,media_tipo,media_desc`);
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

      return res.status(200).json({
        cliente: { nombre: cli.nombre, apellido: cli.apellido, nivel: cli.nivel, objetivo: cli.objetivo,
          periodizacion: cli.periodizacion, periodizacionInicio: cli.periodizacion_inicio, periodizacionFin: cli.periodizacion_fin,
          criteriosEstado: cli.criterios_avance_estado || {}, screening: cli.screening || {} },
        criterios, brand, plan, logs: logs || [], nombres, media,
      });
    }

    // ── ESCRITURA: el cliente registra lo que hizo ──
    if (req.method === "POST") {
      const b = req.body || {};
      const cli = await clienteDeToken(b.token);
      if (!cli) return res.status(403).json({ error: "Acceso no válido" });

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
      const pesoNum = (b.peso_real === "" || b.peso_real == null) ? null : Number(b.peso_real);
      const row = {
        id,
        gym_client_id: cli.id,
        plan_id, dia_id,
        dia_nombre: dia_nombre || "",
        ejercicio_id,
        ejercicio_nombre: ejercicio_nombre || "",
        semana: parseInt(semana),
        peso_real: isNaN(pesoNum) ? null : pesoNum,
        reps_real: (b.reps_real ?? "").toString(),
        rpe_real: (b.rpe_real ?? "").toString(),
        updated_at: new Date().toISOString(),
      };
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
