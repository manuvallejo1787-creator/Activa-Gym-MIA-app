// PoseROM.jsx — Medición de ángulos articulares a partir de una foto.
//
// QUÉ ES Y QUÉ NO ES:
// Esto NO usa un modelo de lenguaje/IA generativa para "leer" la foto y
// adivinar un ángulo — eso da estimaciones no reproducibles. Usa MediaPipe
// Pose Landmarker (detección de landmarks corporales por visión por
// computadora, determinístico), corre 100% en el navegador del usuario
// (nada se sube a un servidor), y el ángulo se calcula por trigonometría
// simple entre 3 landmarks. Es la misma familia de técnica que usan apps
// como Yogger o PostureScreen — no un LLM.
//
// LIMITACIÓN HONESTA: solo se pueden medir con confianza movimientos en el
// plano frontal o sagital visibles desde una sola foto 2D (flexo-extensión
// principalmente). Rotaciones (RI/RE de hombro y cadera), cervicales,
// muñeca y desviaciones inversión/eversión de tobillo NO están mapeadas
// acá a propósito — requieren vistas que una sola foto 2D no resuelve de
// forma confiable. Para esos movimientos el botón queda deshabilitado y
// se avisa que la medición sigue siendo manual (goniómetro).

import { useState, useRef, useCallback } from "react";

// ─── Definiciones de ángulos medibles por región+movimiento ───────────────
// triplet: 3 landmarks de MediaPipe Pose (BlazePose, 33 puntos) —
// se arma como `${lado}_${nombre}` (ej: 'right_shoulder').
// type: '180-angle' → flexión = 180 - ángulo interior en el vértice.
//       'above90'   → ej. dorsiflexión: cuánto supera los 90° neutros.
//       'below90'   → ej. plantarflexión: cuánto queda por debajo de 90°.
const ANGLE_DEFS = {
  hombro:   { 'Flexión':{t:['hip','shoulder','elbow'],type:'180-angle'}, 'Abducción':{t:['hip','shoulder','elbow'],type:'180-angle'} },
  esc:      { 'Elevación hombro':{t:['hip','shoulder','elbow'],type:'180-angle'} },
  codo:     { 'Flexión':{t:['shoulder','elbow','wrist'],type:'180-angle'} },
  cadera:   { 'Flexión':{t:['shoulder','hip','knee'],type:'180-angle'} },
  rodilla:  { 'Flexión':{t:['hip','knee','ankle'],type:'180-angle'} },
  tobillo:  { 'Dorsiflexión':{t:['knee','ankle','foot_index'],type:'above90'}, 'Plantar-flex.':{t:['knee','ankle','foot_index'],type:'below90'} },
  lumbar:   { 'Flexión':{t:['knee','hip','shoulder'],type:'180-angle',aprox:true} },
  columna:  { 'Flexión lumbar':{t:['knee','hip','shoulder'],type:'180-angle',aprox:true} },
};

const getDef=(region,mov)=>ANGLE_DEFS[region]?.[mov]||null;

// ─── Carga perezosa y única del modelo (se comparte entre todas las filas) ─
let landmarkerPromise=null;
async function getLandmarker(){
  if(!landmarkerPromise){
    landmarkerPromise=(async()=>{
      const {PoseLandmarker,FilesetResolver}=await import("@mediapipe/tasks-vision");
      const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
      return PoseLandmarker.createFromOptions(vision,{
        baseOptions:{
          modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate:"GPU",
        },
        runningMode:"IMAGE",
        numPoses:1,
      });
    })();
  }
  return landmarkerPromise;
}

const angleAt=(A,V,C)=>{
  const v1={x:A.x-V.x,y:A.y-V.y}, v2={x:C.x-V.x,y:C.y-V.y};
  const dot=v1.x*v2.x+v1.y*v2.y;
  const m1=Math.hypot(v1.x,v1.y), m2=Math.hypot(v2.x,v2.y);
  if(m1===0||m2===0)return null;
  const cos=Math.min(1,Math.max(-1,dot/(m1*m2)));
  return Math.acos(cos)*180/Math.PI;
};

const calcAngulo=(landmarks,def,lado)=>{
  const IDX={shoulder:11,elbow:13,wrist:15,hip:23,knee:25,ankle:27,foot_index:31}; // lado izquierdo base
  const off=lado==='right'?1:0; // en BlazePose, índice del lado derecho = izquierdo+1
  const pts=def.t.map(name=>landmarks[IDX[name]+off]);
  if(pts.some(p=>!p||p.visibility<0.4))return null;
  const raw=angleAt(pts[0],pts[1],pts[2]);
  if(raw==null)return null;
  if(def.type==='180-angle')return Math.round(180-raw);
  if(def.type==='above90')return Math.max(0,Math.round(raw-90));
  if(def.type==='below90')return Math.max(0,Math.round(90-raw));
  return Math.round(raw);
};

