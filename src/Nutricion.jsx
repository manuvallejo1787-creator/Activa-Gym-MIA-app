// Nutricion.jsx — Módulo de Planes Nutricionales
// Vinculado a clientes · Fórmula Mifflin-St Jeor · 7 días × 5 comidas · PDF export

import { useState, useMemo, useCallback } from "react";
import {
  DB_ALIMENTOS, CATEGORIAS_ALIMENTOS, DIAS_SEMANA, COMIDAS,
  calcularTDEE, calcularObjetivo, sumarMacrosDia, calcularMacros, getAlimentoById
} from "./alimentos.js";

// ─── PALETA ──────────────────────────────────────────────────────────────────
const BK='#1a1a1a', WH='#FFFFFF', R='#CC0000';
const G1='#F4F4F4', G2='#E0E0E0', G3='#999999', G4='#555555';
const GN='#16A34A', AM='#D97706', RJ='#DC2626';
const NV='#0A3D62', TL='#1BAA86';

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const ns = {
  inp: { width:'100%', border:`1px solid ${G2}`, borderRadius:5, padding:'5px 8px', fontSize:11, background:WH, outline:'none' },
  sel: { border:`1px solid ${G2}`, borderRadius:5, padding:'5px 8px', fontSize:11, background:WH, outline:'none' },
  lbl: { display:'block', fontSize:9, color:G3, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3, fontWeight:700 },
  card: { background:WH, borderRadius:8, padding:14, marginBottom:10, border:`1px solid ${G2}` },
  btnR: { background:R, color:WH, border:'none', borderRadius:5, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer' },
  btnG: { background:WH, color:G4, border:`1px solid ${G2}`, borderRadius:5, padding:'5px 10px', fontSize:11, cursor:'pointer' },
  btnTl: { background:TL, color:WH, border:'none', borderRadius:5, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer' },
  tag: (bg) => ({ background:bg, color:WH, fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:99, display:'inline-block' }),
};

const genNutId = (prefix='n') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

// ─── SEMÁFORO DE MACROS ──────────────────────────────────────────────────────
const calcSemaforo = (actual, objetivo, tolerancia=0.15) => {
  if (!objetivo || objetivo <= 0) return 'verde';
  const ratio = actual / objetivo;
  if (ratio >= (1 - tolerancia) && ratio <= (1 + tolerancia)) return 'verde';
  if (ratio >= (1 - tolerancia*2) && ratio <= (1 + tolerancia*2)) return 'amarillo';
  return 'rojo';
};
const colorSem = { verde:GN, amarillo:AM, rojo:RJ };
const emojiSem = { verde:'🟢', amarillo:'🟡', rojo:'🔴' };

// ─── MACRO BAR ───────────────────────────────────────────────────────────────
const MacroBar = ({ label, actual, objetivo, color, unidad='g' }) => {
  const pct = objetivo > 0 ? Math.min(actual / objetivo * 100, 110) : 0;
  const sem = calcSemaforo(actual, objetivo);
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
        <span style={{ fontSize:10, color:G4 }}>{label}</span>
        <span style={{ fontSize:10, fontWeight:700, color:colorSem[sem] }}>
          {emojiSem[sem]} {actual}{unidad} / {objetivo}{unidad}
        </span>
      </div>
      <div style={{ background:G2, borderRadius:99, height:6, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(pct,100)}%`, background:colorSem[sem], height:'100%', borderRadius:99, transition:'width .3s' }}/>
      </div>
    </div>
  );
};

// ─── PANEL RESUMEN MACROS DÍA ────────────────────────────────────────────────
const ResumenDia = ({ totales, objetivoNut }) => {
  if (!objetivoNut) return null;
  const semCal = calcSemaforo(totales.calorias, objetivoNut.kcal);
  return (
    <div style={{ background:G1, borderRadius:7, padding:'10px 12px', border:`2px solid ${colorSem[semCal]}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:700 }}>Resumen del día</span>
        <span style={{ fontSize:16 }}>{emojiSem[semCal]}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:4, marginBottom:6 }}>
        <div style={{ textAlign:'center', background:WH, borderRadius:5, padding:'6px' }}>
          <div style={{ fontSize:9, color:G3 }}>CALORÍAS</div>
          <div style={{ fontSize:18, fontWeight:800, color:colorSem[semCal] }}>{totales.calorias}</div>
          <div style={{ fontSize:9, color:G3 }}>/ {objetivoNut.kcal} kcal</div>
        </div>
        <div style={{ textAlign:'center', background:WH, borderRadius:5, padding:'6px' }}>
          <div style={{ fontSize:9, color:G3 }}>PROTEÍNAS</div>
          <div style={{ fontSize:18, fontWeight:800, color:colorSem[calcSemaforo(totales.proteinas, objetivoNut.prot_g)] }}>{totales.proteinas}g</div>
          <div style={{ fontSize:9, color:G3 }}>/ {objetivoNut.prot_g}g</div>
        </div>
      </div>
      <MacroBar label="Carbohidratos" actual={totales.carbos}    objetivo={objetivoNut.carb_g} color={NV} />
      <MacroBar label="Grasas"        actual={totales.grasas}    objetivo={objetivoNut.gras_g} color={AM} />
      <MacroBar label="Fibra"         actual={totales.fibra}     objetivo={25}                 color={TL} />
    </div>
  );
};

