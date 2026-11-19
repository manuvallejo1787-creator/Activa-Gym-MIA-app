import { useMemo, useState } from "react";
import { REGIONES, REHAB_DB } from "./rehabDB.js";
import { FASES_REHAB as FASES_CLINICAS } from "./criterios.js";
import { FASE_CLINICA_A_LIBRERIA, regionDeZona, sugerirPatronBloqueado,
         ejerciciosDelPlan, armarBloqueDirigido } from "./rehabPuente.js";
import { zonaTexto } from "./incidencias.js";
import { useGymPlanes } from "./db.js";

// ═══════════════════════════════════════════════════════════════════════════
// BloqueDirigido.jsx — EL ESCALÓN 2, QUE ANTES ERA UNA ETIQUETA
//
// QUÉ REEMPLAZA
// Un `prompt('Qué programa dirigido y sobre qué región (opcional)')` que
// guardaba texto libre en `notas_seguimiento` y no hacía absolutamente nada
// más. El estado `programa` cambiaba el rótulo de la tarjeta, liberaba el
// bloqueo del patrón, y no existía ningún bloque dirigido en ningún plan.
//
// QUÉ DECIDIÓ MANU (30/10)
// El bloque se inserta en el plan de gym SIN borrar la rutina original: se
// bloquea la carga de datos del patrón afectado y a continuación se agrega el
// bloque nuevo. Eso se guarda como superposición en la propia incidencia
// (patron_bloqueado + bloque_dirigido) y api/portal.js lo compone al leer, así
// que cuando el riel libera la incidencia la rutina vuelve intacta sola.
//
// POR QUÉ ESTA PANTALLA PREGUNTA EN VEZ DE DECIDIR
// Cuál patrón del plan carga una zona depende del cliente, del ejercicio y del
// hallazgo. La app SUGIERE por palabra clave y deja todo desmarcable: una app
// que elige sola qué patrón frenar está tomando una conducta clínica. Y por la
// norma, todo acá es editable — series, reps, notas, qué se bloquea y qué no.
//
// VOCABULARIO
// Las fases se muestran por CRITERIOS (R0/R1/R2, de criterios.js) porque es el
// vocabulario del método. La biblioteca está indexada por calendario y la
// traducción es una línea en rehabPuente.js. Deuda conocida y aislada.
// ═══════════════════════════════════════════════════════════════════════════

const WH = '#fff', G4 = '#888', G2 = '#2a2a2a', BK = '#111';
const CAJA = { background: '#161616', border: `1px solid ${G2}`, borderRadius: 8, padding: '10px 12px', marginBottom: 10 };

