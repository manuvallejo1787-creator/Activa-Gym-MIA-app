// AIActiva.jsx — Asistente IA integrado en ACTIVA Fitness Club + FisioActiva
// Usa la API de Anthropic directamente desde el navegador
// Contexto: Manu Vallejo, entrenador y fisioterapeuta, Colonia del Sacramento, Uruguay

import { useState } from "react";

// ─── IDENTIDAD DEL ASISTENTE ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos el asistente de IA integrado en el sistema de gestión de ACTIVA Fitness Club y FisioActiva Colonia, el primer centro de rehabilitación y entrenamiento integrado de Colonia del Sacramento, Uruguay. 

Fundador: Manu Vallejo — entrenador personal y fisioterapeuta. Metodología propia: Método Activa Integra con 4 fases (RESTAURA → ACTIVA → POTENCIA → RINDE).

Tu rol: generar contenido clínico y de entrenamiento basado en evidencia científica, personalizado para cada cliente, alineado con la metodología del centro. Siempre respondés en español, con tono profesional y directo.

IMPORTANTE: Siempre respondés ÚNICAMENTE con JSON válido, sin texto adicional, sin marcadores markdown, sin explicaciones fuera del JSON.`;

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
    throw new Error("La IA no devolvió un formato válido. Probá regenerar.");
  }
}

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
export function AIGeneradorSesion({ cliente, periodizacion, tests, exs, onApply }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [show, setShow]       = useState(false);

  const generar = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const faseActiva = periodizacion?.fases?.[0];
      const rm1s = tests?.map(t => `${t.test_nombre}: ${t.rm1_real||t.rm1_calculado||'sin dato'} kg`).join(", ") || "sin tests registrados";

      const prompt = `Generá una sesión de entrenamiento en JSON para este cliente:

Cliente: ${cliente?.nombre} ${cliente?.apellido}
Nivel Método Activa: ${cliente?.nivel?.toUpperCase()} — ${cliente?.objetivo || "objetivo general"}
Semáforo: ${cliente?.semaforo}
Peso corporal: ${cliente?.screening?.peso || "no registrado"} kg
Restricciones: ${cliente?.restricciones || "ninguna"}
Periodización activa: ${periodizacion?.nombre || "sin plan"}
Fase actual: ${faseActiva ? `${faseActiva.nombre} — ${faseActiva.reps} reps, ${faseActiva.intensidad}, RIR ${faseActiva.rir}` : "no definida"}
Tests de fuerza 1RM: ${rm1s}
Instrucciones adicionales: ${instrucciones || "ninguna"}

ESTRUCTURA OBLIGATORIA DE LA SESIÓN (orden fijo de bloques):
1. movilidad → 2. activacion → 3. fuerza/potencia (principal) → 4. accesorios → 5. zona_media/prev_rehab → 6. cardio/flex_recovery
El orden NO se altera. Una sesión típica usa 4-6 bloques siguiendo ese flujo.

EJERCICIOS DISPONIBLES — AGRUPADOS POR BLOQUE.
Un ejercicio SOLO puede ir en un bloque de su mismo tipo. NUNCA pongas un ejercicio de fuerza en movilidad ni viceversa.
${(() => {
  const porBloque = {};
  exs.forEach(e => { (porBloque[e.bloque] = porBloque[e.bloque] || []).push(e); });
  return Object.entries(porBloque).map(([bloque, lista]) =>
    `\n### BLOQUE "${bloque}" (solo estos IDs van en bloques type="${bloque}"):\n` +
    lista.slice(0, 25).map(e => `${e.id} = ${e.nombre}`).join("\n")
  ).join("\n");
})()}

REGLAS ESTRICTAS:
- El "type" de cada bloque DEBE ser uno de: movilidad, activacion, zona_media, prev_rehab, potencia, fuerza, accesorios, cardio, flex_recovery, propiocepcion, funcional.
- Cada "exId" dentro de un bloque DEBE pertenecer al grupo de ese bloque (mismo tipo). Si el ejercicio "sentadilla" está listado bajo BLOQUE "fuerza", solo puede ir en un bloque type="fuerza".
- Usá ÚNICAMENTE los IDs exactos listados arriba. No inventes IDs.
- Respetá el orden: movilidad y activación al inicio, fuerza/potencia en el medio, cardio/recovery al final.