export default function Nutricion({ clients, brand }) {
  // ── Estado principal ──────────────────────────────────────────────────────
  const [view, setView]     = useState('planes');    // planes | plan | alimentos | nuevo_cliente
  const [selClientId, setSelClientId] = useState('');
  const [planes, setPlanes] = useState([]);          // planes guardados en memoria
  const [planActivo, setPlanActivo] = useState(null);
  const [diaActivo, setDiaActivo]   = useState('Lunes');
  const [comidaActiva, setComidaActiva] = useState('desayuno');

  // Datos de alimentos (DB + personalizados)
  const [customAlimentos, setCustomAlimentos] = useState([]);
  const todosAlimentos = useMemo(() => [...DB_ALIMENTOS, ...customAlimentos], [customAlimentos]);

  // Estado picker de alimentos
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCat, setPickerCat] = useState('all');
  const [showNuevoAlimento, setShowNuevoAlimento] = useState(false);

  // Cliente activo
  const cliente = useMemo(() => clients.find(c => c.id === selClientId), [clients, selClientId]);

  // Objetivo nutricional calculado
  const objetivoNut = useMemo(() => {
    if (!planActivo?.perfil) return null;
    const { peso, talla, edad, sexo, actividad, objetivo_nut } = planActivo.perfil;
    if (!peso || !talla || !edad) return null;
    const tdee = calcularTDEE(parseFloat(peso), parseFloat(talla), parseInt(edad), sexo, actividad);
    return calcularObjetivo(tdee, objetivo_nut, parseFloat(peso));
  }, [planActivo?.perfil]);

  // Totales del día activo
  const totalesDia = useMemo(() => {
    if (!planActivo) return { proteinas:0, carbos:0, grasas:0, fibra:0, calorias:0 };
    const diaData = planActivo.semana[diaActivo] || {};
    const items = Object.values(diaData).flat();
    return sumarMacrosDia(items);
  }, [planActivo, diaActivo]);

  // ── Crear nuevo plan ──────────────────────────────────────────────────────
  const crearPlan = (nombre, perfil) => {
    const semana = {};
    DIAS_SEMANA.forEach(d => {
      semana[d] = {};
      COMIDAS.forEach(c => { semana[d][c.id] = []; });
    });
    const plan = { id: genNutId('pl'), nombre, clienteId: selClientId, perfil, semana, notas:'', fechaCreacion: new Date().toISOString().split('T')[0] };
    setPlanes(p => [...p, plan]);
    setPlanActivo(plan);
    setView('plan');
  };

  // ── Agregar alimento a comida ─────────────────────────────────────────────
  const agregarAlimento = useCallback((alimentoId, gramos) => {
    if (!planActivo) return;
    const item = { id: genNutId('it'), alimentoId, gramos: parseFloat(gramos) || 100 };
    setPlanActivo(p => {
      const newPlan = { ...p, semana: { ...p.semana, [diaActivo]: { ...p.semana[diaActivo], [comidaActiva]: [...(p.semana[diaActivo][comidaActiva]||[]), item] } } };
      setPlanes(ps => ps.map(pl => pl.id === p.id ? newPlan : pl));
      return newPlan;
    });
    setShowPicker(false);
  }, [planActivo, diaActivo, comidaActiva]);

  // ── Eliminar alimento ─────────────────────────────────────────────────────
  const eliminarAlimento = useCallback((itemId) => {
    setPlanActivo(p => {
      const newComida = (p.semana[diaActivo][comidaActiva]||[]).filter(i => i.id !== itemId);
      const newPlan = { ...p, semana: { ...p.semana, [diaActivo]: { ...p.semana[diaActivo], [comidaActiva]: newComida } } };
      setPlanes(ps => ps.map(pl => pl.id === p.id ? newPlan : pl));
      return newPlan;
    });
  }, [planActivo, diaActivo, comidaActiva]);

  // ── Actualizar gramos ─────────────────────────────────────────────────────
  const actualizarGramos = useCallback((itemId, gramos) => {
    setPlanActivo(p => {
      const newComida = (p.semana[diaActivo][comidaActiva]||[]).map(i => i.id===itemId ? {...i,gramos:parseFloat(gramos)||100} : i);
      const newPlan = { ...p, semana: { ...p.semana, [diaActivo]: { ...p.semana[diaActivo], [comidaActiva]: newComida } } };
      setPlanes(ps => ps.map(pl => pl.id === p.id ? newPlan : pl));
      return newPlan;
    });
  }, [planActivo, diaActivo, comidaActiva]);

  // ─── PDF EXPORT ────────────────────────────────────────────────────────────
  const exportarPDF = () => {
    if (!planActivo) return;
    const brandColor = brand?.colorPrimary || '#CC0000';
    const gymName = brand?.gymName || 'ACTIVA';
    const gymSub = brand?.gymSub || 'FITNESS CLUB';

    const macroColor = (actual, obj) => {
      const s = calcSemaforo(actual, obj);
      return s==='verde'?GN:s==='amarillo'?AM:RJ;
    };

    const diasHtml = DIAS_SEMANA.map(dia => {
      const diaData = planActivo.semana[dia] || {};
      const totDia = sumarMacrosDia(Object.values(diaData).flat());
      const semDia = calcSemaforo(totDia.calorias, objetivoNut?.kcal);
      const comidasHtml = COMIDAS.map(com => {
        const items = diaData[com.id] || [];
        if (items.length === 0) return `<tr><td style="padding:5px 10px;color:#aaa;font-style:italic;font-size:10px;" colspan="5">${com.emoji} ${com.label} — sin alimentos</td></tr>`;
        const itemsHtml = items.map((item, idx) => {
          const al = getAlimentoById(item.alimentoId);
          if (!al) return '';
          const m = calcularMacros(al, item.gramos);
          return `<tr style="background:${idx%2===0?'#fff':'#f9f9f9'}">
            ${idx===0?`<td rowspan="${items.length}" style="padding:5px 8px;font-size:10px;font-weight:700;background:#f0f4f8;vertical-align:middle;border-right:1px solid #e0e0e0;">${com.emoji} ${com.label}<br/><span style="font-size:8px;color:#888;">${com.hora}</span></td>`:''}
            <td style="padding:4px 8px;font-size:11px;">${al.nombre}</td>
            <td style="padding:4px 8px;font-size:10px;text-align:center;">${item.gramos}g</td>
            <td style="padding:4px 8px;font-size:10px;text-align:center;">${m.proteinas}g P / ${m.carbos}g C / ${m.grasas}g G</td>
            <td style="padding:4px 8px;font-size:10px;text-align:center;font-weight:700;">${m.calorias} kcal</td>
          </tr>`;
        }).join('');
        return itemsHtml;
      }).join('');

      return `
        <div style="page-break-inside:avoid;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:${BK};color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;border-left:4px solid ${brandColor}">
            <span style="font-weight:800;font-size:13px;">${dia}</span>
            <span style="font-size:11px;">${emojiSem[semDia]} ${totDia.calorias} kcal · ${totDia.proteinas}g Prot · ${totDia.carbos}g Carb · ${totDia.grasas}g Gras</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-top:none;">
            <thead><tr style="background:#f0f0f0">
              <th style="padding:5px 8px;font-size:9px;text-align:left;width:110px">Comida</th>
              <th style="padding:5px 8px;font-size:9px;text-align:left">Alimento</th>
              <th style="padding:5px 8px;font-size:9px;text-align:center;width:50px">Gramos</th>
              <th style="padding:5px 8px;font-size:9px;text-align:center;width:170px">Macros</th>
              <th style="padding:5px 8px;font-size:9px;text-align:center;width:70px">Calorías</th>
            </tr></thead>
            <tbody>${comidasHtml}</tbody>
          </table>
        </div>`;
    }).join('');

    const perfilHtml = objetivoNut ? `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
        ${[['Objetivo','font-weight:700;color:'+brandColor,objetivoNut.label],['Calorías','',''+objetivoNut.kcal+' kcal'],['Proteínas','',''+objetivoNut.prot_g+'g'],['Carbos','',''+objetivoNut.carb_g+'g / Grasas '+objetivoNut.gras_g+'g']].map(([t,st,v])=>`
          <div style="background:#f4f4f4;border-radius:5px;padding:8px;text-align:center">
            <div style="font-size:9px;color:#999;margin-bottom:3px">${t}</div>
            <div style="font-size:12px;${st}">${v}</div>
          </div>`).join('')}
      </div>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Plan Nutricional — ${planActivo.nombre}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:20px}
      @media print{body{padding:10px}@page{size:A4;margin:15mm}}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${brandColor};padding-bottom:12px;margin-bottom:16px">
        <div><div style="font-size:22px;font-weight:900;color:${brandColor};letter-spacing:2px">${gymName}</div>
          <div style="font-size:10px;color:#888;letter-spacing:4px">${gymSub}</div></div>
        <div style="text-align:right"><div style="font-size:16px;font-weight:800">Plan Nutricional</div>
          <div style="font-size:12px;color:#555;margin-top:2px">${planActivo.nombre}</div>
          <div style="font-size:10px;color:#888">Cliente: ${cliente?.nombre||'—'} ${cliente?.apellido||''} · ${planActivo.fechaCreacion}</div></div>
      </div>
      ${perfilHtml}
      ${diasHtml}
      ${planActivo.notas?`<div style="margin-top:14px;background:#f9f9f9;border-left:4px solid ${brandColor};padding:10px 14px;font-size:11px;color:#555"><strong>Notas:</strong> ${planActivo.notas}</div>`:''}
      <div style="margin-top:20px;font-size:9px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:8px">${gymName} · ${gymSub} · Plan generado: ${new Date().toLocaleDateString('es-ES')}</div>
      <script>window.onload=()=>window.print()<\/script>
    </body></html>`;

    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
  };

  // ─── NUEVO ALIMENTO FORM ──────────────────────────────────────────────────
  const NuevoAlimentoForm = () => {
    const [form, setF] = useState({ nombre:'', categoria:'proteina_animal', porcion_ref:100, proteinas:0, carbos:0, grasas:0, fibra:0, calorias:0, micro1_nombre:'', micro1_valor:'', micro1_unidad:'mg', micro2_nombre:'', micro2_valor:'', micro2_unidad:'mg' });
    const set = (k,v) => setF(f=>({...f,[k]:v}));
    const calAuto = Math.round(form.proteinas*4 + form.carbos*4 + form.grasas*9);
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'20px 14px'}}>
        <div style={{background:WH,borderRadius:10,padding:20,width:'100%',maxWidth:480,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
            <div style={{fontWeight:800,fontSize:14}}>➕ Nuevo alimento</div>
            <button onClick={()=>setShowNuevoAlimento(false)} style={ns.btnG}>✕</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            <div><span style={ns.lbl}>Nombre *</span><input value={form.nombre} onChange={e=>set('nombre',e.target.value)} style={ns.inp}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              <div><span style={ns.lbl}>Categoría</span>
                <select value={form.categoria} onChange={e=>set('categoria',e.target.value)} style={{...ns.sel,width:'100%'}}>
                  {Object.entries(CATEGORIAS_ALIMENTOS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div><span style={ns.lbl}>Porción ref. (g)</span><input type="number" value={form.porcion_ref} onChange={e=>set('porcion_ref',e.target.value)} style={ns.inp}/></div>
            </div>
            <div style={{background:G1,borderRadius:6,padding:'10px'}}>
              <div style={{fontSize:10,fontWeight:700,color:G4,marginBottom:6}}>Macros por 100g</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
                {[['proteinas','Proteínas (g)'],['carbos','Carbos (g)'],['grasas','Grasas (g)'],['fibra','Fibra (g)']].map(([k,lbl])=>(
                  <div key={k}><span style={ns.lbl}>{lbl}</span><input type="number" value={form[k]} onChange={e=>set(k,parseFloat(e.target.value)||0)} style={ns.inp}/></div>
                ))}
              </div>
              <div style={{marginTop:6}}>
                <span style={ns.lbl}>Calorías (kcal/100g)</span>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input type="number" value={form.calorias} onChange={e=>set('calorias',parseFloat(e.target.value)||0)} style={{...ns.inp,flex:1}}/>
                  <button onClick={()=>set('calorias',calAuto)} style={{...ns.btnG,fontSize:10,whiteSpace:'nowrap'}}>Auto ({calAuto})</button>
                </div>
              </div>
            </div>
            <div style={{background:G1,borderRadius:6,padding:'10px'}}>
              <div style={{fontSize:10,fontWeight:700,color:G4,marginBottom:6}}>Micronutrientes (opcional)</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:5,marginBottom:5}}>
                <div><span style={ns.lbl}>Micro 1 nombre</span><input value={form.micro1_nombre} onChange={e=>set('micro1_nombre',e.target.value)} placeholder="Ej: Vitamina C" style={ns.inp}/></div>
                <div><span style={ns.lbl}>Valor</span><input type="number" value={form.micro1_valor} onChange={e=>set('micro1_valor',e.target.value)} style={ns.inp}/></div>
                <div><span style={ns.lbl}>Unidad</span><input value={form.micro1_unidad} onChange={e=>set('micro1_unidad',e.target.value)} placeholder="mg" style={ns.inp}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:5}}>
                <div><span style={ns.lbl}>Micro 2 nombre</span><input value={form.micro2_nombre} onChange={e=>set('micro2_nombre',e.target.value)} placeholder="Ej: Hierro" style={ns.inp}/></div>
                <div><span style={ns.lbl}>Valor</span><input type="number" value={form.micro2_valor} onChange={e=>set('micro2_valor',e.target.value)} style={ns.inp}/></div>
                <div><span style={ns.lbl}>Unidad</span><input value={form.micro2_unidad} onChange={e=>set('micro2_unidad',e.target.value)} placeholder="mg" style={ns.inp}/></div>
              </div>
            </div>
          </div>
          <button onClick={()=>{
            if(!form.nombre.trim())return;
            setCustomAlimentos(p=>[...p,{...form,id:'ca_'+genNutId(),micro1:{nombre:form.micro1_nombre,valor:parseFloat(form.micro1_valor)||0,unidad:form.micro1_unidad},micro2:{nombre:form.micro2_nombre,valor:parseFloat(form.micro2_valor)||0,unidad:form.micro2_unidad},custom:true}]);
            setShowNuevoAlimento(false);
          }} disabled={!form.nombre.trim()} style={{...ns.btnR,width:'100%',padding:'9px',marginTop:10}}>Guardar alimento</button>
        </div>
      </div>
    );
  };

  // ─── PICKER DE ALIMENTOS ──────────────────────────────────────────────────
  const PickerAlimentos = () => {
    const [localSearch, setLocalSearch] = useState(pickerSearch);
    const [localCat, setLocalCat] = useState(pickerCat);
    const [gramos, setGramos] = useState('');
    const [selAl, setSelAl] = useState(null);
    const filtered = useMemo(() => todosAlimentos.filter(a =>
      (localCat === 'all' || a.categoria === localCat) &&
      (!localSearch || a.nombre.toLowerCase().includes(localSearch.toLowerCase()))
    ), [localSearch, localCat]);
    const preview = selAl && gramos ? calcularMacros(selAl, parseFloat(gramos)||100) : null;
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'20px 14px'}}>
        <div style={{background:WH,borderRadius:10,width:'100%',maxWidth:520,marginBottom:20}}>
          <div style={{background:BK,borderRadius:'10px 10px 0 0',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{color:WH,fontWeight:800,fontSize:13}}>🥗 Agregar alimento — {COMIDAS.find(c=>c.id===comidaActiva)?.label}</div>
            <button onClick={()=>setShowPicker(false)} style={{...ns.btnG,background:'transparent',color:WH,border:'1px solid #555'}}>✕</button>
          </div>
          <div style={{padding:'12px 14px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6,marginBottom:8}}>
              <input value={localSearch} onChange={e=>setLocalSearch(e.target.value)} placeholder="Buscar alimento..." style={ns.inp}/>
              <select value={localCat} onChange={e=>setLocalCat(e.target.value)} style={ns.sel}>
                <option value="all">Todas las categorías</option>
                {Object.entries(CATEGORIAS_ALIMENTOS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div style={{maxHeight:'38vh',overflowY:'auto',marginBottom:10}}>
              {filtered.map(al => {
                const cat = CATEGORIAS_ALIMENTOS[al.categoria];
                return (
                  <div key={al.id} onClick={()=>setSelAl(al===selAl?null:al)}
                    style={{padding:'7px 10px',borderBottom:`1px solid ${G2}`,cursor:'pointer',background:selAl?.id===al.id?'#EFF6FF':WH,borderLeft:selAl?.id===al.id?`3px solid ${TL}`:'3px solid transparent'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <span style={{fontSize:11,fontWeight:600}}>{al.nombre}</span>
                        {al.custom&&<span style={{...ns.tag('#7C3AED'),marginLeft:5,fontSize:7}}>CUSTOM</span>}
                        <div style={{fontSize:9,color:G3,marginTop:1}}>{cat?.emoji} {cat?.label} · por 100g: P {al.proteinas}g · C {al.carbos}g · G {al.grasas}g · {al.calorias} kcal</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0&&<div style={{textAlign:'center',padding:20,color:G3,fontSize:12}}>Sin resultados</div>}
            </div>
            {selAl&&(
              <div style={{background:G1,borderRadius:7,padding:'10px',marginBottom:10,border:`1px solid ${TL}`}}>
                <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>{selAl.nombre}</div>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                  <span style={ns.lbl}>Cantidad (gramos):</span>
                  <input type="number" value={gramos} onChange={e=>setGramos(e.target.value)}
                    placeholder={`Ref: ${selAl.porcion_ref}g`} min="1" max="1000"
                    style={{...ns.inp,width:100}}/>
                  <button onClick={()=>setGramos(String(selAl.porcion_ref))} style={{...ns.btnG,fontSize:10,whiteSpace:'nowrap'}}>Porción ref.</button>
                </div>
                {preview&&<div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:10,color:G4}}>
                  <span>P: <strong>{preview.proteinas}g</strong></span>
                  <span>C: <strong>{preview.carbos}g</strong></span>
                  <span>G: <strong>{preview.grasas}g</strong></span>
                  <span>F: <strong>{preview.fibra}g</strong></span>
                  <span style={{fontWeight:700,color:NV}}>🔥 {preview.calorias} kcal</span>
                </div>}
                {selAl.micro1?.nombre&&<div style={{fontSize:9,color:G3,marginTop:3}}>{selAl.micro1.nombre}: {preview?Math.round(selAl.micro1.valor*(parseFloat(gramos)||100)/100*10)/10:selAl.micro1.valor}{selAl.micro1.unidad} · {selAl.micro2?.nombre}: {preview?Math.round(selAl.micro2.valor*(parseFloat(gramos)||100)/100*10)/10:selAl.micro2.valor}{selAl.micro2?.unidad}</div>}
              </div>
            )}
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowNuevoAlimento(true)} style={{...ns.btnG,flex:1,fontSize:10}}>➕ Nuevo alimento</button>
              <button onClick={()=>{if(selAl)agregarAlimento(selAl.id,parseFloat(gramos)||selAl.porcion_ref);}} disabled={!selAl} style={{...ns.btnTl,flex:2,opacity:!selAl?.5:1}}>Agregar al menú</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── FORMULARIO NUEVO PLAN ────────────────────────────────────────────────
  const NuevoPlanForm = () => {
    const [nombre, setNombre] = useState(cliente?`Plan ${cliente.nombre} ${new Date().toLocaleDateString('es-ES')}`:'');
    const [perfil, setPerfil] = useState({
      peso:'', talla:'', edad:'', sexo:'M',
      actividad: cliente?.screening?.actividad||'moderado',
      objetivo_nut: cliente?.objetivo?.toLowerCase().includes('grasa')||cliente?.objetivo?.toLowerCase().includes('bajar')?'perdida_leve':
                   cliente?.objetivo?.toLowerCase().includes('masa')||cliente?.objetivo?.toLowerCase().includes('volumen')?'hipertrofia':'mantenimiento',
    });
    const set = (k,v) => setPerfil(p=>({...p,[k]:v}));
    const tdee = perfil.peso&&perfil.talla&&perfil.edad ? calcularTDEE(parseFloat(perfil.peso),parseFloat(perfil.talla),parseInt(perfil.edad),perfil.sexo,perfil.actividad) : null;
    const obj = tdee ? calcularObjetivo(tdee, perfil.objetivo_nut, parseFloat(perfil.peso)) : null;
    return (
      <div style={{...ns.card,border:`2px solid ${TL}`}}>
        <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>📋 Configurar nuevo plan nutricional</div>
        <div style={{marginBottom:8}}><span style={ns.lbl}>Nombre del plan *</span><input value={nombre} onChange={e=>setNombre(e.target.value)} style={ns.inp}/></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
          <div><span style={ns.lbl}>Peso corporal (kg) *</span><input type="number" value={perfil.peso} onChange={e=>set('peso',e.target.value)} style={ns.inp}/></div>
          <div><span style={ns.lbl}>Talla (cm) *</span><input type="number" value={perfil.talla} onChange={e=>set('talla',e.target.value)} style={ns.inp}/></div>
          <div><span style={ns.lbl}>Edad (años) *</span><input type="number" value={perfil.edad} onChange={e=>set('edad',e.target.value)} style={ns.inp}/></div>
          <div><span style={ns.lbl}>Sexo</span>
            <select value={perfil.sexo} onChange={e=>set('sexo',e.target.value)} style={{...ns.sel,width:'100%'}}>
              <option value="M">Masculino</option><option value="F">Femenino</option>
            </select>
          </div>
          <div><span style={ns.lbl}>Nivel de actividad</span>
            <select value={perfil.actividad} onChange={e=>set('actividad',e.target.value)} style={{...ns.sel,width:'100%'}}>
              <option value="sedentario">Sedentario (×1.40)</option>
              <option value="moderado">Moderado (×1.55)</option>
              <option value="activo">Activo 4×/sem (×1.65)</option>
              <option value="muy_activo">Muy activo (×1.75)</option>
            </select>
          </div>
          <div><span style={ns.lbl}>Objetivo nutricional</span>
            <select value={perfil.objetivo_nut} onChange={e=>set('objetivo_nut',e.target.value)} style={{...ns.sel,width:'100%'}}>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="hipertrofia">Hipertrofia (+300 kcal)</option>
              <option value="perdida_leve">Pérdida leve (-300 kcal)</option>
              <option value="perdida_moderada">Pérdida moderada (-500 kcal)</option>
              <option value="recomposicion">Recomposición (-200 kcal)</option>
            </select>
          </div>
        </div>
        {obj&&(
          <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'10px 14px',marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:NV,marginBottom:4}}>📊 Resultado Mifflin-St Jeor</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11}}>
              <span>TDEE: <strong>{tdee} kcal</strong></span>
              <span style={{color:obj.color}}>Objetivo: <strong>{obj.kcal} kcal</strong> ({obj.label})</span>
              <span>Proteínas: <strong>{obj.prot_g}g</strong></span>
              <span>Carbos: <strong>{obj.carb_g}g</strong></span>
              <span>Grasas: <strong>{obj.gras_g}g</strong></span>
            </div>
          </div>
        )}
        <button onClick={()=>{if(nombre&&perfil.peso&&perfil.talla&&perfil.edad)crearPlan(nombre,perfil);}}
          disabled={!nombre||!perfil.peso||!perfil.talla||!perfil.edad}
          style={{...ns.btnTl,width:'100%',padding:'9px',opacity:(!nombre||!perfil.peso||!perfil.talla||!perfil.edad)?.4:1}}>
          Crear plan y abrir constructor →
        </button>
      </div>
    );
  };

  // ─── VISTA: LISTA DE PLANES ────────────────────────────────────────────────
  const VistaPlanes = () => (
    <div style={{padding:'12px 14px'}}>
      <div style={{background:BK,borderRadius:10,padding:'14px 16px',marginBottom:12,borderLeft:`3px solid ${TL}`}}>
        <div style={{fontSize:14,fontWeight:800,color:WH}}>🥗 Planes Nutricionales</div>
        <div style={{fontSize:11,color:G3}}>Fórmula Mifflin-St Jeor · 7 días · 5 comidas · {todosAlimentos.length} alimentos</div>
      </div>
      <div style={{...ns.card,marginBottom:12}}>
        <span style={ns.lbl}>Cliente</span>
        <select value={selClientId} onChange={e=>{setSelClientId(e.target.value);setPlanActivo(null);}} style={{...ns.sel,width:'100%'}}>
          <option value="">— Seleccionar cliente —</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
        </select>
      </div>
      {selClientId&&(
        <>
          {planes.filter(p=>p.clienteId===selClientId).length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Planes del cliente ({planes.filter(p=>p.clienteId===selClientId).length})</div>
              {planes.filter(p=>p.clienteId===selClientId).map(plan=>(
                <div key={plan.id} style={{...ns.card,display:'flex',justifyContent:'space-between',alignItems:'center',borderLeft:`3px solid ${TL}`}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700}}>{plan.nombre}</div>
                    <div style={{fontSize:10,color:G3}}>Creado: {plan.fechaCreacion}</div>
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>{setPlanActivo(plan);setView('plan');}} style={{...ns.btnTl,fontSize:10}}>Abrir</button>
                    <button onClick={()=>setPlanes(p=>p.filter(pl=>pl.id!==plan.id))} style={{...ns.btnG,fontSize:10,color:RJ,borderColor:RJ}}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <NuevoPlanForm/>
        </>
      )}
    </div>
  );

  // ─── VISTA: CONSTRUCTOR DEL PLAN ──────────────────────────────────────────
  const VistaConstructor = () => {
    if (!planActivo) return <div style={{padding:28,textAlign:'center',color:G3}}>No hay plan activo</div>;
    const comidaData = planActivo.semana[diaActivo]?.[comidaActiva] || [];
    const totalesComida = sumarMacrosDia(comidaData);

    return (
      <div style={{padding:'12px 14px'}}>
        {/* Header plan */}
        <div style={{background:BK,borderRadius:10,padding:'12px 16px',marginBottom:10,borderLeft:`3px solid ${TL}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:6}}>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:WH}}>{planActivo.nombre}</div>
              <div style={{fontSize:10,color:G3}}>{cliente?.nombre} {cliente?.apellido}</div>
            </div>
            <div style={{display:'flex',gap:5}}>
              <button onClick={exportarPDF} style={{...ns.btnR,fontSize:10,background:brand?.colorPrimary||R}}>📄 Exportar PDF</button>
              <button onClick={()=>setView('planes')} style={{...ns.btnG,fontSize:10}}>← Volver</button>
            </div>
          </div>
          {objetivoNut&&(
            <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8,fontSize:10}}>
              {[['🎯',objetivoNut.label,objetivoNut.color],['🔥',`${objetivoNut.kcal} kcal`,'#fff'],['💪',`P ${objetivoNut.prot_g}g`,'#fff'],['🌾',`C ${objetivoNut.carb_g}g`,'#fff'],['🥑',`G ${objetivoNut.gras_g}g`,'#fff']].map(([e,v,c])=>(
                <span key={v} style={{color:c,fontWeight:700}}>{e} {v}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:10}}>
          {/* Navegación días */}
          <div style={{display:'flex',flexDirection:'column',gap:3,minWidth:88}}>
            {DIAS_SEMANA.map(dia=>{
              const totDia = sumarMacrosDia(Object.values(planActivo.semana[dia]||{}).flat());
              const semDia = calcSemaforo(totDia.calorias, objetivoNut?.kcal);
              return(
                <div key={dia} onClick={()=>setDiaActivo(dia)} style={{cursor:'pointer',padding:'6px 8px',borderRadius:6,background:dia===diaActivo?BK:WH,border:`1px solid ${dia===diaActivo?TL:G2}`,transition:'all .15s'}}>
                  <div style={{fontSize:10,fontWeight:dia===diaActivo?700:400,color:dia===diaActivo?WH:G4,lineHeight:1.2}}>{dia.slice(0,3)}</div>
                  <div style={{fontSize:9,color:dia===diaActivo?G3:'#aaa'}}>{emojiSem[semDia]} {totDia.calorias>0?totDia.calorias+'k':'-'}</div>
                </div>
              );
            })}
          </div>

          {/* Panel central */}
          <div>
            {/* Selector de comidas */}
            <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
              {COMIDAS.map(com=>{
                const items = planActivo.semana[diaActivo]?.[com.id]||[];
                const tot = sumarMacrosDia(items);
                const isActive = com.id===comidaActiva;
                return(
                  <div key={com.id} onClick={()=>setComidaActiva(com.id)} style={{cursor:'pointer',flex:1,padding:'6px 6px',borderRadius:6,border:`1px solid ${isActive?TL:G2}`,background:isActive?'#EFF6FF':WH,textAlign:'center',minWidth:70}}>
                    <div style={{fontSize:14}}>{com.emoji}</div>
                    <div style={{fontSize:9,fontWeight:isActive?700:400,color:isActive?NV:G4,lineHeight:1.2}}>{com.label}</div>
                    <div style={{fontSize:8,color:G3}}>{tot.calorias>0?tot.calorias+' kcal':'—'}</div>
                  </div>
                );
              })}
            </div>

            {/* Alimentos de la comida activa */}
            <div style={{...ns.card}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700}}>{COMIDAS.find(c=>c.id===comidaActiva)?.emoji} {COMIDAS.find(c=>c.id===comidaActiva)?.label} — {diaActivo}</div>
                <button onClick={()=>setShowPicker(true)} style={{...ns.btnTl,fontSize:10}}>+ Agregar</button>
              </div>
              {comidaData.length===0&&<div style={{textAlign:'center',padding:16,color:G3,fontSize:11,borderStyle:'dashed',border:`1px dashed ${G2}`,borderRadius:6}}>Sin alimentos. Tocá "+ Agregar" para comenzar.</div>}
              {comidaData.map((item,i)=>{
                const al = getAlimentoById(item.alimentoId);
                if (!al) return null;
                const m = calcularMacros(al, item.gramos);
                const cat = CATEGORIAS_ALIMENTOS[al.categoria];
                return(
                  <div key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 8px',background:i%2===0?WH:G1,borderRadius:5,marginBottom:3,border:`1px solid ${G2}`}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:600}}>{cat?.emoji} {al.nombre}</div>
                      <div style={{fontSize:9,color:G3,display:'flex',gap:8,flexWrap:'wrap',marginTop:1}}>
                        <span>P: <strong>{m.proteinas}g</strong></span><span>C: <strong>{m.carbos}g</strong></span><span>G: <strong>{m.grasas}g</strong></span>
                        <span style={{color:NV,fontWeight:700}}>🔥 {m.calorias} kcal</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:4,alignItems:'center'}}>
                      <input type="number" value={item.gramos} onChange={e=>actualizarGramos(item.id,e.target.value)}
                        style={{...ns.inp,width:55,textAlign:'center'}} min="1" max="1000"/>
                      <span style={{fontSize:9,color:G3}}>g</span>
                      <button onClick={()=>eliminarAlimento(item.id)} style={{...ns.btnG,color:RJ,borderColor:RJ,padding:'3px 6px',fontSize:12}}>×</button>
                    </div>
                  </div>
                );
              })}
              {comidaData.length>0&&(
                <div style={{marginTop:6,background:G1,borderRadius:5,padding:'6px 8px',display:'flex',gap:12,flexWrap:'wrap',fontSize:10}}>
                  <span style={{fontWeight:700}}>Total comida:</span>
                  <span>P: <strong>{totalesComida.proteinas}g</strong></span><span>C: <strong>{totalesComida.carbos}g</strong></span><span>G: <strong>{totalesComida.grasas}g</strong></span>
                  <span style={{color:NV,fontWeight:700}}>🔥 {totalesComida.calorias} kcal</span>
                </div>
              )}
            </div>

            {/* Resumen del día */}
            <ResumenDia totales={totalesDia} objetivoNut={objetivoNut}/>

            {/* Notas del plan */}
            <div style={{...ns.card}}>
              <span style={ns.lbl}>Notas del plan</span>
              <textarea value={planActivo.notas||''} onChange={e=>{const n={...planActivo,notas:e.target.value};setPlanActivo(n);setPlanes(p=>p.map(pl=>pl.id===n.id?n:pl));}}
                rows={2} style={{...ns.inp,resize:'vertical'}} placeholder="Instrucciones, restricciones, preferencias del cliente..."/>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── VISTA: BASE DE ALIMENTOS ─────────────────────────────────────────────
  const VistaAlimentos = () => {
    const [search, setSearch] = useState('');
    const [cat, setCat] = useState('all');
    const filtered = todosAlimentos.filter(a =>
      (cat==='all'||a.categoria===cat) &&
      (!search||a.nombre.toLowerCase().includes(search.toLowerCase()))
    );
    return(
      <div style={{padding:'12px 14px'}}>
        <div style={{background:BK,borderRadius:10,padding:'14px 16px',marginBottom:12,borderLeft:`3px solid ${TL}`}}>
          <div style={{fontSize:14,fontWeight:800,color:WH}}>📚 Base de alimentos</div>
          <div style={{fontSize:11,color:G3}}>{todosAlimentos.length} alimentos · Uruguay y región</div>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...ns.inp,flex:1,minWidth:150}}/>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={ns.sel}>
            <option value="all">Todas las categorías ({todosAlimentos.length})</option>
            {Object.entries(CATEGORIAS_ALIMENTOS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label} ({todosAlimentos.filter(a=>a.categoria===k).length})</option>)}
          </select>
          <button onClick={()=>setShowNuevoAlimento(true)} style={ns.btnTl}>➕ Nuevo</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
            <thead>
              <tr style={{background:BK,color:WH}}>
                {['Alimento','Categoría','P (g)','C (g)','G (g)','F (g)','Kcal','Micro 1','Micro 2'].map(h=>(
                  <th key={h} style={{padding:'7px 8px',textAlign:'left',fontSize:9,textTransform:'uppercase',letterSpacing:'.04em',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((al,i)=>{
                const cat2=CATEGORIAS_ALIMENTOS[al.categoria];
                return(
                  <tr key={al.id} style={{background:i%2===0?WH:G1,borderBottom:`1px solid ${G2}`}}>
                    <td style={{padding:'5px 8px',fontWeight:600,maxWidth:200}}>{al.nombre} {al.custom&&<span style={{...ns.tag('#7C3AED'),fontSize:7}}>CUSTOM</span>}</td>
                    <td style={{padding:'5px 8px',whiteSpace:'nowrap'}}><span style={ns.tag(cat2?.color||G4)}>{cat2?.emoji} {cat2?.label}</span></td>
                    <td style={{padding:'5px 8px',color:'#CC0000',fontWeight:700}}>{al.proteinas}</td>
                    <td style={{padding:'5px 8px',color:'#7C3AED',fontWeight:700}}>{al.carbos}</td>
                    <td style={{padding:'5px 8px',color:AM,fontWeight:700}}>{al.grasas}</td>
                    <td style={{padding:'5px 8px',color:TL}}>{al.fibra}</td>
                    <td style={{padding:'5px 8px',fontWeight:700,color:NV}}>{al.calorias}</td>
                    <td style={{padding:'5px 8px',color:G4,fontSize:9}}>{al.micro1?.nombre&&`${al.micro1.nombre}: ${al.micro1.valor}${al.micro1.unidad}`}</td>
                    <td style={{padding:'5px 8px',color:G4,fontSize:9}}>{al.micro2?.nombre&&`${al.micro2.nombre}: ${al.micro2.valor}${al.micro2.unidad}`}</td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:24,color:G3}}>Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────
  return(
    <div style={{minHeight:'100vh',background:G1}}>
      {showPicker && <PickerAlimentos/>}
      {showNuevoAlimento && <NuevoAlimentoForm/>}
      {/* Sub-tabs */}
      <div style={{display:'flex',borderBottom:`2px solid ${G2}`,background:WH,overflowX:'auto'}}>
        {[['planes','📋 Planes'],['plan','🏗️ Constructor'],['alimentos','📚 Alimentos']].map(([v,lbl])=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:'9px 14px',border:'none',background:'none',fontWeight:view===v?700:400,fontSize:11,color:view===v?TL:G4,borderBottom:view===v?`2px solid ${TL}`:'2px solid transparent',cursor:'pointer',whiteSpace:'nowrap',marginBottom:-2}}>
            {lbl}
          </button>
        ))}
      </div>
      {view==='planes'    && VistaPlanes()}
      {view==='plan'      && VistaConstructor()}
      {view==='alimentos' && VistaAlimentos()}
    </div>
  );
}
