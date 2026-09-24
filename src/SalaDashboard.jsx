import { useMemo, useState } from "react";
import { computarMetricas } from "./motor.js";
import { faseActual, diasDesde, PLAZOS } from "./hoy.js";
import { PERIODIZACIONES, TESTS_FUERZA } from "./planificacion.js";

// ═══════════════════════════════════════════════════════════════════════════
// SalaDashboard — la información que el profe necesita EN EL MOMENTO
//
// POR QUÉ NO ES UNA LISTA DE TODOS LOS CLIENTES
// En sala hay 5 o 6 personas entrenando, no 68. Un listado completo obliga a
// buscar cada vez; un panel de los que están ahora se arma una vez al empezar
// el turno y queda. Los seleccionados se guardan en el navegador, así que si
// se recarga la pantalla siguen.
//
// QUÉ MUESTRA CADA TARJETA, sin salir de la pantalla
//   · Vencimientos: plan, fase de la periodización, evaluación y test.
//   · Screening resumido: semáforo, nivel, dolor, calidad de movimiento,
//     banderas y restricciones activas.
//   · Último test de fuerza por patrón, con su fecha.
//   · La rutina va detrás de un botón, que es lo único que no cabría.
// ═══════════════════════════════════════════════════════════════════════════

const WH = '#fff', BK = '#141414', G2 = '#2a2a2a', G4 = '#8a8a8a';
const VERDE = '#16A34A', AMBAR = '#D97706', ROJO = '#DC2626', AZUL = '#0E7490';

const SEMAFORO = {
  verde: { c: VERDE, t: 'Puede entrenar normal' },
  amarillo: { c: AMBAR, t: 'Con restricciones' },
  rojo: { c: ROJO, t: 'NO entrena — derivar a clínica' },
  pendiente: { c: G4, t: 'Sin evaluar' },
};
const NIVELES = { restaura: 'RESTAURA N0', activa: 'ACTIVA N1', potencia: 'POTENCIA N2', rinde: 'RINDE N3' };
const nom = (c) => `${c.nombre || ''} ${c.apellido || ''}`.trim();

// Semáforo de días restantes: mismo criterio que la pantalla HOY.
function chipVenc(label, restan, fecha) {
  let c = VERDE, txt;
  if (restan == null) { c = G4; txt = 'sin fecha'; }
  else if (restan < 0) { c = ROJO; txt = `venció hace ${-restan}d`; }
  else if (restan <= PLAZOS.aviso) { c = AMBAR; txt = `en ${restan}d`; }
  else txt = `en ${restan}d`;
  return { label, c, txt, fecha };
}

