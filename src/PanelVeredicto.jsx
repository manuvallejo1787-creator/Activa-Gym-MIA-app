// PanelVeredicto.jsx — Muestra el veredicto CALCULADO de avance de fase.
//
// Se apoya en motor.js. No decide nada por su cuenta: presenta lo que el
// motor computó y deja la confirmación en manos del profesional.
//
// Distingue explícitamente tres estados por criterio:
//   cumple · no cumple · SIN MEDIR
// "Sin medir" no es un criterio fallado, es una medición pendiente. Mezclarlos
// produce semáforos que parecen informados y no lo están.

import { useMemo } from "react";
import { computarMetricas, evaluarAvance, adaptadorGym, resumenDeterminista } from "./motor.js";

const GN = "#16A34A", AM = "#D97706", RJ = "#DC2626", GR = "#6B7280";
const G2 = "#E0E0E0", G3 = "#999", G4 = "#555";

const ESTILO = {
  listo:              { color: GN, bg: "#F0FDF4", bd: "#86EFAC", icono: "✅", titulo: "Listo para avanzar" },
  listo_con_criterio: { color: GN, bg: "#F0FDF4", bd: "#86EFAC", icono: "✅", titulo: "Cumple lo objetivo — falta tu confirmación" },
  faltan_datos:       { color: AM, bg: "#FFFBEB", bd: "#FDE68A", icono: "📋", titulo: "Faltan mediciones" },
  no_avanza:          { color: RJ, bg: "#FEF2F2", bd: "#FCA5A5", icono: "⏸", titulo: "Todavía no avanza" },
  bloqueado:          { color: RJ, bg: "#FEF2F2", bd: "#FCA5A5", icono: "🚩", titulo: "Bloqueado por bandera clínica" },
};

const ICONO_ESTADO = { cumple: "✓", no_cumple: "✗", sin_medir: "○", clinico: "◐" };
const COLOR_ESTADO = { cumple: GN, no_cumple: RJ, sin_medir: GR, clinico: AM };
const TXT_ESTADO   = { cumple: "cumple", no_cumple: "no cumple", sin_medir: "sin medir", clinico: "criterio clínico" };

export default function PanelVeredicto({
  cliente, evaluacion = null, tests = [], incidencias = [],
  siguienteFase, onAvanzar, compacto = false,
}) {
  const { metricas, avance } = useMemo(() => {
    const m = computarMetricas(cliente, { evaluacion, tests, incidencias });
    return { metricas: m, avance: evaluarAvance(cliente.nivel || "activa", m, adaptadorGym) };
  }, [cliente, evaluacion, tests, incidencias]);

  const est = ESTILO[avance.veredicto] || ESTILO.faltan_datos;
  const sig = siguienteFase?.(cliente.nivel);
  const puedeAvanzar = (avance.veredicto === "listo" || avance.veredicto === "listo_con_criterio") && !!sig;

  if (compacto) {
    return (
      <span title={avance.resumen}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: est.bg, border: `1px solid ${est.bd}`, borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: est.color }}>
        {est.icono} {est.titulo}
      </span>
    );
  }

  return (
    <div style={{ marginTop: 10, border: `1px solid ${est.bd}`, background: est.bg, borderRadius: 9, padding: "12px 13px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", color: est.color, opacity: .8 }}>
            VEREDICTO CALCULADO
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: est.color, marginTop: 1 }}>
            {est.icono} {est.titulo}
          </div>
          <div style={{ fontSize: 11, color: G4, marginTop: 3, lineHeight: 1.45 }}>{avance.resumen}</div>
        </div>
      </div>

      {/* Criterios */}
      <div style={{ background: "#fff", borderRadius: 7, padding: "8px 10px", marginBottom: 9 }}>
        {avance.criterios.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "4px 0", borderBottom: i < avance.criterios.length - 1 ? `1px solid #F2F2F2` : "none" }}>
            <span style={{ color: COLOR_ESTADO[c.estado], fontWeight: 800, fontSize: 13, width: 13, flexShrink: 0 }}>
              {ICONO_ESTADO[c.estado]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.estado === "sin_medir" ? G3 : "#222" }}>{c.label}</div>
              <div style={{ fontSize: 10, color: COLOR_ESTADO[c.estado], marginTop: 1 }}>
                {c.val} · {TXT_ESTADO[c.estado]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Banderas */}
      {metricas.banderas.hay && (
        <div style={{ background: "#FEF2F2", border: `1px solid ${RJ}`, borderRadius: 7, padding: "8px 10px", marginBottom: 9 }}>
          {metricas.banderas.activas.map((b, i) => (
            <div key={i} style={{ fontSize: 11, color: "#991B1B", fontWeight: 600 }}>🚩 {b.texto}</div>
          ))}
        </div>
      )}

      {/* Origen del dato de dolor — el criterio más decisivo y el más frágil */}
      <div style={{ fontSize: 10, color: G4, marginBottom: 9, lineHeight: 1.5 }}>
        <strong>Dolor:</strong>{" "}
        {metricas.eva.medido
          ? <>EVA {metricas.eva.eva}/10 · fuente: {metricas.eva.origen}
              {metricas.eva.aproximado && <span style={{ color: AM }}> · aproximado, no es una medición directa</span>}</>
          : <span style={{ color: AM }}>{metricas.eva.motivo || "sin medir"}</span>}
      </div>

      {/* Qué falta medir */}
      {avance.sinMedir.length > 0 && (
        <div style={{ background: "#fff", border: `1px dashed ${G2}`, borderRadius: 7, padding: "8px 10px", marginBottom: 9 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: G4, marginBottom: 3 }}>PARA PODER DECIDIR, FALTA MEDIR</div>
          {avance.sinMedir.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: G4 }}>○ {c.label}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {puedeAvanzar && (
          <button
            onClick={() => {
              if (!confirm(`¿Avanzar a ${cliente.nombre} a fase ${String(sig).toUpperCase()}?\n\n${avance.resumen}\n\nRevisá que el plan de entrenamiento acompañe el cambio.`)) return;
              onAvanzar?.(sig);
            }}
            style={{ background: GN, color: "#fff", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>
            Avanzar a {String(sig).toUpperCase()} →
          </button>
        )}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(resumenDeterminista(cliente, metricas, avance));
            alert("Resumen copiado. Podés pegarlo en el informe o pasárselo a la IA para que lo redacte.");
          }}
          style={{ background: "none", border: `1px solid ${G2}`, borderRadius: 6, padding: "9px 12px", fontSize: 11, cursor: "pointer", color: G4, fontFamily: "Arial,sans-serif" }}>
          📋 Copiar resumen
        </button>
      </div>

      <div style={{ fontSize: 9, color: G3, marginTop: 8, lineHeight: 1.5 }}>
        Calculado desde el screening, las evaluaciones clínicas y las incidencias de sala.
        Podés avanzar igual desde el checklist manual de abajo si tu criterio difiere.
      </div>
    </div>
  );
}