Respondé ÚNICAMENTE con este JSON (sin texto extra):
{
  "nombre": "nombre descriptivo de la sesión",
  "objetivo_sesion": "descripción breve del objetivo",
  "blocks": [
    {
      "type": "uno de los tipos válidos",
      "params": { "series": "3", "reps": "10-12", "rpe": "7", "tempo": "2-0-1", "descanso": "90s" },
      "exercises": [
        { "exId": "id_exacto_de_ese_bloque", "pesoSug": "kg si aplica", "anotacion": "indicación técnica breve" }
      ]
    }
  ],
  "razonamiento": "explicación breve (2-3 líneas)"
}

Incluí 4-6 bloques en el orden correcto. Cada bloque máximo 4 ejercicios. Respetá la fase de periodización para los parámetros.`;

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
        <span style={as.lbl}>Instrucciones adicionales (opcional)</span>
        <input value={instrucciones} onChange={e=>setInstrucciones(e.target.value)}
          placeholder="Ej: enfocarse en piernas, sesión corta 45 min, sin sentadilla hoy..."
          style={as.inp}/>
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
export function AIGeneradorProtocolo({ paciente, region, fase, evaluacion, onApply }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [show, setShow]       = useState(false);

  const generar = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const eva = evaluacion?.escalas_dolor?.eva_actual || evaluacion?.eva || "no registrado";
      const dx  = evaluacion?.diagnosticoPT || evaluacion?.diagnostico || "no registrado";
      const obj = evaluacion?.objetivos_tratamiento || "no especificados";

      const prompt = `Generá un protocolo de rehabilitación en JSON para este paciente de FisioActiva Colonia:

Paciente: ${paciente?.nombre} ${paciente?.apellido}
Región: ${region}
Fase del Método Activa Integra: ${fase?.toUpperCase()}
Diagnóstico fisioterapéutico: ${dx}
EVA actual: ${eva}/10
Objetivos de tratamiento: ${obj}
Instrucciones adicionales: ${instrucciones || "ninguna"}

Respondé ÚNICAMENTE con este JSON:
{
  "titulo": "nombre del protocolo",
  "objetivo": "objetivo clínico principal",
  "duracion_sesion": "X minutos",
  "frecuencia": "X sesiones por semana",
  "ejercicios": [
    {
      "nombre": "nombre del ejercicio",
      "desc": "descripción detallada del procedimiento (posición, ejecución, puntos clave)",
      "param": "parámetros (ej: 3×12 rep · hold 5 seg · RPE 4-5)",
      "progresion": "cómo progresar cuando se domine",
      "precaucion": "qué evitar o vigilar"
    }
  ],
  "criterios_alta_fase": ["criterio 1", "criterio 2", "criterio 3"],
  "precauciones_generales": "precauciones para toda la sesión",
  "razonamiento": "justificación clínica basada en evidencia (2-3 líneas)"
}

