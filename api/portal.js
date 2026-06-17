// api/portal.js — Portal del cliente (frontera de seguridad)
// El portal del cliente NUNCA toca Supabase directo. Pasa por acá.
// Esta función valida el token personal del cliente y usa la SERVICE ROLE KEY
// (solo en el servidor) para devolver/escribir EXCLUSIVAMENTE los datos de ese cliente.
//
// Variables de entorno necesarias en Vercel:
//   SUPABASE_URL                (ej: https://husokxkdwgpjwtgrijei.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (Supabase → Settings → API → service_role)

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const rows = await sb(`gym_clients?portal_token=eq.${enc}&select=id,nombre,apellido`);
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

      const planes = await sb(`gym_planes?gym_client_id=eq.${cli.id}&estado=eq.activo&select=id,nombre,fecha_inicio,fecha_fin_estimada,num_dias,dias,plazos&order=created_at.desc&limit=1`);
      const plan = Array.isArray(planes) && planes.length ? planes[0] : null;
      let logs = [];
      let nombres = {};
      if (plan) {
        logs = await sb(`ejecucion_registros?plan_id=eq.${plan.id}&select=dia_id,ejercicio_id,semana,peso_real,reps_real,rpe_real`);
        const ejs = await sb(`ejercicios?select=id,nombre`);
        (ejs || []).forEach(e => { nombres[e.id] = e.nombre; });
      }
      return res.status(200).json({ cliente: { nombre: cli.nombre, apellido: cli.apellido }, plan, logs: logs || [], nombres });
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
