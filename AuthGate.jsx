// AuthGate.jsx — Autenticación REAL con Supabase Auth.
//
// POR QUÉ REEMPLAZA A PasswordGate.jsx:
// PasswordGate protegía la PANTALLA, no la BASE. El propio archivo lo
// documentaba con honestidad: el JS se descarga igual, la anon key está
// adentro, y con eso alcanza para consultar Supabase directo salteando
// la pantalla de contraseña. Era una cortina, no una puerta.
//
// Con Supabase Auth, la sesión emite un JWT que el cliente manda en cada
// request. Las políticas RLS (ver migracion_auth_rls.sql) exigen ese JWT.
// Sin login no hay datos — ni desde la app, ni desde la consola, ni desde
// curl con la anon key.
//
// EFECTO SECUNDARIO ÚTIL: a partir de acá siempre se sabe QUIÉN hizo cada
// carga. El riel de incidencias usa esto para llenar `reportado_por` solo.

import { useState, useEffect } from "react";
import { supabase, isSupabaseReady } from "./supabase.js";

const RJ = "#CC0000", BG = "#1a1a1a";

export default function AuthGate({ children }) {
  const [sesion, setSesion]   = useState(null);
  const [cargando, setCargando] = useState(true);
  const [email, setEmail]     = useState("");
  const [clave, setClave]     = useState("");
  const [error, setError]     = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (!isSupabaseReady) { setCargando(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data?.session || null);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const entrar = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || !clave) { setError("Completá email y contraseña."); return; }
    setEntrando(true); setError("");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password: clave,
      });
      if (err) throw err;
      setClave("");
    } catch (err) {
      const m = (err?.message || "").toLowerCase();
      setError(m.includes("invalid") ? "Email o contraseña incorrectos."
             : m.includes("email not confirmed") ? "El usuario existe pero falta confirmar el email en Supabase."
             : err?.message || "No se pudo iniciar sesión.");
    } finally { setEntrando(false); }
  };

  // Si Supabase no está configurado, no bloqueamos: la app cae a modo local
  // (mismo criterio que el resto del proyecto). Sin backend no hay dato que
  // proteger.
  if (!isSupabaseReady) return children;

  if (cargando) {
    return (
      <div style={wrap}>
        <div style={{ color: "#999", fontSize: 13 }}>Verificando sesión…</div>
      </div>
    );
  }

  if (!sesion) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: ".06em", textAlign: "center" }}>ACTIVA</div>
          <div style={{ fontSize: 10, color: "#888", textAlign: "center", letterSpacing: ".22em", marginBottom: 22 }}>GESTIÓN DEL CENTRO</div>

          <label style={lbl}>Email</label>
          <input type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar(e)}
            placeholder="tu@email.com" style={inp} />

          <label style={{ ...lbl, marginTop: 12 }}>Contraseña</label>
          <input type="password" autoComplete="current-password" value={clave}
            onChange={(e) => setClave(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar(e)}
            placeholder="••••••••" style={inp} />

          {error && (
            <div style={{ background: "#2A1215", border: `1px solid ${RJ}`, borderRadius: 6, padding: "8px 10px", marginTop: 12, fontSize: 11, color: "#FCA5A5" }}>
              {error}
            </div>
          )}

          <button onClick={entrar} disabled={entrando}
            style={{ ...btn, opacity: entrando ? 0.6 : 1, marginTop: 16 }}>
            {entrando ? "Entrando…" : "Entrar"}
          </button>

          <div style={{ fontSize: 10, color: "#666", marginTop: 16, lineHeight: 1.5, textAlign: "center" }}>
            Los usuarios se crean desde Supabase → Authentication → Users.<br />
            Sin sesión iniciada, la base no devuelve datos.
          </div>
        </div>
      </div>
    );
  }

  return children;
}

// Botón de salida — se monta en el header de la app
export function BotonSalir({ style }) {
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (!isSupabaseReady) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ""));
  }, []);
  if (!isSupabaseReady) return null;
  return (
    <button
      onClick={async () => {
        if (!confirm("¿Cerrar sesión?")) return;
        await supabase.auth.signOut();
        window.location.reload();
      }}
      title={email}
      style={{ background: "none", border: "1px solid #444", color: "#888", borderRadius: 5, padding: "3px 8px", fontSize: 9, cursor: "pointer", fontFamily: "Arial,sans-serif", ...style }}>
      ⏻ {email ? email.split("@")[0] : "Salir"}
    </button>
  );
}

// Devuelve el email del usuario logueado (para `reportado_por`)
export function useUsuarioActual() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!isSupabaseReady) return;
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => sub?.subscription?.unsubscribe();
  }, []);
  return user;
}

const wrap = { minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial,sans-serif", padding: 20 };
const card = { background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: "30px 26px", width: "100%", maxWidth: 340 };
const lbl = { display: "block", fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5, fontWeight: 700 };
const inp = { width: "100%", background: "#1f1f1f", border: "1px solid #333", borderRadius: 6, color: "#fff", padding: "10px 11px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Arial,sans-serif" };
const btn = { width: "100%", background: RJ, color: "#fff", border: "none", borderRadius: 6, padding: "11px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Arial,sans-serif" };