Incluí 5-8 ejercicios apropiados para la fase ${fase} en región ${region}. Basate en evidencia fisioterapéutica actual.`;

      const data = await callClaude(prompt, 2500);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return (
    <button onClick={()=>setShow(true)} style={{...as.btn(),marginBottom:8,width:'100%',justifyContent:'center'}}>
      🤖 Generar protocolo con IA
    </button>
  );

  return (
    <div style={{...as.card,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:800,color:AI}}>🤖 Asistente IA — Protocolo clínico</div>
        <button onClick={()=>{setShow(false);setResult(null);setError(null);}} style={as.btnOutline}>✕</button>
      </div>
      <div style={{fontSize:11,color:G4,marginBottom:8}}>
        Genera un protocolo de rehabilitación personalizado basado en el perfil clínico del paciente, región, fase y diagnóstico registrado.
      </div>
      <div style={{marginBottom:8}}>
        <span style={as.lbl}>Instrucciones adicionales (opcional)</span>
        <input value={instrucciones} onChange={e=>setInstrucciones(e.target.value)}
          placeholder="Ej: paciente deportista, trabajo de pie, intolerancia al dolor..."
          style={as.inp}/>
      </div>
      {!loading&&!result&&(
        <button onClick={generar} style={{...as.btn(),width:'100%',justifyContent:'center'}}>
          ✨ Generar protocolo — {region} · {fase?.toUpperCase()}
        </button>
      )}
      {loading&&<Spinner msg="Generando protocolo basado en evidencia clínica..."/>}
      {error&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,color:'#DC2626'}}><strong>Error:</strong> {error}<br/><button onClick={generar} style={{...as.btn(R),marginTop:5,fontSize:10}}>Reintentar</button></div>}
      {result&&(
        <div>
          <div style={{background:WH,border:`1px solid ${AI_BORDER}`,borderRadius:7,padding:'10px 12px',marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:AI,marginBottom:2}}>{result.titulo}</div>
            <div style={{fontSize:11,color:G4,marginBottom:6}}>{result.objetivo}</div>
            <div style={{display:'flex',gap:10,fontSize:10,color:G3,marginBottom:8}}>
              <span>⏱ {result.duracion_sesion}</span>
              <span>📅 {result.frecuencia}</span>
            </div>
            {result.ejercicios?.map((e,i)=>(
              <div key={i} style={{padding:'7px 10px',background:i%2===0?G1:WH,borderRadius:5,marginBottom:4,borderLeft:`3px solid ${AI}`}}>
                <div style={{fontSize:11,fontWeight:700,marginBottom:2}}>{i+1}. {e.nombre}</div>
                <div style={{fontSize:10,color:G4,marginBottom:2}}>{e.desc}</div>
                <div style={{fontSize:10,fontWeight:700,color:AI}}>{e.param}</div>
                {e.progresion&&<div style={{fontSize:9,color:GN,marginTop:2}}>↑ Progresión: {e.progresion}</div>}
                {e.precaucion&&<div style={{fontSize:9,color:AM,marginTop:1}}>⚠ {e.precaucion}</div>}
              </div>
            ))}
            {result.criterios_alta_fase?.length>0&&(
              <div style={{marginTop:6,background:'#EFF6FF',borderRadius:5,padding:'6px 8px',fontSize:10}}>
                <strong style={{color:'#1D4ED8'}}>📋 Criterios para avanzar de fase:</strong>
                {result.criterios_alta_fase.map((c,i)=><div key={i} style={{color:'#1D4ED8',marginTop:2}}>→ {c}</div>)}
              </div>
            )}
            {result.precauciones_generales&&(
              <div style={{marginTop:6,background:'#FFF9EC',borderRadius:5,padding:'6px 8px',fontSize:10,color:'#78350F',border:'1px solid #FCD34D'}}>⚠ {result.precauciones_generales}</div>
            )}
            {result.razonamiento&&<div style={{marginTop:6,background:'#F5F3FF',borderRadius:5,padding:'6px 8px',fontSize:10,color:G4,borderLeft:`3px solid ${AI}`}}><strong>💡 Razonamiento clínico:</strong> {result.razonamiento}</div>}
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{onApply(result);setResult(null);setShow(false);}} style={{...as.btn(GN),flex:2}}>✅ Aplicar protocolo</button>
            <button onClick={generar} style={{...as.btnOutline,flex:1}}>🔄 Regenerar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO 3: GENERADOR DE PLAN NUTRICIONAL ─────────────────────────────────
export function AIGeneradorNutricion({ cliente, objetivoNut, todosAlimentos, onApply }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [show, setShow]       = useState(false);
  const [diasTarget, setDiasTarget] = useState('3');

  const generar = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const alimentosList = todosAlimentos.slice(0, 100)
        .map(a => `${a.id}|${a.nombre}|P:${a.proteinas}g C:${a.carbos}g G:${a.grasas}g ${a.calorias}kcal`)
        .join("\n");

      const prompt = `Generá un plan nutricional semanal en JSON para este cliente de ACTIVA Fitness Club:

