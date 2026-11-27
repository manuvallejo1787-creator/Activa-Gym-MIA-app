// AIActiva.jsx — Asistente IA integrado en ACTIVA Fitness Club + FisioActiva
// Usa la API de Anthropic directamente desde el navegador
// Contexto: Manu Vallejo, entrenador y fisioterapeuta, Colonia del Sacramento, Uruguay

import { useState } from "react";
import { PERIODIZACIONES, periodizacionesPorFase } from "./planificacion.js";
import { armarPromptSesion } from "./promptSesion.js";

// ─── IDENTIDAD DEL ASISTENTE ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos el asistente de IA integrado en el sistema de gestión de ACTIVA Fitness Club y FisioActiva Colonia, el primer centro de rehabilitación y entrenamiento integrado de Colonia del Sacramento, Uruguay. 

Fundador: Manu Vallejo — entrenador personal y fisioterapeuta. Metodología propia: Método Activa Integra con 4 fases (RESTAURA → ACTIVA → POTENCIA → RINDE).

Tu rol: generar contenido clínico y de entrenamiento basado en evidencia científica, personalizado para cada cliente, alineado con la metodología del centro. Siempre respondés en español, con tono profesional y directo.

IMPORTANTE: Siempre respondés ÚNICAMENTE con JSON válido, sin texto adicional, sin marcadores markdown, sin explicaciones fuera del JSON.`;

// ─── CONTEXTO DE APRENDIZAJE (reglas del profesional + historial) ────────────
// Inyecta las reglas activas del ámbito dado (+ 'general') que el profesional
// definió en "Entrenar IA", para que la IA aplique su criterio.
export const ctxReglas = (reglas, ambito) => {
  const act = (reglas||[]).filter(r => r.activo && [ambito,'general'].includes(r.ambito));
  if (!act.length) return "";
  return `\nREGLAS DEL PROFESIONAL (obligatorias, prioridad sobre criterios genéricos):\n${act.map(r => `- ${r.regla}`).join("\n")}\n`;
};
// Inyecta un historial resumido (planes/sesiones/evaluaciones previas) para progresar.
export const ctxHistorial = (items, label) => {
  const list = (items||[]).slice(0, 4);
  if (!list.length) return "";
  return `\n${label} (para dar continuidad y progresar, NO repetir igual):\n${list.map(t => `- ${t}`).join("\n")}\n`;
};

// ─── LLAMADA A LA API (vía función serverless segura de Vercel) ──────────────
async function callClaude(userPrompt, maxTokens = 2000) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      max_tokens: maxTokens,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }
  const text = data.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("La IA devolvió una respuesta incompleta o cortada. Probá regenerar (o reducí la cantidad de días si el plan es muy largo).");
  }
}

// ─── Lo que necesita el razonador clínico ─────────────────────────────────────
// Los prompts, la forma de los criterios y la validación contra la biblioteca
// viven afuera para que se puedan probar sin montar React: los arneses
// qa/fisioCriterios.mjs y qa/fisioRazonamiento.mjs los ejercitan directo.
import { promptAnalisisClinico, promptPlanRehab, validarPlanContraBiblioteca,
         nombreDeEjercicio } from "./fisioRazonamiento.js";
import { criterioVacio, evaluarFase, EJES, METRICAS } from "./fisioCriterios.js";
import { informeRehabHTML } from "./pdfRehab.js";

// ─── COLORES / ESTILOS ────────────────────────────────────────────────────────
const AI = "#6D28D9";  // violeta IA
const AI_LIGHT = "#F5F3FF";
const AI_BORDER = "#C4B5FD";
const G1 = "#F4F4F4", G2 = "#E0E0E0", G3 = "#999", G4 = "#555";
const WH = "#FFFFFF", GN = "#16A34A", R = "#CC0000", AM = "#D97706";

const as = {
  btn: (color=AI) => ({ background:color, color:WH, border:"none", borderRadius:6, padding:"7px 14px", fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }),
  btnOutline: { background:WH, color:AI, border:`1px solid ${AI_BORDER}`, borderRadius:6, padding:"6px 12px", fontSize:11, cursor:"pointer" },
  card: { background:AI_LIGHT, border:`1px solid ${AI_BORDER}`, borderRadius:8, padding:"12px 14px" },
  inp: { width:"100%", border:`1px solid ${G2}`, borderRadius:5, padding:"5px 8px", fontSize:11, background:WH, outline:"none" },
  lbl: { display:"block", fontSize:9, color:G3, textTransform:"uppercase", letterSpacing:".04em", marginBottom:3, fontWeight:700 },
};

// ─── SPINNER ─────────────────────────────────────────────────────────────────
const Spinner = ({ msg = "Generando..." }) => (
  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px", background:AI_LIGHT, borderRadius:7, border:`1px solid ${AI_BORDER}` }}>
    <div style={{ width:20, height:20, border:`3px solid ${AI_BORDER}`, borderTopColor:AI, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }}/>
    <div>
      <div style={{ fontSize:12, fontWeight:700, color:AI }}>🤖 IA generando...</div>
      <div style={{ fontSize:10, color:G3 }}>{msg}</div>
    </div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ─── MÓDULO 1: GENERADOR DE SESIONES DE ENTRENAMIENTO ───────────────────────
export function AIGeneradorSesion({ cliente, periodizacion, faseIndex=0, tests, exs, historial = [], reglas = [], ejecucion = [], clinico = [], onApply }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [show, setShow]       = useState(false);

  const generar = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      // El pedido se arma en src/promptSesion.js. Estaba inline acá y la
      // unica forma de verificar que la instruccion del profesional llegaba
      // —y con que peso— era generar una sesion de verdad y mirarla a ojo.
      // Eso no es una prueba: ahora lo cubre qa/promptSesion.mjs.
      const prompt = armarPromptSesion({ cliente, periodizacion, faseIndex,
        tests, exs, historial, reglas, ejecucion, instrucciones });

      const data = await callClaude(prompt, 2500);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return (
    <button onClick={()=>setShow(true)} style={{...as.btn(),marginBottom:8,width:'100%',justifyContent:'center',background:AI}}>
      🤖 Generar sesión con IA
    </button>
  );

  return (
    <div style={{...as.card,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:800,color:AI}}>🤖 Asistente IA — Constructor de sesión</div>
        <button onClick={()=>{setShow(false);setResult(null);setError(null);}} style={as.btnOutline}>✕</button>
      </div>
      <div style={{fontSize:11,color:G4,marginBottom:8}}>
        La IA recibe el perfil completo del cliente: nivel, objetivo, restricciones, fase de periodización y tests de fuerza. Genera la sesión y vos la revisás antes de aplicar.
      </div>
      <div style={{marginBottom:8}}>
        <span style={as.lbl}>Tu instrucción para esta sesión (opcional)</span>
        {/* Era un <input> de una línea. No se puede escribir una indicación
            de verdad en un renglón, y el campo comunicaba lo contrario de lo
            que vale: desde el 04/11 esta instrucción tiene MÁXIMA PRIORIDAD
            en el pedido y puede sacar o agregar bloques. */}
        <textarea value={instrucciones} onChange={e=>setInstrucciones(e.target.value)}
          rows={3}
          placeholder={'Ej: "sin cardio, solo fuerza"  ·  "agregale pliometría"  ·  "más unilateral, priorizá glúteo"  ·  "incluí hip thrust"'}
          style={{...as.inp, minHeight:58, resize:'vertical', fontFamily:'inherit', lineHeight:1.45}}/>
        <div style={{fontSize:9.5,color:G3,marginTop:4,lineHeight:1.45}}>
          Manda sobre todo lo demás: puede sacar o agregar bloques, cambiar el énfasis y
          pedir ejercicios puntuales. Lo único que no puede es usar un ejercicio que no
          esté cargado en la base — si pedís uno que no existe, elige el más parecido y lo
          aclara en el razonamiento.
        </div>
      </div>
      {!loading&&!result&&(
        <button onClick={generar} style={{...as.btn(),width:'100%',justifyContent:'center'}}>
          ✨ Generar sesión para {cliente?.nombre}
        </button>
      )}
      {loading&&<Spinner msg="Analizando perfil y generando sesión personalizada..."/>}
      {error&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,color:'#DC2626'}}><strong>Error:</strong> {error}<br/><button onClick={generar} style={{...as.btn(R),marginTop:5,fontSize:10}}>Reintentar</button></div>}
      {result&&(
        <div>
          <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'10px 12px',marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:AI,marginBottom:4}}>{result.nombre}</div>
            <div style={{fontSize:11,color:G4,marginBottom:6}}>{result.objetivo_sesion}</div>
            {result.blocks?.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:6,alignItems:'flex-start',padding:'5px 8px',background:i%2===0?G1:WH,borderRadius:5,marginBottom:3,fontSize:10}}>
                <span style={{fontWeight:700,color:AI,minWidth:20}}>{i+1}.</span>
                <div>
                  <span style={{fontWeight:700,textTransform:'uppercase',fontSize:9,color:G3}}>{b.type}</span>
                  <span style={{marginLeft:6,color:G4}}>{b.params?.reps} reps · {b.params?.series} series · {b.params?.descanso}</span>
                  <div style={{marginTop:2,color:G4}}>
                    {b.exercises?.map((e,j)=>{
                      const ex=exs.find(x=>x.id===e.exId);
                      return <span key={j} style={{marginRight:6}}>{ex?ex.nombre:e.exId}{e.pesoSug?` (${e.pesoSug})`:''}</span>;
                    })}
                  </div>
                </div>
              </div>
            ))}
            {result.razonamiento&&<div style={{marginTop:8,background:'#F5F3FF',borderRadius:5,padding:'6px 8px',fontSize:10,color:G4,borderLeft:`3px solid ${AI}`}}><strong>💡 Razonamiento IA:</strong> {result.razonamiento}</div>}
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{onApply(result);setResult(null);setShow(false);}} style={{...as.btn(GN),flex:2}}>✅ Aplicar esta sesión</button>
            <button onClick={generar} style={{...as.btnOutline,flex:1}}>🔄 Regenerar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO 2: GENERADOR DE PROTOCOLO CLÍNICO ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 2: EL RAZONADOR CLÍNICO — DOS PASOS
// ═══════════════════════════════════════════════════════════════════════════
// REEMPLAZA a AIGeneradorProtocolo, que pedía "5-8 ejercicios para la fase X
// en región Y" con tres campos de la evaluación y la fase de NEGOCIO. Devolvía
// una lista de ejercicios inventados y tres frases de criterio. Manu el
// 27/11/2026: "la IA no genera planes ni sesiones claras en función de la
// lesión cargada, los criterios no están bien establecidos y el PDF no brinda
// información suficiente". El PDF era pobre porque no había nada que imprimir.
//
// PASO 1 — Análisis: interpretación, hipótesis rankeadas con su fundamento,
//          qué no dejar pasar, Fase 0 si las señales la justifican, criterios
//          de avance con umbral, y qué falta medir.
// PASO 2 — Programa: fases y sesiones sobre el análisis YA VALIDADO por el
//          clínico, prescribiendo SOLO de la biblioteca de rehab.
//
// Los dos pasos están separados porque la hipótesis todavía no está cerrada
// cuando se arranca: si la IA genera 12 semanas de una pasada sobre una
// hipótesis equivocada, son 12 semanas de plan equivocado. Decisión de Manu.
export function AIRazonadorClinico({
  paciente, regiones = [], evaluacion, resumenDeterminista = '',
  sesionesDisponibles = null, reglas = [], historial = [], onAplicar,
  marca = {}, evaluador = '',
}) {
  const [show, setShow]       = useState(false);
  const [paso, setPaso]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [criterios, setCriterios] = useState([]);
  const [programa, setPrograma]   = useState(null);
  const [chequeo, setChequeo]     = useState(null);
  const [frecuencia, setFrecuencia] = useState(2);

  const regs = regiones.length ? regiones : (evaluacion?.region ? [evaluacion.region] : []);

  // ─── PASO 1 ──────────────────────────────────────────────────────────────
  const analizar = async () => {
    setLoading(true); setError(null);
    try {
      const data = await callClaude(promptAnalisisClinico({
        resumenDeterminista, regiones: regs,
        testsEsp: evaluacion?.testsEsp || {},
        faseRehabActual: evaluacion?.faseRehab || '',
        historial, ctxReglasTexto: ctxReglas(reglas, 'rehab'),
      }), 4000);
      setAnalisis(data);
      // Los criterios se vuelven editables al toque: la IA elige los ejes y
      // Manu agrega, cambia o borra. Es lo que pidió explícitamente.
      setCriterios((data.criterios_propuestos || []).map(c => criterioVacio({ ...c, origen: 'ia' })));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ─── PASO 2 ──────────────────────────────────────────────────────────────
  const construir = async () => {
    setLoading(true); setError(null);
    try {
      const data = await callClaude(promptPlanRehab({
        analisis: { ...analisis, criterios_propuestos: criterios },
        resumenDeterminista, regiones: regs, sesionesDisponibles, frecuencia,
        ocupacion: evaluacion?.ocupacion || '', deporte: evaluacion?.deporte || '',
        objetivoPaciente: evaluacion?.objetivo || '',
        ctxReglasTexto: ctxReglas(reglas, 'rehab'),
      }), 8000);
      // Se verifica que cada ejercicio exista ANTES de mostrar el programa: un
      // id inventado es un fisio mirando una línea vacía con el paciente
      // adelante.
      setChequeo(validarPlanContraBiblioteca(data, regs));
      setPrograma(data); setPaso(2);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // El criterio se evalúa EN VIVO contra la evaluación guardada, así Manu ve
  // al escribirlo si es exigible o si le falta el dato. Eso es lo que enseña
  // cuál criterio sirve: "falta medir la fuerza del supraespinoso" le dice qué
  // ir a medir, en lugar de dejarlo con una frase linda que nadie puede usar.
  const ctxCrit = { ev: evaluacion || {}, region: regs[0] || '', sesiones: [], confirmaciones: {} };
  const veredicto = evaluarFase(criterios, ctxCrit);

  const setCr = (id, k, v) => setCriterios(cs => cs.map(c => c.id === id ? { ...c, [k]: v, origen: 'manu' } : c));
  const delCr = (id) => setCriterios(cs => cs.filter(c => c.id !== id));
  const addCr = () => setCriterios(cs => [...cs, criterioVacio({ origen: 'manu', que: '', porque: '' })]);

  const COLOR_PROB = { alta:R, 'moderada-alta':AM, moderada:'#CA8A04', baja:G3 };
  const COLOR_EST  = { cumplido:GN, no_cumplido:R, pendiente:G3 };
  const ICONO_EST  = { cumplido:'✓', no_cumplido:'✗', pendiente:'○' };

  if (!show) return (
    <button onClick={()=>setShow(true)} style={{...as.btn(),marginBottom:8,width:'100%',justifyContent:'center'}}>
      🩺 Razonar el caso y armar el programa de rehabilitación
    </button>
  );

  return (
    <div style={{...as.card,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <div style={{fontSize:13,fontWeight:800,color:AI}}>
          🩺 Razonamiento clínico — paso {paso} de 2: {paso===1?'análisis del caso':'programa por fases'}
        </div>
        <button onClick={()=>{setShow(false);setAnalisis(null);setPrograma(null);setError(null);setPaso(1);}} style={as.btnOutline}>✕</button>
      </div>
      <div style={{fontSize:10,color:G4,marginBottom:10}}>
        {paso===1
          ? `Lee la evaluación completa de ${regs.length} región(es) con sus pruebas, su sensibilidad y su especificidad. Primero razona el caso; el programa se arma después, cuando vos valides el análisis.`
          : `Construido sobre el análisis que validaste, prescribiendo solo de la biblioteca de rehabilitación.`}
      </div>

      {!resumenDeterminista && (
        <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:6,padding:'8px 10px',fontSize:11,marginBottom:8}}>
          ⚠ No hay una evaluación cargada para este paciente. Sin evaluación la IA no tiene de dónde razonar: cargá una primero.
        </div>
      )}

      {error && (
        <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,color:R,marginBottom:8}}>
          <strong>Error:</strong> {error}
          <br/><button onClick={paso===1?analizar:construir} style={{...as.btn(R),marginTop:5,fontSize:10}}>Reintentar</button>
        </div>
      )}

      {loading && <Spinner msg={paso===1?'Interpretando hallazgos y rankeando hipótesis...':'Armando fases, sesiones y criterios...'}/>}

      {/* ─── PASO 1: EL ANÁLISIS ─────────────────────────────────────────── */}
      {!loading && paso===1 && !analisis && resumenDeterminista && (
        <button onClick={analizar} style={{...as.btn(),width:'100%',justifyContent:'center'}}>
          ✨ Analizar el caso — {regs.length} región(es)
        </button>
      )}

      {!loading && paso===1 && analisis && (
        <div>
          {/* Lo que no se puede dejar pasar va PRIMERO: si hay que derivar, eso
              manda sobre cualquier programa de ejercicios. */}
          {(analisis.no_dejar_pasar||[]).length>0 && (
            <div style={{background:'#FEF2F2',border:`2px solid ${R}`,borderRadius:7,padding:'10px 12px',marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:800,color:R,marginBottom:6}}>⚠ NO DEJAR PASAR — antes de tratar</div>
              {analisis.no_dejar_pasar.map((x,i)=>(
                <div key={i} style={{marginBottom:6,fontSize:11}}>
                  <div style={{fontWeight:700}}>{x.que}</div>
                  <div style={{color:G4,fontSize:10}}>{x.por_que}</div>
                  <div style={{color:R,fontSize:10,fontWeight:700}}>→ Derivar si: {x.derivar_si}</div>
                </div>
              ))}
            </div>
          )}

          {analisis.lectura_global && (
            <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'10px 12px',marginBottom:10}}>
              <div style={{fontSize:9,color:G3,textTransform:'uppercase',letterSpacing:'.04em',fontWeight:700,marginBottom:4}}>Lectura global del caso</div>
              <div style={{fontSize:11,lineHeight:1.6}}>{analisis.lectura_global}</div>
            </div>
          )}

          {(analisis.interpretacion||[]).map((s,i)=>(
            <div key={i} style={{background:WH,borderRadius:6,padding:'8px 10px',marginBottom:6,borderLeft:`3px solid ${AI}`}}>
              <div style={{fontSize:11,fontWeight:800,marginBottom:3}}>{s.sistema}</div>
              {(s.hallazgos||[]).map((h,j)=><div key={j} style={{fontSize:10,color:G4}}>· {h}</div>)}
              {s.lectura && <div style={{fontSize:10,marginTop:4,fontStyle:'italic',color:'#1D4ED8',lineHeight:1.5}}>{s.lectura}</div>}
            </div>
          ))}

          {(analisis.hipotesis||[]).length>0 && (
            <div style={{marginTop:10,marginBottom:10}}>
              <div style={{fontSize:9,color:G3,textTransform:'uppercase',letterSpacing:'.04em',fontWeight:700,marginBottom:5}}>Hipótesis de trabajo, en orden</div>
              {analisis.hipotesis.map((h,i)=>(
                <div key={i} style={{background:WH,borderRadius:6,padding:'9px 11px',marginBottom:6,border:`1px solid ${G2}`}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                    <span style={{background:COLOR_PROB[h.probabilidad]||G3,color:WH,fontSize:8,fontWeight:800,padding:'2px 7px',borderRadius:99,textTransform:'uppercase'}}>{h.probabilidad}</span>
                    <span style={{fontSize:11,fontWeight:800}}>{h.n}. {h.titulo}</span>
                  </div>
                  {h.fundamento && <div style={{fontSize:10,color:G4,marginBottom:4,lineHeight:1.5}}>{h.fundamento}</div>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:9}}>
                    <div>
                      <div style={{color:GN,fontWeight:700,marginBottom:2}}>A favor</div>
                      {(h.a_favor||[]).map((x,j)=><div key={j} style={{color:G4}}>+ {x}</div>)}
                    </div>
                    <div>
                      <div style={{color:AM,fontWeight:700,marginBottom:2}}>En contra / falta</div>
                      {(h.en_contra||[]).map((x,j)=><div key={j} style={{color:G4}}>− {x}</div>)}
                    </div>
                  </div>
                  {(h.como_confirmar||[]).length>0 && (
                    <div style={{marginTop:5,fontSize:9,background:'#EFF6FF',borderRadius:4,padding:'4px 7px'}}>
                      <strong style={{color:'#1D4ED8'}}>Para confirmarla:</strong> {h.como_confirmar.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {analisis.fase0?.necesaria && (
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'10px 12px',marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:800,color:'#1D4ED8',marginBottom:3}}>
                🔍 Fase 0 — confirmación clínica ({analisis.fase0.sesiones} sesión{analisis.fase0.sesiones>1?'es':''})
              </div>
              <div style={{fontSize:10,color:G4,marginBottom:5}}>{analisis.fase0.por_que}</div>
              {(analisis.fase0.bateria||[]).map((b,i)=>(
                <div key={i} style={{fontSize:10,marginBottom:2}}>
                  <strong>{b.area}:</strong> {(b.pruebas||[]).join(', ')}
                </div>
              ))}
              {analisis.fase0.que_decide && <div style={{fontSize:10,marginTop:5,fontStyle:'italic',color:'#1D4ED8'}}>Qué decide: {analisis.fase0.que_decide}</div>}
            </div>
          )}

          {/* ─── CRITERIOS EDITABLES, EVALUADOS EN VIVO ─────────────────────
              Acá está el arreglo del reclamo "los criterios no los contempla la
              programación": cada criterio es un dato con umbral, y el estado
              que se ve al costado lo calcula el sistema contra la evaluación
              guardada. Si dice "falta medir", eso es lo que hay que ir a medir. */}
          <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'10px 12px',marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:800,color:AI}}>Criterios para pasar de fase ({criterios.length})</div>
              <button onClick={addCr} style={{...as.btnOutline,fontSize:10}}>+ Agregar criterio</button>
            </div>
            <div style={{fontSize:9,color:G3,marginBottom:8}}>
              Los eligió la IA para este caso. Cambialos, agregá o borrá los que quieras: el estado de la derecha lo calcula el sistema contra la evaluación cargada.
            </div>
            {veredicto.criterios.map((ev,i)=>{
              const cr = criterios[i]; if(!cr) return null;
              return (
                <div key={cr.id} style={{background:G1,borderRadius:6,padding:'7px 9px',marginBottom:5}}>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                    <select value={cr.eje} onChange={e=>setCr(cr.id,'eje',e.target.value)} style={{...as.inp,width:120,fontSize:10}}>
                      {Object.entries(EJES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                    <input value={cr.que} onChange={e=>setCr(cr.id,'que',e.target.value)} placeholder="qué se mide, en palabras" style={{...as.inp,flex:1,fontSize:10}}/>
                    <span style={{color:COLOR_EST[ev.estado],fontWeight:800,fontSize:11,whiteSpace:'nowrap'}}>
                      {ICONO_EST[ev.estado]} {ev.valor||'—'}
                    </span>
                    <button onClick={()=>delCr(cr.id)} style={{background:'none',border:'none',color:R,cursor:'pointer',fontSize:13}} title="Borrar este criterio">✕</button>
                  </div>
                  <div style={{display:'flex',gap:5,alignItems:'center'}}>
                    <select value={cr.metrica} onChange={e=>setCr(cr.id,'metrica',e.target.value)} style={{...as.inp,width:155,fontSize:9}}>
                      {Object.entries(METRICAS).map(([k,m])=><option key={k} value={k}>{m.label}{m.auto?'':' (a mano)'}</option>)}
                    </select>
                    <input value={cr.ref||''} onChange={e=>setCr(cr.id,'ref',e.target.value)} placeholder="qué (mov./músculo/escala)" style={{...as.inp,flex:1,fontSize:9}}/>
                    <select value={cr.operador} onChange={e=>setCr(cr.id,'operador',e.target.value)} style={{...as.inp,width:62,fontSize:9}}>
                      {['>=','<=','==','negativo'].map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                    <input type="number" value={cr.umbral??''} onChange={e=>setCr(cr.id,'umbral',e.target.value)} placeholder="umbral" style={{...as.inp,width:70,fontSize:9}}/>
                    <select value={cr.lado||''} onChange={e=>setCr(cr.id,'lado',e.target.value||null)} style={{...as.inp,width:88,fontSize:9}}>
                      <option value="">sin lado</option><option value="derecho">derecho</option>
                      <option value="izquierdo">izquierdo</option><option value="bilateral">bilateral</option>
                    </select>
                    <label style={{fontSize:9,color:G4,display:'flex',alignItems:'center',gap:3,whiteSpace:'nowrap'}}>
                      <input type="checkbox" checked={cr.obligatorio!==false} onChange={e=>setCr(cr.id,'obligatorio',e.target.checked)}/>oblig.
                    </label>
                  </div>
                  <div style={{fontSize:9,color:ev.estado==='pendiente'?AM:G3,marginTop:3}}>
                    {ev.detalle}{cr.porque?` · ${cr.porque}`:''}
                    {cr.origen==='manu'&&<span style={{marginLeft:5,color:AI,fontWeight:700}}>editado por vos</span>}
                  </div>
                </div>
              );
            })}
            <div style={{marginTop:7,padding:'6px 9px',borderRadius:5,fontSize:10,fontWeight:700,
              background:veredicto.veredicto==='avanza'?'#DCFCE7':veredicto.veredicto==='no_avanza'?'#FEF2F2':'#FEF3C7',
              color:veredicto.veredicto==='avanza'?GN:veredicto.veredicto==='no_avanza'?R:AM}}>
              Hoy: {veredicto.motivo}
            </div>
          </div>

          {(analisis.faltantes_evaluacion||[]).length>0 && (
            <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:7,padding:'9px 11px',marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:800,color:AM,marginBottom:4}}>📋 Falta en la evaluación</div>
              {analisis.faltantes_evaluacion.map((f,i)=>(
                <div key={i} style={{fontSize:10,marginBottom:3}}>
                  <strong>{f.que}</strong> <span style={{color:G4}}>— {f.por_que}</span>
                </div>
              ))}
            </div>
          )}

          {analisis.advertencia && (
            <div style={{fontSize:9,color:G4,fontStyle:'italic',marginBottom:10,padding:'6px 9px',background:G1,borderRadius:5}}>
              {analisis.advertencia}
            </div>
          )}

          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            <label style={{fontSize:10,color:G4,whiteSpace:'nowrap'}}>Frecuencia:</label>
            <select value={frecuencia} onChange={e=>setFrecuencia(parseInt(e.target.value))} style={{...as.inp,width:110,fontSize:10}}>
              {[1,2,3].map(n=><option key={n} value={n}>{n}/semana</option>)}
            </select>
            <button onClick={analizar} style={{...as.btnOutline,fontSize:10}}>↻ Reanalizar</button>
            <button onClick={construir} style={{...as.btn(),flex:1,justifyContent:'center'}}>
              ✓ Validar el análisis y construir el programa →
            </button>
          </div>
        </div>
      )}

      {/* ─── PASO 2: EL PROGRAMA ─────────────────────────────────────────── */}
      {!loading && paso===2 && programa && (
        <div>
          {chequeo && !chequeo.ok && (
            <div style={{background:'#FEF2F2',border:`2px solid ${R}`,borderRadius:7,padding:'9px 11px',marginBottom:9,fontSize:11,color:R}}>
              <strong>⚠ El programa tiene ejercicios que no existen en la biblioteca.</strong>
              <div style={{fontSize:10,marginTop:3}}>{chequeo.mensaje}</div>
              <button onClick={construir} style={{...as.btn(R),marginTop:5,fontSize:10}}>↻ Regenerar el programa</button>
            </div>
          )}

          <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'10px 12px',marginBottom:9}}>
            <div style={{fontSize:12,fontWeight:800,color:AI}}>{programa.titulo}</div>
            <div style={{fontSize:11,color:G4,marginTop:3,lineHeight:1.5}}>{programa.objetivo_global}</div>
            <div style={{display:'flex',gap:12,fontSize:10,color:G3,marginTop:6}}>
              <span>📅 {programa.semanas_total} semanas</span>
              <span>🔁 {programa.sesiones_total} sesiones</span>
              <span>📚 {chequeo?.total||0} ejercicios{chequeo?.ok?' ✓ verificados':''}</span>
            </div>
          </div>

          {(programa.progresion||[]).length>0 && (
            <div style={{background:G1,borderRadius:6,padding:'8px 10px',marginBottom:9}}>
              <div style={{fontSize:9,color:G3,fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Progresión de carga</div>
              <div style={{fontSize:10,color:G4,lineHeight:1.7}}>{programa.progresion.join('  →  ')}</div>
            </div>
          )}

          {(programa.fases||[]).map((f,i)=>(
            <div key={i} style={{background:WH,borderRadius:7,padding:'9px 11px',marginBottom:7,borderLeft:`4px solid ${AI}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:11,fontWeight:800}}>{f.label}</div>
                <div style={{fontSize:9,color:G3}}>sem {f.semanas} · {f.sesiones} ses · {f.frecuencia}</div>
              </div>
              <div style={{fontSize:10,color:G4,marginTop:2,marginBottom:5}}>{f.objetivo}</div>

              {(f.criterios_para_salir||[]).length>0 && (
                <div style={{background:'#EFF6FF',borderRadius:5,padding:'5px 8px',marginBottom:5,fontSize:9}}>
                  <strong style={{color:'#1D4ED8'}}>Para salir de esta fase:</strong>
                  {f.criterios_para_salir.map((c,j)=>(
                    <div key={j} style={{color:'#1D4ED8'}}>→ {c.que} ({c.operador} {c.umbral})</div>
                  ))}
                </div>
              )}

              {(f.sesiones_detalle||[]).map((s,j)=>(
                <div key={j} style={{background:G1,borderRadius:5,padding:'6px 8px',marginBottom:4}}>
                  <div style={{fontSize:10,fontWeight:700,marginBottom:3}}>Sesión {s.n} — {s.titulo}</div>
                  {(s.bloques||[]).map((b,k)=>(
                    <div key={k} style={{marginBottom:3}}>
                      <div style={{fontSize:9,color:AI,fontWeight:700,textTransform:'uppercase'}}>{b.tipo}</div>
                      {(b.ejercicios||[]).map((e,l)=>(
                        <div key={l} style={{fontSize:9,color:G4}}>
                          · {nombreDeEjercicio(e.id)} — <strong>{e.param}</strong>
                          {e.nota?<span style={{color:'#1D4ED8'}}> · {e.nota}</span>:null}
                        </div>
                      ))}
                    </div>
                  ))}
                  {s.vigilar && <div style={{fontSize:9,color:AM,marginTop:2}}>⚠ Vigilar: {s.vigilar}</div>}
                </div>
              ))}
            </div>
          ))}

          {(programa.faltan_en_biblioteca||[]).length>0 && (
            <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:7,padding:'9px 11px',marginBottom:9}}>
              <div style={{fontSize:10,fontWeight:800,color:AM,marginBottom:4}}>📚 Le faltó en la biblioteca</div>
              <div style={{fontSize:9,color:G4,marginBottom:4}}>No los inventó dentro del programa. Agregalos a la biblioteca y reconstruí si los querés incluir.</div>
              {programa.faltan_en_biblioteca.map((x,i)=>(
                <div key={i} style={{fontSize:10}}>· <strong>{x.nombre}</strong> — {x.para_que} <span style={{color:G3}}>({x.fase})</span></div>
              ))}
            </div>
          )}

          {programa.dosis_fuera_de_sesion && (
            <div style={{background:WH,borderRadius:6,padding:'8px 10px',marginBottom:7,border:`1px solid ${G2}`}}>
              <div style={{fontSize:9,color:G3,fontWeight:700,textTransform:'uppercase',marginBottom:3}}>Fuera de la sesión</div>
              <div style={{fontSize:10,color:G4,lineHeight:1.5}}>{programa.dosis_fuera_de_sesion}</div>
            </div>
          )}

          {(programa.educacion_paciente||[]).length>0 && (
            <div style={{background:WH,borderRadius:6,padding:'8px 10px',marginBottom:7,border:`1px solid ${G2}`}}>
              <div style={{fontSize:9,color:G3,fontWeight:700,textTransform:'uppercase',marginBottom:3}}>Para explicarle al paciente</div>
              {programa.educacion_paciente.map((x,i)=><div key={i} style={{fontSize:10,color:G4}}>· {x}</div>)}
            </div>
          )}

          {programa.razonamiento && (
            <div style={{fontSize:10,color:G4,fontStyle:'italic',padding:'7px 10px',background:G1,borderRadius:5,marginBottom:9,lineHeight:1.5}}>
              {programa.razonamiento}
            </div>
          )}

          <div style={{display:'flex',gap:7}}>
            <button onClick={()=>setPaso(1)} style={{...as.btnOutline,fontSize:10}}>← Volver al análisis</button>
            <button onClick={construir} style={{...as.btnOutline,fontSize:10}}>↻ Reconstruir</button>
            {/* El informe imprime el razonamiento ENTERO: hipótesis, criterios
                con su umbral y cada ejercicio con su procedimiento. El PDF
                viejo salía pobre porque la IA no producía nada más que una
                lista de nombres. */}
            <button onClick={()=>{
              const html=informeRehabHTML({
                paciente, evaluacion, analisis, criterios, programa,
                evaluados:veredicto, marca, evaluador,
              });
              const w=window.open('','_blank');
              if(!w){alert('El navegador bloqueó la ventana del informe. Habilitá las ventanas emergentes para este sitio.');return;}
              w.document.write(html);w.document.close();
            }} style={{...as.btnOutline,fontSize:10}}>🖨 Informe</button>
            <button
              onClick={()=>onAplicar&&onAplicar({analisis,criterios,programa,chequeo})}
              disabled={chequeo&&!chequeo.ok}
              style={{...as.btn(chequeo&&!chequeo.ok?G3:GN),flex:1,justifyContent:'center',
                cursor:chequeo&&!chequeo.ok?'not-allowed':'pointer'}}>
              {chequeo&&!chequeo.ok?'Corregí los ejercicios inventados primero':'💾 Guardar el programa en el plan clínico'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO 3: GENERADOR DE PLAN NUTRICIONAL ─────────────────────────────────
export function AIGeneradorNutricion({ cliente, objetivoNut, todosAlimentos, reglas = [], historial = [], perfil = null, entrenamiento = '', onApply }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [show, setShow]       = useState(false);
  const [diasTarget, setDiasTarget] = useState('3');

  const generar = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      // Antes se mandaban solo los primeros 100 de ~190 alimentos: los otros
      // 90 eran invisibles para la IA y nunca los podía proponer, sin que
      // nada lo dijera. Ahora van todos, con un formato más compacto para
      // que el prompt no crezca: se quitan las unidades repetidas y las
      // etiquetas, que la IA infiere del encabezado.
      const alimentosList =
        'id|nombre|prot|carb|gras|kcal (por 100 g)\n' +
        todosAlimentos
          .map(a => `${a.id}|${a.nombre}|${a.proteinas}|${a.carbos}|${a.grasas}|${a.calorias}`)
          .join("\n");

      const prompt = `Generá un plan nutricional semanal en JSON para este cliente de ACTIVA Fitness Club:

Cliente: ${cliente?.nombre} ${cliente?.apellido}
Perfil: ${perfil ? `${perfil.sexo==='F'?'Mujer':'Hombre'}, ${perfil.edad||'?'} años, ${perfil.peso||'?'} kg, ${perfil.talla||'?'} cm, nivel de actividad ${perfil.actividad||'?'}` : 'no detallado'}
Objetivo: ${objetivoNut?.label || "mantenimiento"}
Calorías target: ${objetivoNut?.kcal || 2000} kcal/día
Proteínas: ${objetivoNut?.prot_g || 150}g · Carbos: ${objetivoNut?.carb_g || 200}g · Grasas: ${objetivoNut?.gras_g || 70}g
Nivel de entrenamiento: ${cliente?.nivel?.toUpperCase() || "activo"}
Plan de entrenamiento que está cursando: ${entrenamiento || "sin plan de entrenamiento activo registrado"}
Instrucciones especiales: ${instrucciones || "ninguna"}
${ctxReglas(reglas,'nutricion')}${ctxHistorial(historial,'PLANES NUTRICIONALES PREVIOS DE ESTE CLIENTE')}
Considerá el plan de entrenamiento al distribuir macros: más carbohidratos y energía en los días/sesiones de mayor carga, prioridad de proteína en torno al entrenamiento, y coherencia entre el gasto del plan y las calorías target.
IMPORTANTE: Usá SOLO alimentos de esta lista (ID exacto):
${alimentosList}

Generá menús para ${diasTarget} días. Respondé ÚNICAMENTE con este JSON:

REGLAS DEL FORMATO (si no se cumplen, el plan no se puede aplicar):
- "dia" debe ser uno de estos valores EXACTOS, con tilde: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo. No uses "Día 1" ni minúsculas.
- "alimentoId" debe ser un ID EXACTO de la lista de arriba. No inventes IDs ni uses el nombre del alimento.
- "dias" va en la raíz del JSON, no anidado dentro de otra clave.
- Las comidas van dentro de "comidas", no sueltas en el día.

{
  "titulo": "nombre del plan",
  "resumen": "descripción breve (1 línea)",
  "dias": [
    {
      "dia": "Lunes",
      "comidas": {
        "desayuno":    [{"alimentoId": "id_exacto", "gramos": 150}],
        "colacion_am": [{"alimentoId": "id_exacto", "gramos": 100}],
        "almuerzo":    [{"alimentoId": "id_exacto", "gramos": 200}],
        "merienda":    [{"alimentoId": "id_exacto", "gramos": 150}],
        "cena":        [{"alimentoId": "id_exacto", "gramos": 200}]
      }
    }
  ],
  "consejos": ["consejo 1", "consejo 2", "consejo 3"],
  "razonamiento": "justificación nutricional (2-3 líneas)"
}`;

      const data = await callClaude(prompt, 8000);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return (
    <button onClick={()=>setShow(true)} style={{...as.btn(),marginBottom:8,width:'100%',justifyContent:'center'}}>
      🤖 Generar plan con IA
    </button>
  );

  return (
    <div style={{...as.card,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:800,color:AI}}>🤖 Asistente IA — Plan nutricional</div>
        <button onClick={()=>{setShow(false);setResult(null);setError(null);}} style={as.btnOutline}>✕</button>
      </div>
      <div style={{fontSize:11,color:G4,marginBottom:8}}>
        Genera menús diarios completos usando la base de alimentos del sistema, respetando los macros calculados con Mifflin-St Jeor.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:6,marginBottom:8}}>
        <div>
          <span style={as.lbl}>Instrucciones / preferencias</span>
          <input value={instrucciones} onChange={e=>setInstrucciones(e.target.value)}
            placeholder="Ej: sin gluten, no le gusta el pescado, vegetariano..."
            style={as.inp}/>
        </div>
        <div>
          <span style={as.lbl}>Días a generar</span>
          <select value={diasTarget} onChange={e=>setDiasTarget(e.target.value)} style={{...as.inp,cursor:'pointer'}}>
            {['3','4','5','7'].map(d=><option key={d} value={d}>{d} días</option>)}
          </select>
        </div>
      </div>
      {objetivoNut&&(
        <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:5,padding:'6px 10px',marginBottom:8,display:'flex',gap:12,flexWrap:'wrap',fontSize:10}}>
          <span>🎯 <strong>{objetivoNut.label}</strong></span>
          <span>🔥 <strong>{objetivoNut.kcal} kcal</strong></span>
          <span>💪 P:{objetivoNut.prot_g}g</span>
          <span>🌾 C:{objetivoNut.carb_g}g</span>
          <span>🥑 G:{objetivoNut.gras_g}g</span>
        </div>
      )}
      {!loading&&!result&&(
        <button onClick={generar} style={{...as.btn(),width:'100%',justifyContent:'center'}}>
          ✨ Generar {diasTarget} días de menús
        </button>
      )}
      {loading&&<Spinner msg={`Generando ${diasTarget} días de menús personalizados...`}/>}
      {error&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,color:'#DC2626'}}><strong>Error:</strong> {error}<br/><button onClick={generar} style={{...as.btn(R),marginTop:5,fontSize:10}}>Reintentar</button></div>}
      {result&&(
        <div>
          <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'10px 12px',marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:AI,marginBottom:2}}>{result.titulo}</div>
            <div style={{fontSize:11,color:G4,marginBottom:6}}>{result.resumen}</div>
            {result.dias?.map((dia,i)=>(
              <div key={i} style={{padding:'6px 8px',background:i%2===0?G1:WH,borderRadius:5,marginBottom:3}}>
                <div style={{fontSize:11,fontWeight:700,color:AI,marginBottom:2}}>{dia.dia}</div>
                {Object.entries(dia.comidas||{}).map(([comida,items])=>(
                  <div key={comida} style={{fontSize:9,color:G4,marginLeft:8}}>
                    <span style={{fontWeight:700,color:G3,textTransform:'uppercase',marginRight:4}}>{comida}:</span>
                    {items?.map((it,j)=>{
                      const al=todosAlimentos.find(a=>a.id===it.alimentoId);
                      return <span key={j} style={{marginRight:4}}>{al?al.nombre:it.alimentoId} ({it.gramos}g)</span>;
                    })}
                  </div>
                ))}
              </div>
            ))}
            {result.consejos?.length>0&&(
              <div style={{marginTop:6,background:'#EFF6FF',borderRadius:5,padding:'6px 8px',fontSize:10}}>
                <strong style={{color:'#1D4ED8'}}>💡 Consejos:</strong>
                {result.consejos.map((c,i)=><div key={i} style={{color:'#1D4ED8',marginTop:2}}>→ {c}</div>)}
              </div>
            )}
            {result.razonamiento&&<div style={{marginTop:6,background:'#F5F3FF',borderRadius:5,padding:'6px 8px',fontSize:10,color:G4,borderLeft:`3px solid ${AI}`}}><strong>💡 Razonamiento nutricional:</strong> {result.razonamiento}</div>}
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{onApply(result);setResult(null);setShow(false);}} style={{...as.btn(GN),flex:2}}>✅ Aplicar plan</button>
            <button onClick={generar} style={{...as.btnOutline,flex:1}}>🔄 Regenerar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO 4: ANÁLISIS DE EVALUACIÓN → SUGERENCIA DE FASE/MÉTODO/EJERCICIOS ──