export default function PoseROM({movimiento,region,onMedido}){
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [resultado,setResultado]=useState(null);
  const [lado,setLado]=useState('right');
  const [imgUrl,setImgUrl]=useState(null);
  const canvasRef=useRef(null);
  const def=getDef(region,movimiento);

  const procesar=useCallback(async(file,ladoElegido)=>{
    setLoading(true);setError('');setResultado(null);
    try{
      const url=URL.createObjectURL(file);
      setImgUrl(url);
      const img=new Image();
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
      const landmarker=await getLandmarker();
      const res=landmarker.detect(img);
      const landmarks=res?.landmarks?.[0];
      if(!landmarks){setError('No se detectó una persona en la foto. Probá con más luz o de cuerpo más completo.');setLoading(false);return;}
      const angulo=calcAngulo(landmarks,def,ladoElegido);
      if(angulo==null){setError('No se pudieron ubicar con confianza los puntos necesarios (¿la articulación está tapada u oculta en la foto?).');setLoading(false);return;}
      setResultado(angulo);
      // dibujar overlay simple para que el evaluador confirme visualmente
      const canvas=canvasRef.current;
      if(canvas){
        const ctx=canvas.getContext('2d');
        canvas.width=img.width;canvas.height=img.height;
        ctx.drawImage(img,0,0);
        ctx.fillStyle='#1BAA86';
        landmarks.forEach(p=>{ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,5,0,7);ctx.fill();});
      }
    }catch(e){
      setError('Error al procesar la imagen: '+(e?.message||'desconocido'));
    }
    setLoading(false);
  },[def]);

  const handleFile=(e)=>{
    const file=e.target.files?.[0];
    if(file)procesar(file,lado);
  };

  if(!def){
    return <div title="Este movimiento requiere una vista que una foto 2D no mide de forma confiable (rotación, cervical, muñeca, inversión/eversión). Medición manual con goniómetro." style={{fontSize:9,color:'#94A3B8',textAlign:'center',padding:'6px 2px',border:'1px dashed #E2E8F0',borderRadius:6}}>Manual</div>;
  }

  if(!open){
    return <button onClick={()=>setOpen(true)} style={{fontSize:9,fontWeight:700,padding:'6px 4px',borderRadius:6,border:'1px solid #93C5FD',background:'#EFF6FF',color:'#1D4ED8',cursor:'pointer'}}>📸 Medir</button>;
  }

  return(
    <div style={{gridColumn:'1/-1',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:8,padding:10,marginTop:6}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,fontWeight:700,color:'#0A3D62'}}>📸 Medición por foto — {movimiento}{def.aprox?' (aproximado)':''}</span>
        <button onClick={()=>setOpen(false)} style={{fontSize:10,color:'#94A3B8',background:'none',border:'none',cursor:'pointer'}}>✕ cerrar</button>
      </div>
      {def.aprox&&<div style={{fontSize:9,color:'#D97706',marginBottom:6}}>Este ángulo combina el aporte de cadera y columna — es un proxy visual, no reemplaza la goniometría segmentaria si necesitás precisión clínica.</div>}
      <div style={{display:'flex',gap:6,marginBottom:8}}>
        {['right','left'].map(l=>(
          <button key={l} onClick={()=>setLado(l)} style={{fontSize:9,fontWeight:700,padding:'4px 10px',borderRadius:99,border:`1px solid ${lado===l?'#1BAA86':'#E2E8F0'}`,background:lado===l?'#1BAA8620':'white',color:lado===l?'#1BAA86':'#475569',cursor:'pointer'}}>{l==='right'?'Lado Derecho':'Lado Izquierdo'}</button>
        ))}
      </div>
      <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{fontSize:10,marginBottom:8}}/>
      {loading&&<div style={{fontSize:10,color:'#94A3B8'}}>Analizando imagen…</div>}
      {error&&<div style={{fontSize:10,color:'#DC2626',background:'#FEF2F2',padding:6,borderRadius:5,marginBottom:6}}>{error}</div>}
      {imgUrl&&<canvas ref={canvasRef} style={{maxWidth:'100%',borderRadius:6,marginBottom:6,display:resultado!=null||error?'block':'none'}}/>}
      {resultado!=null&&(
        <div style={{display:'flex',alignItems:'center',gap:10,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:6,padding:'6px 10px'}}>
          <div style={{fontSize:18,fontWeight:800,color:'#16A34A'}}>{resultado}°</div>
          <button onClick={()=>{onMedido(resultado,lado);setOpen(false);}} style={{fontSize:10,fontWeight:700,padding:'6px 12px',borderRadius:6,border:'none',background:'#1BAA86',color:'white',cursor:'pointer'}}>Usar este valor</button>
          <span style={{fontSize:9,color:'#64748B'}}>Confirmá que el ángulo se ve razonable antes de aceptar.</span>
        </div>
      )}
    </div>
  );
}
