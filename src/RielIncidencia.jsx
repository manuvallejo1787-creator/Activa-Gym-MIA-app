// RielIncidencia.jsx — EL RIEL DE DECISIÓN DE SALA
//
// QUÉ RESUELVE:
// Hoy, cuando un cliente dice "me duele", Santiago avisa a Manu sin criterio
// y Manu decide. Resultado: (a) Manu queda de guardia durante las horas de
// Santiago, así que esas horas no son delegación real; (b) el evento no queda
// registrado en ningún lado, así que la molestia — que es la señal de demanda
// clínica más barata que tiene el centro — se evapora.
//
// CÓMO LO RESUELVE:
// Un riel de 4 pasos que se abre SOLO cuando hay una molestia (disparo por
// evento, no por sesión — cargar las 20 sesiones de un turno es fricción que
// se abandona en dos semanas). Al final, la app decide la conducta; el
// operador no elige, acepta.
//
// PASO 1 va ANTES del número, y es lo que hace delegable el criterio:
// un dolor 3/10 que irradia por la pierna es más urgente que un 6/10
// muscular conocido. Una escala 0-10 sin descarte previo no es un criterio
// que se pueda delegar a nadie.
//
// ESCALAMIENTO:
//   leve      → registra. NO avisa.
//   moderado  → sustituye con la regresión ya cargada. Badge, sin interrumpir.
//   severo    → frena el patrón, deriva a fisio, WhatsApp inmediato.
//   bandera   → igual que severo, salteando la escala.

import { useState, useMemo } from "react";

const RJ = "#DC2626", AM = "#D97706", GN = "#16A34A", MO = "#7C3AED";
const G1 = "#F4F4F4", G2 = "#E0E0E0", G3 = "#999", G4 = "#555", WH = "#fff";

// ── Paso 1 — descarte clínico ────────────────────────────────────────────
// Cualquiera en SÍ corta el riel y deriva, sin importar la intensidad.
const BANDERAS = [
  { k: "irradia",     txt: "¿Se irradia, hormiguea o se le adormece?",            sub: "Bajando por brazo o pierna" },
  { k: "inestable",   txt: "¿Sensación de que se le va, se traba o chasquido?",   sub: "Con pérdida de fuerza o del gesto" },
  { k: "nuevo",       txt: "¿Es dolor nuevo, sin antecedente, o hubo golpe hoy?", sub: "Zona que nunca le había molestado" },
];

const BANDAS = [
  { k: "leve",     eva: 2, label: "Molesta, puedo seguir",     sub: "EVA 1–3 · continúa igual",              color: GN, emoji: "🟢" },
  { k: "moderado", eva: 5, label: "Duele, tengo que aflojar",  sub: "EVA 4–6 · se regresa el ejercicio",     color: AM, emoji: "🟡" },
  { k: "severo",   eva: 8, label: "Duele mucho, no puedo",     sub: "EVA 7–10 · se frena y se deriva",       color: RJ, emoji: "🔴" },
];

