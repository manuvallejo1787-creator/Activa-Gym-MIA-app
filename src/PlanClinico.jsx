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
import { HORIZONTES, generarPlanClinico, DOSIS_FASE, PROT_SESION,
  generarSesionesPlan, sesionQueToca, dosisDeFase, evaluarEva, deltaEva,
  CONSULTAS_FASE, TERCIO_LABEL, tipoItemRehab } from "./planClinicoMotor.js";

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

      {/* ── GENERADOR POR HORIZONTE ─────────────────────────────────────────
          El plazo lo propone el tejido, no la preferencia. Un plan de 4
          semanas para una tendinopatía es un error con interfaz linda: la
          remodelación del colágeno no se acelera poniendo una fecha corta. */}
      <GeneradorHorizonte
        paciente={paciente} evaluaciones={evaluaciones} regionesList={regionesList}
        onGenerado={async (plan) => { await savePlan(plan); }} fs={fs} />

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
        <div key={p.id}>
          <ResumenPlan plan={p} sesiones={sesiones} regionesList={regionesList} fs={fs}
            onEditar={() => setEditando(p)}
            onEliminar={() => { if (confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) deletePlan(p.id); }} />
          {/* La grilla de sesiones solo tiene sentido sobre el plan activo: un
              plan cerrado no tiene sesión "que toca". */}
          {p.estado === 'activo' && (
            <GrillaSesiones plan={p}
              sesionesHechas={sesiones.filter(x => x.plan_clinico_id === p.id)}
              onGuardar={(campos) => savePlan({ ...p, ...campos })}
              fs={fs} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Resumen de un plan guardado ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// GRILLA DE SESIONES DEL PLAN
//
// El plan deja de ser un cronograma de fases y pasa a tener las sesiones
// diseñadas de antemano. Todo es editable: la frecuencia de consultas por
// fase, la dosis de cada ejercicio y qué ejercicios entran en cada sesión.
//
// El rango de EVA de la fase está visible en cada sesión, no escondido en la
// definición de la fase: cuando abrís la que toca, el techo está a la vista.
// ═══════════════════════════════════════════════════════════════════════════
function GrillaSesiones({ plan, sesionesHechas = [], onGuardar, fs }) {
  const [frec, setFrec] = useState(() => ({ ...CONSULTAS_FASE, ...(plan.consultas_por_fase || {}) }));
  const [grilla, setGrilla] = useState(() => plan.sesiones_plan || null);
  const [abierta, setAbierta] = useState(null);
  const [generando, setGenerando] = useState(false);

  const gen = (frecUsar) => {
    setGenerando(true);
    try {
      const r = generarSesionesPlan({ plan, protSesion: PROT_SESION, consultasPorFase: frecUsar || frec, genId });
      setGrilla(r.sesiones);
      return r;
    } finally { setGenerando(false); }
  };

  const resultado = useMemo(() => {
    if (!grilla) return null;
    return sesionQueToca(grilla, sesionesHechas);
  }, [grilla, sesionesHechas]);

  const regenerar = () => {
    const editadas = (grilla || []).filter(s => s.editado).length;
    if (editadas && !confirm(`Hay ${editadas} sesión/es que editaste a mano. Regenerar las reemplaza. ¿Seguir?`)) return;
    const r = gen();
    if (r.avisos?.length) alert(r.avisos.join('\n\n'));
  };

  const setFrecFase = (fase, v) => {
    const n = Math.max(1, Math.min(7, parseInt(v) || 1));
    const nf = { ...frec, [fase]: n };
    setFrec(nf);
    if (grilla) gen(nf);
  };

  const editarEj = (sn, ejId, campo, valor) => {
    setGrilla(g => g.map(s => s.n !== sn ? s : {
      ...s, editado: true,
      ejercicios: s.ejercicios.map(e => e.id !== ejId ? e : { ...e, [campo]: valor, editado: true }),
    }));
  };
  const toggleEj = (sn, ejId) => {
    setGrilla(g => g.map(s => s.n !== sn ? s : {
      ...s, editado: true,
      ejercicios: s.ejercicios.map(e => e.id !== ejId ? e : { ...e, activo: !e.activo, editado: true }),
    }));
  };

  const COLOR_FASE = { proteccion: RJ, carga_progresiva: AM, retorno_funcion: GN };
  const LBL_FASE = { proteccion: 'Protección', carga_progresiva: 'Carga progresiva', retorno_funcion: 'Retorno a la función' };

  return (
    <div style={{ background: WH, border: `1px solid ${GL}`, borderRadius: 9, padding: 12, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>🗓 Sesiones del plan</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {grilla && <button onClick={() => onGuardar({ sesiones_plan: grilla, consultas_por_fase: frec })}
            style={{ ...fs.btnNV, fontSize: 10, padding: '4px 10px' }}>Guardar grilla</button>}
          <button onClick={regenerar} disabled={generando}
            style={{ ...fs.btnG, fontSize: 10, padding: '4px 10px' }}>
            {generando ? 'Generando…' : grilla ? 'Regenerar' : '⚡ Diseñar las sesiones'}</button>
        </div>
      </div>

      {/* Frecuencia de CONSULTAS por fase — editable */}
      <div style={{ background: BG, borderRadius: 7, padding: 9, marginBottom: 9 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: GD, marginBottom: 6 }}>Consultas por semana, por fase</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['proteccion', 'carga_progresiva', 'retorno_funcion'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: COLOR_FASE[f], fontWeight: 700 }}>{LBL_FASE[f]}</span>
              <input type="number" min="1" max="7" value={frec[f]} onChange={e => setFrecFase(f, e.target.value)}
                style={{ width: 44, padding: '3px 5px', border: `1px solid ${GL}`, borderRadius: 5, fontSize: 11, textAlign: 'center' }}/>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: GM, marginTop: 6 }}>
          Esto es cuántas veces lo ves vos en la clínica. Lo que el paciente hace solo en casa es el
          programa domiciliario, que sale de la dosis de cada fase y aparece dentro de cada sesión.
        </div>
      </div>

      {!grilla && <div style={{ fontSize: 11, color: GM }}>
        Todavía no diseñaste las sesiones. El generador las arma desde las fases del plan, con la dosis
        del tercio que corresponde a cada semana y el rango de EVA de su fase.
      </div>}

      {resultado && (
        <>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, marginBottom: 8, flexWrap: 'wrap' }}>
            <span>Hechas: <b>{resultado.hechas}</b>/{resultado.total}</span>
            {resultado.toca && <span style={{ color: TL, fontWeight: 700 }}>
              Toca la n° {resultado.toca.n} · semana {resultado.toca.semana} · EVA hasta {resultado.toca.eva?.max}/10
            </span>}
            {!resultado.toca && <span style={{ color: GN, fontWeight: 700 }}>Plan completo</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {resultado.lista.map(ses => {
              const esLaQueToca = resultado.toca && resultado.toca.n === ses.n;
              const abiertaAhora = abierta === ses.n;
              const activos = ses.ejercicios.filter(e => e.activo);
              return (
                <div key={ses.n} style={{
                  border: `1px solid ${esLaQueToca ? TL : GL}`,
                  borderLeft: `4px solid ${COLOR_FASE[ses.fase] || GM}`,
                  background: ses.estado === 'hecha' ? '#F8FAFC' : WH,
                  borderRadius: 7, padding: '7px 9px', opacity: ses.estado === 'hecha' ? 0.65 : 1 }}>
                  <div onClick={() => setAbierta(abiertaAhora ? null : ses.n)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>
                        {ses.estado === 'hecha' ? '✓ ' : esLaQueToca ? '▶ ' : ''}Sesión {ses.n}
                        <span style={{ fontWeight: 400, color: GM }}> · semana {ses.semana}</span>
                        {ses.editado && <span style={{ fontSize: 9, color: MO, marginLeft: 5 }}>editada</span>}
                      </div>
                      <div style={{ fontSize: 9, color: GM, marginTop: 1 }}>
                        <span style={{ color: COLOR_FASE[ses.fase], fontWeight: 700 }}>{LBL_FASE[ses.fase] || ses.fase}</span>
                        {ses.tercio && ` · ${TERCIO_LABEL[ses.tercio]}`} · {activos.length} ítems
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      {ses.eva && <div style={{ fontSize: 10, fontWeight: 800, color: COLOR_FASE[ses.fase] }}>
                        EVA ≤{ses.eva.max}<span style={{ fontWeight: 400, color: GM }}> (techo {ses.eva.techo})</span>
                      </div>}
                      <div style={{ fontSize: 9, color: GM }}>{abiertaAhora ? '▾' : '▸'}</div>
                    </div>
                  </div>

                  {abiertaAhora && (
                    <div style={{ marginTop: 8, borderTop: `1px solid ${GL}`, paddingTop: 8 }}>
                      {ses.eva && (
                        <div style={{ background: '#FFFBEB', border: `1px solid ${AM}`, borderRadius: 6, padding: '6px 8px', marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E' }}>Rango de EVA de esta fase</div>
                          <div style={{ fontSize: 10, color: GD, marginTop: 2 }}>{ses.eva.regla}</div>
                        </div>
                      )}
                      {ses.domiciliario && (
                        <div style={{ fontSize: 10, color: GD, marginBottom: 7 }}>
                          🏠 <b>Programa domiciliario:</b> {ses.domiciliario}
                        </div>
                      )}
                      {ses.objetivo && <div style={{ fontSize: 10, color: GM, marginBottom: 7, fontStyle: 'italic' }}>{ses.objetivo}</div>}

                      {ses.ejercicios.map(e => (
                        <div key={e.id} style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 4, opacity: e.activo ? 1 : 0.4 }}>
                          <input type="checkbox" checked={e.activo} onChange={() => toggleEj(ses.n, e.id)}/>
                          <span style={{ fontSize: 10, flex: 1, minWidth: 0 }}>
                            {e.nombre}
                            <span style={{ color: GM, fontSize: 9 }}> · {e.tipo}</span>
                          </span>
                          {e.tipo === 'modalidad' ? (
                            <input value={e.tiempo || ''} onChange={ev => editarEj(ses.n, e.id, 'tiempo', ev.target.value)}
                              placeholder="duración" style={{ width: 70, padding: '2px 4px', border: `1px solid ${GL}`, borderRadius: 4, fontSize: 10 }}/>
                          ) : (
                            <>
                              <input value={e.series || ''} onChange={ev => editarEj(ses.n, e.id, 'series', ev.target.value)}
                                placeholder="ser" style={{ width: 34, padding: '2px 4px', border: `1px solid ${GL}`, borderRadius: 4, fontSize: 10, textAlign: 'center' }}/>
                              <span style={{ fontSize: 9, color: GM }}>×</span>
                              <input value={e.reps || e.tiempo || ''}
                                onChange={ev => editarEj(ses.n, e.id, e.reps ? 'reps' : 'tiempo', ev.target.value)}
                                placeholder="reps/tiempo" style={{ width: 72, padding: '2px 4px', border: `1px solid ${GL}`, borderRadius: 4, fontSize: 10, textAlign: 'center' }}/>
                            </>
                          )}
                        </div>
                      ))}
                      {ses.ejercicios.some(e => e.carga) && (
                        <div style={{ fontSize: 9, color: GM, marginTop: 5 }}>
                          Carga / intención: {ses.ejercicios.find(e => e.carga)?.carga}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

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


// ═══════════════════════════════════════════════════════════════════════════
// GENERADOR POR HORIZONTE TEMPORAL
// ═══════════════════════════════════════════════════════════════════════════
function GeneradorHorizonte({ paciente, evaluaciones, regionesList, onGenerado, fs }) {
  const [abierto, setAbierto] = useState(false);
  const [horizonte, setHorizonte] = useState(null);   // null = el que sugiere el tejido
  const [semanas, setSemanas] = useState(null);
  const [regionesSel, setRegionesSel] = useState(null);
  const [res, setRes] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const regionesDisp = useMemo(() => {
    const set = new Set();
    (evaluaciones || []).forEach(e => {
      const rs = (e.regiones && e.regiones.length) ? e.regiones : [e.region];
      rs.forEach(r => r && set.add(r));
    });
    return [...set];
  }, [evaluaciones]);

  const lbl = (rk) => regionesList.find(x => x.k === rk)?.label || rk;

  const generar = () => {
    try {
      setRes(generarPlanClinico({
        paciente, evaluaciones,
        regionesSel: regionesSel && regionesSel.length ? regionesSel : null,
        horizonteElegido: horizonte, semanasElegidas: semanas,
        sesionesContratadas: Number(paciente?.sesionesContratadas || paciente?.sesiones_contratadas || 0) || 0,
        protSesion: PROT_SESION, custom: [],
      }));
    } catch (e) { alert('No se pudo generar: ' + e.message); }
  };

  if (!abierto) {
    return (
      <div style={{ background: '#EFF6FF', border: `1px solid #93C5FD`, borderRadius: 9, padding: '13px 15px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: NV, marginBottom: 4 }}>⚡ Generar plan desde las evaluaciones</div>
        <div style={{ fontSize: 11, color: GD, lineHeight: 1.55, marginBottom: 10 }}>
          Corto (≤4 sem), medio (4-12) o largo plazo (&gt;12), con fases, criterios de salida
          y ejercicios prescritos por fase. El plazo se propone según el tejido evaluado.
        </div>
        <button onClick={() => { setAbierto(true); }} style={{ ...fs.btnTL, fontSize: 12 }}>Armar plan por horizonte</button>
      </div>
    );
  }

  return (
    <div style={{ background: WH, border: `1px solid ${GL}`, borderRadius: 9, padding: 13, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>⚡ Plan por horizonte temporal</span>
        <button onClick={() => { setAbierto(false); setRes(null); }} style={{ background: 'none', border: 'none', color: GM, fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Regiones */}
      {regionesDisp.length > 1 && (
        <div style={{ marginBottom: 10 }}>
          <span style={fs.lbl}>Regiones a incluir (por defecto, todas las evaluadas)</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {regionesDisp.map(rk => {
              const act = !regionesSel || regionesSel.includes(rk);
              return (
                <button key={rk} onClick={() => {
                    const base = regionesSel || regionesDisp;
                    const n = base.includes(rk) ? base.filter(x => x !== rk) : [...base, rk];
                    setRegionesSel(n.length ? n : null); setRes(null);
                  }}
                  style={{ background: act ? NV : WH, color: act ? WH : GD, border: `1px solid ${NV}`, borderRadius: 99, padding: '4px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {lbl(rk)}{act ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Horizonte */}
      <span style={fs.lbl}>Horizonte</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginTop: 4, marginBottom: 10 }}>
        <button onClick={() => { setHorizonte(null); setSemanas(null); setRes(null); }}
          style={{ gridColumn: '1/-1', background: horizonte === null ? TL : WH, color: horizonte === null ? WH : GD, border: `1px solid ${TL}`, borderRadius: 7, padding: '9px', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
          🧬 El que corresponda al tejido (recomendado)
        </button>
        {Object.values(HORIZONTES).map(h => (
          <button key={h.k} onClick={() => { setHorizonte(h.k); setSemanas(null); setRes(null); }}
            style={{ background: horizonte === h.k ? h.color : WH, color: horizonte === h.k ? WH : GD, border: `1px solid ${h.color}`, borderRadius: 7, padding: '8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            {h.label}<span style={{ display: 'block', fontSize: 9, opacity: .8, fontWeight: 400 }}>{h.rango}</span>
          </button>
        ))}
      </div>

      {horizonte && (
        <div style={{ marginBottom: 10 }}>
          <span style={fs.lbl}>Semanas (dentro de {HORIZONTES[horizonte].rango})</span>
          <input type="number" min={HORIZONTES[horizonte].semanasMin} max={HORIZONTES[horizonte].semanasMax}
            value={semanas ?? ''} placeholder="auto"
            onChange={e => { setSemanas(e.target.value ? +e.target.value : null); setRes(null); }}
            style={{ ...fs.inp, width: 90 }} />
        </div>
      )}

      <button onClick={generar} style={{ ...fs.btnTL, fontSize: 12, width: '100%' }}>Generar</button>

      {res && <ResultadoGenerado res={res} lbl={lbl} guardando={guardando}
        onAplicar={async () => {
          const d = res.diagnostico;
          const msg = d.listoParaAplicar
            ? `¿Guardar "${res.plan.nombre}"?`
            : `⚠ Este plan tiene ${d.bloqueantes.length} punto(s) que contradicen el plazo biológico o el presupuesto:\n\n${d.bloqueantes.join('\n\n')}\n\n¿Guardarlo igual?`;
          if (!confirm(msg)) return;
          setGuardando(true);
          try { await onGenerado(res.plan); setRes(null); setAbierto(false); }
          catch (e) { alert('No se pudo guardar: ' + e.message); }
          finally { setGuardando(false); }
        }} fs={fs} />}
    </div>
  );
}

function ResultadoGenerado({ res, lbl, onAplicar, guardando, fs }) {
  const d = res.diagnostico, p = res.plan;
  const H = HORIZONTES[p.horizonte];
  return (
    <div style={{ marginTop: 12, background: BG, borderRadius: 8, padding: 11 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: H.color }}>{p.nombre}</div>
      <div style={{ fontSize: 10, color: GD, marginTop: 2, marginBottom: 8 }}>
        {p.semanas} semanas · {p.regiones.length} región(es) · ~{d.sesionesEstimadas} sesiones estimadas
        ({d.sesionesPorSemana}/semana)
      </div>

      {d.bloqueantes.map((b, i) => (
        <div key={i} style={{ background: '#FEF2F2', border: `1px solid ${RJ}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, fontSize: 10, color: '#991B1B', lineHeight: 1.5 }}>⛔ {b}</div>
      ))}
      {d.avisos.slice(0, 4).map((a, i) => (
        <div key={i} style={{ fontSize: 10, color: '#92400E', marginBottom: 4, lineHeight: 1.5 }}>🧬 {a}</div>
      ))}

      {/* Timeline por región */}
      {(p.fases_detalle || []).map(reg => (
        <div key={reg.region} style={{ marginTop: 10, background: WH, borderRadius: 7, padding: '9px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 2 }}>{lbl(reg.region)}</div>
          <div style={{ fontSize: 9, color: GM, marginBottom: 7 }}>
            {reg.tejido || 'sin tejido definido'} · EVA {reg.eva ?? '—'} · arranca en {reg.faseInicial}
          </div>
          {reg.fases.map(f => (
            <div key={f.fase} style={{ borderLeft: `3px solid ${f.color}`, paddingLeft: 9, marginBottom: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: f.color }}>
                {f.emoji} {f.label} <span style={{ color: GM, fontWeight: 400 }}>· semanas {f.semanaDesde}–{f.semanaHasta} ({f.semanas})</span>
              </div>
              <div style={{ fontSize: 10, color: GD, marginTop: 2, lineHeight: 1.45 }}>{f.objetivo}</div>
              <div style={{ fontSize: 9, color: NV, marginTop: 3, background: '#EFF6FF', borderRadius: 5, padding: '5px 7px', lineHeight: 1.5 }}>
                <strong>Dosis:</strong> {f.dosis.series} × {f.dosis.reps} · {f.dosis.carga} · {f.dosis.frecuencia} · descanso {f.dosis.descanso}
                <br /><em>{f.dosis.intencion}</em>
              </div>
              {f.ejercicios.length > 0 && (
                <div style={{ fontSize: 10, color: GD, marginTop: 4 }}>
                  <strong>{f.ejercicios.length} ejercicios:</strong> {f.ejercicios.slice(0, 4).map(e => e.nombre).join(' · ')}
                  {f.ejercicios.length > 4 && ` … +${f.ejercicios.length - 4}`}
                </div>
              )}
              {f.criterios.length > 0 && (
                <div style={{ fontSize: 9, color: GM, marginTop: 4 }}>
                  <strong>Para pasar de fase:</strong> {f.criterios.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <button onClick={onAplicar} disabled={guardando}
        style={{ width: '100%', marginTop: 11, background: d.listoParaAplicar ? TL : AM, color: WH, border: 'none', borderRadius: 7, padding: '11px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        {guardando ? 'Guardando…' : d.listoParaAplicar ? 'Guardar plan' : 'Guardar igual y ajustar'}
      </button>
    </div>
  );
}
