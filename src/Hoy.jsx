import { useMemo, useState } from "react";
import { construirHoy, resumenRiel, SEV } from "./hoy.js";

// ═══════════════════════════════════════════════════════════════════════════
// Hoy.jsx — LA BANDEJA DE ENTRADA DEL CENTRO
//
// Reglas de diseño, puestas a propósito para que esto no se convierta en otro
// tablero que nadie abre:
//   · Es la pantalla de entrada. No hay que elegirla.
//   · Cada ítem tiene UN botón que lleva al lugar donde se resuelve.
//   · Cada ítem dice POR QUÉ importa. Un aviso sin consecuencia se ignora.
//   · Los críticos se muestran todos; el resto tiene tope.
//   · Todo se puede postergar 7 días, y eso se guarda en la base (no en el
//     navegador) porque la app se usa en la compu del centro y en el celular.
// ═══════════════════════════════════════════════════════════════════════════

const BK = '#111', WH = '#fff', G4 = '#888', G2 = '#e5e5e5';

export default function Hoy({ gym, fisio, descartes, reportes = [], incidencias = [], loading, postergar, marcarItem, quitarMarca, onIr, brand, config = {} }) {
  const [verTodo, setVerTodo] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const H = useMemo(() => construirHoy({ gym, fisio, descartes, reportes, incidencias, config }), [gym, fisio, descartes, reportes, incidencias, config]);

  const hoyTxt = new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: G4, fontSize: 12 }}>Calculando la bandeja…</div>;

  const Item = ({ it }) => {
    const sv = SEV[it.sev];
    const ab = abierto === it.key;
    return (
      <div style={{ background: WH, border: `1px solid ${G2}`, borderLeft: `4px solid ${sv.color}`, borderRadius: 9, padding: '11px 13px', marginBottom: 7 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, lineHeight: 1.1, flexShrink: 0 }}>{it.icono}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111', lineHeight: 1.35 }}>{it.titulo}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2, lineHeight: 1.45 }}>{it.detalle}</div>
            {ab && it.porQue && (
              <div style={{ fontSize: 11, color: sv.color, background: sv.bg, borderRadius: 6, padding: '7px 9px', marginTop: 7, lineHeight: 1.5 }}>
                {it.porQue}
              </div>
            )}
            {ab && it.lista && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 7, lineHeight: 1.7 }}>
                {it.lista.map(x => (
                  <div key={x.id}>
                    · {x.nombre}
                    <button onClick={() => onIr(it.accion.tab, x.id)}
                      style={{ background: 'none', border: 'none', color: '#0E7490', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>abrir</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
              {it.accion && !it.agrupado && (
                <button onClick={() => onIr(it.accion.tab, it.accion.clienteId || it.accion.pacienteId)}
                  style={{ background: sv.color, color: WH, border: 'none', borderRadius: 6, padding: '6px 13px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  {it.accion.label} →
                </button>
              )}
              <button onClick={() => setAbierto(ab ? null : it.key)}
                style={{ background: 'none', border: `1px solid ${G2}`, color: '#666', borderRadius: 6, padding: '6px 11px', fontSize: 11, cursor: 'pointer' }}>
                {ab ? 'Cerrar' : it.agrupado ? 'Ver quiénes' : '¿Por qué?'}
              </button>
            </div>
            {/* ── ESTADO DEL AVISO ──────────────────────────────────────────
                Antes lo único posible era postergar 7 días. "En proceso" y
                "atendido" lo dejan visible con su marca: algo que se está
                atendiendo y no cerró no tiene que desaparecer de la vista. */}
            <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap', alignItems: 'center', borderTop: `1px solid ${G2}`, paddingTop: 7 }}>
              {it.estadoGuardado ? (
                <>
                  <span style={{ background: it.estadoGuardado === 'atendido' ? '#ECFDF5' : '#FFFBEB',
                    border: `1px solid ${it.estadoGuardado === 'atendido' ? '#16A34A' : '#D97706'}`,
                    color: it.estadoGuardado === 'atendido' ? '#166534' : '#92400E',
                    borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 800 }}>
                    {it.estadoGuardado === 'atendido' ? '✓ Atendido' : '⏳ En proceso'}
                    {it.estadoNota ? ` — ${it.estadoNota}` : ''}
                  </span>
                  <button onClick={() => marcarItem?.(it.key, 'resuelto')}
                    style={{ background: '#16A34A', color: WH, border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                    Cerrar como resuelto
                  </button>
                  <button onClick={() => quitarMarca?.(it.key)}
                    style={{ background: 'none', border: 'none', color: G4, fontSize: 10, cursor: 'pointer' }}>quitar marca</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 10, color: G4 }}>Marcar:</span>
                  {[['en_proceso', '⏳ En proceso', '#D97706'], ['atendido', '✓ Atendido', '#16A34A'],
                    ['resuelto', '✅ Resuelto', '#16A34A'], ['descartado', '✕ Descartar', G4]].map(([k, lbl, col]) => (
                    <button key={k} onClick={() => {
                        const nota = (k === 'atendido' || k === 'en_proceso')
                          ? (prompt('¿Qué hiciste? (opcional, queda a la vista)', '') || '') : '';
                        marcarItem?.(it.key, k, nota);
                      }}
                      style={{ background: 'none', border: `1px solid ${col}55`, color: col, borderRadius: 6, padding: '5px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {lbl}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '12px 14px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#111' }}>Hoy</div>
        <div style={{ fontSize: 11, color: G4, textTransform: 'capitalize' }}>{hoyTxt}</div>
      </div>

      {/* ── RESUMEN DIARIO DEL RIEL ───────────────────────────────────────
          El canal elegido para el escalón 1. No repite los avisos —están
          abajo, cada uno con su botón— : lo que agrega es la SALIDA. Quien
          tiene que hacer la valoración puede no ser quien abre la app, y hasta
          acá el escalón 1 no tenía forma de llegarle. */}
      {(H.riel.pendientes > 0 || H.riel.cronicos.length > 0) && (
        <div style={{ background: H.riel.pendientes ? '#FFFBEB' : '#F8FAFC',
          border: `1px solid ${H.riel.pendientes ? '#D97706' : G2}`, borderRadius: 10,
          padding: '11px 13px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: H.riel.pendientes ? '#92400E' : '#444' }}>
            Riel — resumen del día
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.55 }}>
            {H.riel.pendientes
              ? [
                  H.riel.valoraciones.length && `${H.riel.valoraciones.length} valoración${H.riel.valoraciones.length > 1 ? 'es' : ''} pendiente${H.riel.valoraciones.length > 1 ? 's' : ''}`,
                  H.riel.rutear.length && `${H.riel.rutear.length} valorada${H.riel.rutear.length > 1 ? 's' : ''} sin rutear`,
                  H.riel.sinConducta.length && `${H.riel.sinConducta.length} sin conducta`,
                  H.riel.basesVencidas.length && `${H.riel.basesVencidas.length} crónico${H.riel.basesVencidas.length > 1 ? 's' : ''} a revalorar`,
                ].filter(Boolean).join(' · ')
              : 'Nada pendiente en el riel.'}
            {H.riel.cronicos.length > 0 && (
              <div style={{ color: G4, marginTop: 3 }}>
                {H.riel.cronicos.length} con línea de base vigente: el riel registra y no avisa.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
            <button onClick={async () => {
                const txt = resumenRiel(H, { centro: config.nombre || '' });
                try { await navigator.clipboard.writeText(txt); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
                catch { prompt('Copialo desde acá:', txt); }   // sin permiso de portapapeles
              }}
              style={{ background: copiado ? '#16A34A' : BK, color: WH, border: 'none', borderRadius: 6, padding: '6px 13px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
              {copiado ? '✓ Copiado' : '📋 Copiar resumen'}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(resumenRiel(H, { centro: config.nombre || '' }))}`}
              target="_blank" rel="noreferrer"
              style={{ background: '#25D366', color: '#073b23', borderRadius: 6, padding: '6px 13px', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>
              Enviar por WhatsApp
            </a>
          </div>
        </div>
      )}

      {H.todoAlDia ? (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '22px 16px', textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#166534', marginTop: 5 }}>No hay nada urgente</div>
          <div style={{ fontSize: 11, color: '#3f6b4f', marginTop: 3 }}>
            Ninguna molestia reportada, ninguna reevaluación vencida y ningún plan terminado sin reemplazo.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['critico', H.conteo.critico], ['atencion', H.conteo.atencion], ['proximo', H.conteo.proximos], ['manten', H.conteo.manten]].map(([k, n]) => (
            <div key={k} style={{ flex: '1 1 110px', background: SEV[k].bg, border: `1px solid ${SEV[k].color}44`, borderRadius: 9, padding: '9px 11px' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: SEV[k].color, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 10, color: SEV[k].color, fontWeight: 700, marginTop: 3 }}>{SEV[k].label}</div>
            </div>
          ))}
        </div>
      )}

      {H.visibles.map(it => <Item key={it.key} it={it} />)}

      {H.ocultos.length > 0 && (
        verTodo
          ? H.ocultos.map(it => <Item key={it.key} it={it} />)
          : <button onClick={() => setVerTodo(true)}
              style={{ width: '100%', background: 'none', border: `1px dashed ${G2}`, color: '#666', borderRadius: 8, padding: '9px', fontSize: 11, cursor: 'pointer', marginBottom: 10 }}>
              Ver {H.ocultos.length} más de esta semana
            </button>
      )}

      {H.proximos.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0E7490', textTransform: 'uppercase', letterSpacing: .6, margin: '18px 0 3px' }}>
            Vence en los próximos 7 días
          </div>
          <div style={{ fontSize: 10, color: G4, marginBottom: 8, lineHeight: 1.45 }}>
            Evaluaciones, tests y cambios de fase. Aparecen con una semana de anticipación para que
            puedas agendarlos antes de que venzan, no después.
          </div>
          {H.proximos.map(it => <Item key={it.key} it={it} />)}
        </>
      )}

      {H.grupos.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: G4, textTransform: 'uppercase', letterSpacing: .6, margin: '16px 0 7px' }}>
            Cuando puedas — calidad de datos
          </div>
          {H.grupos.map(g => <Item key={g.key} it={g} />)}
        </>
      )}

      <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 18, lineHeight: 1.6 }}>
        La bandeja se calcula sola con los datos del centro. No hay nada que marcar como hecho:
        cuando resolvés el motivo, el aviso desaparece.
      </div>
    </div>
  );
}