export default function SalaDashboard({ clients = [], hoyGym = [], tests = {}, planes = {}, config = {}, onVerRutina, onNuevaIncidencia, onCambioSeleccion, incidencias = [] }) {
  const [sel, setSel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sala_clientes') || '[]'); } catch { return []; }
  });
  const [busca, setBusca] = useState('');
  const hoy = new Date().toISOString().slice(0, 10);

  const guardar = (ids) => {
    setSel(ids);
    try { localStorage.setItem('sala_clientes', JSON.stringify(ids)); } catch {}
    onCambioSeleccion?.(ids);   // el padre dispara la consulta de tests y planes
  };
  const agregar = (id) => { if (!sel.includes(id)) guardar([...sel, id]); setBusca(''); };
  const quitar = (id) => guardar(sel.filter(x => x !== id));

  const q = busca.trim().toLowerCase();
  const sugerencias = q
    ? clients.filter(c => !sel.includes(c.id) && nom(c).toLowerCase().includes(q)).slice(0, 6)
    : [];

  const filas = useMemo(() => sel.map(id => {
    const c = clients.find(x => x.id === id);
    if (!c) return null;
    const h = hoyGym.find(x => x.id === id) || {};
    const m = computarMetricas(c, {});
    const plan = planes[id] || null;
    const per = h.periodizacion || c.periodizacion;
    const f = faseActual(per, h.ciclo_inicio, hoy);
    const dScr = h.screening_fecha ? diasDesde(h.screening_fecha, hoy) : null;
    const dTest = h.test_ultimo ? diasDesde(h.test_ultimo, hoy) : null;
    const vencScr = config.venc_screening_dias ?? PLAZOS.screening;
    const vencTest = config.venc_test_dias ?? PLAZOS.test;
    const abiertas = incidencias.filter(i => i.gym_client_id === id && ['abierta', 'seguimiento'].includes(i.estado || 'abierta'));
    return {
      c, h, m, plan, f, per,
      vencimientos: [
        chipVenc('Plan', h.plan_vence ? -diasDesde(h.plan_vence, hoy) : null, h.plan_vence),
        chipVenc('Evaluación', dScr == null ? null : vencScr - dScr, h.screening_fecha),
        chipVenc('Test', dTest == null ? null : vencTest - dTest, h.test_ultimo),
      ],
      tests: tests[id] || {},
      abiertas,
    };
  }).filter(Boolean), [sel, clients, hoyGym, planes, tests, incidencias, config, hoy]);

  return (
    <div style={{ padding: '10px 12px' }}>
      {/* ── Selector de quiénes están en sala ─────────────────────────────── */}
      <div style={{ background: BK, border: `1px solid ${G2}`, borderRadius: 10, padding: '11px 13px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: WH, marginBottom: 3 }}>🏋️ Quién está en sala</div>
        <div style={{ fontSize: 10, color: G4, marginBottom: 8, lineHeight: 1.45 }}>
          Agregá a los que están entrenando ahora. Quedan fijos aunque recargues la pantalla.
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente…"
          style={{ width: '100%', background: '#0e0e0e', border: `1px solid ${G2}`, color: WH, borderRadius: 7, padding: '9px 11px', fontSize: 13, outline: 'none' }} />
        {sugerencias.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {sugerencias.map(c => (
              <div key={c.id} onClick={() => agregar(c.id)}
                style={{ padding: '7px 9px', borderRadius: 6, background: '#1c1c1c', marginBottom: 3, cursor: 'pointer', fontSize: 12, color: WH, display: 'flex', justifyContent: 'space-between' }}>
                <span>{nom(c)}</span>
                <span style={{ color: (SEMAFORO[c.semaforo] || SEMAFORO.pendiente).c, fontSize: 11, fontWeight: 700 }}>＋ agregar</span>
              </div>
            ))}
          </div>
        )}
        {sel.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
            {filas.map(f => (
              <span key={f.c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1c1c1c', border: `1px solid ${(SEMAFORO[f.c.semaforo] || SEMAFORO.pendiente).c}55`, borderRadius: 99, padding: '3px 5px 3px 10px', fontSize: 11, color: WH }}>
                {nom(f.c)}
                <button onClick={() => quitar(f.c.id)} title="Sacar de sala"
                  style={{ background: 'none', border: 'none', color: G4, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 3px' }}>×</button>
              </span>
            ))}
            <button onClick={() => guardar([])} style={{ background: 'none', border: 'none', color: G4, fontSize: 10, cursor: 'pointer' }}>vaciar</button>
          </div>
        )}
      </div>

      {filas.length === 0 && (
        <div style={{ background: BK, border: `1px dashed ${G2}`, borderRadius: 10, padding: '26px 16px', textAlign: 'center', color: G4, fontSize: 12, lineHeight: 1.6 }}>
          Buscá a los clientes que están entrenando y van a aparecer acá sus vencimientos,
          el resumen del screening y su último test — sin salir de esta pantalla.
        </div>
      )}

      {/* ── Tarjetas: 2 columnas en pantalla ancha, 1 en celular ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 10 }}>
        {filas.map(f => <Tarjeta key={f.c.id} f={f} onVerRutina={onVerRutina} onNuevaIncidencia={onNuevaIncidencia} />)}
      </div>
    </div>
  );
}

function Tarjeta({ f, onVerRutina, onNuevaIncidencia }) {
  const { c, h, m, plan, per } = f;
  const sem = SEMAFORO[c.semaforo] || SEMAFORO.pendiente;
  const r = c.restricciones_flags || {};
  const restricciones = [r.impacto && 'sin impacto', r.overhead && 'sin overhead', r.cargaAxial && 'sin carga axial'].filter(Boolean);
  const testsLista = TESTS_FUERZA.map(t => ({ ...t, d: f.tests[t.id] })).filter(t => t.d);

  return (
    <div style={{ background: BK, border: `1px solid ${G2}`, borderLeft: `4px solid ${sem.c}`, borderRadius: 10, padding: '11px 12px' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: WH, lineHeight: 1.2 }}>{nom(c)}</div>
          <div style={{ fontSize: 10, color: sem.c, fontWeight: 700, marginTop: 2 }}>
            {NIVELES[c.nivel] || c.nivel} · {sem.t}
          </div>
        </div>
        {f.abiertas.length > 0 && (
          <span style={{ background: '#3A1215', border: `1px solid ${ROJO}`, color: '#FCA5A5', borderRadius: 99, padding: '2px 8px', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
            ⚠ {f.abiertas.length} molestia{f.abiertas.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {c.objetivo && <div style={{ fontSize: 10, color: G4, marginTop: 5 }}>🎯 {c.objetivo}</div>}

      {/* ── Vencimientos ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 9 }}>
        {f.vencimientos.map(v => (
          <span key={v.label} title={v.fecha ? `Último/fin: ${v.fecha}` : 'sin fecha registrada'}
            style={{ background: `${v.c}1f`, border: `1px solid ${v.c}66`, color: v.c, borderRadius: 6, padding: '3px 7px', fontSize: 9, fontWeight: 700 }}>
            {v.label}: {v.txt}
          </span>
        ))}
      </div>

      {/* ── Fase de la periodización ─────────────────────────────────────── */}
      <div style={{ background: '#0e0e0e', borderRadius: 7, padding: '7px 9px', marginTop: 8 }}>
        {!per ? (
          <div style={{ fontSize: 10, color: G4 }}>Sin periodización asignada</div>
        ) : !f.f ? (
          <div style={{ fontSize: 10, color: G4 }}>
            {PERIODIZACIONES[per]?.nombre || per} · sin fecha de inicio de ciclo
          </div>
        ) : f.f.cicloTerminado ? (
          <div style={{ fontSize: 10, color: ROJO, fontWeight: 700 }}>
            ⛔ Ciclo terminado hace {f.f.diasDesdeFin} días — corresponde retestear y replanificar
          </div>
        ) : f.f.rotativa ? (
          <div style={{ fontSize: 10, color: WH, lineHeight: 1.5 }}>
            <strong style={{ color: AZUL }}>{f.f.per}</strong><br />
            Semana {f.f.semana} de {f.f.semanasCiclo} · rota el estímulo cada semana
            {f.f.diasParaFinCiclo != null && <> · ciclo termina en {f.f.diasParaFinCiclo}d</>}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: WH, lineHeight: 1.5 }}>
            <strong style={{ color: AZUL }}>F{f.f.faseIdx + 1}/{f.f.totalFases} · {f.f.fase}</strong>
            <span style={{ color: G4 }}> (sem {f.f.semanaDeFase}/{f.f.semanasFase})</span><br />
            <strong>{f.f.reps} reps</strong> · {f.f.intensidad}{f.f.rir ? ` · RIR ${f.f.rir}` : ''}<br />
            <span style={{ color: f.f.diasParaFinFase <= PLAZOS.aviso ? AMBAR : G4 }}>
              {f.f.diasParaFinFase <= 0 ? 'La fase ya terminó' : `Cambia de fase en ${f.f.diasParaFinFase}d`}
              {f.f.siguiente ? ` → ${f.f.siguiente}` : ' · última fase'}
            </span>
          </div>
        )}
      </div>

      {/* ── Screening ────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 9, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Screening</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Dato k="Dolor" v={m.eva.medido ? `${m.eva.eva}/10` : 'sin medir'}
            c={!m.eva.medido ? G4 : m.eva.eva >= 4 ? ROJO : m.eva.eva > 0 ? AMBAR : VERDE} />
          <Dato k="Calidad mov." v={m.calidad.medido ? `${m.calidad.pct}%` : 'sin medir'}
            c={!m.calidad.medido ? G4 : m.calidad.pct >= 70 ? VERDE : m.calidad.pct >= 50 ? AMBAR : ROJO} />
          {m.ybalance.medido && <Dato k="Y-Balance" v={`${m.ybalance.difAntCm} cm`} c={m.ybalance.simetrico ? VERDE : AMBAR} />}
          {m.romPct != null && <Dato k="ROM" v={`${m.romPct}%`} c={m.romPct >= 85 ? VERDE : m.romPct >= 70 ? AMBAR : ROJO} />}
        </div>
        {m.banderas.hay && (
          <div style={{ fontSize: 9, color: '#FCA5A5', background: '#3A1215', borderRadius: 5, padding: '5px 7px', marginTop: 5, lineHeight: 1.45 }}>
            🚩 {m.banderas.activas.map(a => a.texto).join(' · ')}
          </div>
        )}
        {restricciones.length > 0 && (
          <div style={{ fontSize: 9, color: '#FCD34D', marginTop: 4 }}>⛔ {restricciones.join(' · ')}</div>
        )}
        {(c.restricciones || '').trim() && (
          <div style={{ fontSize: 9, color: '#FCD34D', marginTop: 3, lineHeight: 1.4 }}>{c.restricciones}</div>
        )}
        {m.calidad.medido && m.calidad.detalle?.some(d => d.puntos <= 2) && (
          <div style={{ fontSize: 9, color: G4, marginTop: 4, lineHeight: 1.45 }}>
            Déficits: {m.calidad.detalle.filter(d => d.puntos <= 2).map(d => d.patron).join(' · ')}
          </div>
        )}
      </div>

      {/* ── Último test de fuerza ────────────────────────────────────────── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 9, color: G4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>
          Último test de fuerza {h.test_ultimo ? `· ${h.test_ultimo}` : ''}
        </div>
        {testsLista.length === 0 ? (
          <div style={{ fontSize: 10, color: G4 }}>Sin tests registrados</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 4 }}>
            {testsLista.map(t => {
              const rm = t.d.rm1_real || t.d.rm1_calculado;
              return (
                <div key={t.id} style={{ background: '#0e0e0e', borderRadius: 6, padding: '5px 7px' }}>
                  <div style={{ fontSize: 8, color: G4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: WH }}>{rm ? `${rm} kg` : '—'}</div>
                  <div style={{ fontSize: 8, color: G4 }}>{t.d.fecha}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={() => onVerRutina?.(c, plan)} disabled={!plan}
          style={{ flex: 1, minWidth: 130, background: plan ? '#1BAA86' : '#222', color: plan ? '#04231C' : G4, border: 'none', borderRadius: 7, padding: '8px', fontSize: 11, fontWeight: 800, cursor: plan ? 'pointer' : 'default' }}>
          {plan ? '📋 Ver la rutina' : 'sin plan activo'}
        </button>
        <button onClick={() => onNuevaIncidencia?.(c)}
          style={{ background: 'none', border: `1px solid ${ROJO}66`, color: '#FCA5A5', borderRadius: 7, padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          ⚠️ Le duele
        </button>
      </div>
    </div>
  );
}

function Dato({ k, v, c }) {
  return (
    <div style={{ background: `${c}14`, border: `1px solid ${c}44`, borderRadius: 6, padding: '4px 7px', minWidth: 62 }}>
      <div style={{ fontSize: 8, color: G4 }}>{k}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: c }}>{v}</div>
    </div>
  );
}
