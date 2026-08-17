// PasswordGate.jsx — Portón de contraseña a nivel de toda la app.
//
// POR QUÉ EXISTE ASÍ Y NO DE OTRA FORMA:
// La Password Protection nativa de Vercel (a nivel de borde, antes de que
// cargue una sola línea de código) requiere el plan "Advanced Deployment
// Protection" — el equipo no lo tiene contratado. Esta es la alternativa
// dentro de la app misma.
//
// LÍMITE HONESTO: esto corre en el navegador, no en el borde. Frena a
// alguien que llega por accidente al dominio o cotillea un rato — que es
// exactamente el problema que se pidió resolver. NO es una barrera real
// contra alguien que se toma el trabajo de inspeccionar el código fuente
// del sitio: el JS de la app (con este archivo adentro) se descarga igual
// a cualquier visitante antes de mostrar la pantalla de contraseña, y con
// eso alcanza para ver esta lógica. Por eso no comparo la contraseña en
// texto plano — comparo su hash SHA-256 — pero un hash no es cifrado: no
// evita que alguien decidido pruebe fuerza bruta offline contra ese hash.
// Como capa REAL de seguridad de datos, esto no reemplaza políticas RLS
// atadas a autenticación de usuario en Supabase.

import { useState, useEffect } from "react";

const HASH_CLAVE = "929093e224b6ba087e77db880f682d70723a17c2e00b3a78b74d7ca01ebc960b"; // sha256("ActivaFC2026-Colonia")
const STORAGE_KEY = "activa_gate_ok_v1";

async function sha256(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function PasswordGate({ children }) {
  const [desbloqueado, setDesbloqueado] = useState(null); // null = todavía chequeando
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    try {
      setDesbloqueado(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDesbloqueado(false);
    }
  }, []);

  const intentar = async (e) => {
    e.preventDefault();
    setVerificando(true);
    setError("");
    const hash = await sha256(clave);
    if (hash === HASH_CLAVE) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
      setDesbloqueado(true);
    } else {
      setError("Contraseña incorrecta.");
      setClave("");
    }
    setVerificando(false);
  };

  if (desbloqueado === null) return null; // evita parpadeo mientras chequea localStorage
  if (desbloqueado) return children;

  return (
    <div style={{
      minHeight: "100vh", background: "#1a1a1a", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "Arial,sans-serif", padding: 24,
    }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Acceso restringido</div>
      <div style={{ fontSize: 12, color: "#999", marginBottom: 22, textAlign: "center", maxWidth: 320 }}>
        Gestión ACTIVA — Grupo ACTIVA. Ingresá la contraseña del centro para continuar.
      </div>
      <form onSubmit={intentar} style={{ width: "100%", maxWidth: 280 }}>
        <input
          type="password"
          value={clave}
          onChange={e => setClave(e.target.value)}
          placeholder="Contraseña"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #333",
            background: "#111", color: "#fff", fontSize: 14, marginBottom: 10, boxSizing: "border-box",
          }}
        />
        {error && <div style={{ color: "#CC0000", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{error}</div>}
        <button
          type="submit"
          disabled={verificando || !clave}
          style={{
            width: "100%", padding: "10px", borderRadius: 6, border: "none",
            background: "#CC0000", color: "#fff", fontWeight: 700, fontSize: 14,
            cursor: verificando || !clave ? "not-allowed" : "pointer", opacity: verificando || !clave ? 0.6 : 1,
          }}
        >
          {verificando ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