export default function BloqueDirigido({ inc, cliente, exs = [], onGuardar, onCerrar }) {
  const zona = inc?.zona || '';
  // El modal busca SUS planes en lugar de recibirlos: los de la pantalla de
  // sala están acotados a los clientes seleccionados ahí, y la incidencia que
  // se está ruteando puede ser de otro. Pedirlos acá evita que la lista de
  // "qué bloquear" salga vacía justo cuando hace falta.
  const { gymPlanes: planes, loading: cargandoPlanes } = useGymPlanes(inc?.gym_client_id || null);
  const nombrePorId = useMemo(() => {
    const idx = {};
    (exs || []).forEach(e => { if (e && e.id) idx[e.id] = e.nombre; });
    return (id) => idx[id] || '';
  }, [exs]);
  const [region, setRegion] = useState(() => regionDeZona(zona) || 'lumbar');
  const [faseClinica, setFaseClinica] = useState('proteccion');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Los ejercicios del plan activo, con nombre resuelto. Es lo que se puede
  // bloquear: no tiene sentido ofrecer bloquear algo que el cliente no hace.
  const delPlan = useMemo(() => ejerciciosDelPlan(planes, nombrePorId), [planes, nombrePorId]);

  // Sugerencia inicial de qué bloquear, por palabra clave sobre la zona.
  //
  // No se puede calcular en el inicializador de useState: los planes llegan
  // de una consulta y en el primer render `delPlan` está vacío, así que la
  // sugerencia habría salido siempre vacía. Se siembra cuando los planes
  // llegan, y una sola vez — después manda lo que el profesional marcó.
  const [bloquear, setBloquear] = useState(null);
  const sugerido = useMemo(() => sugerirPatronBloqueado(zona, delPlan), [zona, delPlan]);
  const marcados = bloquear == null ? sugerido : bloquear;

  const faseLib = FASE_CLINICA_A_LIBRERIA[faseClinica] || 'aguda';
  const disponibles = useMemo(
    () => (REHAB_DB[region] && REHAB_DB[region][faseLib]) || [],
    [region, faseLib]);

  // Elegidos: id → {series, reps, notas}. Arranca vacío a propósito: elegir
  // los ejercicios es la decisión del profesional, no un default a aceptar.
  const [elegidos, setElegidos] = useState({});
  const faseMeta = FASES_CLINICAS.find(f => f.k === faseClinica) || {};

  const toggleEx = (ej) => setElegidos(p => {
    const n = { ...p };
    if (n[ej.id]) delete n[ej.id];
    else n[ej.id] = { series: 3, reps: ej.param || '', notas: '' };
    return n;
  });
  const setParam = (id, k, v) => setElegidos(p => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const toggleBloq = (exId) => setBloquear(() =>
    marcados.includes(exId) ? marcados.filter(x => x !== exId) : [...marcados, exId]);

  const nElegidos = Object.keys(elegidos).length;

  const guardar = async () => {
    const ejercicios = Object.entries(elegidos).map(([id, cfg]) => {
      const base = disponibles.find(e => e.id === id) || {};
      return { exId: id, nombre: base.nombre || id, desc: base.desc || '', ...cfg };
    });
    const bloque = armarBloqueDirigido({
      region: REGIONES[region]?.label || region,
      faseClinica, faseLabel: faseMeta.label || '', ejercicios, nota,
    });
    if (!bloque) { alert('Elegí al menos un ejercicio para el bloque dirigido.'); return; }
    setGuardando(true);
    try {
      await onGuardar({
        bloque_dirigido: bloque,
        patron_bloqueado: marcados,
        // El texto que ya se guardaba antes, ahora derivado del bloque en vez
        // de escrito a mano: lo leen el panel de sala y el resumen del día.
        notas_seguimiento: `Bloque dirigido · ${REGIONES[region]?.label || region} · ${faseMeta.label || ''}` +
          ` · ${ejercicios.length} ejercicio${ejercicios.length === 1 ? '' : 's'}` +
          (marcados.length ? ` · bloquea ${marcados.length} patrón${marcados.length === 1 ? '' : 'es'}` : ' · sin bloquear nada') +
          (nota ? ` · ${nota}` : ''),
      });
      onCerrar?.();
    } catch (e) {
      alert('No se pudo guardar: ' + e.message);
      setGuardando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 9000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 12px', overflowY: 'auto' }}>
      <div style={{ background: BK, border: `1px solid ${G2}`, borderRadius: 12, maxWidth: 620, width: '100%' }}>

        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${G2}` }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: WH }}>🎯 Programa dirigido — escalón 2</div>
          <div style={{ fontSize: 11, color: G4, marginTop: 3 }}>
            {cliente ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() : 'Cliente'}
            {zona ? ` · ${zonaTexto(zona)}` : ''}
            {inc?.naturaleza ? ` · ${inc.naturaleza}` : ''}
          </div>
          <div style={{ fontSize: 10, color: '#5EEAD4', marginTop: 6, lineHeight: 1.5 }}>
            La rutina no se borra: el patrón que elijas queda sin carga y este bloque se agrega
            al final de cada día. Cuando el riel libere la incidencia, la rutina vuelve sola.
          </div>
        </div>

        <div style={{ padding: '12px 16px' }}>

          {/* ── REGIÓN ───────────────────────────────────────────────────── */}
          <div style={CAJA}>
            <div style={{ fontSize: 10, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
              1 · Región
            </div>
            <select value={region} onChange={e => { setRegion(e.target.value); setElegidos({}); }}
              style={{ width: '100%', background: '#0e0e0e', color: WH, border: `1px solid ${G2}`, borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
              {Object.entries(REGIONES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            {regionDeZona(zona) && regionDeZona(zona) !== region && (
              <div style={{ fontSize: 10, color: '#FDBA74', marginTop: 5 }}>
                La molestia se reportó en {zonaTexto(zona)} → {REGIONES[regionDeZona(zona)]?.label}. Cambiaste la región a mano.
              </div>
            )}
          </div>

          {/* ── FASE, POR CRITERIOS ──────────────────────────────────────── */}
          <div style={CAJA}>
            <div style={{ fontSize: 10, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
              2 · Fase clínica
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FASES_CLINICAS.map(f => (
                <button key={f.k} onClick={() => { setFaseClinica(f.k); setElegidos({}); }}
                  style={{ flex: '1 1 150px', background: faseClinica === f.k ? f.color : 'none',
                    border: `1px solid ${f.color}`, color: faseClinica === f.k ? WH : f.color,
                    borderRadius: 6, padding: '7px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
                  {f.emoji} {f.badge} · {f.label}
                </button>
              ))}
            </div>
            {faseMeta.objetivo_clinico && (
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 7, lineHeight: 1.5 }}>
                <strong style={{ color: G4 }}>Objetivo:</strong> {faseMeta.objetivo_clinico}
              </div>
            )}
            {!!(faseMeta.criterios_avance_generico || []).length && (
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 5, lineHeight: 1.6 }}>
                <strong style={{ color: G4 }}>Para pasar a la siguiente:</strong>
                {faseMeta.criterios_avance_generico.map((c, i) => <div key={i}>· {c}</div>)}
              </div>
            )}
          </div>

          {/* ── EJERCICIOS DEL BLOQUE ────────────────────────────────────── */}
          <div style={CAJA}>
            <div style={{ fontSize: 10, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
              3 · Ejercicios del bloque {nElegidos ? `(${nElegidos} elegido${nElegidos === 1 ? '' : 's'})` : ''}
            </div>
            {!disponibles.length && (
              <div style={{ fontSize: 11, color: '#FDBA74' }}>
                La biblioteca no tiene ejercicios para {REGIONES[region]?.label} en esta fase.
                Elegí otra fase o cargalos desde la pestaña Rehab.
              </div>
            )}
            {disponibles.map(ej => {
              const on = !!elegidos[ej.id];
              return (
                <div key={ej.id} style={{ borderLeft: `3px solid ${on ? '#0F766E' : G2}`, paddingLeft: 8, marginBottom: 7 }}>
                  <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleEx(ej)} style={{ marginTop: 3 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11.5, color: WH, fontWeight: 700 }}>{ej.nombre}</span>
                      {ej.desc && <span style={{ display: 'block', fontSize: 10, color: G4, lineHeight: 1.4 }}>{ej.desc}</span>}
                    </span>
                  </label>
                  {on && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <input value={elegidos[ej.id].series} onChange={e => setParam(ej.id, 'series', e.target.value)}
                        placeholder="series" style={{ width: 62, background: '#0e0e0e', color: WH, border: `1px solid ${G2}`, borderRadius: 5, padding: '5px 7px', fontSize: 11 }} />
                      <input value={elegidos[ej.id].reps} onChange={e => setParam(ej.id, 'reps', e.target.value)}
                        placeholder="reps / tiempo" style={{ flex: '1 1 120px', background: '#0e0e0e', color: WH, border: `1px solid ${G2}`, borderRadius: 5, padding: '5px 7px', fontSize: 11 }} />
                      <input value={elegidos[ej.id].notas} onChange={e => setParam(ej.id, 'notas', e.target.value)}
                        placeholder="indicación para el cliente" style={{ flex: '1 1 100%', background: '#0e0e0e', color: WH, border: `1px solid ${G2}`, borderRadius: 5, padding: '5px 7px', fontSize: 11 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── QUÉ PATRÓN SE BLOQUEA ────────────────────────────────────── */}
          <div style={CAJA}>
            <div style={{ fontSize: 10, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>
              4 · Qué queda sin carga ({marcados.length})
            </div>
            <div style={{ fontSize: 10, color: G4, marginBottom: 7, lineHeight: 1.5 }}>
              Marcados por la zona reportada. Revisalo: la app sugiere por el nombre del ejercicio,
              no sabe cómo carga cada cliente. Lo que quede marcado no se puede cargar desde el
              portal y el cliente ve por qué.
            </div>
            {cargandoPlanes && <div style={{ fontSize: 11, color: G4 }}>Buscando el plan del cliente…</div>}
            {!cargandoPlanes && !delPlan.length && (
              <div style={{ fontSize: 11, color: '#FDBA74' }}>
                Este cliente no tiene ejercicios en un plan activo, así que no hay nada que bloquear.
                El bloque dirigido se agrega igual cuando tenga plan.
              </div>
            )}
            {delPlan.map(e => {
              const on = marcados.includes(e.exId);
              return (
                <label key={e.exId} style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', padding: '3px 0' }}>
                  <input type="checkbox" checked={on} onChange={() => toggleBloq(e.exId)} />
                  <span style={{ fontSize: 11, color: on ? '#FDBA74' : '#bbb', fontWeight: on ? 700 : 400 }}>
                    {e.nombre}
                    {e.diaNombre ? <span style={{ color: G4, fontWeight: 400 }}> · {e.diaNombre}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>

          {/* ── INDICACIÓN GENERAL ───────────────────────────────────────── */}
          <div style={CAJA}>
            <div style={{ fontSize: 10, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
              5 · Indicación del bloque (la lee el cliente)
            </div>
            <input value={nota} onChange={e => setNota(e.target.value)}
              placeholder="Ej.: suspender si el dolor supera 4/10"
              style={{ width: '100%', background: '#0e0e0e', color: WH, border: `1px solid ${G2}`, borderRadius: 6, padding: '8px 10px', fontSize: 12 }} />
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${G2}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} disabled={guardando}
            style={{ background: 'none', border: `1px solid ${G2}`, color: G4, borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || !nElegidos}
            style={{ background: nElegidos ? '#0F766E' : '#222', color: nElegidos ? WH : G4, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: nElegidos ? 'pointer' : 'not-allowed' }}>
            {guardando ? 'Guardando…' : 'Activar el programa dirigido'}
          </button>
        </div>
      </div>
    </div>
  );
}
