// PlanClinico.jsx — PLAN CLÍNICO A LARGO PLAZO CON VARIAS REGIONES
//
// POR QUÉ EXISTE
// Un paciente con 4 regiones afectadas y 20 sesiones contratadas no se trata
// con 4 planes en paralelo: 20 ÷ 4 = 5 sesiones por región, que está por
// debajo de dosis terapéutica para casi cualquier tendinopatía. Repartir
// parejo garantiza cuatro tratamientos subdosificados.
//
// El plan es una ASIGNACIÓN, no una suma de planes:
//   · qué región es FOCO cada semana (recibe la dosis principal)
//   · qué hacen las otras mientras tanto (mantenimiento / domiciliario / espera)
//   · cómo se consume el presupuesto finito de sesiones
//
// Además distingue la RELACIÓN entre cuadros. Una radiculopatía cervical puede
// estar generando tendinopatías distales; en ese caso el cervical es el driver
// y tratar los efectos en paralelo gasta sesiones sin resolver la causa.

import { useState, useMemo, useEffect } from "react";

const NV = '#0A3D62', TL = '#1BAA86', CR = '#FF6F4C';
const WH = '#FFFFFF', BG = '#F0F4F8', GL = '#E2E8F0';
const GM = '#94A3B8', GD = '#475569';
const GN = '#16A34A', AM = '#D97706', RJ = '#DC2626', MO = '#7C3AED';

// Rol semanal de cada región. `sesiones` es cuánto del presupuesto consume.
export const ROLES_SEMANA = {
  foco:         { label: 'Foco',          abbr: 'F', color: RJ, bg: '#FEE2E2', desc: 'Tratamiento activo, dosis principal', peso: 1 },
  mantenimiento:{ label: 'Mantenimiento', abbr: 'M', color: AM, bg: '#FEF3C7', desc: 'Se sostiene en sesión, dosis menor',  peso: 0.5 },
  domiciliario: { label: 'Domiciliario',  abbr: 'D', color: TL, bg: '#D1FAE5', desc: 'Solo pauta en casa, no usa sesión',   peso: 0 },
  espera:       { label: 'En espera',     abbr: '·', color: GM, bg: '#F1F5F9', desc: 'Todavía no se interviene',            peso: 0 },
};

export const ROLES_REGION = {
  driver:       { label: 'Driver',        color: RJ, desc: 'Hipótesis de causa — puede estar generando a las dependientes' },
  dependiente:  { label: 'Dependiente',   color: AM, desc: 'Se sospecha secundaria al driver' },
  independiente:{ label: 'Independiente', color: NV, desc: 'Cuadro propio, sin relación con los otros' },
};

const FASES_R = [
  { k: 'proteccion',      label: 'Protección' },
  { k: 'carga_progresiva',label: 'Carga progresiva' },
  { k: 'retorno_funcion', label: 'Retorno funcional' },
  { k: 'alta',            label: 'Alta' },
];

const genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export default function PlanClinico({
  paciente, regionesList = [], evaluaciones = [],
  planes = [], savePlan, deletePlan, sesiones = [], onVolver, fs,
}) {
  const activo = planes.find(p => p.estado === 'activo') || null;
  const [editando, setEditando] = useState(null);

  if (!paciente) return null;

  // ── Semilla desde las evaluaciones ya cargadas ───────────────────────────
  const nuevoPlan = () => {
    const regs = [...new Set(evaluaciones.map(e => e.region).filter(Boolean))];
    const contratadas = Number(paciente.sesionesContratadas || paciente.sesiones_contratadas || 0) || 0;
    return {
      id: genId('planc'),
      paciente_id: paciente.id,
      nombre: 'Plan clínico 12 semanas',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      semanas: 12,
      sesiones_presupuestadas: contratadas,
      objetivo_general: '',
      regiones: regs.map((r, i) => {
        const ult = evaluaciones.filter(e => e.region === r).slice(-1)[0];
        return {
          region: r,
          rol: i === 0 ? 'driver' : 'independiente',
          diagnostico: ult?.diagnosticoPT || '',
          fase_inicial: ult?.faseRehab || 'proteccion',
          fase_objetivo: 'retorno_funcion',
          prioridad: i + 1,
        };
      }),
      matriz: [],
      hitos: [],
      notas: '',
      estado: 'activo',
    };
  };

  if (editando) {
    return <Editor plan={editando} paciente={paciente} regionesList={regionesList}
      onCancel={() => setEditando(null)}
      onSave={async (p) => { await savePlan(p); setEditando(null); }} fs={fs} />;
  }

  return (
    <div style={{ padding: 14 }}>
      <button onClick={onVolver} style={{ ...fs.btnG, fontSize: 11, marginBottom: 12 }}>← Volver</button>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>Plan clínico — {paciente.nombre} {paciente.apellido}</div>
      <div style={{ fontSize: 11, color: GM, marginBottom: 14 }}>
        Planificación a largo plazo con asignación de sesiones entre regiones.
      </div>

      {!activo && (
        <div style={{ background: '#EFF6FF', border: `1px solid #93C5FD`, borderRadius: 9, padding: '13px 15px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: NV, marginBottom: 5 }}>Sin plan activo</div>
          <div style={{ fontSize: 11, color: GD, lineHeight: 1.55, marginBottom: 10 }}>
            Se arma sobre las regiones ya evaluadas: <strong>{[...new Set(evaluaciones.map(e => e.region))].join(', ') || 'ninguna todavía'}</strong>.
            Podés agregar más adentro del plan.
          </div>
          <button onClick={() => setEditando(nuevoPlan())} style={{ ...fs.btnTL, fontSize: 12 }}>+ Armar plan</button>
        </div>
      )}

      {planes.map(p => (
        <ResumenPlan key={p.id} plan={p} sesiones={sesiones} regionesList={regionesList} fs={fs}
          onEditar={() => setEditando(p)}
          onEliminar={() => { if (confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) deletePlan(p.id); }} />
      ))}
    </div>
  );
}

// ─── Resumen de un plan guardado ───────────────────────────────────────────
function ResumenPlan({ plan, sesiones, regionesList, fs, onEditar, onEliminar }) {
  const gasto = useMemo(() => calcularGasto(plan), [plan]);
  const usadas = sesiones.filter(s => s.plan_clinico_id === plan.id).length;
  const inicio = new Date(plan.fecha_inicio + 'T12:00');
  const semanaActual = Math.floor((Date.now() - inicio.getTime()) / (7 * 864e5)) + 1;
  const enCurso = semanaActual >= 1 && semanaActual <= plan.semanas;

  return (
    <div style={{ background: WH, border: `1px solid ${GL}`, borderLeft: `4px solid ${plan.estado === 'activo' ? TL : GM}`, borderRadius: 9, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{plan.nombre}</div>
          <div style={{ fontSize: 10, color: GM, marginTop: 2 }}>
            {plan.fecha_inicio} · {plan.semanas} semanas · {(plan.regiones || []).length} regiones
            {enCurso && <span style={{ color: TL, fontWeight: 700 }}> · en semana {semanaActual}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onEditar} style={{ ...fs.btnNV, fontSize: 10, padding: '4px 10px' }}>Abrir</button>
          <button onClick={onEliminar} style={{ ...fs.btnG, fontSize: 10, padding: '4px 8px', color: RJ, borderColor: RJ }}>✕</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {(plan.regiones || []).map(r => {
          const rl = regionesList.find(x => x.k === r.region);
          const rr = ROLES_REGION[r.rol] || ROLES_REGION.independiente;
          return (
            <span key={r.region} style={{ fontSize: 10, fontWeight: 700, border: `1px solid ${rr.color}`, color: rr.color, borderRadius: 99, padding: '2px 9px' }}>
              {rl?.label || r.region} · {rr.label}
            </span>
          );
        })}
      </div>

      <div style={{ marginTop: 9, background: BG, borderRadius: 7, padding: '8px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: GD, marginBottom: 4 }}>
          <span>Presupuesto de sesiones</span>
          <span style={{ fontWeight: 800, color: gasto.total > plan.sesiones_presupuestadas ? RJ : GN }}>
            {gasto.total} planificadas / {plan.sesiones_presupuestadas || '—'} contratadas · {usadas} registradas
          </span>
        </div>
        {plan.sesiones_presupuestadas > 0 && (
          <div style={{ height: 7, background: GL, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, gasto.total / plan.sesiones_presupuestadas * 100)}%`, height: '100%', background: gasto.total > plan.sesiones_presupuestadas ? RJ : TL }} />
          </div>
        )}
        {gasto.total > plan.sesiones_presupuestadas && plan.sesiones_presupuestadas > 0 && (
          <div style={{ fontSize: 10, color: RJ, marginTop: 5, fontWeight: 700 }}>
            ⚠ El plan asigna {gasto.total - plan.sesiones_presupuestadas} sesiones más de las contratadas.
          </div>
        )}
      </div>
    </div>
  );
}

// Suma el consumo de sesiones: foco cuenta 1, mantenimiento 0,5,
// domiciliario y espera no consumen.
export function calcularGasto(plan) {
  const porRegion = {};
  let total = 0;
  (plan.matriz || []).forEach(sem => {
    (sem.asignaciones || []).forEach(a => {
      const peso = ROLES_SEMANA[a.rol]?.peso ?? 0;
      const n = peso * (Number(sem.sesiones) || 0);
      porRegion[a.region] = (porRegion[a.region] || 0) + n;
      total += n;
    });
  });
  Object.keys(porRegion).forEach(k => porRegion[k] = Math.round(porRegion[k] * 10) / 10);
  return { total: Math.round(total * 10) / 10, porRegion };
}

// ─── Editor: matriz semana × región ────────────────────────────────────────
function Editor({ plan: planIn, paciente, regionesList, onCancel, onSave, fs }) {
  const [p, setP] = useState(planIn);
  const set = (k, v) => setP(x => ({ ...x, [k]: v }));

  // La matriz se sincroniza con la cantidad de semanas y de regiones.
  useEffect(() => {
    setP(x => {
      const regs = (x.regiones || []).map(r => r.region);
      const m = [];
      for (let i = 1; i <= (x.semanas || 12); i++) {
        const prev = (x.matriz || []).find(s => s.semana === i);
        m.push({
          semana: i,
          sesiones: prev?.sesiones ?? 2,
          asignaciones: regs.map(rg => prev?.asignaciones?.find(a => a.region === rg) || { region: rg, rol: 'espera' }),
          nota: prev?.nota || '',
        });
      }
      return { ...x, matriz: m };
    });
  }, [p.semanas, (p.regiones || []).map(r => r.region).join(',')]);

  const gasto = useMemo(() => calcularGasto(p), [p]);
  const excede = p.sesiones_presupuestadas > 0 && gasto.total > p.sesiones_presupuestadas;

  const ciclarRol = (semana, region) => {
    const orden = ['espera', 'domiciliario', 'mantenimiento', 'foco'];
    setP(x => ({
      ...x,
      matriz: x.matriz.map(s => s.semana !== semana ? s : {
        ...s,
        asignaciones: s.asignaciones.map(a => a.region !== region ? a : {
          ...a, rol: orden[(orden.indexOf(a.rol) + 1) % orden.length],
        }),
      }),
    }));
  };

  const setRegion = (i, k, v) => setP(x => ({ ...x, regiones: x.regiones.map((r, ix) => ix === i ? { ...r, [k]: v } : r) }));
  const addRegion = (rk) => {
    if (!rk || (p.regiones || []).some(r => r.region === rk)) return;
    if ((p.regiones || []).length >= 6) { alert('Seis regiones es el techo razonable de un plan. Más que eso no es un plan, es una lista de deseos.'); return; }
    setP(x => ({ ...x, regiones: [...x.regiones, { region: rk, rol: 'independiente', diagnostico: '', fase_inicial: 'proteccion', fase_objetivo: 'retorno_funcion', prioridad: x.regiones.length + 1 }] }));
  };
  const delRegion = (rk) => setP(x => ({ ...x, regiones: x.regiones.filter(r => r.region !== rk) }));

  const lbl = (rk) => regionesList.find(x => x.k === rk)?.label || rk;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={{ ...fs.btnG, fontSize: 11 }}>← Cancelar</button>
        <button onClick={() => onSave(p)} style={{ ...fs.btnTL, fontSize: 11 }}>💾 Guardar plan</button>
      </div>

      {/* Cabecera */}
      <div style={{ background: WH, border: `1px solid ${GL}`, borderRadius: 9, padding: 12, marginBottom: 10 }}>
        <input value={p.nombre} onChange={e => set('nombre', e.target.value)}
          style={{ ...fs.inp, fontSize: 14, fontWeight: 700, width: '100%', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div><span style={fs.lbl}>Inicio</span>
            <input type="date" value={p.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} style={{ ...fs.inp, width: 138 }} /></div>
          <div><span style={fs.lbl}>Semanas</span>
            <input type="number" min={1} max={26} value={p.semanas} onChange={e => set('semanas', Math.max(1, Math.min(26, +e.target.value || 12)))} style={{ ...fs.inp, width: 78 }} /></div>
          <div><span style={fs.lbl}>Sesiones contratadas</span>
            <input type="number" min={0} value={p.sesiones_presupuestadas} onChange={e => set('sesiones_presupuestadas', +e.target.value || 0)} style={{ ...fs.inp, width: 96 }} /></div>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={fs.lbl}>Objetivo general del plan</span>
          <textarea value={p.objetivo_general} onChange={e => set('objetivo_general', e.target.value)} rows={2}
            placeholder="Qué tiene que poder hacer la paciente al final de las 12 semanas"
            style={{ ...fs.inp, width: '100%', resize: 'vertical' }} />
        </div>
      </div>

      {/* Regiones y su relación */}
      <div style={{ background: WH, border: `1px solid ${GL}`, borderRadius: 9, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>Regiones y relación entre cuadros</div>
        <div style={{ fontSize: 10, color: GM, marginBottom: 9, lineHeight: 1.5 }}>
          Marcar un <strong>driver</strong> cambia la estrategia: si un cuadro está generando a los otros,
          tratarlos en paralelo gasta sesiones en los efectos y no en la causa.
        </div>
        {(p.regiones || []).map((r, i) => {
          const rr = ROLES_REGION[r.rol] || ROLES_REGION.independiente;
          return (
            <div key={r.region} style={{ border: `1px solid ${GL}`, borderLeft: `3px solid ${rr.color}`, borderRadius: 7, padding: '9px 10px', marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{lbl(r.region)}</span>
                <button onClick={() => delRegion(r.region)} style={{ ...fs.btnG, fontSize: 9, padding: '2px 7px', color: RJ, borderColor: RJ }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
                <div><span style={fs.lbl}>Relación</span>
                  <select value={r.rol} onChange={e => setRegion(i, 'rol', e.target.value)} style={{ ...fs.sel, fontSize: 11 }}>
                    {Object.entries(ROLES_REGION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div><span style={fs.lbl}>Fase hoy</span>
                  <select value={r.fase_inicial} onChange={e => setRegion(i, 'fase_inicial', e.target.value)} style={{ ...fs.sel, fontSize: 11 }}>
                    {FASES_R.map(f => <option key={f.k} value={f.k}>{f.label}</option>)}
                  </select></div>
                <div><span style={fs.lbl}>Fase objetivo</span>
                  <select value={r.fase_objetivo} onChange={e => setRegion(i, 'fase_objetivo', e.target.value)} style={{ ...fs.sel, fontSize: 11 }}>
                    {FASES_R.map(f => <option key={f.k} value={f.k}>{f.label}</option>)}
                  </select></div>
              </div>
              <input value={r.diagnostico} onChange={e => setRegion(i, 'diagnostico', e.target.value)}
                placeholder="Diagnóstico fisioterapéutico de esta región"
                style={{ ...fs.inp, width: '100%', fontSize: 11 }} />
              <div style={{ fontSize: 9, color: rr.color, marginTop: 4 }}>{rr.desc}</div>
            </div>
          );
        })}
        <select value="" onChange={e => addRegion(e.target.value)} style={{ ...fs.sel, fontSize: 11, marginTop: 4 }}>
          <option value="">+ Agregar región…</option>
          {regionesList.filter(r => !(p.regiones || []).some(x => x.region === r.k)).map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
        </select>
      </div>

      {/* Matriz */}
      <div style={{ background: WH, border: `1px solid ${GL}`, borderRadius: 9, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>Asignación semana × región</div>
        <div style={{ fontSize: 10, color: GM, marginBottom: 8 }}>Tocá una celda para cambiar el rol de esa región esa semana.</div>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 9 }}>
          {Object.entries(ROLES_SEMANA).map(([k, v]) => (
            <span key={k} style={{ fontSize: 9, color: v.color, background: v.bg, border: `1px solid ${v.color}44`, borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
              {v.abbr} {v.label} — {v.desc}
            </span>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
            <thead>
              <tr>
                <th style={{ ...th, position: 'sticky', left: 0, background: NV, zIndex: 2 }}>Sem</th>
                <th style={th}>Ses.</th>
                {(p.regiones || []).map(r => <th key={r.region} style={th}>{lbl(r.region)}</th>)}
              </tr>
            </thead>
            <tbody>
              {(p.matriz || []).map(sem => (
                <tr key={sem.semana}>
                  <td style={{ ...td, fontWeight: 800, position: 'sticky', left: 0, background: WH, zIndex: 1 }}>{sem.semana}</td>
                  <td style={td}>
                    <input type="number" min={0} max={7} value={sem.sesiones}
                      onChange={e => setP(x => ({ ...x, matriz: x.matriz.map(s => s.semana === sem.semana ? { ...s, sesiones: +e.target.value || 0 } : s) }))}
                      style={{ width: 40, border: `1px solid ${GL}`, borderRadius: 4, padding: '3px 4px', fontSize: 11, textAlign: 'center' }} />
                  </td>
                  {(sem.asignaciones || []).map(a => {
                    const rv = ROLES_SEMANA[a.rol] || ROLES_SEMANA.espera;
                    return (
                      <td key={a.region} style={{ ...td, padding: 3 }}>
                        <div onClick={() => ciclarRol(sem.semana, a.region)} title={rv.desc}
                          style={{ cursor: 'pointer', background: rv.bg, color: rv.color, border: `1px solid ${rv.color}55`, borderRadius: 5, padding: '5px 0', textAlign: 'center', fontWeight: 800, fontSize: 11 }}>
                          {rv.abbr}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Presupuesto */}
      <div style={{ background: excede ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${excede ? RJ : GN}`, borderRadius: 9, padding: '11px 13px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: excede ? RJ : GN, marginBottom: 6 }}>
          {excede ? '⚠ El plan excede las sesiones contratadas' : '✓ Presupuesto dentro de lo contratado'}
        </div>
        <div style={{ fontSize: 11, color: GD, marginBottom: 7 }}>
          Planificadas <strong>{gasto.total}</strong> de <strong>{p.sesiones_presupuestadas || '—'}</strong> contratadas.
          {excede && ` Sobran ${(gasto.total - p.sesiones_presupuestadas).toFixed(1)} — hay que sacar foco de alguna semana o contratar más.`}
        </div>
        {Object.entries(gasto.porRegion).map(([rk, n]) => (
          <div key={rk} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: `1px solid ${GL}` }}>
            <span>{lbl(rk)}</span>
            <span style={{ fontWeight: 700, color: n < 6 ? AM : GD }}>
              {n} sesiones{n > 0 && n < 6 ? ' · dosis probablemente insuficiente' : ''}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 9, color: GM, marginTop: 7, fontStyle: 'italic', lineHeight: 1.5 }}>
          El aviso de dosis insuficiente usa 6 sesiones como piso orientativo para un cuadro
          tendinoso o articular. No es una regla clínica: es un recordatorio de que repartir
          parejo entre muchas regiones subdosifica todas.
        </div>
      </div>
    </div>
  );
}

const th = { background: NV, color: WH, fontSize: 9, fontWeight: 700, padding: '5px 6px', textAlign: 'center', border: `1px solid ${NV}` };
const td = { border: `1px solid ${GL}`, padding: '4px 6px', fontSize: 11, textAlign: 'center' };
