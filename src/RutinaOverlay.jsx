import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// RutinaOverlay — la rutina del cliente, sin salir de Sala
//
// Es lo único que no cabe en la tarjeta, así que va detrás de un botón. Se
// abre encima de la pantalla en lugar de navegar al Constructor: el profe
// vuelve al panel cerrando, sin perder los clientes que cargó en sala.
//
// Solo LECTURA: acá no se edita nada. Editar la rutina es trabajo de
// escritorio, y si se pudiera tocar desde sala terminarían cambiándola con
// el cliente esperando al lado.
// ═══════════════════════════════════════════════════════════════════════════

const WH = '#fff', BK = '#161616', G2 = '#2e2e2e', G4 = '#8a8a8a';

const TIPO = {
  movilidad: ['Movilidad', '#8B5CF6'], activacion: ['Activación', '#0E7490'],
  fuerza: ['Fuerza', '#DC2626'], accesorios: ['Accesorios', '#D97706'],
  cardio: ['Cardio', '#059669'], potencia: ['Potencia', '#B91C1C'],
  pliometria: ['Pliometría', '#BE185D'], prev_rehab: ['Prevención / Rehab', '#0284C7'],
  propiocepcion: ['Propiocepción', '#7C3AED'], flex_recovery: ['Flexibilidad', '#16A34A'],
  funcional: ['Funcional', '#EA580C'], zona_media: ['Zona media', '#CA8A04'],
};

export default function RutinaOverlay({ cliente, plan, exs = [], onCerrar }) {
  const dias = plan?.dias || [];
  const [diaIdx, setDiaIdx] = useState(0);
  const d = dias[diaIdx];
  const nombreEx = (id) => exs.find(e => e.id === id)?.nombre || id;

  return (
    <div onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '14px 10px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: BK, border: `1px solid ${G2}`, borderRadius: 12, width: '100%', maxWidth: 560, padding: '14px 15px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: WH }}>{cliente?.nombre} {cliente?.apellido}</div>
            <div style={{ fontSize: 10, color: G4, marginTop: 2 }}>
              {plan?.nombre || 'Plan activo'}
              {plan?.fecha_inicio ? ` · desde ${plan.fecha_inicio}` : ''}
              {plan?.fecha_fin_estimada ? ` · hasta ${plan.fecha_fin_estimada}` : ''}
            </div>
          </div>
          <button onClick={onCerrar}
            style={{ background: 'none', border: 'none', color: G4, fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        {dias.length === 0 ? (
          <div style={{ color: G4, fontSize: 12, padding: '20px 0', textAlign: 'center' }}>El plan no tiene días cargados.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 3, marginBottom: 10 }}>
              {dias.map((x, i) => (
                <button key={x.id || i} onClick={() => setDiaIdx(i)}
                  style={{ flex: '0 0 auto', background: i === diaIdx ? '#1BAA86' : '#1f1f1f', color: i === diaIdx ? '#04231C' : WH, border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  {x.name || `Día ${i + 1}`}
                </button>
              ))}
            </div>

            {(d?.blocks || []).map(b => {
              const [lbl, col] = TIPO[b.type] || [b.type, G4];
              const p = b.params || {};
              return (
                <div key={b.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: col }}>{lbl}</span>
                    <span style={{ fontSize: 9, color: G4 }}>
                      {p.series}×{p.reps}{p.rpe ? ` · RPE ${p.rpe}` : ''}{p.tempo && p.tempo !== '—' ? ` · ${p.tempo}` : ''}{p.descanso ? ` · ${p.descanso}` : ''}
                    </span>
                  </div>
                  {(b.exercises || []).map((be, i) => (
                    <div key={be.exId + i} style={{ background: '#0e0e0e', borderRadius: 6, padding: '7px 9px', marginBottom: 4, borderLeft: `3px solid ${be.override ? '#D97706' : col}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, color: WH, fontWeight: 600, lineHeight: 1.3 }}>
                          {nombreEx(be.exId)}
                          {be.override && <span style={{ color: '#FCD34D', fontSize: 9 }}> ⚠ marcado por restricción</span>}
                        </span>
                        {be.pesoSug && <span style={{ fontSize: 12, fontWeight: 800, color: '#7FE9CE', flexShrink: 0 }}>{be.pesoSug} kg</span>}
                      </div>
                      {(be.params?.series || be.params?.reps) && (be.params.series !== p.series || be.params.reps !== p.reps) && (
                        <div style={{ fontSize: 9, color: G4, marginTop: 2 }}>
                          {be.params.series}×{be.params.reps}{be.params.rpe ? ` · RPE ${be.params.rpe}` : ''}
                        </div>
                      )}
                      {be.anotacion && (
                        <div style={{ fontSize: 9, color: '#9a9a9a', marginTop: 3, lineHeight: 1.45 }}>{be.anotacion}</div>
                      )}
                    </div>
                  ))}
                  {(b.exercises || []).length === 0 && <div style={{ fontSize: 10, color: G4 }}>Bloque vacío</div>}
                </div>
              );
            })}
            {(d?.blocks || []).length === 0 && (
              <div style={{ color: G4, fontSize: 12, padding: '14px 0', textAlign: 'center' }}>Este día no tiene bloques cargados.</div>
            )}
          </>
        )}

        <div style={{ fontSize: 9, color: '#6a6a6a', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          Solo lectura. Para modificar la rutina, entrá al Constructor.
        </div>
      </div>
    </div>
  );
}