// Lee los datos de una evaluación (gym o fisio) y sugiere ubicación metodológica.
export function AIAnalisisEvaluacion({ tipo, datos, reglas = [], onApply, onResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [show, setShow]       = useState(false);

  const generar = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const contexto = tipo === "fisio"
        ? `EVALUACIÓN FISIOTERAPÉUTICA
Paciente: ${datos.nombre || ""} ${datos.apellido || ""}
Región afectada: ${datos.region || "no registrada"}
Diagnóstico PT: ${datos.diagnostico || "no registrado"}
EVA actual: ${datos.eva ?? "no registrado"}/10
ROM / movilidad: ${datos.rom || "no registrado"}
Fuerza (MRC): ${datos.fuerza || "no registrado"}
Hallazgos screening: ${datos.screening || "no registrado"}
Antropometría: ${datos.antropometria || "no registrada"}
Objetivos: ${datos.objetivos || "no especificados"}
Tiempo de evolución: ${datos.evolucion || "no registrado"}`
        : `EVALUACIÓN FUNCIONAL DE GIMNASIO
Cliente: ${datos.nombre || ""} ${datos.apellido || ""}

▸ OBJETIVO declarado: ${datos.objetivo || "no registrado"}
▸ Experiencia previa: ${datos.experiencia || "no registrada"}
▸ Nivel actual asignado: ${datos.nivel || "no asignado"} · Semáforo: ${datos.semaforo || "pendiente"}

▸ MEDICIONES CORPORALES (antropometría): ${datos.antropometria || "NO REGISTRADA"}

▸ ÁNGULOS / MOVILIDAD ARTICULAR: ${datos.movilidad || "NO REGISTRADA"}
▸ POSTURA (por segmento): ${datos.postura || "NO REGISTRADA"}
▸ CONTROL MOTOR (patrones): ${datos.controlMotor || "no registrado"}
▸ BALANCE DINÁMICO (Y-Balance): ${datos.yBalance || "no registrado"}

▸ CAPACIDADES FÍSICAS (PVFI): ${datos.capacidades || "sin tests"} · Semáforo PVFI: ${datos.pvfiNivel || "no asignado"}
▸ POTENCIA Y SALTOS (solo si es deportista): ${datos.potencia || "no registrada"}
▸ TESTS DE FUERZA (1RM y ratios): ${datos.tests || "sin tests"}

▸ SALUD / SCREENING: ${datos.screening || "no registrado"}
▸ BANDERAS CLÍNICAS: ${datos.banderas || "sin banderas"}
▸ RESTRICCIONES (filtro de ejercicios): ${datos.restriccionesEstructuradas || "ninguna"}${datos.restricciones && datos.restricciones!=='ninguna' ? ` · Otras: ${datos.restricciones}` : ''}`;

      const fases = tipo === "fisio"
        ? "RESTAURA (rehabilitación aguda), ACTIVA (reintegración), POTENCIA (desarrollo de capacidad), RINDE (mantenimiento/rendimiento)"
        : "RESTAURA (rehab/dolor presente), ACTIVA (reacondicionamiento base), POTENCIA (desarrollo de fuerza/hipertrofia), RINDE (rendimiento/mantenimiento)";

      const metodologiasPorFase = ['restaura','activa','potencia','rinde'].map(fase=>{
        const compatibles=periodizacionesPorFase(fase);
        const lista=compatibles.length>0?compatibles.map(p=>p.nombre).join(', '):'(ninguna — en RESTAURA no se asigna periodización de fuerza, el plan es el protocolo clínico de rehab)';
        return `- ${fase}: ${lista}`;
      }).join('\n');

      // ─── CAPA DETERMINISTA ────────────────────────────────────────────
      // Todo lo aritmético lo calcula motor.js antes de llegar acá. La IA no
      // vuelve a hacer una sola cuenta: solo interpreta banderas ya resueltas.
      // Sin esto había que auditar cada número antes de confiar en el texto, y
      // auditar cuentas ajenas cuesta casi lo mismo que hacerlas.
      const bloqueDet = datos.deterministico
        ? `\n${'='.repeat(64)}\nMÉTRICAS YA CALCULADAS POR EL SISTEMA — SON DEFINITIVAS\n${'='.repeat(64)}\n${datos.deterministico}\n${'='.repeat(64)}\n\nREGLAS SOBRE ESTE BLOQUE (no negociables):\n1. NO recalcules ninguno de estos valores. Ya están verificados.\n2. NO contradigas el VEREDICTO DE AVANCE ni el estado de cada criterio.\n3. "sin medir" significa MEDICIÓN PENDIENTE, nunca "mal resultado". No lo\n   trates como déficit ni lo uses para justificar una fase más baja.\n4. Si un dato del bloque difiere de los datos crudos de abajo, MANDA EL BLOQUE.\n5. Los datos crudos de abajo son contexto cualitativo para redactar mejor,\n   no una fuente alternativa de números.\n`
        : '';

      const prompt = `Analizá esta evaluación y sugerí dónde ubicar a la persona dentro del Método Activa Integra.
${bloqueDet}
${contexto}

Fases disponibles: ${fases}

Metodologías de planificación válidas POR FASE (la metodología sugerida DEBE pertenecer a la lista de la fase que elijas — nunca mezcles una metodología de otra fase):
${metodologiasPorFase}
${ctxReglas(reglas,'evaluacion')}
Respondé ÚNICAMENTE con este JSON:
{
  "interpretacion": "síntesis integradora de 3-4 líneas que cruza objetivo + cuerpo + movilidad + fuerza, no una lista",
  "analisis_objetivos": "relación entre lo que la persona busca y lo que la evaluación muestra: ¿el objetivo es realista hoy?, ¿qué hay que resolver antes? (2-3 líneas)",
  "analisis_corporal": "lectura de las mediciones corporales: IMC, % graso, perímetros y ratio cintura/cadera si están; qué implican para el objetivo (2-3 líneas). Si dice NO REGISTRADA, indicá que falta el dato",
  "analisis_movilidad": "lectura de los ángulos de movilidad y la postura: qué articulaciones están limitadas o con dolor, asimetrías relevantes y cómo condicionan los ejercicios (2-3 líneas). Si dice NO REGISTRADA, indicá que falta el dato",
  "deficiencias_funcionales": ["déficit funcional concreto detectado (control motor, postura, balance, movilidad) con su implicancia"],
  "deficiencias_fuerza": ["déficit de fuerza concreto: grupo/patrón débil según tests 1RM, ratios o PVFI, con referencia al valor"],
  "fase_sugerida": "restaura|activa|potencia|rinde",
  "fase_justificacion": "por qué esta fase, citando los datos que la fundamentan (2 líneas)",
  "metodologia_sugerida": "nombre exacto de una metodología de la lista correspondiente a fase_sugerida (si fase_sugerida es restaura, dejá este campo vacío)",
  "periodizacion_id": "el ID de esa metodología, EXACTO, uno de: lineal | dup | bloque | atr | conjugado | hst | triphasic | fitness_general | perdida_grasa. Vacío si fase_sugerida es restaura. Este campo es el que el sistema usa para asignarla: si no lo mandás, la asignación depende de interpretar el nombre.",
  "metodologia_justificacion": "por qué este sistema para este caso (2 líneas)",
  "prioridades": ["en orden, qué atacar primero según lo que más limita hoy"],
  "ejercicios_base": [
    {"nombre": "ejercicio", "razon": "qué déficit o capacidad puntual ataca en ESTE cliente"}
  ],
  "precauciones": "consideraciones de seguridad concretas, integrando banderas, dolor y restricciones",
  "objetivos_sugeridos": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "falta_medir": ["medición pendiente y por qué importa para decidir"]
}

Incluí 4-6 ejercicios base y 2-4 ítems en cada lista de deficiencias y prioridades (si no hay déficit en un eje, devolvé lista vacía).

INSTRUCCIONES CRÍTICAS:
- Analizá TODOS los ejes provistos: objetivo, mediciones corporales, ángulos de movimiento/postura, control motor/balance, capacidades físicas y fuerza. Cada campo de análisis debe referirse a los valores concretos del cliente, nunca genérico.
- Conectá los déficits con el objetivo: si el objetivo choca con una limitación (ej. quiere hipertrofia de hombro pero tiene flexión de hombro limitada o restricción overhead), decilo explícitamente y ponelo en prioridades.
- Solo declarás un dato ausente si el texto dice literalmente "NO REGISTRADA", "NO HAY", "no registrado" o "sin tests". No asumas ausencia de lo que sí está.
- Usá los grados exactos cuando estén informados y la escala (Óptimo/Limitado/Muy limitado/Dolor) para fundamentar movilidad; usá 1RM, ratios (×peso corporal) y PVFI para fundamentar fuerza. "Dolor" en cualquier movimiento es una precaución obligatoria.
- Una bandera roja obliga a derivación y a fase RESTAURA con precaución explícita, sin importar la fuerza. Las restricciones (impacto/overhead/carga axial) deben respetarse en los ejercicios sugeridos.
- Coherencia: no mandes a RESTAURA a alguien con fuerza Intermedia/Avanzada y movilidad normal salvo dolor/lesión/bandera; no mandes a POTENCIA/RINDE a alguien con déficits funcionales marcados o semáforo PVFI rojo.
- Si hay bloque de MÉTRICAS YA CALCULADAS, tu "fase_sugerida" debe ser coherente con su VEREDICTO DE AVANCE. Si el veredicto dice que no avanza o que faltan datos, no sugieras la fase siguiente.
- En "falta_medir" listá SOLO lo que el bloque marca como "sin medir" o los datos crudos declaran ausentes. Si no falta nada, devolvé lista vacía. Nunca inventes mediciones pendientes.
- Escribí en español rioplatense (voseo), directo y sin relleno. Nada de "es importante destacar" ni frases de transición vacías.`;

      const data = await callClaude(prompt, 3200);
      setResult(data);
      onResult && onResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return (
    <button onClick={()=>{setShow(true);generar();}} style={{...as.btn(),width:'100%',justifyContent:'center',marginTop:8}}>
      🤖 Analizar evaluación con IA — sugerir fase, método y ejercicios
    </button>
  );

  return (
    <div style={{...as.card,marginTop:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:800,color:AI}}>🤖 Análisis IA de la evaluación</div>
        <button onClick={()=>{setShow(false);setResult(null);setError(null);}} style={as.btnOutline}>✕</button>
      </div>
      {loading&&<Spinner msg="Analizando evaluación y sugiriendo ubicación metodológica..."/>}
      {error&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,color:'#DC2626'}}><strong>Error:</strong> {error}<br/><button onClick={generar} style={{...as.btn(R),marginTop:5,fontSize:10}}>Reintentar</button></div>}
      {result&&(
        <div>
          <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'12px 14px',marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:G3,textTransform:'uppercase',marginBottom:4}}>Interpretación</div>
            <div style={{fontSize:11,color:G4,lineHeight:1.5,marginBottom:10}}>{result.interpretacion}</div>

            {(result.analisis_objetivos||result.analisis_corporal||result.analisis_movilidad)&&(
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
                {result.analisis_objetivos&&<div style={{background:'#EFF6FF',borderRadius:6,padding:'7px 10px'}}><div style={{fontSize:9,fontWeight:700,color:'#1D4ED8',textTransform:'uppercase',marginBottom:2}}>🎯 Objetivos vs. evaluación</div><div style={{fontSize:10.5,color:G4,lineHeight:1.45}}>{result.analisis_objetivos}</div></div>}
                {result.analisis_corporal&&<div style={{background:'#F0FDF4',borderRadius:6,padding:'7px 10px'}}><div style={{fontSize:9,fontWeight:700,color:'#15803D',textTransform:'uppercase',marginBottom:2}}>📏 Mediciones corporales</div><div style={{fontSize:10.5,color:G4,lineHeight:1.45}}>{result.analisis_corporal}</div></div>}
                {result.analisis_movilidad&&<div style={{background:'#FEF6F0',borderRadius:6,padding:'7px 10px'}}><div style={{fontSize:9,fontWeight:700,color:'#C2410C',textTransform:'uppercase',marginBottom:2}}>🦴 Ángulos y movilidad</div><div style={{fontSize:10.5,color:G4,lineHeight:1.45}}>{result.analisis_movilidad}</div></div>}
              </div>
            )}

            {(result.deficiencias_funcionales?.length>0||result.deficiencias_fuerza?.length>0)&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div style={{background:'#FFF9EC',borderRadius:6,padding:'8px 10px',border:'1px solid #FCD34D'}}>
                  <div style={{fontSize:9,fontWeight:700,color:'#92400E',textTransform:'uppercase',marginBottom:3}}>Déficits funcionales</div>
                  {result.deficiencias_funcionales?.length>0?result.deficiencias_funcionales.map((d,i)=><div key={i} style={{fontSize:10,color:'#78350F',marginBottom:2}}>• {d}</div>):<div style={{fontSize:10,color:G3}}>Sin déficits marcados</div>}
                </div>
                <div style={{background:'#FEF2F2',borderRadius:6,padding:'8px 10px',border:'1px solid #FCA5A5'}}>
                  <div style={{fontSize:9,fontWeight:700,color:'#991B1B',textTransform:'uppercase',marginBottom:3}}>Déficits de fuerza</div>
                  {result.deficiencias_fuerza?.length>0?result.deficiencias_fuerza.map((d,i)=><div key={i} style={{fontSize:10,color:'#7F1D1D',marginBottom:2}}>• {d}</div>):<div style={{fontSize:10,color:G3}}>Sin déficits marcados</div>}
                </div>
              </div>
            )}

            {result.prioridades?.length>0&&(
              <div style={{background:'#1A1A1A',borderRadius:6,padding:'8px 11px',marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:700,color:'#FCA5A5',textTransform:'uppercase',marginBottom:4}}>🔢 Prioridades (en orden)</div>
                {result.prioridades.map((p,i)=><div key={i} style={{fontSize:10.5,color:'#fff',marginBottom:2,display:'flex',gap:6}}><span style={{color:'#FCA5A5',fontWeight:800}}>{i+1}.</span><span>{p}</span></div>)}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
              <div style={{background:'#F5F3FF',borderRadius:6,padding:'8px 10px',border:`1px solid ${AI_BORDER}`}}>
                <div style={{fontSize:9,color:G3,textTransform:'uppercase',fontWeight:700}}>Fase sugerida</div>
                <div style={{fontSize:16,fontWeight:800,color:AI,textTransform:'uppercase'}}>{result.fase_sugerida}</div>
                <div style={{fontSize:9,color:G4,marginTop:2}}>{result.fase_justificacion}</div>
              </div>
              <div style={{background:'#F5F3FF',borderRadius:6,padding:'8px 10px',border:`1px solid ${AI_BORDER}`}}>
                <div style={{fontSize:9,color:G3,textTransform:'uppercase',fontWeight:700}}>Metodología</div>
                <div style={{fontSize:13,fontWeight:800,color:AI}}>{result.metodologia_sugerida}</div>
                <div style={{fontSize:9,color:G4,marginTop:2}}>{result.metodologia_justificacion}</div>
              </div>
            </div>

            {result.ejercicios_base?.length>0&&(
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:G3,textTransform:'uppercase',marginBottom:4}}>Ejercicios base sugeridos</div>
                {result.ejercicios_base.map((e,i)=>(
                  <div key={i} style={{display:'flex',gap:6,padding:'4px 8px',background:i%2===0?G1:WH,borderRadius:5,marginBottom:2}}>
                    <span style={{fontWeight:700,color:AI,fontSize:10}}>→</span>
                    <div><span style={{fontSize:11,fontWeight:700}}>{e.nombre}</span><span style={{fontSize:9,color:G4,marginLeft:6}}>{e.razon}</span></div>
                  </div>
                ))}
              </div>
            )}

            {result.objetivos_sugeridos?.length>0&&(
              <div style={{background:'#EFF6FF',borderRadius:5,padding:'6px 8px',marginBottom:6,fontSize:10}}>
                <strong style={{color:'#1D4ED8'}}>🎯 Objetivos sugeridos:</strong>
                {result.objetivos_sugeridos.map((o,i)=><div key={i} style={{color:'#1D4ED8',marginTop:1}}>→ {o}</div>)}
              </div>
            )}
            {result.precauciones&&<div style={{background:'#FFF9EC',border:'1px solid #FCD34D',borderRadius:5,padding:'6px 8px',fontSize:10,color:'#78350F'}}>⚠ {result.precauciones}</div>}
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{onApply(result);}} style={{...as.btn(GN),flex:2}}>✅ Aplicar sugerencias</button>
            <button onClick={generar} style={{...as.btnOutline,flex:1}}>🔄 Regenerar</button>
          </div>
        </div>
      )}
    </div>
  );
}