export default function RielIncidencia({
  clients = [], exs = [], config = {}, saveConfig,
  saveIncidencia, incidencias = [], marcarResuelta, usuarioEmail = "",
}) {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso]       = useState(0);
  const [busca, setBusca]     = useState("");
  const [cli, setCli]         = useState(null);
  const [flags, setFlags]     = useState({});
  const [banda, setBanda]     = useState(null);
  const [exBusca, setExBusca] = useState("");
  const [ex, setEx]           = useState(null);
  const [sust, setSust]       = useState(null);
  const [nota, setNota]       = useState("");
  const [guardando, setGuard] = useState(false);
  const [editTel, setEditTel] = useState(false);
  const [telTmp, setTelTmp]   = useState(config.telAviso || "");

  const banderaActiva = Object.values(flags).some(Boolean);

  const reset = () => {
    setPaso(0); setBusca(""); setCli(null); setFlags({}); setBanda(null);
    setExBusca(""); setEx(null); setSust(null); setNota(""); setAbierto(false);
  };

  // ── Sustitución: la regresión YA está cargada en 240 de 282 ejercicios ──
  // `regresion` a veces guarda un id de ejercicio ('po03') y a veces texto
  // libre. Se resuelve el id si existe; si no, se ofrecen alternativas del
  // mismo bloque de nivel más bajo.
  const opcionesSust = useMemo(() => {
    if (!ex) return [];
    const out = [];
    const reg = (ex.regresion || "").trim();
    if (reg) {
      const porId = exs.find(e => e.id === reg);
      if (porId) out.push({ ...porId, _motivo: "Regresión directa cargada en la base" });
      else out.push({ id: "", nombre: reg, _motivo: "Regresión indicada en la base (texto)" });
    }
    const ordenNivel = { Principiante: 0, Intermedio: 1, Avanzado: 2 };
    exs.filter(e =>
        e.bloque === ex.bloque && e.id !== ex.id &&
        !out.some(o => o.id === e.id) &&
        (ordenNivel[e.nivel] ?? 1) < (ordenNivel[ex.nivel] ?? 1))
      .slice(0, 4)
      .forEach(e => out.push({ ...e, _motivo: `Mismo bloque, nivel ${e.nivel}` }));
    return out.slice(0, 5);
  }, [ex, exs]);

  const bandaFinal = banderaActiva ? "bandera" : banda;
  const esEscalable = bandaFinal === "severo" || bandaFinal === "bandera";
  const esModerado  = bandaFinal === "moderado";

  const textoWA = () => {
    const b = bandaFinal === "bandera" ? "🚩 BANDERA CLÍNICA" : "🔴 DOLOR SEVERO";
    const detalle = banderaActiva
      ? BANDERAS.filter(f => flags[f.k]).map(f => "• " + f.txt.replace(/^¿|\?$/g, "")).join("\n")
      : "• Refiere dolor 7–10, no puede continuar";
    return encodeURIComponent(
      `${b} en sala\n\n` +
      `Cliente: ${cli ? cli.nombre + " " + cli.apellido : "—"}\n` +
      `Ejercicio: ${ex ? ex.nombre : "—"}\n\n${detalle}\n\n` +
      (nota ? `Nota: ${nota}\n\n` : "") +
      `Se frenó el patrón. Queda pendiente tu conducta.\n— ${usuarioEmail || "sala"}`
    );
  };

  const guardar = async () => {
    if (!cli) return;
    setGuard(true);
    const accion = esEscalable ? "frena_deriva" : esModerado ? "sustituye" : "continua";
    const bandaObj = BANDAS.find(b => b.k === banda);
    try {
      await saveIncidencia({
        id: "inc_" + Date.now().toString(36),
        gym_client_id: cli.id,
        cliente_nombre: `${cli.nombre} ${cli.apellido}`,
        fecha: new Date().toISOString(),
        reportado_por: usuarioEmail || "",
        banderas: flags,
        bandera_activa: banderaActiva,
        banda: bandaFinal,
        eva: banderaActiva ? null : (bandaObj?.eva ?? null),
        ejercicio_id: ex?.id || "",
        ejercicio_nombre: ex?.nombre || "",
        accion,
        sustituto_id: sust?.id || "",
        sustituto_nombre: sust?.nombre || "",
        nota,
        avisado: false,
        resuelto: bandaFinal === "leve",
        derivado_fisio: esEscalable,
      });
      if (esEscalable) {
        const tel = (config.telAviso || "").replace(/[^0-9]/g, "");
        if (tel) window.open(`https://wa.me/${tel}?text=${textoWA()}`, "_blank");
        else alert("Incidencia registrada y derivada.\n\n⚠ No hay teléfono de aviso configurado — avisá a Manu por otro medio.");
      }
      reset();
    } catch (e) {
      alert("No se pudo guardar: " + e.message);
    } finally { setGuard(false); }
  };

  const pendientes = incidencias.filter(i => !i.resuelto);

  // ══════════════════ PANTALLA DE LISTA (profesional) ══════════════════
  if (!abierto) {
    return (
      <div style={{ padding: "14px 16px" }}>
        <button onClick={() => setAbierto(true)}
          style={{ width: "100%", background: RJ, color: WH, border: "none", borderRadius: 10, padding: "18px", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "Arial,sans-serif", marginBottom: 14 }}>
          ⚠️ Registrar molestia o dolor
        </button>

        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "9px 11px", marginBottom: 14, fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>
          <strong>Cómo se usa:</strong> se abre solo cuando alguien refiere dolor.
          No hay que registrar las sesiones normales. Cada registro que quede acá
          es, además, un candidato a evaluación de FisioActiva.
        </div>

        {/* Teléfono de aviso */}
        <div style={{ background: G1, borderRadius: 8, padding: "9px 11px", marginBottom: 14, fontSize: 11, color: G4 }}>
          {!editTel ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>📲 Aviso por WhatsApp a: <strong>{config.telAviso || "— sin configurar —"}</strong></span>
              <button onClick={() => { setTelTmp(config.telAviso || ""); setEditTel(true); }}
                style={{ background: "none", border: `1px solid ${G2}`, borderRadius: 5, padding: "3px 9px", fontSize: 10, cursor: "pointer", color: G4, flexShrink: 0 }}>Cambiar</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={telTmp} onChange={e => setTelTmp(e.target.value)} placeholder="59899123456 (con código de país, sin +)"
                style={{ flex: 1, border: `1px solid ${G2}`, borderRadius: 5, padding: "6px 8px", fontSize: 12, outline: "none", minWidth: 0 }} />
              <button onClick={async () => { await saveConfig({ ...config, telAviso: telTmp.trim() }); setEditTel(false); }}
                style={{ background: MO, color: WH, border: "none", borderRadius: 5, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>OK</button>
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: G4, marginBottom: 8 }}>
          Pendientes de conducta ({pendientes.length})
        </div>
        {pendientes.length === 0 && (
          <div style={{ fontSize: 12, color: G3, fontStyle: "italic", padding: "10px 0" }}>Nada pendiente.</div>
        )}
        {pendientes.map(i => {
          const col = i.banda === "bandera" || i.banda === "severo" ? RJ : i.banda === "moderado" ? AM : GN;
          return (
            <div key={i.id} style={{ background: WH, border: `1px solid ${G2}`, borderLeft: `4px solid ${col}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{i.cliente_nombre}</div>
                  <div style={{ fontSize: 11, color: G4, marginTop: 2 }}>
                    {i.ejercicio_nombre || "—"} · <span style={{ color: col, fontWeight: 700 }}>
                      {i.banda === "bandera" ? "🚩 Bandera clínica" : i.banda === "severo" ? "🔴 Severo" : "🟡 Moderado"}
                    </span>
                  </div>
                  {i.sustituto_nombre && <div style={{ fontSize: 10, color: G3, marginTop: 2 }}>→ sustituido por {i.sustituto_nombre}</div>}
                  {i.bandera_activa && (
                    <div style={{ fontSize: 10, color: RJ, marginTop: 3 }}>
                      {BANDERAS.filter(f => i.banderas?.[f.k]).map(f => f.sub).join(" · ")}
                    </div>
                  )}
                  {i.nota && <div style={{ fontSize: 10, color: G4, marginTop: 3, fontStyle: "italic" }}>“{i.nota}”</div>}
                  <div style={{ fontSize: 9, color: G3, marginTop: 4 }}>
                    {new Date(i.fecha).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {i.reportado_por ? ` · ${i.reportado_por.split("@")[0]}` : ""}
                  </div>
                </div>
                <button onClick={() => marcarResuelta(i)}
                  style={{ background: GN, color: WH, border: "none", borderRadius: 5, padding: "5px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  Resuelta
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ══════════════════════════ EL RIEL ══════════════════════════
  const Header = ({ titulo, n }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: G3, fontWeight: 700, letterSpacing: ".08em" }}>PASO {n} DE 4</span>
        <button onClick={reset} style={{ background: "none", border: "none", color: G3, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= n ? RJ : G2 }} />
        ))}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>{titulo}</div>
    </div>
  );

  const box = { padding: "16px 16px 32px", maxWidth: 520, margin: "0 auto", fontFamily: "Arial,sans-serif" };

  // ── PASO 0: cliente ──
  if (paso === 0) {
    const filtrados = clients.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(busca.toLowerCase())).slice(0, 8);
    return (
      <div style={box}>
        <Header n={1} titulo="¿Quién refiere la molestia?" />
        <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nombre…"
          style={{ width: "100%", border: `1px solid ${G2}`, borderRadius: 8, padding: "12px 13px", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
        {filtrados.map(c => (
          <button key={c.id} onClick={() => { setCli(c); setPaso(1); }}
            style={{ width: "100%", textAlign: "left", background: WH, border: `1px solid ${G2}`, borderRadius: 8, padding: "13px 14px", marginBottom: 6, cursor: "pointer", fontSize: 15, fontWeight: 600, fontFamily: "Arial,sans-serif" }}>
            {c.nombre} {c.apellido}
            <span style={{ fontSize: 11, color: G3, fontWeight: 400, display: "block", marginTop: 2 }}>
              {(c.nivel || "").toUpperCase()}{c.restricciones ? ` · ⚠ ${c.restricciones}` : ""}
            </span>
          </button>
        ))}
        {busca && filtrados.length === 0 && <div style={{ fontSize: 12, color: G3, padding: 10 }}>Sin resultados.</div>}
      </div>
    );
  }

  // ── PASO 1: descarte clínico ──
  if (paso === 1) {
    return (
      <div style={box}>
        <Header n={2} titulo={`${cli.nombre} — antes del número, tres preguntas`} />
        <div style={{ fontSize: 11, color: G4, background: G1, borderRadius: 7, padding: "9px 11px", marginBottom: 14, lineHeight: 1.5 }}>
          Preguntáselas tal cual están escritas. Si <strong>alguna</strong> da SÍ,
          se frena igual, aunque diga que casi no le duele.
        </div>
        {BANDERAS.map(f => (
          <div key={f.k} style={{ background: WH, border: `1px solid ${flags[f.k] ? RJ : G2}`, borderRadius: 8, padding: "12px 13px", marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{f.txt}</div>
            <div style={{ fontSize: 11, color: G3, marginBottom: 9 }}>{f.sub}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setFlags(p => ({ ...p, [f.k]: false }))}
                style={{ flex: 1, padding: "9px", borderRadius: 6, border: `1px solid ${flags[f.k] === false ? GN : G2}`, background: flags[f.k] === false ? GN : WH, color: flags[f.k] === false ? WH : G4, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>NO</button>
              <button onClick={() => setFlags(p => ({ ...p, [f.k]: true }))}
                style={{ flex: 1, padding: "9px", borderRadius: 6, border: `1px solid ${flags[f.k] === true ? RJ : G2}`, background: flags[f.k] === true ? RJ : WH, color: flags[f.k] === true ? WH : G4, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>SÍ</button>
            </div>
          </div>
        ))}
        {banderaActiva && (
          <div style={{ background: "#FEF2F2", border: `1px solid ${RJ}`, borderRadius: 8, padding: "11px 13px", marginTop: 10, fontSize: 12, color: "#991B1B", lineHeight: 1.5 }}>
            🚩 <strong>Se frena acá.</strong> No hace falta puntuar el dolor.
            Se suspende ese patrón, se deriva a FisioActiva y se avisa a Manu ahora.
          </div>
        )}
        <button disabled={BANDERAS.some(f => flags[f.k] === undefined)}
          onClick={() => setPaso(banderaActiva ? 3 : 2)}
          style={{ width: "100%", marginTop: 14, padding: "14px", borderRadius: 8, border: "none", background: BANDERAS.some(f => flags[f.k] === undefined) ? G2 : (banderaActiva ? RJ : "#1a1a1a"), color: WH, fontSize: 15, fontWeight: 800, cursor: BANDERAS.some(f => flags[f.k] === undefined) ? "not-allowed" : "pointer", fontFamily: "Arial,sans-serif" }}>
          {BANDERAS.some(f => flags[f.k] === undefined) ? "Contestá las tres" : banderaActiva ? "Frenar y derivar →" : "Continuar →"}
        </button>
      </div>
    );
  }

  // ── PASO 2: intensidad ──
  if (paso === 2) {
    return (
      <div style={box}>
        <Header n={3} titulo="¿Cuánto le duele?" />
        <div style={{ fontSize: 11, color: G4, background: G1, borderRadius: 7, padding: "9px 11px", marginBottom: 14, lineHeight: 1.5 }}>
          No preguntes “del 0 al 10”. Leele las tres opciones y que elija una.
          Da un número mucho más consistente entre personas distintas.
        </div>
        {BANDAS.map(b => (
          <button key={b.k} onClick={() => { setBanda(b.k); setPaso(3); }}
            style={{ width: "100%", textAlign: "left", background: WH, border: `2px solid ${banda === b.k ? b.color : G2}`, borderRadius: 10, padding: "15px 14px", marginBottom: 9, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: b.color }}>{b.emoji} {b.label}</div>
            <div style={{ fontSize: 11, color: G3, marginTop: 3 }}>{b.sub}</div>
          </button>
        ))}
      </div>
    );
  }

  // ── PASO 3: contexto + conducta ──
  const exFiltrados = exs.filter(e => e.nombre.toLowerCase().includes(exBusca.toLowerCase())).slice(0, 6);
  return (
    <div style={box}>
      <Header n={4} titulo="¿Haciendo qué ejercicio?" />

      {!ex ? (
        <>
          <input autoFocus value={exBusca} onChange={e => setExBusca(e.target.value)} placeholder="Buscar ejercicio…"
            style={{ width: "100%", border: `1px solid ${G2}`, borderRadius: 8, padding: "12px 13px", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          {exFiltrados.map(e => (
            <button key={e.id} onClick={() => setEx(e)}
              style={{ width: "100%", textAlign: "left", background: WH, border: `1px solid ${G2}`, borderRadius: 8, padding: "12px 13px", marginBottom: 6, cursor: "pointer", fontSize: 14, fontFamily: "Arial,sans-serif" }}>
              {e.nombre}<span style={{ fontSize: 10, color: G3, display: "block", marginTop: 2 }}>{e.bloque} · {e.nivel}</span>
            </button>
          ))}
          <button onClick={() => setEx({ id: "", nombre: "Sin ejercicio puntual", bloque: "", nivel: "" })}
            style={{ width: "100%", background: "none", border: `1px dashed ${G2}`, borderRadius: 8, padding: "11px", marginTop: 4, fontSize: 12, color: G4, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>
            No estaba haciendo un ejercicio puntual
          </button>
        </>
      ) : (
        <>
          <div style={{ background: G1, borderRadius: 8, padding: "11px 13px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{ex.nombre}</span>
            <button onClick={() => { setEx(null); setSust(null); }}
              style={{ background: "none", border: `1px solid ${G2}`, borderRadius: 5, padding: "4px 9px", fontSize: 10, cursor: "pointer", color: G4, flexShrink: 0 }}>Cambiar</button>
          </div>

          {/* CONDUCTA — la decide el sistema */}
          {bandaFinal === "leve" && (
            <div style={{ background: "#F0FDF4", border: `1px solid ${GN}`, borderRadius: 8, padding: "13px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#166534" }}>🟢 Continúa igual</div>
              <div style={{ fontSize: 12, color: "#166534", marginTop: 4, lineHeight: 1.5 }}>
                No se modifica nada. Se registra para tener el antecedente.
                Manu no recibe aviso.
              </div>
            </div>
          )}

          {esModerado && (
            <div style={{ background: "#FFFBEB", border: `1px solid ${AM}`, borderRadius: 8, padding: "13px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#92400E", marginBottom: 3 }}>🟡 Regresar el ejercicio</div>
              <div style={{ fontSize: 11, color: "#92400E", marginBottom: 10 }}>Elegí el reemplazo. No cambies de bloque.</div>
              {opcionesSust.length === 0 && (
                <div style={{ fontSize: 11, color: "#92400E", fontStyle: "italic" }}>
                  Sin regresión cargada para este ejercicio. Bajá carga o rango y anotalo abajo.
                </div>
              )}
              {opcionesSust.map((o, i) => (
                <button key={o.id || "t" + i} onClick={() => setSust(o)}
                  style={{ width: "100%", textAlign: "left", background: sust?.nombre === o.nombre ? AM : WH, color: sust?.nombre === o.nombre ? WH : G4, border: `1px solid ${sust?.nombre === o.nombre ? AM : G2}`, borderRadius: 7, padding: "10px 12px", marginBottom: 5, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Arial,sans-serif" }}>
                  {o.nombre}
                  <span style={{ fontSize: 10, display: "block", marginTop: 2, opacity: .75, fontWeight: 400 }}>{o._motivo}</span>
                </button>
              ))}
            </div>
          )}

          {esEscalable && (
            <div style={{ background: "#FEF2F2", border: `1px solid ${RJ}`, borderRadius: 8, padding: "13px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#991B1B" }}>
                {bandaFinal === "bandera" ? "🚩 Bandera clínica" : "🔴 Se frena"}
              </div>
              <div style={{ fontSize: 12, color: "#991B1B", marginTop: 4, lineHeight: 1.6 }}>
                • Se suspende ese patrón por hoy.<br />
                • Puede seguir con el resto del plan si no le duele.<br />
                • Queda derivado a FisioActiva.<br />
                • <strong>Se avisa a Manu por WhatsApp ahora.</strong>
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: G4, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
            Nota (opcional)
          </label>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
            placeholder="Qué dijo, en qué serie, qué se hizo…"
            style={{ width: "100%", border: `1px solid ${G2}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Arial,sans-serif", resize: "vertical", marginBottom: 14 }} />

          <button onClick={guardar} disabled={guardando || (esModerado && !sust && opcionesSust.length > 0)}
            style={{ width: "100%", padding: "15px", borderRadius: 8, border: "none", background: guardando || (esModerado && !sust && opcionesSust.length > 0) ? G2 : (esEscalable ? RJ : "#1a1a1a"), color: WH, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>
            {guardando ? "Guardando…"
              : esModerado && !sust && opcionesSust.length > 0 ? "Elegí el reemplazo"
              : esEscalable ? "Registrar y avisar a Manu 📲"
              : "Registrar"}
          </button>
        </>
      )}
    </div>
  );
}