Cliente: ${cliente?.nombre} ${cliente?.apellido}
Objetivo: ${objetivoNut?.label || "mantenimiento"}
Calorías target: ${objetivoNut?.kcal || 2000} kcal/día
Proteínas: ${objetivoNut?.prot_g || 150}g · Carbos: ${objetivoNut?.carb_g || 200}g · Grasas: ${objetivoNut?.gras_g || 70}g
Nivel de entrenamiento: ${cliente?.nivel?.toUpperCase() || "activo"}
Instrucciones especiales: ${instrucciones || "ninguna"}

IMPORTANTE: Usá SOLO alimentos de esta lista (ID exacto):
${alimentosList}

Generá menús para ${diasTarget} días. Respondé ÚNICAMENTE con este JSON:
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

      const data = await callClaude(prompt, 3000);
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
export function AIAnalisisEvaluacion({ tipo, datos, onApply }) {
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
        : `EVALUACIÓN DE GIMNASIO
Cliente: ${datos.nombre || ""} ${datos.apellido || ""}
Objetivo declarado: ${datos.objetivo || "no registrado"}
Nivel actual asignado: ${datos.nivel || "no asignado"}
Semáforo: ${datos.semaforo || "pendiente"}
Restricciones: ${datos.restricciones || "ninguna"}
Antropometría: ${datos.antropometria || "no registrada"}
Tests de fuerza: ${datos.tests || "sin tests"}
Screening de salud: ${datos.screening || "no registrado"}
Experiencia previa: ${datos.experiencia || "no registrada"}`;

      const fases = tipo === "fisio"
        ? "RESTAURA (rehabilitación aguda), ACTIVA (reintegración), POTENCIA (desarrollo de capacidad), RINDE (mantenimiento/rendimiento)"
        : "RESTAURA (rehab/dolor presente), ACTIVA (reacondicionamiento base), POTENCIA (desarrollo de fuerza/hipertrofia), RINDE (rendimiento/mantenimiento)";

      const metodologias = "Lineal Clásica (Bompa), DUP Ondulante Diaria, Bloques (Verkhoshansky), ATR (Issurin), Conjugado (Westside), HST (Hypertrophy Specific Training), Trifásico (Cal Dietz), Fitness General ACTIVA, Pérdida de Grasa";

      const prompt = `Analizá esta evaluación y sugerí dónde ubicar a la persona dentro del Método Activa Integra.

${contexto}

Fases disponibles: ${fases}
Metodologías de planificación: ${metodologias}

Respondé ÚNICAMENTE con este JSON:
{
  "interpretacion": "interpretación clínica/funcional de la evaluación en 3-4 líneas, integrando los datos",
  "fase_sugerida": "restaura|activa|potencia|rinde",
  "fase_justificacion": "por qué esta fase (2 líneas)",
  "metodologia_sugerida": "nombre exacto de una de las metodologías listadas",
  "metodologia_justificacion": "por qué este sistema para este caso (2 líneas)",
  "ejercicios_base": [
    {"nombre": "ejercicio", "razon": "por qué para este caso"}
  ],
  "precauciones": "consideraciones de seguridad para esta persona",
  "objetivos_sugeridos": ["objetivo 1", "objetivo 2", "objetivo 3"]
}

Incluí 4-6 ejercicios base apropiados. Basate en evidencia y en el estado real de la persona.

INSTRUCCIONES CRÍTICAS:
- USÁ todos los datos provistos arriba. Si hay antropometría, tests de fuerza o hallazgos, INTEGRALOS explícitamente en tu interpretación.
- Solo decí que un dato "no está disponible" si el texto dice literalmente "NO REGISTRADA", "NO HAY" o "no registrado". No asumas ausencia de datos que sí están.
- Si hay tests de fuerza con niveles y ratios, usalos para fundamentar la fase y la metodología (ej: un cliente con fuerza nivel Intermedio/Avanzado no debería ir a RESTAURA salvo que haya dolor o lesión).
- La interpretación debe referirse a los números concretos del cliente, no ser genérica.`;

      const data = await callClaude(prompt, 2200);
      setResult(data);
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
