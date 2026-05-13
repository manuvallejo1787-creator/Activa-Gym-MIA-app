import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import FisioActiva from "./FisioActiva.jsx";
import { FASES_METODO, generarCriteriosPersonalizados, checkCriteriosAvance, getSemaforoPorFase } from "./criterios.js";
import { useGymClients, genId } from "./db.js";

// ─── PALETA ────────────────────────────────────────────────────────────────
const R='#CC0000', BK='#1a1a1a', WH='#FFFFFF';
const G1='#F4F4F4', G2='#E0E0E0', G3='#999999', G4='#555555';

// ─── SEMÁFORO ───────────────────────────────────────────────────────────────
const SF={
  pendiente:{emoji:'⏳',label:'PENDIENTE', color:'#6B7280',bg:'#F9FAFB',border:'#D1D5DB',desc:'Evaluación no completada'},
  verde:    {emoji:'🟢',label:'VERDE',    color:'#16A34A',bg:'#F0FDF4',border:'#86EFAC',desc:'Sin restricciones'},
  amarillo: {emoji:'🟡',label:'AMARILLO', color:'#D97706',bg:'#FFFBEB',border:'#FCD34D',desc:'Restricciones activas'},
  rojo:     {emoji:'🔴',label:'ROJO',     color:'#CC0000',bg:'#FEF2F2',border:'#FCA5A5',desc:'Solo fisioterapia'},
};

// ─── CONTINUUM ──────────────────────────────────────────────────────────────
const NIVEL={
  restaura:{label:'RESTAURA',badge:'N0',color:'#374151',desc:'Rehabilitación'},
  activa:  {label:'ACTIVA',  badge:'N1',color:'#1D4ED8',desc:'Base de movimiento'},
  potencia:{label:'POTENCIA',badge:'N2',color:'#7C3AED',desc:'Desarrollo de capacidades'},
  rinde:   {label:'RINDE',   badge:'N3',color:'#CC0000',desc:'Alto rendimiento'},
};

// ─── OBJETIVOS (mapeados al continuum) ──────────────────────────────────────
const OBJS={
  restaura:{label:'RESTAURA · N0',icon:'⬛',desc:'Rehabilitación funcional',nivelKey:'restaura',
    blocks:['movilidad','prev_rehab','propiocepcion','activacion','flex_recovery']},
  activa:  {label:'ACTIVA · N1',icon:'◈',desc:'Base de movimiento',nivelKey:'activa',
    blocks:['movilidad','activacion','fuerza','accesorios','cardio']},
  potencia:{label:'POTENCIA · N2',icon:'◆',desc:'Desarrollo de capacidades',nivelKey:'potencia',
    blocks:['activacion','fuerza','accesorios','cardio','flex_recovery']},
  rinde:   {label:'RINDE · N3',icon:'◐',desc:'Potencia y rendimiento',nivelKey:'rinde',
    blocks:['movilidad','activacion','potencia','fuerza','funcional','propiocepcion']},
};

// ─── BLOQUES ────────────────────────────────────────────────────────────────
const BLOCKS={
  movilidad:    {label:'Movilidad',         pos:[1],         tag:'MOV',color:'#1a1a1a'},
  activacion:   {label:'Activación',        pos:[1,2],       tag:'ACT',color:'#CC0000'},
  zona_media:   {label:'Zona Media',        pos:[2,3,5,6,7], tag:'ZM', color:'#7a0000'},
  prev_rehab:   {label:'Prev/Rehab',        pos:[2,3,5,6,7], tag:'PR', color:'#374151'},
  potencia:     {label:'Potencia/Plio.',    pos:[3,4],       tag:'POT',color:'#111111'},
  fuerza:       {label:'Fuerza',            pos:[3,4],       tag:'FZA',color:'#CC0000'},
  accesorios:   {label:'Accesorios',        pos:[3,4,5],     tag:'ACC',color:'#4B5563'},
  cardio:       {label:'Cardio',            pos:[5,6,7],     tag:'CAR',color:'#990000'},
  flex_recovery:{label:'Flex/Recovery',     pos:[2,5,6,7],   tag:'FLX',color:'#1F2937'},
  propiocepcion:{label:'Propiocepción',     pos:[2,3,4,5,6,7],tag:'PRO',color:'#7a0000'},
  funcional:    {label:'Funcional Integr.', pos:[2,3,4,5,6,7],tag:'FUN',color:'#374151'},
};

// ─── RESTRICCIÓN × BLOQUE/PATRÓN ────────────────────────────────────────────
// Retorna null (libre) | 'warn' | 'block'
function checkRestriction(ex, client){
  if(!client || client.semaforo==='pendiente') return null;
  if(client.semaforo==='rojo') return 'block';
  if(client.semaforo!=='amarillo') return null;
  const r=client.restricciones_flags||{};
  if(r.impacto && ex.bloque==='potencia') return 'block';
  if(r.impacto && (ex.patron||'').toLowerCase().includes('salto')) return 'block';
  if(r.impacto && (ex.patron||'').toLowerCase().includes('pliométr')) return 'block';
  if(r.overhead && ((ex.patron||'').toLowerCase().includes('overhead')||
     (ex.patron||'').toLowerCase().includes('vertical')||
     (ex.patron||'').toLowerCase().includes('empuje v'))) return 'warn';
  if(r.cargaAxial && ex.bloque==='fuerza' &&
     ((ex.patron||'').toLowerCase().includes('bilateral')||
      (ex.patron||'').toLowerCase().includes('bisagra'))) return 'warn';
  if(r.cargaAxial && (ex.nombre||'').toLowerCase().includes('sentadilla')) return 'warn';
  if(r.cargaAxial && (ex.nombre||'').toLowerCase().includes('peso muerto')) return 'warn';
  return null;
}

const NIVEL_COLOR={Principiante:'#16A34A',Intermedio:'#D97706',Avanzado:'#CC0000'};

// ─── LOGO ───────────────────────────────────────────────────────────────────
const DefaultLogo=({h=40,gymName='ACTIVA',gymSub='FITNESS CLUB'})=>(
  <svg height={h} viewBox="0 0 240 54" fill="none">
    <ellipse cx="27" cy="36" rx="14" ry="13" fill={BK} stroke={R} strokeWidth="1.5"/>
    <path d="M17 24 Q27 10 37 24" stroke={BK} strokeWidth="5" fill="none" strokeLinecap="round"/>
    <path d="M17 24 Q27 11 37 24" stroke={R} strokeWidth="2" fill="none" strokeLinecap="round"/>
    <rect x="20" y="30" width="8" height="3" rx="1" fill={R} opacity=".85" transform="rotate(-12 20 30)"/>
    <rect x="28" y="38" width="5" height="2" rx="1" fill={R} opacity=".7" transform="rotate(8 28 38)"/>
    <circle cx="23" cy="40" r="2" fill={R} opacity=".6"/>
    <circle cx="32" cy="33" r="1.5" fill={R} opacity=".5"/>
    <text x="52" y="30" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize="22" fill={R} letterSpacing="2">{gymName}</text>
    <text x="53" y="46" fontFamily="Arial,sans-serif" fontWeight="400" fontSize="11" fill={WH} letterSpacing="3.5">{gymSub}</text>
    <rect x="52" y="33" width="178" height="2" fill={R} opacity=".2" rx="1"/>
  </svg>
);


// ─── BASE DE REHABILITACIÓN ──────────────────────────────────────────────────
const REGIONES={
  cervical:    {label:'Columna Cervical',   icon:'🔵', color:'#1D4ED8'},
  hombro:      {label:'Hombro',             icon:'🟣', color:'#7C3AED'},
  codo:        {label:'Codo',               icon:'🟤', color:'#92400E'},
  muneca:      {label:'Muñeca y Mano',      icon:'🟡', color:'#D97706'},
  esc:         {label:'Cintura Escapular',  icon:'⚫', color:'#374151'},
  dorsal:      {label:'Columna Dorsal',     icon:'🔶', color:'#B45309'},
  lumbar:      {label:'Columna Lumbar',     icon:'🔴', color:'#CC0000'},
  cadera:      {label:'Cadera',             icon:'🟢', color:'#16A34A'},
  rodilla:     {label:'Rodilla',            icon:'🔷', color:'#0284C7'},
  tobillo:     {label:'Tobillo y Pie',      icon:'🟠', color:'#EA580C'},
};

const FASES_REHAB={
  aguda:    {label:'Fase Aguda',    sub:'0–72 h / Dolor activo',    color:'#CC0000', bg:'#FEF2F2', border:'#FCA5A5'},
  subaguda: {label:'Fase Subaguda', sub:'3 días – 6 semanas',       color:'#D97706', bg:'#FFFBEB', border:'#FCD34D'},
  cronica:  {label:'Fase Crónica / Funcional', sub:'6+ semanas / Retorno actividad', color:'#16A34A', bg:'#F0FDF4', border:'#86EFAC'},
};

const TEJIDOS_BASE={
  fractura:{
    label:'Fractura', icon:'🦴',
    criterios:'Inmovilización según consolidación. Progresión guiada por imagen + clínica.',
    fases:{
      aguda:   {titulo:'Fase de inmovilización (0–6 sem)',   criterios:'Sin carga. Movilización articulaciones adyacentes. Control del edema y dolor.',
        ejercicios:['Isométricos musculatura periarticular','Movilización activa articulaciones no comprometidas','Elevación y crioterapia','Respiración diafragmática y relajación']},
      subaguda:{titulo:'Fase de movilización (6–12 sem)',    criterios:'Carga progresiva según tolerancia. Movilidad articular activa-asistida.',
        ejercicios:['Movilización activo-asistida de la articulación','Fortalecimiento isométrico progresivo','Propiocepción sin carga completa','Hidroterapia si disponible']},
      cronica: {titulo:'Fase de fortalecimiento (12+ sem)',  criterios:'Carga total tolerada. Retorno funcional progresivo.',
        ejercicios:['Fortalecimiento isotónico progresivo','Ejercicios de cadena cinética cerrada','Propiocepción y equilibrio','Actividades funcionales específicas']},
    },
    precauciones:'Nunca forzar el rango articular. Respetar criterios radiológicos de consolidación. Dolor >4/10 = detener.',
  },
  tendinosa:{
    label:'Lesión Tendinosa', icon:'🧵',
    criterios:'Carga excéntrica como base. Respetar el continuum tendinoso (reactivo → disreparación → degenerativo).',
    fases:{
      aguda:   {titulo:'Control de carga (sem 1–2)',         criterios:'Reducir carga irritante. Isométricos para analgesia.',
        ejercicios:['Isométricos sostenidos 30–45 seg (5×/día)','Crioterapia post-actividad','Descarga relativa del tendón','Control postural para reducir tensión']},
      subaguda:{titulo:'Carga isotónica lenta (sem 3–8)',    criterios:'Excéntrico + concéntrico lentos. Sin rebote. Sin dolor >3/10.',
        ejercicios:['Excéntrico lento 3×15 (ritmo 3-3-3)','Fortalecimiento proximal (glúteo/manguito según región)','Ejercicios en cadena cinética cerrada','Estiramientos suaves post-ejercicio']},
      cronica: {titulo:'Carga de almacenamiento energía (sem 8+)',criterios:'Reintroducción de carga de impacto gradual.',
        ejercicios:['Pliometría progresiva de bajo impacto','Ejercicios de potencia controlada','Fortalecimiento funcional','Retorno actividad deportiva/laboral progresivo']},
    },
    precauciones:'Evitar estiramiento pasivo agresivo en fase aguda. No infiltrar si protocolo activo en curso. Monitor dolor 24h post-sesión.',
  },
  ligamentosa:{
    label:'Lesión Ligamentosa', icon:'🔗',
    criterios:'Estabilización precoz. Propiocepción es clave. Tiempo de cicatrización 6–12 semanas según grado.',
    fases:{
      aguda:   {titulo:'Protección y control (sem 1–2)',     criterios:'PRICER. Movilización precoz dentro del rango seguro.',
        ejercicios:['Isométricos musculatura estabilizadora','Movilización activa sin estrés ligamentoso','Propiocepción básica (carga parcial si tolera)','Control del edema: elevación + compresión']},
      subaguda:{titulo:'Restablecimiento función (sem 3–8)', criterios:'Carga progresiva. Ejercicios de estabilización dinámica.',
        ejercicios:['Fortalecimiento sinergistas del ligamento','Propiocepción progresiva en carga','Ejercicios funcionales en rango estable','Reeducación del patrón de movimiento']},
      cronica: {titulo:'Retorno funcional (sem 8–16)',       criterios:'Fuerza simétrica >80%. Propiocepción normalizada.',
        ejercicios:['Ejercicios de velocidad y cambio de dirección','Pliometría progresiva','Actividades deportivas/laborales específicas','Prevención de recidiva']},
    },
    precauciones:'Grado III puede requerir cirugía. No forzar el rango. Evaluar inestabilidad residual antes de retorno deportivo.',
  },
  muscular:{
    label:'Lesión Muscular', icon:'💪',
    criterios:'Clasificación por grado (I/II/III). Cicatrización 2–8 semanas según extensión.',
    fases:{
      aguda:   {titulo:'Hemostasia y protección (0–72h)',    criterios:'PRICER. Sin calor ni masaje en primeras 48h.',
        ejercicios:['Contracción isométrica suave sin dolor','Elevación y compresión','Movilización activa rangos no dolorosos','Crio terapia cada 2h primeras 48h']},
      subaguda:{titulo:'Remodelación (3 días – 4 sem)',      criterios:'Estiramiento progresivo sin provocar dolor. Fortalecimiento excéntrico suave.',
        ejercicios:['Estiramiento estático suave (sin pain point)','Fortalecimiento concéntrico submáximo','Ejercicio aeróbico de bajo impacto','Masaje transverso profundo (semana 2+)']},
      cronica: {titulo:'Remodelación y retorno (4–8 sem)',   criterios:'Fuerza >90% lado contralateral. Sin dolor.',
        ejercicios:['Fortalecimiento excéntrico progresivo','Ejercicios de velocidad progresiva','Stretching dinámico','Retorno deportivo/laboral escalonado']},
    },
    precauciones:'No masaje profundo en primeras 48h. Evitar antiinflamatorios >5 días (afectan reparación). Respetar el dolor como guía.',
  },
  fascia:{
    label:'Lesión Fascial / Miofascial', icon:'🕸️',
    criterios:'Liberación miofascial + ejercicio en rango completo. Hidratación y carga progresiva son esenciales.',
    fases:{
      aguda:   {titulo:'Control del dolor y puntos gatillo (sem 1–2)', criterios:'Terapia manual. Evitar sobrecarga de la estructura afectada.',
        ejercicios:['Foam rolling suave zona periférica (no sobre punto gatillo activo)','Estiramiento suave mantenido 60–90 seg','Calor húmedo pre-ejercicio','Movilización activa no irritante']},
      subaguda:{titulo:'Restauración de deslizamiento fascial (sem 3–6)', criterios:'Liberación activa. Carga excéntrica en rango completo.',
        ejercicios:['Foam rolling sistemático con carga progresiva','Estiramiento activo en rango completo (AIS)','Ejercicios excéntricos en rango total','Movimientos de deslizamiento neural si componente nervioso']},
      cronica: {titulo:'Carga funcional y prevención (sem 6+)', criterios:'Ejercicio como tratamiento principal.',
        ejercicios:['Fortalecimiento en rango completo','Ejercicios funcionales con carga progresiva','Reeducación del patrón de movimiento','Autogestión: foam rolling + hidratación']},
    },
    precauciones:'Presión excesiva sobre punto gatillo activo puede agravar. Integrar siempre trabajo muscular activo. Descartar causas sistémicas.',
  },
};

const REHAB_DB={
  cervical:{
    aguda:[
      {id:'rc_a01',nombre:'Isométrico cervical anterior',desc:'Mano en frente. Empuje isométrico 5 seg. Sin movimiento.',param:'3×10 rep · 5 seg hold · sin dolor'},
      {id:'rc_a02',nombre:'Isométrico cervical posterior',desc:'Manos detrás de cabeza. Empuje isométrico hacia atrás.',param:'3×10 rep · 5 seg hold'},
      {id:'rc_a03',nombre:'Isométrico cervical lateral D/I',desc:'Mano en sien. Empuje lateral isométrico bilateral.',param:'3×10 rep/lado · 5 seg hold'},
      {id:'rc_a04',nombre:'Retracción cervical en supino',desc:'Chin tuck suave en decúbito. Sin elevar cabeza.',param:'3×10 rep · hold 5 seg'},
      {id:'rc_a05',nombre:'Respiración diafragmática',desc:'Activación parasimpática. Reducción tensión muscular cervical.',param:'5 min · 4-4-6 ciclos'},
      {id:'rc_a06',nombre:'Movilización escapular activa',desc:'Círculos y elevar/deprimir escápulas. Alivia tensión cervical.',param:'3×10 ciclos'},
    ],
    subaguda:[
      {id:'rc_s01',nombre:'Chin tuck dinámico sentado',desc:'Retracción + leve flexión. Activa flexores profundos.',param:'3×12 rep · 3 seg hold'},
      {id:'rc_s02',nombre:'Rotación cervical activa-asistida',desc:'Mano guía rotación hasta rango cómodo.',param:'3×8 rep/lado · lento'},
      {id:'rc_s03',nombre:'Flexión-extensión cervical activa',desc:'Rango progresivo sin dolor. Eje óptimo.',param:'3×10 rep · control excéntrico'},
      {id:'rc_s04',nombre:'Inclinación lateral activa',desc:'Oreja a hombro progresiva. Estiramiento contralateral.',param:'3×8 rep/lado'},
      {id:'rc_s05',nombre:'Estiramiento trapecio superior',desc:'Inclinación + rotación contralateral. 30 seg sostenido.',param:'3×30 seg/lado'},
      {id:'rc_s06',nombre:'Estiramiento escalenos',desc:'Extensión cervical + rotación ipsilateral + depresión escapular.',param:'3×30 seg/lado'},
      {id:'rc_s07',nombre:'Deep neck flexor (DNF) progresivo',desc:'Chin tuck + elevación parcial cabeza en supino.',param:'3×8–10 rep · build up'},
      {id:'rc_s08',nombre:'Ejercicio ocular + cervical',desc:'Seguimiento visual con movimiento cervical controlado. Propiocepción.',param:'3×10 rep cada dirección'},
    ],
    cronica:[
      {id:'rc_c01',nombre:'Chin tuck con banda de resistencia',desc:'Retracción contra resistencia elástica suave.',param:'3×12 rep · progresión semanal'},
      {id:'rc_c02',nombre:'Fortalecimiento extensores cervicales',desc:'En decúbito prono. Extensión isométrica + carga distal mínima.',param:'3×10 rep · RPE 6'},
      {id:'rc_c03',nombre:'Propiocepción cervical con laser pointer',desc:'Cabeza con sensor. Reproducción de posición target.',param:'5 min · ejercicio funcional'},
      {id:'rc_c04',nombre:'Fortalecimiento postural global',desc:'Remo + retracción escapular + chin tuck simultáneo.',param:'3×12 rep · integrado'},
      {id:'rc_c05',nombre:'Estabilización cervical en cuadrupedia',desc:'Bird-dog con control cervical neutro.',param:'3×8 rep/lado · neutro cervical'},
      {id:'rc_c06',nombre:'Fortalecimiento rotadores cervicales',desc:'Con banda. Rotación resistida en rango completo.',param:'3×12 rep/lado'},
    ],
  },
  hombro:{
    aguda:[
      {id:'rh_a01',nombre:'Péndulo de Codman',desc:'Brazo colgante. Círculos y lateral por gravedad. Descomprime glenohumeral.',param:'2×2 min · sin contracción activa'},
      {id:'rh_a02',nombre:'Isométrico de hombro en posición neutra',desc:'Empuje contra pared. Abducción, flexión, extensión, rotaciones.',param:'3×10 rep · 5 seg hold/dirección'},
      {id:'rh_a03',nombre:'Movilización escapular pasiva',desc:'Fisioterapeuta o autoasistida con lado contrario.',param:'3×10 rep · deslizamientos'},
      {id:'rh_a04',nombre:'Rotación externa isométrica 0° abd',desc:'Codo a 90°. Toalla entre cuerpo y brazo. Empuje externo isométrico.',param:'3×10 rep · 5 seg'},
      {id:'rh_a05',nombre:'Control escapular en reposo',desc:'Educación posición escapular. Retracción suave sin dolor.',param:'Educativo · postura de referencia'},
      {id:'rh_a06',nombre:'Crioterapia post-actividad',desc:'Hielo 15–20 min. Siempre post ejercicio en fase aguda.',param:'15–20 min · 3–4×/día'},
    ],
    subaguda:[
      {id:'rh_s01',nombre:'Polea de hombro (flexión asistida)',desc:'Brazo sano eleva el afectado. Recuperación de rango.',param:'3×15 rep · rango progresivo'},
      {id:'rh_s02',nombre:'Rotación externa con banda (neutro)',desc:'Codo 90°. Banda anclada. Rotación externa controlada.',param:'3×15 rep · RPE 5–6'},
      {id:'rh_s03',nombre:'Rotación interna con banda (neutro)',desc:'Ídem en dirección interna. Equilibrio rotadores.',param:'3×15 rep · RPE 5–6'},
      {id:'rh_s04',nombre:'Scaption (elevación en el plano de la escápula)',desc:'30° anterior a la frontal. Elevación hasta 90° con pulgar arriba.',param:'3×12 rep · progresión lenta'},
      {id:'rh_s05',nombre:'Estiramiento cápsula posterior',desc:'Cross-body stretch o sleeper stretch. 30 seg sostenido.',param:'3×30 seg · 2×/día'},
      {id:'rh_s06',nombre:'Retracción escapular con banda',desc:'Remo horizontal con foco en retracción. Activa romboides/trapecio medio.',param:'3×15 rep'},
      {id:'rh_s07',nombre:'Fortalecimiento serrato anterior',desc:'Serratus push-up o deslizamiento en pared.',param:'3×12 rep · lento'},
      {id:'rh_s08',nombre:'Ejercicio Y/T/W en banco inclinado',desc:'Fortalecimiento manguito + estabilizadores escapulares.',param:'3×12 rep cada letra · bajo peso'},
    ],
    cronica:[
      {id:'rh_c01',nombre:'Press de hombro con mancuerna',desc:'Elevación progresiva. Control total del rango.',param:'3×10–12 rep · RPE 6–7'},
      {id:'rh_c02',nombre:'Remo vertical en polea',desc:'Jalón enfatizando depresión y retracción escapular.',param:'3×12 rep'},
      {id:'rh_c03',nombre:'Push-up plus (protracción final)',desc:'Serrato. Empuje + protracción máxima al final.',param:'3×12 rep'},
      {id:'rh_c04',nombre:'Rotación externa a 90° abducción',desc:'Mayor demanda. Solo cuando tolerado sin dolor a 90°.',param:'3×12 rep · RPE 6'},
      {id:'rh_c05',nombre:'Ejercicios funcionales sobre la cabeza',desc:'Progresión funcional: alcances, lanzamientos, empujes.',param:'Series funcionales'},
      {id:'rh_c06',nombre:'Entrenamiento excéntrico manguito',desc:'Foco en desaceleración. Específico para tendinopatía.',param:'3×15 rep · ritmo 3-3-3'},
    ],
  },
  codo:{
    aguda:[
      {id:'re_a01',nombre:'Inmovilización relativa + elevación',desc:'Reposo relativo. Codo en posición de confort (~70° flex).',param:'Educativo · gestión de carga'},
      {id:'re_a02',nombre:'Isométrico de flexores de codo',desc:'Sin rango. Solo tensión isométrica suave.',param:'3×10 · 5 seg hold'},
      {id:'re_a03',nombre:'Isométrico extensores de codo',desc:'Contra superficie estable. Sin movimiento.',param:'3×10 · 5 seg hold'},
      {id:'re_a04',nombre:'Movilización activa de muñeca',desc:'Flexo-extensión suave. Mantiene circulación distal.',param:'3×10 rep · suave'},
      {id:'re_a05',nombre:'Crioterapia + compresión',desc:'15–20 min sobre área dolorosa.',param:'3–4×/día · post actividad'},
    ],
    subaguda:[
      {id:'re_s01',nombre:'Flexo-extensión de codo activa',desc:'Rango progresivo sin dolor. Lento y controlado.',param:'3×12 rep · control excéntrico'},
      {id:'re_s02',nombre:'Pronosupinación activa',desc:'Giro de antebrazo. Codo a 90°.',param:'3×12 rep/dirección'},
      {id:'re_s03',nombre:'Excéntrico extensores de muñeca (epicondilitis lateral)',desc:'Tyler twist o excéntrico clásico. Carga progresiva.',param:'3×15 rep · ritmo 3-3-3 · sem 3+'},
      {id:'re_s04',nombre:'Excéntrico flexores de muñeca (epicondilitis medial)',desc:'Carga excéntrica de flexores. Progresión desde peso cero.',param:'3×15 rep · ritmo 3-3-3'},
      {id:'re_s05',nombre:'Estiramiento extensores antebrazo',desc:'Muñeca en flexión + extensión de codo. 30 seg.',param:'3×30 seg · 2×/día'},
      {id:'re_s06',nombre:'Estiramiento flexores antebrazo',desc:'Muñeca en extensión + extensión de codo. 30 seg.',param:'3×30 seg · 2×/día'},
      {id:'re_s07',nombre:'Fortalecimiento agarre progresivo',desc:'Pelota de estrés o grip trainer.',param:'3×20 rep · progresión semanal'},
    ],
    cronica:[
      {id:'re_c01',nombre:'Curl de bíceps con mancuerna',desc:'Rango completo. Control excéntrico.',param:'3×12 rep · RPE 6'},
      {id:'re_c02',nombre:'Extensión de tríceps en polea',desc:'Fortalecimiento funcional del extensor.',param:'3×12 rep · RPE 6'},
      {id:'re_c03',nombre:'Fortalecimiento global antebrazo',desc:'Pronación/supinación resistida con barra.',param:'3×15 rep/dirección'},
      {id:'re_c04',nombre:'Ejercicios funcionales de empuje/tracción',desc:'Retorno progresivo a actividades laborales/deportivas.',param:'Series funcionales'},
    ],
  },
  muneca:{
    aguda:[
      {id:'rm_a01',nombre:'Reposo relativo + ortesis funcional',desc:'Muñeca en posición neutra. Reducción de carga irritante.',param:'Educativo · gestión de actividad'},
      {id:'rm_a02',nombre:'Isométrico flexores de muñeca',desc:'Sin rango. Contracción isométrica suave.',param:'3×10 · 5 seg hold'},
      {id:'rm_a03',nombre:'Isométrico extensores de muñeca',desc:'Ídem en extensión.',param:'3×10 · 5 seg hold'},
      {id:'rm_a04',nombre:'Movilización de dedos activa',desc:'Apertura y cierre de mano. Mantiene circulación.',param:'3×15 rep · suave'},
      {id:'rm_a05',nombre:'Elevación + crioterapia',desc:'Muñeca elevada sobre nivel del corazón.',param:'15–20 min · varias veces/día'},
    ],
    subaguda:[
      {id:'rm_s01',nombre:'Flexo-extensión de muñeca activa',desc:'Rango progresivo. Control excéntrico.',param:'3×12 rep · lento'},
      {id:'rm_s02',nombre:'Desviación radial-cubital activa',desc:'Movimiento lateral de muñeca. Plano frontal.',param:'3×12 rep/dirección'},
      {id:'rm_s03',nombre:'Pronosupinación con palo',desc:'Palo como brazo de palanca. Dificultad progresiva.',param:'3×12 rep/dirección'},
      {id:'rm_s04',nombre:'Fortalecimiento agarre funcional',desc:'Estrés progresivo: pelota blanda → dura.',param:'3×20 rep · progresión'},
      {id:'rm_s05',nombre:'Puño progresivo (hook fist → full fist)',desc:'Movilización diferenciada de tendones flexores.',param:'3×10 rep cada variante'},
      {id:'rm_s06',nombre:'Neurodynamics del nervio mediano',desc:'Si hay compromiso del nervio. Deslizamiento neural.',param:'3×10 rep suave · sin dolor irradiado'},
    ],
    cronica:[
      {id:'rm_c01',nombre:'Fortalecimiento muñeca con mancuerna',desc:'Flex/ext con carga. Excéntrico controlado.',param:'3×12–15 rep · RPE 5–6'},
      {id:'rm_c02',nombre:'Ejercicios de estabilidad de muñeca',desc:'Apoyo en cuadrupedia. Carga progresiva en muñeca.',param:'3×20 seg hold'},
      {id:'rm_c03',nombre:'Actividades funcionales con resistencia',desc:'Amasado, torsión, agarre en pinza con resistencia.',param:'Series funcionales'},
    ],
  },
  esc:{
    aguda:[
      {id:'res_a01',nombre:'Retracción escapular isométrica',desc:'Apretón de escápulas suave contra suave resistencia.',param:'3×10 · 5 seg hold'},
      {id:'res_a02',nombre:'Depresión escapular activa',desc:'Hombros hacia abajo y atrás. Sin dolor.',param:'3×12 rep'},
      {id:'res_a03',nombre:'Movilización glenohumeral pasiva-asistida',desc:'Péndulo o asistida. Mantiene rango.',param:'2×2 min'},
      {id:'res_a04',nombre:'Isométrico manguito rotador (neutro)',desc:'En posición de reposo del hombro.',param:'3×10 · 5 seg hold'},
    ],
    subaguda:[
      {id:'res_s01',nombre:'Y/T/W en banco inclinado',desc:'Bajo peso o sin carga. Estabilizadores escapulares.',param:'3×12 rep · lento'},
      {id:'res_s02',nombre:'Remo horizontal con banda',desc:'Retracción escapular como objetivo principal.',param:'3×15 rep · énfasis retracción'},
      {id:'res_s03',nombre:'Serrato press (push-up plus)',desc:'Protracción final en el push-up. Activa serrato.',param:'3×12 rep'},
      {id:'res_s04',nombre:'Rotación interna/externa con banda 0°',desc:'Equilibrio de manguito. Bandas suaves.',param:'3×15 rep/dirección'},
      {id:'res_s05',nombre:'Scaption a 90°',desc:'Elevación en plano escapular. Activa supraespinoso.',param:'3×12 rep · control'},
      {id:'res_s06',nombre:'Fortalecimiento trapecio inferior',desc:'Elevación de brazos a 135° (en Y) en decúbito prono.',param:'3×12 rep · bajo peso'},
    ],
    cronica:[
      {id:'res_c01',nombre:'Press vertical progresivo',desc:'Overhead press con control escapular activo.',param:'3×10 rep · RPE 6–7'},
      {id:'res_c02',nombre:'Dominada asistida (enfoque escapular)',desc:'Depresión activa antes del tirón. Control total.',param:'3×6–8 rep'},
      {id:'res_c03',nombre:'Face pull en polea',desc:'Salud del hombro. Rotación externa + retracción.',param:'4×15 rep · peso bajo'},
      {id:'res_c04',nombre:'Ejercicios funcionales integrados',desc:'Empuje + tirón + carga overhead progresiva.',param:'Series funcionales'},
    ],
  },
  dorsal:{
    aguda:[
      {id:'rd_a01',nombre:'Posición de alivio (semifetal)',desc:'Decúbito lateral. Almohada entre rodillas. Posición antálgica.',param:'Educativo · gestión de postura'},
      {id:'rd_a02',nombre:'Respiración costal baja',desc:'Expansión lateral del tórax. Movilización indirecta.',param:'5 min · 3×/día'},
      {id:'rd_a03',nombre:'Movilización torácica en foam roller (suave)',desc:'Extensión torácica pasiva. Segmento por segmento.',param:'2 min · T4–T8'},
      {id:'rd_a04',nombre:'Rotación torácica en decúbito',desc:'Rodillas juntas. Rotación pélvica. Movilización suave.',param:'3×8 rep/lado · sin dolor'},
    ],
    subaguda:[
      {id:'rd_s01',nombre:'Rotación torácica en cuadrupedia',desc:'Mano detrás de cabeza. Rotación máxima.',param:'3×10 rep/lado'},
      {id:'rd_s02',nombre:'Extensión torácica en foam roller',desc:'Movilización segmentaria. Rango progresivo.',param:'3×10 rep sobre foam'},
      {id:'rd_s03',nombre:'Cat-camel con énfasis torácico',desc:'Disociación lumbo-torácica en cuadrupedia.',param:'3×12 rep · lento'},
      {id:'rd_s04',nombre:'Fortalecimiento erector torácico',desc:'Extensiones en decúbito prono. Solo rango torácico.',param:'3×12 rep'},
      {id:'rd_s05',nombre:'Remo con énfasis retracción escapular',desc:'Fortalecimiento de extensores torácicos indirectamente.',param:'3×15 rep'},
      {id:'rd_s06',nombre:'Estiramiento pectoral en marco',desc:'Apertura de tórax. Complemento a movilización.',param:'3×30 seg'},
    ],
    cronica:[
      {id:'rd_c01',nombre:'Rotaciones torácicas con palo',desc:'En bipedestación. Disociación segmentaria.',param:'3×12 rep/lado'},
      {id:'rd_c02',nombre:'Press de hombro con control torácico',desc:'Mantener neutro torácico bajo carga.',param:'3×10 rep · RPE 6'},
      {id:'rd_c03',nombre:'Fortalecimiento postural integrado',desc:'Remo + extensión torácica simultánea.',param:'3×12 rep · integrado'},
      {id:'rd_c04',nombre:'Ejercicios de respiración con carga',desc:'Respiración costal bajo esfuerzo físico.',param:'Integrado en el entrenamiento'},
    ],
  },
  lumbar:{
    aguda:[
      {id:'rl_a01',nombre:'Posición de gancho (hook lying)',desc:'Supino. Rodillas flexionadas. Descompresión lumbar.',param:'5–10 min · varias veces al día'},
      {id:'rl_a02',nombre:'Extensiones en prono (McKenzie)',desc:'Extensión pasiva sobre brazos. Solo si centraliza el dolor.',param:'3×10 rep · evaluar respuesta'},
      {id:'rl_a03',nombre:'Flexiones en supino (Williams)',desc:'Rodillas al pecho. Solo si flexión alivia.',param:'3×10 rep · según preferencia'},
      {id:'rl_a04',nombre:'Activación transverso abdominal (TA)',desc:'Abbrasión abdominal. Core profundo sin movimiento lumbar.',param:'3×10 · hold 10 seg'},
      {id:'rl_a05',nombre:'Neurodynamics nervio ciático',desc:'Si hay irradiación. Deslizamiento neural suave.',param:'3×10 rep · sin dolor irradiado'},
      {id:'rl_a06',nombre:'Movilidad de cadera en descarga',desc:'Rotaciones de cadera en supino. Reduce carga lumbar.',param:'3×10 rep/lado'},
    ],
    subaguda:[
      {id:'rl_s01',nombre:'Estabilización lumbar básica (dead bug)',desc:'Control lumbo-pélvico. Core profundo activo.',param:'3×8 rep/lado · neutro lumbar'},
      {id:'rl_s02',nombre:'Puente de glúteo isométrico',desc:'Activación glúteo + core. Sin hiperextensión lumbar.',param:'3×12 rep · hold 2 seg'},
      {id:'rl_s03',nombre:'Bird-dog (cuadrupedia)',desc:'Estabilización antiextensión. Control rotacional.',param:'3×8 rep/lado · neutro'},
      {id:'rl_s04',nombre:'Plancha frontal progresiva',desc:'Desde rodillas. Progresión a plancha completa.',param:'3×20–45 seg'},
      {id:'rl_s05',nombre:'Hip hinge con palo (enseñanza)',desc:'Bisagra correcta. Disociación cadera-columna.',param:'3×10 rep · dominar patrón'},
      {id:'rl_s06',nombre:'Estiramiento isquiotibiales suave',desc:'En supino con banda. Sin flexión lumbar.',param:'3×30 seg/pierna'},
      {id:'rl_s07',nombre:'Fortalecimiento glúteo medio lateral',desc:'Clamshell. Carga sobre glúteo para descarga lumbar.',param:'3×15 rep/lado'},
    ],
    cronica:[
      {id:'rl_c01',nombre:'Peso muerto rumano (carga progresiva)',desc:'Bisagra funcional. Fortalecimiento cadena posterior.',param:'3×10 rep · RPE 6 → progresión'},
      {id:'rl_c02',nombre:'Sentadilla goblet (técnica)',desc:'Patrón de sentadilla. Core activo. Carga progresiva.',param:'3×10 rep · RPE 6'},
      {id:'rl_c03',nombre:'Plancha lateral',desc:'Anti-flexión lateral. Cuadrado lumbar + glúteo medio.',param:'3×20–45 seg/lado'},
      {id:'rl_c04',nombre:'Pallof press',desc:'Anti-rotación. Estabilización funcional del core.',param:'3×12 rep/lado'},
      {id:'rl_c05',nombre:'Retorno a carga axial progresivo',desc:'Sentadilla + peso muerto con carga creciente.',param:'Programa de progresión 8–12 sem'},
    ],
  },
  cadera:{
    aguda:[
      {id:'rca_a01',nombre:'Isométrico de abductores (clamshell)',desc:'Sin carga articular. Activación glúteo medio.',param:'3×10 rep · 5 seg hold'},
      {id:'rca_a02',nombre:'Isométrico de extensores de cadera',desc:'En prono. Glúteo contra superficie. Isométrico.',param:'3×10 rep · 5 seg hold'},
      {id:'rca_a03',nombre:'Movilización pasiva de cadera en supino',desc:'Fisioterapeuta o autoasistida. Preservar rango.',param:'3×10 rep · ROM no doloroso'},
      {id:'rca_a04',nombre:'Control del edema y descarga',desc:'Elevación. Crioterapia si pertinente.',param:'15–20 min · varias veces'},
      {id:'rca_a05',nombre:'Activación TA en supino',desc:'Core profundo. Soporte indirecto de cadera.',param:'3×10 · hold 10 seg'},
    ],
    subaguda:[
      {id:'rca_s01',nombre:'Puente de glúteo bilateral',desc:'Extensión de cadera en descarga. Activa glúteo mayor.',param:'3×15 rep · 2 seg hold'},
      {id:'rca_s02',nombre:'Clamshell con banda progresiva',desc:'Abductor de cadera. Glúteo medio.',param:'3×15 rep/lado'},
      {id:'rca_s03',nombre:'Monster walk con banda',desc:'Abducción en carga. Glúteo medio funcional.',param:'3×10 pasos/dirección'},
      {id:'rca_s04',nombre:'SLR (elevación pierna recta)',desc:'Flexión de cadera activa. Control lumbo-pélvico.',param:'3×12 rep/lado'},
      {id:'rca_s05',nombre:'Peso muerto unilateral (sin carga)',desc:'Control pélvico + fuerza extensores. Patrón bisagra.',param:'3×8 rep/lado'},
      {id:'rca_s06',nombre:'Estiramiento de psoas en lunge',desc:'Flexores de cadera. Posición funcional.',param:'3×30 seg/lado'},
      {id:'rca_s07',nombre:'Hip 90/90 movilidad',desc:'Rotación interna y externa de cadera. Rango articular.',param:'3×10 rep/posición'},
    ],
    cronica:[
      {id:'rca_c01',nombre:'Hip thrust con carga progresiva',desc:'Fortalecimiento máximo de glúteo mayor.',param:'3×10–12 rep · RPE 7'},
      {id:'rca_c02',nombre:'Step-up unilateral',desc:'Carga progresiva. Control de cadera y rodilla.',param:'3×10 rep/lado · progresión altura'},
      {id:'rca_c03',nombre:'Sentadilla unilateral (pistol asistida)',desc:'Demanda alta. Control total de cadera.',param:'3×6–8 rep/lado · asistida'},
      {id:'rca_c04',nombre:'Zancada búlgara',desc:'Fuerza unilateral. Glúteo + cuádriceps.',param:'3×8–10 rep/lado · RPE 7'},
      {id:'rca_c05',nombre:'Ejercicios de potencia de cadera',desc:'KB swing, saltos controlados. Retorno funcional.',param:'Series funcionales progresivas'},
    ],
  },
  rodilla:{
    aguda:[
      {id:'rr_a01',nombre:'PRICER — Protocolo inmediato',desc:'Protección, reposo relativo, hielo, compresión, elevación, derivación.',param:'Educativo · primeras 72h'},
      {id:'rr_a02',nombre:'Isométrico de cuádriceps (quad set)',desc:'Pierna extendida. Apretar cuádriceps contra suelo.',param:'3×10 · hold 10 seg'},
      {id:'rr_a03',nombre:'SLR (elevación de pierna recta)',desc:'Sin carga articular. Activa cuádriceps y flexores.',param:'3×15 rep · lento'},
      {id:'rr_a04',nombre:'Movilización pasiva de rodilla',desc:'Rango articular sin carga. Previene rigidez.',param:'3×10 rep · rango confortable'},
      {id:'rr_a05',nombre:'Dorsiflexión de tobillo activa',desc:'Mantiene circulación. Bomba venosa distal.',param:'3×20 rep'},
      {id:'rr_a06',nombre:'Isométrico VMO (terminal)',desc:'Últimos 20° de extensión. Foco en vasto medial.',param:'3×10 · hold 10 seg'},
    ],
    subaguda:[
      {id:'rr_s01',nombre:'Extensión de cuádriceps en arco corto (0–30°)',desc:'Arco seguro. Fortalecimiento sin estrés articular.',param:'3×15 rep · control excéntrico'},
      {id:'rr_s02',nombre:'Leg press bilateral (carga baja)',desc:'Cadena cinética cerrada. Menos estrés articular.',param:'3×15 rep · rango 0–60°'},
      {id:'rr_s03',nombre:'Curl femoral en descarga',desc:'Fortalecimiento isquiotibiales. Equilibrio agonista.',param:'3×12 rep'},
      {id:'rr_s04',nombre:'Step-up bajo (10–15 cm)',desc:'Cadena cerrada. Control cuádriceps + glúteo.',param:'3×10 rep/lado'},
      {id:'rr_s05',nombre:'Propiocepción básica (bipodal estable)',desc:'Plataforma estable. Sensación de posición articular.',param:'3×30 seg · progresión'},
      {id:'rr_s06',nombre:'Fortalecimiento glúteo medio',desc:'Clamshell + monster walk. Descarga rodilla.',param:'3×15 rep/lado'},
      {id:'rr_s07',nombre:'Estiramiento cuádriceps + isquiotibiales',desc:'Equilibrio de tensiones musculares.',param:'3×30 seg/músculo'},
    ],
    cronica:[
      {id:'rr_c01',nombre:'Sentadilla (0–90°) progresiva',desc:'Cadena cinética cerrada. Carga progresiva.',param:'3×10–12 rep · RPE 6–7'},
      {id:'rr_c02',nombre:'Step-down excéntrico (eccentric step down)',desc:'Control de valgo. Fortalecimiento excéntrico cuádriceps.',param:'3×10 rep/lado · lento'},
      {id:'rr_c03',nombre:'Nordic curl (isquiotibiales)',desc:'Fortalecimiento excéntrico. Prevención de lesiones.',param:'3×6–8 rep · progresión'},
      {id:'rr_c04',nombre:'Propiocepción avanzada (superficie inestable)',desc:'BOSU, disco. Progresión unipodal.',param:'3×30 seg/lado'},
      {id:'rr_c05',nombre:'Salto + aterrizaje controlado',desc:'Retorno deportivo. Control de valgo en aterrizaje.',param:'3×8 rep · progresión impacto'},
      {id:'rr_c06',nombre:'Carrera progresiva (si aplica)',desc:'Retorno al trote controlado. Sin dolor.',param:'Protocolo retorno carrera'},
    ],
  },
  tobillo:{
    aguda:[
      {id:'rt_a01',nombre:'PRICER — Protocolo inmediato',desc:'Protección, reposo relativo, hielo, compresión, elevación.',param:'Educativo · primeras 72h'},
      {id:'rt_a02',nombre:'Movilización temprana activa (AROM)',desc:'Alfabeto con el tobillo en descarga. Movilidad.',param:'3×10 letras · suave'},
      {id:'rt_a03',nombre:'Isométrico eversores (peroneales)',desc:'Estabilizadores laterales. Contra banda o mano.',param:'3×10 · hold 5 seg'},
      {id:'rt_a04',nombre:'Isométrico inversores',desc:'Equilibrio muscular.',param:'3×10 · hold 5 seg'},
      {id:'rt_a05',nombre:'Elevación + compresión',desc:'Control del edema. Tobillo sobre nivel del corazón.',param:'15–20 min · varias veces/día'},
      {id:'rt_a06',nombre:'Carga parcial progresiva (si tolera)',desc:'Iniciación temprana de la carga. Mejor cicatrización.',param:'Carga progresiva según dolor'},
    ],
    subaguda:[
      {id:'rt_s01',nombre:'Movilización tobillo en carga (rock back)',desc:'Dorsiflexión activa en bipedestación. Preserva rango.',param:'3×15 rep · progresivo'},
      {id:'rt_s02',nombre:'Elevación de talones bilateral',desc:'Fortalecimiento gemelo + sóleo. Progresión unilateral.',param:'3×15–20 rep'},
      {id:'rt_s03',nombre:'Fortalecimiento peroneal con banda',desc:'Eversión resistida. Estabilizadores laterales clave.',param:'3×15 rep'},
      {id:'rt_s04',nombre:'Propiocepción básica bipodal',desc:'Balance board o suelo inestable. Dos piernas.',param:'3×30 seg'},
      {id:'rt_s05',nombre:'Caminata sobre puntas y talones',desc:'Fortalecimiento funcional. Plantar y dorsiflexión.',param:'2×15 metros'},
      {id:'rt_s06',nombre:'Excéntrico de gemelo (escalón)',desc:'Fortalecimiento excéntrico. Tendinopatía de Aquiles.',param:'3×15 rep · ritmo 3-3-3'},
    ],
    cronica:[
      {id:'rt_c01',nombre:'Propiocepción unipodal (estable)',desc:'Una pierna. Progresión con ojos cerrados.',param:'3×30 seg/lado'},
      {id:'rt_c02',nombre:'Propiocepción en superficie inestable',desc:'BOSU, disco de equilibrio. Unipodal.',param:'3×30 seg/lado'},
      {id:'rt_c03',nombre:'Elevación de talón unilateral',desc:'Carga total en una pierna. Gemelo + sóleo.',param:'3×15 rep/lado'},
      {id:'rt_c04',nombre:'Salto bipodal y aterrizaje controlado',desc:'Introducción de impacto. Control de tobillo.',param:'3×10 rep · progresión'},
      {id:'rt_c05',nombre:'Salto unipodal progresivo',desc:'Demanda alta. Retorno deportivo.',param:'3×8 rep/lado'},
      {id:'rt_c06',nombre:'Carrera + cambio de dirección',desc:'Retorno funcional completo.',param:'Protocolo retorno actividad'},
    ],
  },
};

// ─── BASE DE EJERCICIOS ─────────────────────────────────────────────────────
const DB0=[
  {id:'m01',nombre:'Rotación torácica en cuadrupedia',bloque:'movilidad',musculos:'Columna torácica, intercostales',contraccion:'Dinámica activa',patron:'Rotación',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'Rotación torácica con carga'},
  {id:'m02',nombre:'Hip 90/90 stretch',bloque:'movilidad',musculos:'Cadera, piriforme, aductores',contraccion:'Estiramiento pasivo',patron:'Movilidad de cadera',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'Hip 90/90 con inclinación'},
  {id:'m03',nombre:"World's greatest stretch",bloque:'movilidad',musculos:'Cadera, pectoral, columna',contraccion:'Dinámica activa',patron:'Movilidad global',nivel:'Intermedio',equipo:'Suelo',regresion:'Lunge estático con rotación',progresion:"World's greatest con peso"},
  {id:'m04',nombre:'Cat-camel',bloque:'movilidad',musculos:'Columna lumbar y torácica',contraccion:'Dinámica activa',patron:'Flexo-extensión columna',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'Cat-camel con carga distal'},
  {id:'m05',nombre:'Apertura de cadera en decúbito',bloque:'movilidad',musculos:'Cadera, aductores, glúteo',contraccion:'Estiramiento activo',patron:'Abducción de cadera',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'m02'},
  {id:'m06',nombre:'Movilidad glenohumeral con banda',bloque:'movilidad',musculos:'Hombro, manguito rotador',contraccion:'Dinámica activa',patron:'Rotación de hombro',nivel:'Principiante',equipo:'Banda elástica',regresion:'Círculos libres de hombro',progresion:'m12'},
  {id:'m07',nombre:'Círculos de cadera bipedestación',bloque:'movilidad',musculos:'Cadera, glúteo, lumbar',contraccion:'Dinámica activa',patron:'Circunducción de cadera',nivel:'Principiante',equipo:'Ninguno',regresion:'',progresion:'Círculos con carga'},
  {id:'m08',nombre:'Estiramiento de tobillo en pared',bloque:'movilidad',musculos:'Gemelo, sóleo, tobillo',contraccion:'Estiramiento pasivo',patron:'Dorsiflexión',nivel:'Principiante',equipo:'Pared',regresion:'',progresion:'Sentadilla profunda talones libres'},
  {id:'m09',nombre:'Extensión columna en foam roller',bloque:'movilidad',musculos:'Columna torácica, intercostales',contraccion:'Liberación miofascial',patron:'Extensión torácica',nivel:'Principiante',equipo:'Foam roller',regresion:'',progresion:'Extensión con mancuerna overhead'},
  {id:'m10',nombre:'Pass-through con palo',bloque:'movilidad',musculos:'Hombros, pectoral, dorsal',contraccion:'Dinámica activa',patron:'Tirón/Empuje overhead',nivel:'Principiante',equipo:'Palo/bastón',regresion:'Apertura hombros en pared',progresion:'Pass-through con banda'},
  {id:'m11',nombre:'Movilidad de muñeca en cuadrupedia',bloque:'movilidad',musculos:'Muñeca, antebrazo',contraccion:'Dinámica activa',patron:'Flexo-extensión de muñeca',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'Carga progresiva en muñeca'},
  {id:'m12',nombre:'Rotación externa glenohumeral pared',bloque:'movilidad',musculos:'Infraespinoso, redondo menor',contraccion:'Dinámica activa',patron:'Rotación externa',nivel:'Intermedio',equipo:'Pared',regresion:'m06',progresion:'Rotación externa con banda'},
  {id:'a01',nombre:'Puente de glúteo isométrico',bloque:'activacion',musculos:'Glúteo mayor, isquiotibiales',contraccion:'Isométrica',patron:'Empuje de cadera',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'a02'},
  {id:'a02',nombre:'Puente de glúteo dinámico',bloque:'activacion',musculos:'Glúteo mayor, isquiotibiales, core',contraccion:'Concéntrica-excéntrica',patron:'Empuje de cadera',nivel:'Principiante',equipo:'Suelo',regresion:'a01',progresion:'Hip thrust con carga'},
  {id:'a03',nombre:'Clamshell con banda',bloque:'activacion',musculos:'Glúteo medio, piriforme',contraccion:'Concéntrica-excéntrica',patron:'Abducción de cadera',nivel:'Principiante',equipo:'Banda elástica',regresion:'Clamshell sin banda',progresion:'Monster walk'},
  {id:'a04',nombre:'Monster walk con banda',bloque:'activacion',musculos:'Glúteo medio, TFL',contraccion:'Concéntrica-excéntrica',patron:'Abducción en carga',nivel:'Principiante',equipo:'Banda elástica',regresion:'a03',progresion:'Lateral band walk con squat'},
  {id:'a05',nombre:'Bird dog',bloque:'activacion',musculos:'Core, glúteo, estabilizadores columna',contraccion:'Isométrica-concéntrica',patron:'Estabilización anti-extensión',nivel:'Principiante',equipo:'Suelo',regresion:'Bird dog parcial',progresion:'Bird dog con carga distal'},
  {id:'a06',nombre:'Dead bug',bloque:'activacion',musculos:'Core profundo, transverso abdominal',contraccion:'Isométrica-concéntrica',patron:'Estabilización anti-extensión',nivel:'Principiante',equipo:'Suelo',regresion:'Dead bug rodilla flex.',progresion:'Dead bug con banda'},
  {id:'a07',nombre:'Face pull con banda',bloque:'activacion',musculos:'Deltoides posterior, manguito rotador',contraccion:'Concéntrica-excéntrica',patron:'Tirón horizontal',nivel:'Principiante',equipo:'Banda elástica',regresion:'Retracción escapular pared',progresion:'Face pull en polea'},
  {id:'a08',nombre:'Rotación externa con banda',bloque:'activacion',musculos:'Infraespinoso, redondo menor',contraccion:'Concéntrica-excéntrica',patron:'Rotación externa',nivel:'Principiante',equipo:'Banda elástica',regresion:'Rotación externa isométrica',progresion:'Face pull con polea'},
  {id:'a09',nombre:'Activación de serrato en pared',bloque:'activacion',musculos:'Serrato anterior',contraccion:'Concéntrica-isométrica',patron:'Protracción escapular',nivel:'Principiante',equipo:'Pared',regresion:'',progresion:'Serratus push-up'},
  {id:'a10',nombre:'Plank shoulder tap',bloque:'activacion',musculos:'Core, deltoides, estabilizadores',contraccion:'Isométrica-dinámica',patron:'Anti-rotación',nivel:'Intermedio',equipo:'Suelo',regresion:'Plank estático',progresion:'Shoulder tap con carga'},
  {id:'a11',nombre:'Activación glúteo medio lateral',bloque:'activacion',musculos:'Glúteo medio, TFL',contraccion:'Isométrica',patron:'Abducción en decúbito',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'a03'},
  {id:'a12',nombre:'Squat to stand',bloque:'activacion',musculos:'Isquiotibiales, cadera, columna',contraccion:'Dinámica activa',patron:'Bisagra + sentadilla',nivel:'Principiante',equipo:'Ninguno',regresion:'',progresion:'Squat to stand con rotación'},
  {id:'zm01',nombre:'Plancha frontal',bloque:'zona_media',musculos:'Transverso abdominal, recto, glúteo',contraccion:'Isométrica',patron:'Anti-extensión',nivel:'Principiante',equipo:'Suelo',regresion:'Plancha en rodillas',progresion:'Plancha con elevación de pierna'},
  {id:'zm02',nombre:'Plancha lateral',bloque:'zona_media',musculos:'Oblicuo, cuadrado lumbar, glúteo medio',contraccion:'Isométrica',patron:'Anti-flexión lateral',nivel:'Principiante',equipo:'Suelo',regresion:'Plancha lateral rodillas',progresion:'Plancha lateral con rotación'},
  {id:'zm03',nombre:'Dead bug extensión completa',bloque:'zona_media',musculos:'Transverso abdominal, psoas, core',contraccion:'Isométrica-concéntrica',patron:'Anti-extensión',nivel:'Intermedio',equipo:'Suelo',regresion:'a06',progresion:'Dead bug con KB'},
  {id:'zm04',nombre:'Rueda abdominal (rollout)',bloque:'zona_media',musculos:'Recto abdominal, dorsal, serrato',contraccion:'Excéntrica-concéntrica',patron:'Anti-extensión dinámica',nivel:'Avanzado',equipo:'Rueda abdominal',regresion:'Rollout en fitball',progresion:'Rollout de pie'},
  {id:'zm05',nombre:'Hollow body hold',bloque:'zona_media',musculos:'Core completo, psoas, recto abdominal',contraccion:'Isométrica',patron:'Flexión lumbar activa',nivel:'Intermedio',equipo:'Suelo',regresion:'Hollow body con rodillas',progresion:'Hollow body rock'},
  {id:'zm06',nombre:'Pallof press dinámico',bloque:'zona_media',musculos:'Oblicuos, transverso, estabilizadores',contraccion:'Concéntrica-isométrica',patron:'Anti-rotación',nivel:'Intermedio',equipo:'Polea/banda',regresion:'Pallof press isométrico',progresion:'Pallof press overhead'},
  {id:'zm07',nombre:'Russian twist con carga',bloque:'zona_media',musculos:'Oblicuos, recto abdominal',contraccion:'Concéntrica-excéntrica',patron:'Rotación',nivel:'Intermedio',equipo:'Mancuerna/disco',regresion:'Russian twist sin carga',progresion:'Russian twist balón medicinal'},
  {id:'zm08',nombre:'Dragon flag',bloque:'zona_media',musculos:'Core completo, serrato, glúteo',contraccion:'Excéntrica-isométrica',patron:'Anti-extensión extrema',nivel:'Avanzado',equipo:'Banco',regresion:'zm05',progresion:'Dragon flag completo'},
  {id:'zm09',nombre:'L-sit en paralelas',bloque:'zona_media',musculos:'Psoas, recto abdominal, tríceps',contraccion:'Isométrica',patron:'Compresión de cadera',nivel:'Avanzado',equipo:'Paralelas',regresion:'L-sit en suelo',progresion:'L-sit en argollas'},
  {id:'zm10',nombre:'Rollout en fitball',bloque:'zona_media',musculos:'Core, dorsal, serrato',contraccion:'Excéntrica-concéntrica',patron:'Anti-extensión',nivel:'Intermedio',equipo:'Fitball',regresion:'Rollout parcial',progresion:'zm04'},
  {id:'zm11',nombre:'Anti-rotación con cable',bloque:'zona_media',musculos:'Oblicuos, transverso, erector',contraccion:'Isométrica',patron:'Anti-rotación',nivel:'Intermedio',equipo:'Polea',regresion:'zm06',progresion:'Anti-rot. overhead'},
  {id:'zm12',nombre:'Stir the pot en fitball',bloque:'zona_media',musculos:'Core completo, hombros',contraccion:'Isométrica-dinámica',patron:'Anti-ext. con rotación',nivel:'Avanzado',equipo:'Fitball',regresion:'zm01',progresion:'Stir the pot con carga'},
  {id:'pr01',nombre:'Nordic curl',bloque:'prev_rehab',musculos:'Isquiotibiales',contraccion:'Excéntrica',patron:'Bisagra',nivel:'Avanzado',equipo:'Banco/sujeción',regresion:'Excéntrico parcial',progresion:'Nordic curl completo'},
  {id:'pr02',nombre:'Elevación de talón excéntrica',bloque:'prev_rehab',musculos:'Gemelo, sóleo',contraccion:'Excéntrica',patron:'Plantar-flexión',nivel:'Principiante',equipo:'Escalón',regresion:'Excéntrico bilateral',progresion:'Excéntrico con carga'},
  {id:'pr03',nombre:'Fortalecimiento VMO terminal',bloque:'prev_rehab',musculos:'Vasto medial oblicuo',contraccion:'Concéntrica',patron:'Extensión de rodilla',nivel:'Principiante',equipo:'Banda elástica',regresion:'Isométrico cuádriceps',progresion:'Extensión máquina'},
  {id:'pr04',nombre:'Rotación de hombro isométrica',bloque:'prev_rehab',musculos:'Manguito rotador',contraccion:'Isométrica',patron:'Rotación de hombro',nivel:'Principiante',equipo:'Pared/banda',regresion:'',progresion:'Rotación con carga externa'},
  {id:'pr05',nombre:'Ejercicio de Copenhague',bloque:'prev_rehab',musculos:'Aductores, core',contraccion:'Isométrica-concéntrica',patron:'Aducción de cadera',nivel:'Intermedio',equipo:'Banco',regresion:'Copenhague parcial',progresion:'Copenhague con carga'},
  {id:'pr06',nombre:'Y/T/W en fitball o inclinado',bloque:'prev_rehab',musculos:'Deltoides post., romboides, trapecio',contraccion:'Concéntrica-excéntrica',patron:'Retracción escapular',nivel:'Principiante',equipo:'Fitball/banco',regresion:'Y/T/W en pared',progresion:'Y/T/W con mancuernas'},
  {id:'pr07',nombre:'Hip hinge con palo',bloque:'prev_rehab',musculos:'Glúteo, isquiotibiales, erector',contraccion:'Excéntrica-concéntrica',patron:'Bisagra',nivel:'Principiante',equipo:'Palo',regresion:'',progresion:'Peso muerto rumano sin carga'},
  {id:'pr08',nombre:'Retracción escapular con banda',bloque:'prev_rehab',musculos:'Romboides, trapecio medio',contraccion:'Concéntrica-isométrica',patron:'Retracción escapular',nivel:'Principiante',equipo:'Banda elástica',regresion:'Retracción en pared',progresion:'Remo énfasis escapular'},
  {id:'pr09',nombre:'Isométrico cuádriceps arco limitado',bloque:'prev_rehab',musculos:'Cuádriceps, VMO',contraccion:'Isométrica',patron:'Extensión de rodilla',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'pr03'},
  {id:'pr10',nombre:'Abducción de cadera en decúbito',bloque:'prev_rehab',musculos:'Glúteo medio, TFL',contraccion:'Concéntrica-excéntrica',patron:'Abducción de cadera',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:'Abducción con banda'},
  {id:'pr11',nombre:'Reeducación patrón de marcha',bloque:'prev_rehab',musculos:'Cadena cinética global',contraccion:'Dinámica funcional',patron:'Marcha',nivel:'Principiante',equipo:'Ninguno',regresion:'',progresion:'Marcha con carga'},
  {id:'pr12',nombre:'Apertura de hombro en pared',bloque:'prev_rehab',musculos:'Pectoral, bíceps, cápsula ant.',contraccion:'Estiramiento pasivo',patron:'Extensión de hombro',nivel:'Principiante',equipo:'Pared',regresion:'',progresion:'Estiramiento con banda'},
  {id:'pt01',nombre:'Jump squat',bloque:'potencia',musculos:'Cuádriceps, glúteo, gemelo',contraccion:'Explosiva concéntrica',patron:'Empuje de piernas con salto',nivel:'Intermedio',equipo:'Ninguno',regresion:'Squat elevación puntillas',progresion:'Jump squat con carga'},
  {id:'pt02',nombre:'Box jump',bloque:'potencia',musculos:'Cuádriceps, glúteo, isquiotibiales',contraccion:'Explosiva concéntrica',patron:'Empuje vertical pliométrico',nivel:'Intermedio',equipo:'Cajón pliométrico',regresion:'pt01',progresion:'Depth jump'},
  {id:'pt03',nombre:'Broad jump',bloque:'potencia',musculos:'Cuádriceps, glúteo, isquiotibiales',contraccion:'Explosiva concéntrica',patron:'Empuje horizontal pliométrico',nivel:'Intermedio',equipo:'Ninguno',regresion:'pt01',progresion:'Triple broad jump'},
  {id:'pt04',nombre:'Burpee con salto',bloque:'potencia',musculos:'Cuerpo completo',contraccion:'Explosiva-dinámica',patron:'Movimiento global con salto',nivel:'Intermedio',equipo:'Ninguno',regresion:'Burpee sin salto',progresion:'Burpee con box jump'},
  {id:'pt05',nombre:'Salto al cajón unilateral',bloque:'potencia',musculos:'Cuádriceps, glúteo, estabilizadores',contraccion:'Explosiva unilateral',patron:'Empuje unilateral con salto',nivel:'Avanzado',equipo:'Cajón',regresion:'pt01',progresion:'Depth jump unilateral'},
  {id:'pt06',nombre:'Lanzamiento balón medicinal',bloque:'potencia',musculos:'Core, pectoral, hombros',contraccion:'Explosiva rotacional',patron:'Empuje con rotación',nivel:'Intermedio',equipo:'Balón medicinal',regresion:'Pase de pecho estático',progresion:'Slam overhead'},
  {id:'pt07',nombre:'Push-up explosivo (clapping)',bloque:'potencia',musculos:'Pectoral, tríceps, hombros',contraccion:'Explosiva concéntrica',patron:'Empuje horizontal pliométrico',nivel:'Avanzado',equipo:'Suelo',regresion:'Push-up con elevación',progresion:'Clapping con déficit'},
  {id:'pt08',nombre:'KB swing',bloque:'potencia',musculos:'Glúteo, isquiotibiales, core, hombros',contraccion:'Explosiva-bisagra',patron:'Bisagra de cadera potente',nivel:'Intermedio',equipo:'Kettlebell',regresion:'Hip hinge sin carga',progresion:'KB swing americano'},
  {id:'pt09',nombre:'Power clean desde suelo',bloque:'potencia',musculos:'Cadena posterior, trapecio',contraccion:'Explosiva multiarticular',patron:'Triple extensión bilateral',nivel:'Avanzado',equipo:'Barra',regresion:'Clean desde colgante',progresion:'Power clean + push press'},
  {id:'pt10',nombre:'Drop jump',bloque:'potencia',musculos:'Cuádriceps, gemelo, isquiotibiales',contraccion:'Reactiva pliométrica',patron:'Ciclo estiramiento-acortamiento pliométrico',nivel:'Avanzado',equipo:'Cajón',regresion:'pt02',progresion:'Depth jump con rebote'},
  {id:'pt11',nombre:'Sprint de aceleración 10-20m',bloque:'potencia',musculos:'Cuádriceps, isquiotibiales, glúteo',contraccion:'Explosiva reactiva',patron:'Carrera de velocidad',nivel:'Intermedio',equipo:'Espacio abierto',regresion:'Aceleración de marcha',progresion:'Sprint resistido con trineo'},
  {id:'pt12',nombre:'Salto lateral pliométrico (skaters)',bloque:'potencia',musculos:'Glúteo medio, aductores, cuádriceps',contraccion:'Explosiva lateral',patron:'Empuje lateral pliométrico',nivel:'Intermedio',equipo:'Ninguno',regresion:'Paso lateral controlado',progresion:'Skaters con carga'},
  {id:'f01',nombre:'Sentadilla trasera con barra',bloque:'fuerza',musculos:'Cuádriceps, glúteo, isquiotibiales, core',contraccion:'Concéntrica-excéntrica',patron:'Empuje bilateral piernas carga axial',nivel:'Intermedio',equipo:'Barra, rack',regresion:'Sentadilla goblet',progresion:'Sentadilla con pausa'},
  {id:'f02',nombre:'Peso muerto convencional',bloque:'fuerza',musculos:'Isquiotibiales, glúteo, erector, trapecio',contraccion:'Concéntrica-excéntrica',patron:'Bisagra bilateral carga axial',nivel:'Intermedio',equipo:'Barra',regresion:'Peso muerto rumano',progresion:'Peso muerto déficit'},
  {id:'f03',nombre:'Press banca plano con barra',bloque:'fuerza',musculos:'Pectoral mayor, tríceps, deltoides ant.',contraccion:'Concéntrica-excéntrica',patron:'Empuje horizontal',nivel:'Intermedio',equipo:'Barra, banco, rack',regresion:'Press con mancuernas',progresion:'Press banca con pausa'},
  {id:'f04',nombre:'Press militar con barra',bloque:'fuerza',musculos:'Deltoides, tríceps, trapecio, core',contraccion:'Concéntrica-excéntrica',patron:'Empuje vertical overhead',nivel:'Intermedio',equipo:'Barra, rack',regresion:'Press con mancuernas',progresion:'Press jerk'},
  {id:'f05',nombre:'Dominada lastrada',bloque:'fuerza',musculos:'Dorsal, bíceps, romboides, core',contraccion:'Concéntrica-excéntrica',patron:'Tirón vertical',nivel:'Avanzado',equipo:'Barra + lastre',regresion:'Dominada asistida',progresion:'Dominada con resistencia'},
  {id:'f06',nombre:'Remo con barra Pendlay',bloque:'fuerza',musculos:'Dorsal, romboides, bíceps, core',contraccion:'Concéntrica-excéntrica',patron:'Tirón horizontal',nivel:'Intermedio',equipo:'Barra',regresion:'Remo con mancuerna',progresion:'Remo Yates'},
  {id:'f07',nombre:'Sentadilla frontal',bloque:'fuerza',musculos:'Cuádriceps, core, glúteo',contraccion:'Concéntrica-excéntrica',patron:'Empuje bilateral piernas carga axial',nivel:'Avanzado',equipo:'Barra, rack',regresion:'f01',progresion:'Sentadilla frontal con pausa'},
  {id:'f08',nombre:'Hip thrust con barra',bloque:'fuerza',musculos:'Glúteo mayor, isquiotibiales, core',contraccion:'Concéntrica-excéntrica',patron:'Empuje de cadera',nivel:'Intermedio',equipo:'Barra, banco',regresion:'Puente de glúteo',progresion:'Hip thrust unilateral'},
  {id:'f09',nombre:'Peso muerto rumano',bloque:'fuerza',musculos:'Isquiotibiales, glúteo, erector',contraccion:'Excéntrica-concéntrica',patron:'Bisagra bilateral',nivel:'Intermedio',equipo:'Barra/mancuernas',regresion:'Hip hinge con palo',progresion:'f02'},
  {id:'f10',nombre:'Press inclinado con barra',bloque:'fuerza',musculos:'Pectoral superior, deltoides, tríceps',contraccion:'Concéntrica-excéntrica',patron:'Empuje diagonal',nivel:'Intermedio',equipo:'Barra, banco inclinado',regresion:'f03',progresion:'Press inclinado con pausa'},
  {id:'f11',nombre:'Zancada búlgara con barra',bloque:'fuerza',musculos:'Cuádriceps, glúteo, isquiotibiales',contraccion:'Concéntrica-excéntrica',patron:'Empuje unilateral',nivel:'Avanzado',equipo:'Barra, banco',regresion:'Zancada con mancuernas',progresion:'Zancada búlgara con pausa'},
  {id:'f12',nombre:'Fondos lastrados en paralelas',bloque:'fuerza',musculos:'Pectoral inf., tríceps, deltoides',contraccion:'Concéntrica-excéntrica',patron:'Empuje vertical descendente',nivel:'Avanzado',equipo:'Paralelas + lastre',regresion:'Fondos sin lastre',progresion:'Fondos con déficit'},
  {id:'ac01',nombre:'Curl de bíceps con barra',bloque:'accesorios',musculos:'Bíceps, braquial, braquiorradial',contraccion:'Concéntrica-excéntrica',patron:'Tirón de codo',nivel:'Principiante',equipo:'Barra',regresion:'Curl con mancuernas',progresion:'Curl predicador barra EZ'},
  {id:'ac02',nombre:'Extensión de tríceps en polea',bloque:'accesorios',musculos:'Tríceps (tres cabezas)',contraccion:'Concéntrica-excéntrica',patron:'Extensión de codo',nivel:'Principiante',equipo:'Polea alta, cuerda',regresion:'Press francés mancuerna',progresion:'Extensión overhead polea'},
  {id:'ac03',nombre:'Elevaciones laterales mancuerna',bloque:'accesorios',musculos:'Deltoides medial',contraccion:'Concéntrica-excéntrica',patron:'Abducción de hombro',nivel:'Principiante',equipo:'Mancuernas',regresion:'Elevaciones con banda',progresion:'Laterales en cable'},
  {id:'ac04',nombre:'Remo en polea baja con cuerda',bloque:'accesorios',musculos:'Romboides, trapecio medio, bíceps',contraccion:'Concéntrica-excéntrica',patron:'Tirón horizontal',nivel:'Principiante',equipo:'Polea baja',regresion:'Remo con banda',progresion:'Remo con pausa'},
  {id:'ac05',nombre:'Aperturas en cable cruzado',bloque:'accesorios',musculos:'Pectoral mayor (fibras mediales)',contraccion:'Concéntrica-excéntrica',patron:'Aducción horizontal',nivel:'Principiante',equipo:'Cables cruzados',regresion:'Aperturas mancuernas',progresion:'Aperturas con pausa'},
  {id:'ac06',nombre:'Curl femoral acostado en máquina',bloque:'accesorios',musculos:'Isquiotibiales',contraccion:'Concéntrica-excéntrica',patron:'Flexión de rodilla',nivel:'Principiante',equipo:'Máquina curl femoral',regresion:'Curl femoral banda',progresion:'Curl femoral excéntrico'},
  {id:'ac07',nombre:'Extensión de cuádriceps en máquina',bloque:'accesorios',musculos:'Cuádriceps (4 cabezas)',contraccion:'Concéntrica-excéntrica',patron:'Extensión de rodilla',nivel:'Principiante',equipo:'Máquina extensión',regresion:'pr03',progresion:'Extensión unilateral'},
  {id:'ac08',nombre:'Gemelo parado en máquina',bloque:'accesorios',musculos:'Gastrocnemio',contraccion:'Concéntrica-excéntrica',patron:'Plantar-flexión',nivel:'Principiante',equipo:'Máquina gemelo',regresion:'Gemelo en escalón',progresion:'Gemelo unilateral'},
  {id:'ac09',nombre:'Jalón al pecho agarre neutro',bloque:'accesorios',musculos:'Dorsal, bíceps, romboides',contraccion:'Concéntrica-excéntrica',patron:'Tirón vertical',nivel:'Principiante',equipo:'Polea alta',regresion:'Jalón con banda',progresion:'Dominada agarre neutro'},
  {id:'ac10',nombre:'Press francés con mancuerna',bloque:'accesorios',musculos:'Tríceps (cabeza larga)',contraccion:'Concéntrica-excéntrica',patron:'Extensión de codo overhead',nivel:'Principiante',equipo:'Mancuerna',regresion:'ac02',progresion:'Press francés barra EZ'},
  {id:'ac11',nombre:'Pull-over en cable',bloque:'accesorios',musculos:'Dorsal, serrato, pectoral inferior',contraccion:'Concéntrica-excéntrica',patron:'Extensión de hombro',nivel:'Intermedio',equipo:'Polea alta',regresion:'Pull-over mancuerna',progresion:'Pull-over con pausa'},
  {id:'ac12',nombre:'Curl de bíceps en predicador',bloque:'accesorios',musculos:'Bíceps (pico de contracción)',contraccion:'Concéntrica-excéntrica',patron:'Tirón de codo',nivel:'Principiante',equipo:'Banco predicador, barra',regresion:'ac01',progresion:'Predicador excéntrico'},
  {id:'c01',nombre:'HIIT en cinta (30s/30s)',bloque:'cardio',musculos:'Cadena inf., cardiovascular',contraccion:'Dinámica cíclica',patron:'Carrera intervalada',nivel:'Intermedio',equipo:'Cinta',regresion:'Intervalos 20s/40s',progresion:'Intervalos 40s/20s'},
  {id:'c02',nombre:'Cardio estacionario en bicicleta',bloque:'cardio',musculos:'Cuádriceps, isquiotibiales, glúteo',contraccion:'Dinámica cíclica',patron:'Pedaleo',nivel:'Principiante',equipo:'Bicicleta estática',regresion:'',progresion:'Bicicleta en intervalos'},
  {id:'c03',nombre:'Remo en ergómetro',bloque:'cardio',musculos:'Cuerpo completo',contraccion:'Dinámica cíclica',patron:'Remo',nivel:'Intermedio',equipo:'Rowing machine',regresion:'Remo con pausas',progresion:'Intervalos en remo'},
  {id:'c04',nombre:'Saltar la cuerda',bloque:'cardio',musculos:'Gemelo, coordinación, cardiovascular',contraccion:'Reactiva pliométrica',patron:'Salto cíclico con impacto',nivel:'Intermedio',equipo:'Cuerda',regresion:'Saltos sin cuerda',progresion:'Double under'},
  {id:'c05',nombre:'Assault bike / AirBike',bloque:'cardio',musculos:'Cuerpo completo',contraccion:'Dinámica total',patron:'Ciclo push-pull + piernas',nivel:'Intermedio',equipo:'Assault bike',regresion:'c02',progresion:'Tabata assault bike'},
  {id:'c06',nombre:'LISS caminata inclinada',bloque:'cardio',musculos:'Cuádriceps, glúteo, cardiovascular',contraccion:'Dinámica baja intensidad',patron:'Marcha',nivel:'Principiante',equipo:'Cinta',regresion:'Caminata plana',progresion:'c01'},
  {id:'c07',nombre:'Escaladora (stepmill)',bloque:'cardio',musculos:'Glúteo, cuádriceps, cardiovascular',contraccion:'Concéntrica cíclica',patron:'Escalada',nivel:'Intermedio',equipo:'Stepmill',regresion:'c06',progresion:'Stepmill con intervalos'},
  {id:'c08',nombre:'Tabata (20s/10s x8)',bloque:'cardio',musculos:'Variable según ejercicio',contraccion:'Explosiva-dinámica',patron:'HIIT protocolo',nivel:'Avanzado',equipo:'Variable',regresion:'c01',progresion:'Tabata doble'},
  {id:'c09',nombre:'Circuito metabólico',bloque:'cardio',musculos:'Cuerpo completo',contraccion:'Dinámica multiarticular',patron:'Circuito',nivel:'Intermedio',equipo:'Variable',regresion:'Circuito con descanso',progresion:'AMRAP'},
  {id:'c10',nombre:'Sprints en cinta (10x20m)',bloque:'cardio',musculos:'Cuádriceps, isquiotibiales, glúteo',contraccion:'Explosiva-reactiva',patron:'Sprint con impacto',nivel:'Avanzado',equipo:'Cinta',regresion:'c01',progresion:'Sprint resistido'},
  {id:'c11',nombre:'Ciclo 30/30 en remo',bloque:'cardio',musculos:'Cuerpo completo, cardiovascular',contraccion:'Alta intensidad cíclica',patron:'Remo intervalado',nivel:'Intermedio',equipo:'Rowing machine',regresion:'c03',progresion:'Ciclo 40/20'},
  {id:'c12',nombre:'EMOM (every minute on the minute)',bloque:'cardio',musculos:'Variable',contraccion:'Dinámica intermitente',patron:'Protocolo de densidad',nivel:'Intermedio',equipo:'Variable',regresion:'AMRAP con descanso',progresion:'EMOM doble'},
  {id:'fr01',nombre:'Estiramiento psoas en lunge',bloque:'flex_recovery',musculos:'Psoas, recto femoral',contraccion:'Estiramiento pasivo',patron:'Extensión de cadera',nivel:'Principiante',equipo:'Suelo',regresion:'Estiramiento cadera decúbito',progresion:'Psoas con rotación torácica'},
  {id:'fr02',nombre:'Estiramiento isquiotibiales con banda',bloque:'flex_recovery',musculos:'Isquiotibiales, gemelo',contraccion:'Estiramiento pasivo',patron:'Flexión de cadera',nivel:'Principiante',equipo:'Banda, suelo',regresion:'Isquios sentado',progresion:'Isquios de pie'},
  {id:'fr03',nombre:'Estiramiento cuádriceps de pie',bloque:'flex_recovery',musculos:'Cuádriceps, recto femoral',contraccion:'Estiramiento pasivo',patron:'Flexión de rodilla',nivel:'Principiante',equipo:'Ninguno',regresion:'Estiramiento en suelo',progresion:'Unilateral con equilibrio'},
  {id:'fr04',nombre:'Estiramiento pectoral en marco',bloque:'flex_recovery',musculos:'Pectoral mayor, deltoides ant.',contraccion:'Estiramiento pasivo',patron:'Extensión de hombro',nivel:'Principiante',equipo:'Marco/poste',regresion:'Estiramiento cruzado',progresion:'Estiramiento con rotación'},
  {id:'fr05',nombre:'Estiramiento glúteo figura 4',bloque:'flex_recovery',musculos:'Glúteo mayor, piriforme',contraccion:'Estiramiento pasivo',patron:'Rotación externa de cadera',nivel:'Principiante',equipo:'Suelo/silla',regresion:'',progresion:'m02'},
  {id:'fr06',nombre:'Estiramiento de dorsal en polea',bloque:'flex_recovery',musculos:'Dorsal, serrato, intercostales',contraccion:'Estiramiento activo asistido',patron:'Extensión de hombro',nivel:'Principiante',equipo:'Polea',regresion:'Estiramiento dorsal en barra',progresion:'Estiramiento con rotación'},
  {id:'fr07',nombre:'Foam rolling cuádriceps',bloque:'flex_recovery',musculos:'Cuádriceps, fascia anterior',contraccion:'Liberación miofascial',patron:'Compresión y deslizamiento',nivel:'Principiante',equipo:'Foam roller',regresion:'Automasaje manual',progresion:'FR focalizado en puntos'},
  {id:'fr08',nombre:'Foam rolling columna dorsal',bloque:'flex_recovery',musculos:'Erector espinal, fascia toracolumbar',contraccion:'Liberación miofascial',patron:'Extensión torácica',nivel:'Principiante',equipo:'Foam roller',regresion:'',progresion:'m09'},
  {id:'fr09',nombre:'Foam rolling banda iliotibial',bloque:'flex_recovery',musculos:'TFL, banda iliotibial',contraccion:'Liberación miofascial',patron:'Compresión lateral',nivel:'Principiante',equipo:'Foam roller',regresion:'',progresion:'FR con pausa en puntos'},
  {id:'fr10',nombre:'Estiramiento de trapecio',bloque:'flex_recovery',musculos:'Trapecio superior, escalenos',contraccion:'Estiramiento pasivo',patron:'Flexión lateral de cuello',nivel:'Principiante',equipo:'Ninguno',regresion:'',progresion:'Estiramiento asistido'},
  {id:'fr11',nombre:'Respiración diafragmática',bloque:'flex_recovery',musculos:'Diafragma, core profundo',contraccion:'Dinámica baja intensidad',patron:'Respiración',nivel:'Principiante',equipo:'Ninguno',regresion:'',progresion:'Respiración con carga'},
  {id:'fr12',nombre:"Child's pose con respiración",bloque:'flex_recovery',musculos:'Dorsal, glúteo, columna',contraccion:'Estiramiento pasivo',patron:'Flexión global',nivel:'Principiante',equipo:'Suelo',regresion:'',progresion:"Child's pose con rotación"},
  {id:'po01',nombre:'Equilibrio monopodal estático',bloque:'propiocepcion',musculos:'Estabilizadores tobillo, glúteo, core',contraccion:'Isométrica',patron:'Estabilización unipodal',nivel:'Principiante',equipo:'Ninguno',regresion:'Equilibrio bipodal inestable',progresion:'po02'},
  {id:'po02',nombre:'Equilibrio monopodal con perturbación',bloque:'propiocepcion',musculos:'Cadena cinética inferior, core',contraccion:'Reactiva',patron:'Estabilización reactiva',nivel:'Intermedio',equipo:'Ninguno',regresion:'po01',progresion:'Equilibrio ojos cerrados'},
  {id:'po03',nombre:'BOSU squat',bloque:'propiocepcion',musculos:'Cuádriceps, glúteo, estabilizadores',contraccion:'Concéntrica-excéntrica',patron:'Empuje en superficie inestable',nivel:'Intermedio',equipo:'BOSU',regresion:'Squat convencional',progresion:'BOSU squat con carga'},
  {id:'po04',nombre:'Disco de equilibrio bipedestación',bloque:'propiocepcion',musculos:'Tobillo, rodilla, cadera',contraccion:'Isométrica reactiva',patron:'Estabilización global',nivel:'Principiante',equipo:'Disco de equilibrio',regresion:'po01',progresion:'po03'},
  {id:'po05',nombre:'Single-leg RDL sin carga',bloque:'propiocepcion',musculos:'Isquiotibiales, glúteo, estabilizadores',contraccion:'Excéntrica-concéntrica',patron:'Bisagra unilateral',nivel:'Intermedio',equipo:'Ninguno',regresion:'po01',progresion:'Single-leg RDL con mancuerna'},
  {id:'po06',nombre:'Perturbación lateral con banda',bloque:'propiocepcion',musculos:'Glúteo medio, estabilizadores rodilla',contraccion:'Reactiva',patron:'Estabilización lateral',nivel:'Intermedio',equipo:'Banda elástica',regresion:'po04',progresion:'Perturbación con carga'},
  {id:'po07',nombre:'Equilibrio en fitball sentado',bloque:'propiocepcion',musculos:'Core, cadera, columna',contraccion:'Isométrica',patron:'Estabilización de tronco',nivel:'Principiante',equipo:'Fitball',regresion:'Sentado en silla',progresion:'Fitball con movimiento brazos'},
  {id:'po08',nombre:'Catch and stabilize con pelota',bloque:'propiocepcion',musculos:'Miembro superior, hombro, core',contraccion:'Reactiva',patron:'Estabilización de hombro',nivel:'Intermedio',equipo:'Pelota',regresion:'Apoyo estático en pared',progresion:'Lanzamiento en inestable'},
  {id:'po09',nombre:'Tandem walk',bloque:'propiocepcion',musculos:'Tobillo, rodilla, cadera',contraccion:'Dinámica controlada',patron:'Marcha en línea',nivel:'Principiante',equipo:'Ninguno',regresion:'Caminata amplia',progresion:'Tandem ojos cerrados'},
  {id:'po10',nombre:'Step-up lento con equilibrio final',bloque:'propiocepcion',musculos:'Cuádriceps, glúteo, estabilizadores',contraccion:'Concéntrica lenta',patron:'Empuje unilateral controlado',nivel:'Intermedio',equipo:'Cajón',regresion:'po01',progresion:'Step-up con carga y equilibrio'},
  {id:'po11',nombre:'Estabilización dinámica de cadera',bloque:'propiocepcion',musculos:'Cadera, glúteo, core',contraccion:'Reactiva-isométrica',patron:'Control de cadera',nivel:'Intermedio',equipo:'Banda elástica',regresion:'Isométrico de cadera',progresion:'po06'},
  {id:'po12',nombre:'Equilibrio inestable + perturbación visual',bloque:'propiocepcion',musculos:'Sistema vestibular, cadena cinética',contraccion:'Reactiva global',patron:'Estabilización multisensorial',nivel:'Avanzado',equipo:'BOSU/disco',regresion:'po02',progresion:'Perturbación + tarea cognitiva'},
  {id:'fi01',nombre:'Turkish get-up',bloque:'funcional',musculos:'Hombro, core, cadera, cuádriceps',contraccion:'Dinámica multiplanar',patron:'Levantamiento del suelo',nivel:'Avanzado',equipo:'Kettlebell',regresion:'TGU sin carga',progresion:'TGU con mayor carga'},
  {id:'fi02',nombre:'KB complex (swing+clean+press)',bloque:'funcional',musculos:'Cuerpo completo',contraccion:'Explosiva-dinámica',patron:'Complejo multiarticular',nivel:'Avanzado',equipo:'Kettlebell',regresion:'pt08',progresion:'KB complex doble'},
  {id:'fi03',nombre:'Bear crawl',bloque:'funcional',musculos:'Hombros, core, cadera, cuádriceps',contraccion:'Dinámica ipsilateral',patron:'Cuadrupedia dinámica',nivel:'Intermedio',equipo:'Suelo',regresion:'Bear crawl estático',progresion:'Bear crawl con carga distal'},
  {id:'fi04',nombre:"Farmer's carry",bloque:'funcional',musculos:'Core, trapecios, antebrazos, glúteo',contraccion:'Isométrica-dinámica',patron:'Carga transportada',nivel:'Intermedio',equipo:'Mancuernas/KB/barra',regresion:'Carry unilateral',progresion:'fi10'},
  {id:'fi05',nombre:'Sled push',bloque:'funcional',musculos:'Cuádriceps, glúteo, core, hombros',contraccion:'Concéntrica empuje',patron:'Empuje horizontal con carga',nivel:'Intermedio',equipo:'Trineo',regresion:'Empuje de pared',progresion:'Sled push mayor carga'},
  {id:'fi06',nombre:'Battle ropes alternadas',bloque:'funcional',musculos:'Hombros, core, piernas',contraccion:'Dinámica ondulatoria',patron:'Movimiento alternado de brazos',nivel:'Intermedio',equipo:'Battle ropes',regresion:'Battle ropes bilateral',progresion:'Battle ropes con sentadilla'},
  {id:'fi07',nombre:'Sandbag clean and press',bloque:'funcional',musculos:'Cadena posterior, hombros, core',contraccion:'Explosiva-concéntrica',patron:'Levantamiento y empuje vertical',nivel:'Avanzado',equipo:'Sandbag',regresion:'Sandbag deadlift',progresion:'Sandbag thruster'},
  {id:'fi08',nombre:'Lunge con rotación y press',bloque:'funcional',musculos:'Cuádriceps, core, hombros, oblicuos',contraccion:'Dinámica multiplanar',patron:'Movimiento integrado',nivel:'Intermedio',equipo:'Mancuerna/balón',regresion:'Lunge + rotación sin press',progresion:'Lunge rot. press overhead'},
  {id:'fi09',nombre:'Burpee con remo en TRX',bloque:'funcional',musculos:'Cuerpo completo',contraccion:'Dinámica integrada',patron:'Empuje + tirón integrado',nivel:'Avanzado',equipo:'TRX',regresion:'Burpee sin remo',progresion:'Burpee con doble remo'},
  {id:'fi10',nombre:'Overhead carry',bloque:'funcional',musculos:'Hombros, core, trapecio, columna',contraccion:'Isométrica-dinámica',patron:'Estabilización overhead en movimiento',nivel:'Avanzado',equipo:'Mancuernas/KB',regresion:'fi04',progresion:'Overhead carry unilateral'},
  {id:'fi11',nombre:'Circuito de movimientos integrados',bloque:'funcional',musculos:'Cuerpo completo',contraccion:'Dinámica multiarticular',patron:'Circuito funcional',nivel:'Intermedio',equipo:'Variable',regresion:'Circuito con pausas',progresion:'Circuito a tiempo'},
  {id:'fi12',nombre:'Crawling pattern (reptación)',bloque:'funcional',musculos:'Core, hombros, cadera',contraccion:'Dinámica contralateral',patron:'Reptación',nivel:'Principiante',equipo:'Suelo',regresion:'fi03',progresion:'Reptación con carga'},
];

// ─── ESTILOS ────────────────────────────────────────────────────────────────
const mkS=()=>({
  page:{fontFamily:"Arial,sans-serif",background:'#F2F2F2',minHeight:'100vh'},
  hdr:{background:BK,padding:'10px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`3px solid ${R}`},
  tabBar:{background:'#141414',display:'flex',gap:0,borderBottom:`2px solid ${R}`},
  tb:(a,ac)=>({padding:'10px 18px',border:'none',background:'none',color:a?WH:G3,cursor:'pointer',fontSize:13,fontWeight:a?700:400,borderBottom:a?`3px solid ${ac||R}`:'3px solid transparent',fontFamily:'Arial,sans-serif',marginBottom:-2}),
  card:{background:WH,border:`1px solid ${G2}`,borderRadius:8,padding:'12px 14px',marginBottom:8},
  btnR:{background:R,color:WH,border:'none',borderRadius:5,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Arial,sans-serif'},
  btnBK:{background:BK,color:WH,border:'none',borderRadius:5,padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Arial,sans-serif'},
  btnG:{background:'none',border:`1px solid ${G2}`,borderRadius:5,padding:'6px 12px',cursor:'pointer',fontSize:12,color:G4,fontFamily:'Arial,sans-serif'},
  btnGreen:{background:'#16A34A',color:WH,border:'none',borderRadius:5,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Arial,sans-serif'},
  inp:{width:'100%',padding:'7px 9px',border:`1px solid ${G2}`,borderRadius:5,fontSize:12,outline:'none',fontFamily:'Arial,sans-serif',boxSizing:'border-box'},
  sel:{padding:'7px 9px',border:`1px solid ${G2}`,borderRadius:5,fontSize:12,background:WH,outline:'none',fontFamily:'Arial,sans-serif'},
  lbl:{display:'block',fontSize:10,fontWeight:700,color:G4,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3},
  tag:(c)=>({display:'inline-block',background:c,color:WH,fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:99}),
  bHdr:(t)=>({background:BLOCKS[t].color,color:WH,padding:'9px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}),
  ovFlag:{background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:4,padding:'1px 6px',fontSize:10,color:'#92400E',display:'inline-block',marginTop:2},
});

// ─── SCREENING VACÍO ────────────────────────────────────────────────────────
const emptyScreening=()=>({
  // Fase 1 — cliente
  fechaNac:'', genero:'', ocupacion:'',
  condicionMedica:'no', condicionDetalle:'',
  medicacion:'no', medicacionDetalle:'',
  lesionesActivas:'no', lesionesDetalle:'',
  cirugias:'no', cirugiasDetalle:'',
  dolorActual:'no', dolorDetalle:'',
  nivelActividad:'sedentario',
  expEntrenamiento:'sin_experiencia',
  entrenamientoActual:'no',
  objetivoPrincipal:'salud_bienestar',
  objetivoSecundario:'',
  sueño:'regular',
  estres:'moderado',
  // Fase 2 — profesional
  fechaEvaluacion:'', evaluador:'', derivadoA:'',
  peso:'', talla:'', imc:'', pctGrasa:'',
  perCintura:'', perCadera:'', fcReposo:'', ta:'',
  postura_hallazgos:'',
  movilidad_hallazgos:'',
  capacidades_hallazgos:'',
  // Banderas — clave para el filtro
  banderaRoja:'no', banderaNaranja:'no', banderaAmarilla:'no',
  restriccionImpacto:'no',
  restriccionOverhead:'no',
  restriccionCargaAxial:'no',
  otraRestriccion:'',
  // Síntesis
  hallazgosPrincipales:'', prioridades:'',
  nivelAsignado:'activa',
  semaforoAsignado:'verde',
  modalidades:[], frecuencia:'', duracion:'', revision:'',
  observaciones:'',
});

// ─── CLIENTE VACÍO ──────────────────────────────────────────────────────────
const emptyCliente=()=>({
  id:genId('cli'),
  nombre:'', apellido:'', documento:'', celular:'',
  nivel:'activa', semaforo:'pendiente',
  restricciones:'', restricciones_flags:{impacto:false,overhead:false,cargaAxial:false},
  fechaIngreso:new Date().toISOString().split('T')[0],
  fechaEval:'',
  notasInternas:'',
  screeningCompleto:false,
  screening:emptyScreening(),
  objetivo:'',
  criterios_personalizados:[],
  fisio_pacienteId:null,
});

// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const s=mkS();
  const [tab,setTab]=useState(()=>{
    try { return localStorage.getItem('activa_tab')||'clientes'; } catch { return 'clientes'; }
  });
  useEffect(()=>{
    try { localStorage.setItem('activa_tab',tab); } catch {}
  },[tab]);
  const [exs,setExs]=useState(DB0);
  const [session,setSession]=useState({obj:null,blocks:[],name:'',cliente:'',clienteId:null,fecha:new Date().toISOString().split('T')[0],notas:''});
  // ── DATOS EN TIEMPO REAL (Supabase) ──────────────────────────────────────
  const { clients: dbClients, loading: dbLoading, error: dbError, saveClient: dbSaveClient, deleteClient: dbDeleteClient, updateClient: dbUpdateClient } = useGymClients();
  const [clients, setClientsLocal] = useState([]);

  // Sincronizar clientes de DB con estado local
  useEffect(()=>{ setClientsLocal(dbClients); }, [dbClients]);

  // Wrappers que persisten en DB Y actualizan estado local
  const saveClientFn = useCallback(async (client) => {
    await dbSaveClient(client);
  }, [dbSaveClient]);

  const deleteClientFn = useCallback(async (id) => {
    await dbDeleteClient(id);
    if(session.clienteId===id) setSession(p=>({...p,clienteId:null,cliente:''}));
  }, [dbDeleteClient, session.clienteId]);

  const updateClientFn = useCallback(async (id, updates) => {
    await dbUpdateClient(id, updates);
  }, [dbUpdateClient]);
  const [dbFilter,setDbFilter]=useState('all');
  const [dbSearch,setDbSearch]=useState('');
  const [showExForm,setShowExForm]=useState(false);
  const [editingEx,setEditingEx]=useState(null);
  const [expandedBlock,setExpandedBlock]=useState(null);
  const [selBlock,setSelBlock]=useState(null);
  const [exSearch,setExSearch]=useState('');
  const [overrideState,setOverrideState]=useState(null);
  const [addBType,setAddBType]=useState('');
  const [addBPos,setAddBPos]=useState('');
  // brand persiste en localStorage — no se pierde al cambiar de pestaña
  const [brand,setBrand]=useState(()=>{
    try {
      const saved=localStorage.getItem('activa_brand');
      return saved ? JSON.parse(saved) : {gymName:'ACTIVA',gymSub:'FITNESS CLUB',logoImg:null,colorPrimary:'#CC0000',colorBg:'#1a1a1a'};
    } catch { return {gymName:'ACTIVA',gymSub:'FITNESS CLUB',logoImg:null,colorPrimary:'#CC0000',colorBg:'#1a1a1a'}; }
  });
  // Guardar brand en localStorage cada vez que cambia
  useEffect(()=>{
    try { localStorage.setItem('activa_brand', JSON.stringify(brand)); } catch {}
  },[brand]);
  const [clientWizard,setClientWizard]=useState(null);

  const logoInputRef=useRef();
  const emptyEx={id:'',nombre:'',bloque:'movilidad',musculos:'',contraccion:'',patron:'',nivel:'Principiante',equipo:'',regresion:'',progresion:''};

  const activeClient=useMemo(()=>session.clienteId?clients.find(c=>c.id===session.clienteId):null,[clients,session.clienteId]);

  // ─── LÓGICA DE SESIÓN ────────────────────────────────────────────────────
  const suggestBlocks=(obj)=>{
    const bs=OBJS[obj].blocks.map((type,i)=>({id:Date.now()+i,type,position:i+1,exercises:[],params:{series:3,reps:'10-12',rpe:7,tempo:'2-0-1',descanso:'90s'}}));
    setSession(p=>({...p,obj,blocks:bs,name:`Sesión ${OBJS[obj].label}`}));
  };
  const addBlock=()=>{
    if(!addBType||!addBPos||session.blocks.length>=7)return;
    const nb={id:Date.now(),type:addBType,position:parseInt(addBPos),exercises:[],params:{series:3,reps:'10-12',rpe:7,tempo:'2-0-1',descanso:'90s'}};
    setSession(p=>({...p,blocks:[...p.blocks,nb].sort((a,b)=>a.position-b.position)}));
    setAddBType('');setAddBPos('');
  };
  const removeBlock=(id)=>setSession(p=>({...p,blocks:p.blocks.filter(b=>b.id!==id)}));
  const addExToBlock=(blockId,exId,override=false,note='')=>{
    setSession(p=>({...p,blocks:p.blocks.map(b=>{
      if(b.id!==blockId||b.exercises.length>=5)return b;
      return{...b,exercises:[...b.exercises,{exId,override,note}]};
    })}));
  };
  const removeExFromBlock=(blockId,exId)=>setSession(p=>({...p,blocks:p.blocks.map(b=>{
    if(b.id!==blockId)return b;
    return{...b,exercises:b.exercises.filter(e=>e.exId!==exId)};
  })}));
  const updateParams=(blockId,key,val)=>setSession(p=>({...p,blocks:p.blocks.map(b=>b.id===blockId?{...b,params:{...b.params,[key]:val}}:b)}));

  const handlePickEx=(block,ex)=>{
    const rest=checkRestriction(ex,activeClient);
    if(rest==='block'){
      alert(`🚫 Ejercicio bloqueado\n\nEl semáforo ${SF[activeClient.semaforo].label} de ${activeClient.nombre} impide agregar este ejercicio.\n\nPatrón: ${ex.patron}`);
      return;
    }
    if(rest==='warn'){
      setOverrideState({blockId:block.id,ex,blockType:block.type,note:'',isRestriction:true});
      return;
    }
    if(ex.bloque!==block.type){setOverrideState({blockId:block.id,ex,blockType:block.type,note:'',isRestriction:false});}
    else{addExToBlock(block.id,ex.id);setSelBlock(null);setExSearch('');}
  };
  const confirmOverride=()=>{
    if(!overrideState)return;
    addExToBlock(overrideState.blockId,overrideState.ex.id,true,overrideState.note);
    setOverrideState(null);setSelBlock(null);setExSearch('');
  };

  // ─── GUARDAR CLIENTE ────────────────────────────────────────────────────
  const saveClient=(client)=>{
    saveClientFn(client).catch(e=>console.error('Error guardando cliente:',e));
    setClientWizard(null);
  };
  const deleteClient=(id)=>{
    deleteClientFn(id).catch(e=>console.error('Error eliminando cliente:',e));
  };

  // ─── EXPORTAR PDF ────────────────────────────────────────────────────────
  const exportPDF=()=>{
    const rows=session.blocks.map(b=>{
      const bd=BLOCKS[b.type];
      const exList=b.exercises.map(be=>{const ex=exs.find(e=>e.id===be.exId);return ex?`${ex.nombre}${be.override?' [OVR]':''}`:be.exId;}).join(' / ');
      return`<tr><td style="background:${bd.color};color:#fff;font-weight:700;padding:6px 10px;font-size:11px;">${b.position}</td><td style="background:${bd.color};color:#fff;font-weight:700;padding:6px 10px;font-size:11px;">${bd.label}</td><td style="padding:6px 10px;font-size:11px;">${exList||'—'}</td><td style="padding:6px 10px;font-size:11px;text-align:center;">${b.params.series}</td><td style="padding:6px 10px;font-size:11px;text-align:center;">${b.params.reps}</td><td style="padding:6px 10px;font-size:11px;text-align:center;">${b.params.rpe}</td><td style="padding:6px 10px;font-size:11px;text-align:center;">${b.params.tempo}</td><td style="padding:6px 10px;font-size:11px;text-align:center;">${b.params.descanso}</td></tr>`;
    }).join('');
    const sfBanner=activeClient?`<div style="margin-bottom:14px;padding:10px 14px;border-radius:6px;background:${SF[activeClient.semaforo].bg};border:1px solid ${SF[activeClient.semaforo].border};font-size:11px;"><strong>${SF[activeClient.semaforo].emoji} SEMÁFORO ${SF[activeClient.semaforo].label}</strong>${activeClient.restricciones?` · ${activeClient.restricciones}`:''}</div>`:'';
    const logoHtml=brand.logoImg
      ?`<div style="display:flex;align-items:center;gap:12px"><img src="${brand.logoImg}" style="height:50px;object-fit:contain;flex-shrink:0;"/><div><div style="font-family:Arial Black,Arial,sans-serif;font-weight:900;font-size:22px;color:${brand.colorPrimary};letter-spacing:2px;line-height:1">${brand.gymName}</div><div style="font-family:Arial,sans-serif;font-size:10px;color:#888;letter-spacing:3.5px;margin-top:3px">${brand.gymSub}</div></div></div>`
      :`<div><div style="font-size:22px;font-weight:900;color:${brand.colorPrimary};letter-spacing:2px;">${brand.gymName}</div><div style="font-size:10px;color:#888;letter-spacing:4px;">${brand.gymSub}</div></div>`;
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${session.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:28px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${brand.colorPrimary};padding-bottom:14px;margin-bottom:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1a1a1a;color:#fff;padding:8px 10px;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.06em}td{border-bottom:1px solid #e0e0e0}tr:nth-child(even) td{background:#f9f9f9}.footer{margin-top:24px;font-size:10px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:10px}.notas{margin-top:14px;background:#f9f9f9;border-left:4px solid ${brand.colorPrimary};padding:10px 14px;font-size:11px;color:#555}@media print{body{padding:16px}}</style></head><body><div class="hdr"><div>${logoHtml}</div><div style="text-align:right"><div style="font-size:16px;font-weight:800;color:#111">${session.name}</div><div style="font-size:10px;color:#666;margin-top:3px">Nivel: ${activeClient?NIVEL[activeClient.nivel].label:'—'} · Cliente: ${session.cliente||'—'} · Fecha: ${session.fecha}</div></div></div>${sfBanner}<table><thead><tr><th>#</th><th>Bloque</th><th>Ejercicios</th><th>Series</th><th>Reps</th><th>RPE</th><th>Tempo</th><th>Descanso</th></tr></thead><tbody>${rows}</tbody></table>${session.notas?`<div class="notas"><strong>Notas:</strong> ${session.notas}</div>`:''}<div class="footer">${brand.gymName} · ${brand.gymSub} · ${new Date().toLocaleDateString('es-ES')}</div><script>window.onload=()=>{window.print()}<\/script></body></html>`;
    const w=window.open('','_blank');w.document.write(html);w.document.close();
  };

  const exportCSV=()=>{
    const headers=['Posición','Bloque','Ejercicio','Override','Nota Override','Series','Reps','RPE','Tempo','Descanso','Cliente','Nivel','Semáforo','Restricciones','Objetivo','Fecha'];
    const rows=[];
    const nivelLabel=activeClient?NIVEL[activeClient.nivel].label:'';
    const sfLabel=activeClient?SF[activeClient.semaforo].label:'';
    const rest=activeClient?activeClient.restricciones:'';
    session.blocks.forEach(b=>{
      const bd=BLOCKS[b.type];
      if(b.exercises.length===0)rows.push([b.position,bd.label,'(sin ejercicios)','','',b.params.series,b.params.reps,b.params.rpe,b.params.tempo,b.params.descanso,session.cliente,nivelLabel,sfLabel,rest,session.obj?OBJS[session.obj].label:'',session.fecha]);
      else b.exercises.forEach(be=>{const ex=exs.find(e=>e.id===be.exId);rows.push([b.position,bd.label,ex?ex.nombre:be.exId,be.override?'SI':'NO',be.note||'',b.params.series,b.params.reps,b.params.rpe,b.params.tempo,b.params.descanso,session.cliente,nivelLabel,sfLabel,rest,session.obj?OBJS[session.obj].label:'',session.fecha]);});
    });
    const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${session.name.replace(/\s/g,'_')}_${session.fecha}.csv`;a.click();URL.revokeObjectURL(url);
  };

  const OverlayWrap=({children,wide})=>(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'20px 16px'}}>
      <div style={{background:WH,borderRadius:12,padding:24,width:'100%',maxWidth:wide?760:440,marginBottom:20}}>{children}</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // WIZARD DE ALTA DE CLIENTE
  // Paso 0 = Datos personales | Pasos 1-9 = Screening
  // ══════════════════════════════════════════════════════════════════════════
  const WIZARD_STEPS=[
    {title:'Datos personales',          icon:'👤',fase:1},
    {title:'Historia de salud',         icon:'🏥',fase:1},
    {title:'Historia de entrenamiento', icon:'🏋️',fase:1},
    {title:'Estilo de vida y objetivos',icon:'🌿',fase:1},
    {title:'Guardar / Agendar evaluación',icon:'💾',fase:'transicion'},
    {title:'Composición corporal',      icon:'📊',fase:2},
    {title:'Evaluación postural',       icon:'🔍',fase:2},
    {title:'Movilidad y control motor', icon:'🦵',fase:2},
    {title:'PVFI — Capacidades físicas',icon:'⚡',fase:2},
    {title:'Banderas clínicas',         icon:'🚩',fase:2},
    {title:'Síntesis y plan',           icon:'📋',fase:2},
  ];

  const ClientWizardModal=({clientWizard,saveClient,setClientWizard,brand,NIVEL,SF,OBJS,s,emptyScreening})=>{
    if(!clientWizard)return null;
    const [step,setStep]=useState(clientWizard.step||0);
    const [form,setForm]=useState(()=>({...clientWizard.cli}));
    const [sc,setSc]=useState(()=>({...clientWizard.cli.screening}));
    const set=(k,v)=>setForm(f=>({...f,[k]:v}));
    const setSCK=(k,v)=>setSc(f=>({...f,[k]:v}));
    const isNew=!clientWizard.cli.screeningCompleto;
    const totalSteps=WIZARD_STEPS.length;

    const finalize=()=>{
      const flags={
        impacto:sc.restriccionImpacto==='si',
        overhead:sc.restriccionOverhead==='si',
        cargaAxial:sc.restriccionCargaAxial==='si',
      };
      const resText=[
        sc.restriccionImpacto==='si'?'Sin impacto':'',
        sc.restriccionOverhead==='si'?'Sin overhead':'',
        sc.restriccionCargaAxial==='si'?'Sin carga axial':'',
        sc.otraRestriccion||'',
      ].filter(Boolean).join(' · ');
      const saved={
        ...form,
        nivel:sc.nivelAsignado,
        semaforo:sc.semaforoAsignado,
        restricciones:resText,
        restricciones_flags:flags,
        fechaEval:sc.fechaEvaluacion||new Date().toISOString().split('T')[0],
        screeningCompleto:true,
        screening:sc,
      };
      saveClient(saved);
    };

    const inp2=(k,placeholder='')=>(
      <input value={sc[k]||''} onChange={e=>setSCK(k,e.target.value)} placeholder={placeholder} style={s.inp}/>
    );
    const sel2=(k,opts)=>(
      <select value={sc[k]||''} onChange={e=>setSCK(k,e.target.value)} style={{...s.sel,width:'100%'}}>
        {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    );

    const renderStep=()=>{
      switch(step){
        // ── PASO 0: DATOS PERSONALES ──────────────────────────────────────
        case 0: return(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><span style={s.lbl}>Nombre *</span><input value={form.nombre} onChange={e=>set('nombre',e.target.value)} style={s.inp} placeholder="Nombre"/></div>
              <div><span style={s.lbl}>Apellido *</span><input value={form.apellido} onChange={e=>set('apellido',e.target.value)} style={s.inp} placeholder="Apellido"/></div>
              <div style={{gridColumn:'1/-1'}}>
                <span style={s.lbl}>🎯 Objetivo del cliente — condiciona criterios de evolución</span>
                <input value={form.objetivo||''} onChange={e=>set('objetivo',e.target.value)} placeholder="¿Qué quiere lograr? (Ej: volver a correr, trabajar sin dolor, levantar...)" style={s.inp}/>
                <div style={{fontSize:10,color:G3,marginTop:3}}>Este objetivo personaliza los criterios de avance entre fases del método.</div>
              </div>
              <div><span style={s.lbl}>N° de documento *</span><input value={form.documento} onChange={e=>set('documento',e.target.value)} style={s.inp} placeholder="CI / Pasaporte"/></div>
              <div><span style={s.lbl}>Celular *</span><input value={form.celular} onChange={e=>set('celular',e.target.value)} style={s.inp} placeholder="+598 9x xxx xxx"/></div>
              <div><span style={s.lbl}>Fecha de nacimiento</span><input type="date" value={sc.fechaNac} onChange={e=>setSCK('fechaNac',e.target.value)} style={s.inp}/></div>
              <div><span style={s.lbl}>Género</span>{sel2('genero',[['','Seleccionar'],['masculino','Masculino'],['femenino','Femenino']])}</div>
              <div style={{gridColumn:'1/-1'}}><span style={s.lbl}>Ocupación</span><input value={sc.ocupacion} onChange={e=>setSCK('ocupacion',e.target.value)} style={s.inp} placeholder="Trabajo / actividad principal"/></div>
              <div><span style={s.lbl}>Fecha de ingreso</span><input type="date" value={form.fechaIngreso} onChange={e=>set('fechaIngreso',e.target.value)} style={s.inp}/></div>
            </div>
          </div>
        );
        // ── PASO 1: HISTORIA DE SALUD ────────────────────────────────────
        case 1: return(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><span style={s.lbl}>A1. ¿Condición médica diagnosticada actualmente?</span>{sel2('condicionMedica',[['no','No'],['si','Sí']])}{sc.condicionMedica==='si'&&<input value={sc.condicionDetalle||''} onChange={e=>setSCK('condicionDetalle',e.target.value)} style={{...s.inp,marginTop:6}} placeholder="Especificar condición"/>}</div>
            <div><span style={s.lbl}>A2. ¿Toma medicación actualmente?</span>{sel2('medicacion',[['no','No'],['si','Sí']])}{sc.medicacion==='si'&&<input value={sc.medicacionDetalle||''} onChange={e=>setSCK('medicacionDetalle',e.target.value)} style={{...s.inp,marginTop:6}} placeholder="Especificar medicación"/>}</div>
            <div><span style={s.lbl}>A3. ¿Lesiones activas o dolor crónico?</span>{sel2('lesionesActivas',[['no','No'],['si','Sí — dolor activo'],['historia','Historia de lesiones']])}{sc.lesionesActivas!=='no'&&<input value={sc.lesionesDetalle||''} onChange={e=>setSCK('lesionesDetalle',e.target.value)} style={{...s.inp,marginTop:6}} placeholder="Zona, tiempo, diagnóstico si lo tiene"/>}</div>
            <div><span style={s.lbl}>A4. ¿Cirugías previas?</span>{sel2('cirugias',[['no','No'],['si','Sí']])}{sc.cirugias==='si'&&<input value={sc.cirugiasDetalle||''} onChange={e=>setSCK('cirugiasDetalle',e.target.value)} style={{...s.inp,marginTop:6}} placeholder="Tipo de cirugía y año"/>}</div>
            <div><span style={s.lbl}>A5. ¿Dolor actual al movimiento?</span>{sel2('dolorActual',[['no','No'],['leve','Leve (1-3/10)'],['moderado','Moderado (4-6/10)'],['intenso','Intenso (7+/10)']])}{sc.dolorActual!=='no'&&<input value={sc.dolorDetalle||''} onChange={e=>setSCK('dolorDetalle',e.target.value)} style={{...s.inp,marginTop:6}} placeholder="Localización y tipo de dolor"/>}</div>
          </div>
        );
        // ── PASO 2: HISTORIA DE ENTRENAMIENTO ────────────────────────────
        case 2: return(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><span style={s.lbl}>B1. Nivel de actividad física actual</span>{sel2('nivelActividad',[['sedentario','Sedentario (−1 vez/sem)'],['levemente_activo','Levemente activo (1-2 veces/sem)'],['moderadamente_activo','Moderadamente activo (3-4 veces/sem)'],['muy_activo','Muy activo (5+ veces/sem)'],['atleta','Atleta / competidor']])}</div>
            <div><span style={s.lbl}>B2. Experiencia previa en entrenamiento</span>{sel2('expEntrenamiento',[['sin_experiencia','Sin experiencia'],['menos_1_año','Menos de 1 año'],['1_3_años','1-3 años'],['mas_3_años','Más de 3 años'],['entrenamiento_dirigido','Entrenamiento dirigido/competitivo']])}</div>
            <div><span style={s.lbl}>B3. ¿Está entrenando actualmente?</span>{sel2('entrenamientoActual',[['no','No'],['si_gym','Sí — gimnasio'],['si_deporte','Sí — deporte'],['si_otro','Sí — otro tipo de actividad']])}</div>
            <div><span style={s.lbl}>B4. Experiencia con ejercicios específicos (libre)</span><input value={sc.expEjerciciosDetalle||''} onChange={e=>setSCK('expEjerciciosDetalle',e.target.value)} style={s.inp} placeholder="Ej: levantamiento olímpico, pilates, crossfit..."/></div>
          </div>
        );
        // ── PASO 3: ESTILO DE VIDA Y OBJETIVOS ───────────────────────────
        case 3: return(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><span style={s.lbl}>C1. Calidad del sueño</span>{sel2('sueño',[['bueno','Bueno (7-9h, reparador)'],['regular','Regular (interrumpido o insuficiente)'],['malo','Malo (menos de 6h o no reparador)']])}</div>
            <div><span style={s.lbl}>C2. Nivel de estrés percibido</span>{sel2('estres',[['bajo','Bajo'],['moderado','Moderado'],['alto','Alto'],['muy_alto','Muy alto — interfiere con la vida diaria']])}</div>
            <div><span style={s.lbl}>D1. Objetivo principal</span>{sel2('objetivoPrincipal',[['salud_bienestar','Salud y bienestar general'],['perdida_grasa','Pérdida de grasa / composición corporal'],['hipertrofia','Aumento de masa muscular'],['fuerza','Ganancia de fuerza'],['rendimiento','Rendimiento deportivo'],['rehabilitacion','Rehabilitación / recuperación de lesión'],['otro','Otro']])}</div>
            <div><span style={s.lbl}>D2. Expectativas adicionales / restricciones de tiempo</span><input value={sc.expectativas||''} onChange={e=>setSCK('expectativas',e.target.value)} style={s.inp} placeholder="Disponibilidad horaria, compromisos, limitaciones logísticas..."/></div>
          </div>
        );
        // ── PASO 4: GUARDAR / AGENDAR EVALUACIÓN ────────────────────────
        case 4: return(
          <div>
            <div style={{background:'#1a1a1a',border:'2px solid #CC0000',borderRadius:10,padding:'18px 16px',marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8}}>💾</div>
              <div style={{fontWeight:800,fontSize:15,color:WH,marginBottom:6}}>Fase 1 completada</div>
              <div style={{fontSize:12,color:G3,lineHeight:1.7}}>Los datos personales y la historia clínica de <strong style={{color:WH}}>{form.nombre} {form.apellido}</strong> están registrados.<br/>Podés guardar la ficha ahora y completar la evaluación funcional en otro momento.</div>
            </div>
            <div style={{...s.card,borderLeft:'4px solid #16A34A',marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'#16A34A'}}>✓ Guardar y continuar después</div>
              <div style={{fontSize:12,color:G4,lineHeight:1.6,marginBottom:12}}>La ficha queda guardada con semáforo ⏳ PENDIENTE. El cliente aparece en el directorio pero no está disponible para construir sesiones hasta completar la evaluación funcional.</div>
              <button onClick={()=>{
                const saved={...form,nivel:'activa',semaforo:'pendiente',restricciones:'',restricciones_flags:{impacto:false,overhead:false,cargaAxial:false},fechaEval:'',screeningCompleto:false,screening:{...emptyScreening(),...sc}};
                saveClient(saved);
              }} style={{...s.btnGreen,width:'100%',padding:'11px',fontSize:13}}>Guardar ficha — completar evaluación después</button>
            </div>
            <div style={{...s.card,borderLeft:'4px solid #D97706',marginBottom:12,background:'#FFFBEB'}}>
              <div style={{fontWeight:700,fontSize:12,color:'#92400E',marginBottom:4}}>📅 Recordatorio</div>
              <div style={{fontSize:12,color:'#78350F',lineHeight:1.6}}>Agendá una consulta de <strong>45–60 minutos</strong> para completar la evaluación funcional (Fases 2: composición corporal, postura, movilidad, capacidades físicas y banderas clínicas).<br/><br/>Hasta completarla, el cliente no tendrá semáforo asignado ni filtro de ejercicios activo.</div>
            </div>
            <div style={{...s.card,borderLeft:'4px solid #1D4ED8'}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'#1D4ED8'}}>→ Continuar ahora con la Fase 2</div>
              <div style={{fontSize:12,color:G4,marginBottom:0}}>Si el tiempo lo permite, continuá con la evaluación profesional en esta misma sesión.</div>
            </div>
          </div>
        );
        // ── PASO 5: COMPOSICIÓN CORPORAL ─────────────────────────────────
        case 5: return(
          <div>
            <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:6,padding:'8px 10px',fontSize:11,marginBottom:12}}>🩺 <strong>Fase 2 — Evaluación profesional.</strong> Completado por el equipo del centro.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div><span style={s.lbl}>Fecha de evaluación</span><input type="date" value={sc.fechaEvaluacion||''} onChange={e=>setSCK('fechaEvaluacion',e.target.value)} style={s.inp}/></div>
              <div><span style={s.lbl}>Evaluador/es</span><input value={sc.evaluador||''} onChange={e=>setSCK('evaluador',e.target.value)} style={s.inp} placeholder="Nombre y cargo"/></div>
              <div><span style={s.lbl}>Derivado a</span>{sel2('derivadoA',[['','Seleccionar'],['clinica','Clínica'],['entrenamiento','Entrenamiento'],['ambos','Ambos']])}</div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:G4,textTransform:'uppercase',marginBottom:8,letterSpacing:'.04em'}}>Antropometría básica</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
              {[['peso','Peso (kg)'],['talla','Talla (cm)'],['imc','IMC (kg/m²)'],['pctGrasa','% Grasa corporal'],['fcReposo','FC reposo (lpm)'],['ta','Tensión arterial']].map(([k,lbl])=>(
                <div key={k}><span style={s.lbl}>{lbl}</span><input value={sc[k]||''} onChange={e=>setSCK(k,e.target.value)} style={s.inp}/></div>
              ))}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:G4,textTransform:'uppercase',marginBottom:8,letterSpacing:'.04em'}}>Circunferencias corporales (cm)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[
                ['per_cintura_escapular','Cintura escapular'],
                ['per_brazo_d','Brazo derecho'],
                ['per_brazo_i','Brazo izquierdo'],
                ['per_cintura','Cintura (ombligo)'],
                ['per_cadera','Cadera (trocánter)'],
                ['per_muslo_d','Muslo derecho'],
                ['per_muslo_i','Muslo izquierdo'],
                ['per_pantorrilla_d','Pantorrilla derecha'],
                ['per_pantorrilla_i','Pantorrilla izquierda'],
              ].map(([k,lbl])=>(
                <div key={k}><span style={s.lbl}>{lbl}</span><input value={sc[k]||''} onChange={e=>setSCK(k,e.target.value)} style={s.inp} placeholder="cm"/></div>
              ))}
            </div>
          </div>
        );
        // ── PASO 6: EVALUACIÓN POSTURAL ──────────────────────────────────
        case 6: return(
          <div>
            <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:6,padding:'8px 10px',fontSize:11,marginBottom:12}}>🩺 <strong>Fase 2.</strong> Registrar hallazgos posturales principales.</div>
            {[
              ['postura_cabeza','Alineación de cabeza',['Centrada','Lateralización D','Lateralización I','Antepulsión']],
              ['postura_hombros','Nivel de hombros',['Simétrico','Elevado derecho','Elevado izquierdo']],
              ['postura_columna_lat','Curva lumbar (lateral)',['Normal','Hiperlordosis','Rectificación']],
              ['postura_columna_tor','Curva torácica',['Normal','Hipercifosis','Rectificación']],
              ['postura_pelvis','Posición pélvica',['Neutra','Anteversión','Retroversión']],
              ['postura_rodillas','Rodillas',['Neutro','Valgo bilateral','Varo bilateral','Hiperextensión']],
              ['postura_pies','Pies',['Neutro','Pronación bilateral','Supinación bilateral','Asimétrico']],
            ].map(([k,lbl,opts])=>(
              <div key={k} style={{marginBottom:8,display:'grid',gridTemplateColumns:'160px 1fr',gap:8,alignItems:'center'}}>
                <span style={{fontSize:11,fontWeight:600}}>{lbl}</span>
                <select value={sc[k]||opts[0]} onChange={e=>setSCK(k,e.target.value)} style={{...s.sel,width:'100%'}}>
                  {opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{marginTop:10}}><span style={s.lbl}>Observaciones posturales adicionales</span><textarea value={sc.postura_hallazgos||''} onChange={e=>setSCK('postura_hallazgos',e.target.value)} rows={3} placeholder="Detalles relevantes..." style={{...s.inp,resize:'vertical'}}/></div>
          </div>
        );
        // ── PASO 7: MOVILIDAD Y CONTROL MOTOR ────────────────────────────
        case 7: return(
          <div>
            <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:6,padding:'8px 10px',fontSize:11,marginBottom:10}}>
              🩺 Escala: <strong>N</strong> = Normal · <strong>L</strong> = Limitado · <strong>ML</strong> = Muy limitado · <strong>D</strong> = Dolor presente
            </div>
            <div style={{fontSize:11,fontWeight:700,color:G4,textTransform:'uppercase',marginBottom:6}}>Screening de movilidad articular</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 70px 70px',gap:4,marginBottom:2}}>
              <div style={{fontSize:9,color:G3,fontWeight:700,textTransform:'uppercase',paddingLeft:4}}>Movimiento · Referencia</div>
              <div style={{fontSize:9,color:G3,fontWeight:700,textAlign:'center'}}>Der/Bil</div>
              <div style={{fontSize:9,color:G3,fontWeight:700,textAlign:'center'}}>Izq</div>
            </div>
            {[
              ['mov_tobillo','Dorsiflexión tobillo','Normal ≥20° · Disfunc <10°'],
              ['mov_cad_rot','Rotación interna cadera','Normal 40-45° · Disfunc <30°'],
              ['mov_cad_flex','Flexión de cadera activa','Normal 90-120° · Disfunc <70°'],
              ['mov_tor_rot','Rotación torácica','Normal 45°/lado · Disfunc <30°'],
              ['mov_hombro_flex','Elevación hombro (flexión)','Normal 180° · Disfunc <150°'],
              ['mov_hombro_ri','Rotación interna hombro','Normal 70° · Disfunc <45°'],
              ['mov_hombro_re','Rotación externa hombro','Normal 90° · Disfunc <60°'],
            ].map(([k,lbl,ref])=>(
              <div key={k} style={{marginBottom:6,display:'grid',gridTemplateColumns:'1fr 70px 70px',gap:4,alignItems:'center',background:G1,borderRadius:5,padding:'5px 8px'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:600}}>{lbl}</div>
                  <div style={{fontSize:9,color:G3}}>{ref}</div>
                </div>
                {['DBil','Izq'].map(side=>(
                  <select key={side} value={sc[k+'_'+side]||'N'} onChange={e=>setSCK(k+'_'+side,e.target.value)} style={{...s.sel,fontSize:11,textAlign:'center'}}>
                    {['N','L','ML','D'].map(o=><option key={o}>{o}</option>)}
                  </select>
                ))}
              </div>
            ))}
            <div style={{fontSize:11,fontWeight:700,color:G4,textTransform:'uppercase',margin:'14px 0 8px'}}>Estabilidad y control motor</div>
            {[
              ['cm_squat','Deep squat / Overhead squat',['Óptimo','Compensaciones leves','Compensaciones marcadas','No puede realizarlo']],
              ['cm_lunge','Estocada estática',['Óptimo D/I','Falla derecho','Falla izquierdo','Falla bilateral']],
              ['cm_sls','Single leg stance (30s)',['Estable D/I','Inestable derecho','Inestable izquierdo','Inestable bilateral']],
              ['cm_birddog','Bird-dog (rotary stability)',['Óptimo','Rotación pélvica','Inestabilidad marcada','No puede realizarlo']],
              ['cm_deadbug','Dead bug (control lumbo-pélvico)',['Óptimo','Pierde neutro lumbar','No puede realizarlo']],
              ['cm_bisagra','Bisagra de cadera con palo',['Óptimo','Compensaciones leves','Compensaciones marcadas','No puede realizarlo']],
            ].map(([k,lbl,opts])=>(
              <div key={k} style={{marginBottom:6,display:'grid',gridTemplateColumns:'1fr 180px',gap:8,alignItems:'center',background:G1,borderRadius:5,padding:'5px 8px'}}>
                <span style={{fontSize:11,fontWeight:600}}>{lbl}</span>
                <select value={sc[k]||opts[0]} onChange={e=>setSCK(k,e.target.value)} style={{...s.sel,width:'100%',fontSize:11}}>
                  {opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{marginTop:12,background:G1,borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:8,color:G4,textTransform:'uppercase'}}>Y Reach Test — Balance dinámico (cm)</div>
              <div style={{display:'grid',gridTemplateColumns:'120px 1fr 1fr 1fr',gap:6,marginBottom:4}}>
                <div/>
                {['Anterior','Posteromedial','Posterolateral'].map(d=><div key={d} style={{fontSize:9,color:G3,fontWeight:700,textAlign:'center',textTransform:'uppercase'}}>{d}</div>)}
              </div>
              {['Pierna derecha','Pierna izquierda'].map((pierna,pi)=>(
                <div key={pi} style={{display:'grid',gridTemplateColumns:'120px 1fr 1fr 1fr',gap:6,marginBottom:6,alignItems:'center'}}>
                  <span style={{fontSize:11,fontWeight:600}}>{pierna}</span>
                  {['ant','pm','pl'].map(dir=>(
                    <input key={dir} value={sc[`yreach_${pi===0?'d':'i'}_${dir}`]||''} onChange={e=>setSCK(`yreach_${pi===0?'d':'i'}_${dir}`,e.target.value)} placeholder="cm" style={{...s.inp,fontSize:11,textAlign:'center'}}/>
                  ))}
                </div>
              ))}
              <div style={{fontSize:10,color:G3,marginTop:4}}>Referencia: diferencia bilateral &gt;4 cm = asimetría significativa. Riesgo de lesión si &lt;89% del largo de pierna en dirección anterior.</div>
            </div>
            <div style={{marginTop:10}}><span style={s.lbl}>Observaciones movilidad y control motor</span><textarea value={sc.movilidad_hallazgos||''} onChange={e=>setSCK('movilidad_hallazgos',e.target.value)} rows={2} placeholder="Compensaciones, asimetrías relevantes..." style={{...s.inp,resize:'vertical'}}/></div>
          </div>
        );
        // ── PASO 8: PVFI — CAPACIDADES FÍSICAS ───────────────────────────
        case 8: return(
          <div>
            <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,marginBottom:14}}>⚠️ <strong>No aplicar en perfil RESTAURA.</strong> Omitir tests con contraindicación clínica. Seleccionar el bloque según perfil del evaluado.</div>
            <div style={{fontSize:12,fontWeight:800,color:BK,marginBottom:10,borderBottom:`2px solid ${R}`,paddingBottom:6}}>PVFI — Ficha de Valoración Funcional Integral</div>

            {/* BLOQUE 1: ADULTO MAYOR / FRAGILIDAD */}
            <div style={{marginBottom:16}}>
              <div style={{background:BK,color:WH,borderRadius:'6px 6px 0 0',padding:'7px 12px',fontSize:11,fontWeight:700}}>🧓 BLOQUE 1 — Adulto mayor / Fragilidad <span style={{fontWeight:400,color:G3,marginLeft:8}}>+60 años o movilidad muy reducida</span></div>
              <div style={{border:`1px solid ${G2}`,borderTop:'none',borderRadius:'0 0 6px 6px',padding:'10px 12px',display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {k:'pvfi_chair_stand',lbl:'1. 30s Chair Stand — Fuerza tren inferior',unit:'reps',ref:'🔴 <8 rep · 🟢 12–17 rep',obs:'pvfi_chair_stand_obs',obsPlaceholder:'Calidad del apoyo, uso de manos, fatiga'},
                  {k:'pvfi_dino_d',lbl:'2. Dinamometría — Mano derecha',unit:'kg',ref:'H >27 kg · M >16 kg',obs:'pvfi_dino_d_obs',obsPlaceholder:'Asimetrías o dolor en el agarre'},
                  {k:'pvfi_dino_i',lbl:'Dinamometría — Mano izquierda',unit:'kg',ref:'H >27 kg · M >16 kg',obs:null},
                  {k:'pvfi_tug',lbl:'3. TUG Test — Agilidad y movilidad',unit:'seg',ref:'🔴 >20s · 🟢 <10s',obs:'pvfi_tug_obs',obsPlaceholder:'Equilibrio en el giro, fluidez de marcha'},
                  {k:'pvfi_plancha_elev',lbl:'4. Plancha elevada — Resistencia core',unit:'seg',ref:'Mínimo >30 seg',obs:'pvfi_plancha_elev_obs',obsPlaceholder:'Compensación lumbar, control escapular'},
                ].map(({k,lbl,unit,ref,obs,obsPlaceholder})=>(
                  <div key={k} style={{background:G1,borderRadius:6,padding:'8px 10px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:8,alignItems:'center',marginBottom:obs?6:0}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700}}>{lbl}</div>
                        <div style={{fontSize:10,color:G3}}>{ref}</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <input value={sc[k]||''} onChange={e=>setSCK(k,e.target.value)} placeholder="—" style={{...s.inp,textAlign:'center',fontSize:11}}/>
                        <span style={{fontSize:10,color:G4,whiteSpace:'nowrap'}}>{unit}</span>
                      </div>
                    </div>
                    {obs&&<input value={sc[obs]||''} onChange={e=>setSCK(obs,e.target.value)} placeholder={`Obs: ${obsPlaceholder}`} style={{...s.inp,fontSize:10,color:G4}}/>}
                  </div>
                ))}
              </div>
            </div>

            {/* BLOQUE 2: ADULTO SEDENTARIO / INEXPERTO */}
            <div style={{marginBottom:16}}>
              <div style={{background:BK,color:WH,borderRadius:'6px 6px 0 0',padding:'7px 12px',fontSize:11,fontWeight:700}}>🏃 BLOQUE 2 — Adulto sedentario / Inexperto <span style={{fontWeight:400,color:G3,marginLeft:8}}>20–59 años</span></div>
              <div style={{border:`1px solid ${G2}`,borderTop:'none',borderRadius:'0 0 6px 6px',padding:'10px 12px',display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {k:'pvfi_wallsit',lbl:'1. Wall Sit 90° — Resistencia tren inferior',unit:'seg',ref:'Pobre <25s · Promedio 35–50s · Pro >60s',obs:'pvfi_wallsit_obs',obsPlaceholder:'Temblor, valgo de rodilla'},
                  {k:'pvfi_pushup_rod',lbl:'2. Push-Up en rodillas — Fuerza empuje',unit:'reps',ref:'Pobre <10 · Promedio 15–24 · Pro >25',obs:'pvfi_pushup_rod_obs',obsPlaceholder:'Estabilidad escapular, control de cadera'},
                  {k:'pvfi_plancha_suelo',lbl:'3. Plancha frontal suelo — Resistencia core',unit:'seg',ref:'Pobre <30s · Promedio 45–75s · Pro >90s',obs:'pvfi_plancha_suelo_obs',obsPlaceholder:'Pérdida de alineación, dolor lumbar'},
                  {k:'pvfi_row_iso',lbl:'4. Row isométrico / Suspensión — Fuerza tracción',unit:'seg',ref:'Mínimo >30 seg',obs:'pvfi_row_iso_obs',obsPlaceholder:'Capacidad de retracción escapular'},
                  {k:'pvfi_dino2',lbl:'5. Dinamometría — Fuerza tren superior',unit:'kg',ref:'H >35 kg · M >22 kg',obs:'pvfi_dino2_obs',obsPlaceholder:'Fuerza relativa al peso corporal'},
                ].map(({k,lbl,unit,ref,obs,obsPlaceholder})=>(
                  <div key={k} style={{background:G1,borderRadius:6,padding:'8px 10px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:8,alignItems:'center',marginBottom:obs?6:0}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700}}>{lbl}</div>
                        <div style={{fontSize:10,color:G3}}>{ref}</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <input value={sc[k]||''} onChange={e=>setSCK(k,e.target.value)} placeholder="—" style={{...s.inp,textAlign:'center',fontSize:11}}/>
                        <span style={{fontSize:10,color:G4,whiteSpace:'nowrap'}}>{unit}</span>
                      </div>
                    </div>
                    {obs&&<input value={sc[obs]||''} onChange={e=>setSCK(obs,e.target.value)} placeholder={`Obs: ${obsPlaceholder}`} style={{...s.inp,fontSize:10,color:G4}}/>}
                  </div>
                ))}
              </div>
            </div>

            {/* BLOQUE 3: SEMÁFORO DE PRIORIDADES */}
            <div style={{marginBottom:14}}>
              <div style={{background:BK,color:WH,borderRadius:'6px 6px 0 0',padding:'7px 12px',fontSize:11,fontWeight:700}}>🚦 BLOQUE 3 — Semáforo de prioridades <span style={{fontWeight:400,color:G3,marginLeft:8}}>Criterio multidisciplinario</span></div>
              <div style={{border:`1px solid ${G2}`,borderTop:'none',borderRadius:'0 0 6px 6px',padding:'10px 12px'}}>
                {[
                  ['pvfi_nivel_rojo','🔴 NIVEL ROJO — Rehabilitación / Adaptación','Riesgos funcionales o valores de fragilidad. Programa centrado en movilidad segura, estabilidad y fuerza base bajo supervisión estricta.'],
                  ['pvfi_nivel_amarillo','🟡 NIVEL AMARILLO — Acondicionamiento','Valores en rangos mínimos o promedio bajo. Corregir asimetrías, mejorar técnica y aumentar capacidad de carga progresivamente.'],
                  ['pvfi_nivel_verde','🟢 NIVEL VERDE — Optimización','Buen punto de partida. Listo para programas de rendimiento, hipertrofia o metas estéticas/deportivas.'],
                ].map(([k,titulo,desc])=>(
                  <div key={k} onClick={()=>setSCK('pvfi_nivel',k.replace('pvfi_nivel_',''))} style={{display:'grid',gridTemplateColumns:'1fr 32px',gap:8,alignItems:'center',marginBottom:8,border:`2px solid ${sc.pvfi_nivel===k.replace('pvfi_nivel_','')?R:G2}`,borderRadius:6,padding:'8px 10px',cursor:'pointer',background:sc.pvfi_nivel===k.replace('pvfi_nivel_','')?'#FEF2F2':WH}}>
                    <div><div style={{fontSize:11,fontWeight:700}}>{titulo}</div><div style={{fontSize:10,color:G4,marginTop:2}}>{desc}</div></div>
                    <div style={{width:22,height:22,borderRadius:4,border:`2px solid ${sc.pvfi_nivel===k.replace('pvfi_nivel_','')?R:G2}`,background:sc.pvfi_nivel===k.replace('pvfi_nivel_','')?R:WH,display:'flex',alignItems:'center',justifyContent:'center',color:WH,fontSize:12,fontWeight:700,flexShrink:0}}>{sc.pvfi_nivel===k.replace('pvfi_nivel_','')&&'✓'}</div>
                  </div>
                ))}
                <div style={{marginTop:8}}><span style={s.lbl}>Notas del equipo (fisio/entrenador)</span><textarea value={sc.pvfi_notas||''} onChange={e=>setSCK('pvfi_notas',e.target.value)} rows={2} placeholder="Observaciones integradas del equipo..." style={{...s.inp,resize:'vertical'}}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
                  <div><span style={s.lbl}>Próxima evaluación</span><input type="date" value={sc.pvfi_proxima_eval||''} onChange={e=>setSCK('pvfi_proxima_eval',e.target.value)} style={s.inp}/></div>
                  <div style={{display:'flex',alignItems:'flex-end'}}><div style={{fontSize:10,color:G3,lineHeight:1.5}}>Recomendado: 8–12 semanas desde la evaluación inicial.</div></div>
                </div>
              </div>
            </div>
          </div>
        );
        // ── PASO 9: BANDERAS CLÍNICAS ────────────────────────────────────
        case 9: return(
          <div>
            <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:6,padding:'8px 10px',fontSize:11,marginBottom:12}}>🔒 <strong>Completado exclusivamente por fisioterapeuta.</strong> Lectura permitida al entrenador.</div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
              {[
                ['banderaRoja','🔴 Bandera Roja','Patología seria: tumor, fractura, infección, neurológico','Derivación médica inmediata'],
                ['banderaNaranja','🟠 Bandera Naranja','Trastorno psicológico que influye en el dolor','Comunicación con salud mental'],
                ['banderaAmarilla','🟡 Bandera Amarilla','Miedo al movimiento, catastrofismo, kinesiofobia','Abordaje educativo + progresión gradual'],
              ].map(([k,titulo,desc,accion])=>(
                <div key={k} style={{display:'grid',gridTemplateColumns:'1fr 100px',gap:8,alignItems:'center',background:G1,borderRadius:6,padding:'8px 10px'}}>
                  <div><div style={{fontSize:12,fontWeight:700}}>{titulo}</div><div style={{fontSize:10,color:G4}}>{desc}</div><div style={{fontSize:10,color:R,marginTop:2}}>{accion}</div></div>
                  <select value={sc[k]||'no'} onChange={e=>setSCK(k,e.target.value)} style={{...s.sel}}>
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:G4,textTransform:'uppercase',marginBottom:8}}>Restricciones activas — alimentan el filtro de ejercicios</div>
            {[
              ['restriccionImpacto','🚫 Restricción de impacto','Sin saltos, carrera, pliometría → bloquea bloque Potencia'],
              ['restriccionOverhead','🚫 Restricción overhead','Sin cargas sobre la cabeza → alerta en empuje vertical'],
              ['restriccionCargaAxial','⚠️ Restricción carga axial','Sin sentadilla/peso muerto pesados → alerta en Fuerza bilateral'],
            ].map(([k,titulo,desc])=>(
              <div key={k} style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:8,alignItems:'center',marginBottom:8,border:`1px solid ${G2}`,borderRadius:6,padding:'8px 10px'}}>
                <div><div style={{fontSize:12,fontWeight:700}}>{titulo}</div><div style={{fontSize:10,color:G4}}>{desc}</div></div>
                <select value={sc[k]||'no'} onChange={e=>setSCK(k,e.target.value)} style={s.sel}>
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>
            ))}
            <div style={{marginTop:8}}><span style={s.lbl}>Otra restricción específica</span><input value={sc.otraRestriccion||''} onChange={e=>setSCK('otraRestriccion',e.target.value)} style={s.inp} placeholder="Especificar si aplica"/></div>
            <div style={{marginTop:14}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>🚦 Semáforo de carga — Estado para el entrenador</div>
              <div style={{display:'flex',gap:8}}>
                {[['verde','🟢 Verde — Sin restricciones'],['amarillo','🟡 Amarillo — Restricciones parciales'],['rojo','🔴 Rojo — Solo clínica']].map(([v,l])=>{
                  const sfv=SF[v];
                  return(
                    <div key={v} onClick={()=>setSCK('semaforoAsignado',v)} style={{flex:1,padding:'10px 8px',borderRadius:8,border:`2px solid ${sc.semaforoAsignado===v?sfv.color:G2}`,background:sc.semaforoAsignado===v?sfv.bg:WH,cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:sc.semaforoAsignado===v?700:400,color:sc.semaforoAsignado===v?sfv.color:'#333',transition:'all .15s'}}>
                      {l}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
        // ── PASO 10: SÍNTESIS Y PLAN ─────────────────────────────────────
        case 10: return(
          <div>
            <div><span style={s.lbl}>Hallazgos principales</span><textarea value={sc.hallazgosPrincipales||''} onChange={e=>setSCK('hallazgosPrincipales',e.target.value)} rows={3} placeholder="1.&#10;2.&#10;3." style={{...s.inp,resize:'vertical'}}/></div>
            <div style={{marginTop:10}}><span style={s.lbl}>Prioridades de trabajo</span><textarea value={sc.prioridades||''} onChange={e=>setSCK('prioridades',e.target.value)} rows={3} placeholder="1.&#10;2.&#10;3." style={{...s.inp,resize:'vertical'}}/></div>
            <div style={{marginTop:14,fontSize:11,fontWeight:700,marginBottom:8}}>Asignación de nivel — Método Activa Integra</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {Object.entries(NIVEL).map(([k,v])=>(
                <div key={k} onClick={()=>setSCK('nivelAsignado',k)} style={{padding:'12px',borderRadius:8,border:`2px solid ${sc.nivelAsignado===k?v.color:G2}`,background:sc.nivelAsignado===k?`${v.color}14`:WH,cursor:'pointer',transition:'all .15s'}}>
                  <div style={{fontWeight:800,color:v.color,fontSize:12}}>{v.badge} · {v.label}</div>
                  <div style={{fontSize:11,color:G4,marginTop:2}}>{v.desc}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
              <div><span style={s.lbl}>Frecuencia semanal</span><input value={sc.frecuencia||''} onChange={e=>setSCK('frecuencia',e.target.value)} style={s.inp} placeholder="ej: 3 sesiones"/></div>
              <div><span style={s.lbl}>Duración por sesión</span><input value={sc.duracion||''} onChange={e=>setSCK('duracion',e.target.value)} style={s.inp} placeholder="ej: 60 min"/></div>
              <div><span style={s.lbl}>Revisión programada</span><input value={sc.revision||''} onChange={e=>setSCK('revision',e.target.value)} style={s.inp} placeholder="ej: 8 semanas"/></div>
            </div>
            <div><span style={s.lbl}>Observaciones adicionales del equipo</span><textarea value={sc.observaciones||''} onChange={e=>setSCK('observaciones',e.target.value)} rows={2} placeholder="Cualquier información relevante para el plan inicial..." style={{...s.inp,resize:'vertical'}}/></div>
            <div style={{marginTop:14,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Resumen del alta</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                <div><div style={{fontSize:9,color:G3,textTransform:'uppercase'}}>Nivel</div><div style={{fontSize:13,fontWeight:700,color:NIVEL[sc.nivelAsignado]?.color}}>{NIVEL[sc.nivelAsignado]?.label}</div></div>
                <div><div style={{fontSize:9,color:G3,textTransform:'uppercase'}}>Semáforo</div><div style={{fontSize:13,fontWeight:700,color:SF[sc.semaforoAsignado]?.color}}>{SF[sc.semaforoAsignado]?.emoji} {SF[sc.semaforoAsignado]?.label}</div></div>
                <div><div style={{fontSize:9,color:G3,textTransform:'uppercase'}}>Restricciones activas</div><div style={{fontSize:12,fontWeight:700}}>{[sc.restriccionImpacto==='si'&&'Impacto',sc.restriccionOverhead==='si'&&'Overhead',sc.restriccionCargaAxial==='si'&&'Carga axial',sc.otraRestriccion].filter(Boolean).join(', ')||'Ninguna'}</div></div>
              </div>
            </div>
          </div>
        );
        default: return null;
      }
    };

    const canNext=step===0?(!!(form.nombre&&form.apellido&&form.documento&&form.celular)):step===4?true:true;
    const isLast=step===totalSteps-1;

    return(
      <OverlayWrap wide>
        {/* Header del wizard */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontWeight:800,fontSize:15}}>{form.nombre?`${form.nombre} ${form.apellido}`:'Alta de nuevo cliente'}</div>
            <div style={{fontSize:11,color:G3,marginTop:2}}>{WIZARD_STEPS[step].fase===1?'📋 Fase 1 — Autocompletado':WIZARD_STEPS[step].fase==='transicion'?'💾 Guardar progreso':'🩺 Fase 2 — Evaluación profesional'}</div>
          </div>
          <button onClick={()=>{setClientWizard(null);}} style={s.btnG}>✕</button>
        </div>
        {/* Barra de pasos */}
        <div style={{display:'flex',gap:3,marginBottom:16,overflowX:'auto'}}>
          {WIZARD_STEPS.map((ws,i)=>(
            <div key={i} onClick={()=>i<step&&setStep(i)} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,background:i===step?BK:i<step?'#E5E7EB':G1,color:i===step?WH:i<step?G4:G3,fontSize:10,fontWeight:i===step?700:400,cursor:i<step?'pointer':'default',flexShrink:0,whiteSpace:'nowrap'}}>
              <span>{i<step?'✓':ws.icon}</span>
              <span style={{display:window.innerWidth>600?'inline':'none'}}>{ws.title}</span>
              {window.innerWidth<=600&&<span>{i+1}</span>}
            </div>
          ))}
        </div>
        {/* Título del paso */}
        <div style={{background:BK,borderRadius:8,padding:'10px 14px',marginBottom:14,borderLeft:`3px solid ${R}`}}>
          <div style={{color:WH,fontWeight:700,fontSize:13}}>{WIZARD_STEPS[step].icon} Paso {step+1} de {totalSteps} — {WIZARD_STEPS[step].title}</div>
        </div>
        {/* Contenido */}
        <div style={{maxHeight:'50vh',overflowY:'auto',paddingRight:4}}>
          {renderStep()}
        </div>
        {/* Navegación */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,paddingTop:12,borderTop:`1px solid ${G2}`}}>
          <button onClick={()=>step>0&&setStep(p=>p-1)} disabled={step===0} style={{...s.btnG,opacity:step===0?.3:1}}>← Anterior</button>
          <span style={{fontSize:11,color:G3}}>{step+1} / {totalSteps}</span>
          {isLast
            ?<button onClick={finalize} style={{...s.btnGreen,padding:'9px 20px'}}>✓ Completar alta</button>
            :<button onClick={()=>canNext&&setStep(p=>p+1)} disabled={!canNext} style={{...s.btnR,opacity:!canNext?.4:1}}>Siguiente →</button>
          }
        </div>
        {step===0&&(!form.nombre||!form.apellido||!form.documento||!form.celular)&&(
          <div style={{fontSize:10,color:'#D97706',textAlign:'center',marginTop:6}}>* Nombre, apellido, documento y celular son obligatorios para continuar</div>
        )}
      </OverlayWrap>
    );
  };

  // ─── BANNER SEMÁFORO ─────────────────────────────────────────────────────
  const SemaforoBanner=({cliente})=>{
    if(!cliente)return null;
    const sf=SF[cliente.semaforo];
    const nv=NIVEL[cliente.nivel];
    return(
      <div style={{background:sf.bg,border:`1.5px solid ${sf.border}`,borderRadius:8,padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{fontSize:22,flexShrink:0}}>{sf.emoji}</div>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              <span style={{fontWeight:800,fontSize:12,color:sf.color}}>SEMÁFORO {sf.label}</span>
              <span style={{background:nv.color,color:WH,fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99}}>{nv.badge} {nv.label}</span>
              {!cliente.screeningCompleto&&<span style={{background:'#FEF3C7',color:'#92400E',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99,border:'1px solid #F59E0B'}}>EVALUACIÓN PENDIENTE</span>}
            </div>
            {cliente.restricciones
              ?<div style={{fontSize:11,color:'#444'}}><strong>Restricciones:</strong> {cliente.restricciones}</div>
              :<div style={{fontSize:11,color:G3}}>Sin restricciones documentadas</div>
            }
            {cliente.semaforo==='rojo'&&<div style={{fontSize:11,color:R,fontWeight:700,marginTop:4}}>⚠ Solo fisioterapia — Derivar antes de programar entrenamiento</div>}
            {cliente.semaforo==='pendiente'&&<div style={{fontSize:11,color:'#D97706',marginTop:2}}>El filtro de ejercicios se activa al completar la evaluación funcional.</div>}
            {cliente.objetivo&&(
              <div style={{marginTop:6,background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:5,padding:'5px 8px'}}>
                <div style={{fontSize:9,color:'#1D4ED8',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>🎯 Objetivo · Criterios de evolución activos</div>
                <div style={{fontSize:10,color:'#1D4ED8',marginBottom:3,fontStyle:'italic'}}>"{cliente.objetivo}"</div>
                {generarCriteriosPersonalizados(cliente.objetivo,cliente.nivel||'activa','',null).slice(0,3).map((crit,i)=>(
                  <div key={i} style={{fontSize:10,color:'#374151',display:'flex',gap:4,marginBottom:1}}>
                    <span style={{color:FASES_METODO[cliente.nivel]?.color||'#374151',fontWeight:700,flexShrink:0}}>→</span>{crit}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={()=>setSession(p=>({...p,clienteId:null,cliente:''}))} style={{...s.btnG,flexShrink:0,fontSize:10,padding:'3px 8px'}}>Desvincular</button>
      </div>
    );
  };

  // ── TAB: CLIENTES ──────────────────────────────────────────────────────────
  const ClientesTab=()=>(
    <div style={{padding:'12px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>Directorio de clientes</div>
          <div style={{fontSize:11,color:G4}}>{clients.length} clientes · Método Activa Integra v4.0</div>
        </div>
        <button onClick={()=>setClientWizard({cli:emptyCliente(),step:0})} style={{...s.btnR,background:brand.colorPrimary}}>+ Alta de cliente</button>
      </div>
      {clients.length===0&&(
        <div style={{...s.card,textAlign:'center',padding:36,borderStyle:'dashed'}}>
          <div style={{fontSize:28,marginBottom:8}}>👤</div>
          <div style={{fontWeight:700,marginBottom:4}}>Sin clientes registrados</div>
          <div style={{fontSize:12,color:G3,marginBottom:16,lineHeight:1.6}}>El alta incluye datos personales + screening funcional completo.<br/>El semáforo y el filtro de ejercicios se activan al finalizar la evaluación.</div>
          <button onClick={()=>setClientWizard({cli:emptyCliente(),step:0})} style={{...s.btnR,background:brand.colorPrimary}}>+ Alta de cliente</button>
        </div>
      )}
      <div style={{display:'grid',gap:8}}>
        {clients.map(c=>{
          const sf=SF[c.semaforo];
          const nv=NIVEL[c.nivel];
          const isLinked=session.clienteId===c.id;
          return(
            <div key={c.id} style={{...s.card,borderLeft:`4px solid ${c.screeningCompleto?sf.color:'#D1D5DB'}`,marginBottom:0,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,fontSize:14}}>{c.nombre} {c.apellido}</span>
                    {c.documento&&<span style={{fontSize:10,color:G3}}>CI {c.documento}</span>}
                    <span style={{fontSize:15}}>{sf.emoji}</span>
                    <span style={{background:nv.color,color:WH,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:99}}>{nv.badge} {nv.label}</span>
                    {!c.screeningCompleto&&<span style={{background:'#FEF3C7',color:'#92400E',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:99,border:'1px solid #F59E0B'}}>⏳ Evaluación pendiente</span>}
                    {isLinked&&<span style={{background:'#DCFCE7',color:'#16A34A',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:99,border:'1px solid #86EFAC'}}>● EN SESIÓN</span>}
                  </div>
                  {c.objetivo&&(
                    <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:5,padding:'5px 8px',margin:'4px 0'}}>
                      <div style={{fontSize:9,color:'#1D4ED8',fontWeight:700,marginBottom:2}}>🎯 {FASES_METODO[c.nivel]?.badge} {FASES_METODO[c.nivel]?.label} — Criterios de evolución</div>
                      <div style={{fontSize:10,color:'#1E40AF',fontStyle:'italic',marginBottom:2}}>"{c.objetivo}"</div>
                      {generarCriteriosPersonalizados(c.objetivo,c.nivel||'activa','',null).slice(0,2).map((crit,i)=>(
                        <div key={i} style={{fontSize:10,color:'#374151',display:'flex',gap:4}}>
                          <span style={{color:FASES_METODO[c.nivel]?.color||'#374151',fontWeight:700,flexShrink:0}}>→</span>{crit}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:10,color:G3}}>
                    {c.celular&&<span>📱 {c.celular}</span>}
                    {c.restricciones&&<span style={{color:'#444',fontSize:11}}><strong>Restricciones:</strong> {c.restricciones}</span>}
                    {c.fechaEval&&<span>Eval: {c.fechaEval}</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  {!c.screeningCompleto&&(
                    <button onClick={()=>setClientWizard({cli:c,step:5})} style={{...s.btnR,fontSize:10,padding:'4px 10px'}}>Completar evaluación →</button>
                  )}
                  {c.screeningCompleto&&!isLinked&&(
                    <button onClick={()=>{setSession(p=>({...p,clienteId:c.id,cliente:`${c.nombre} ${c.apellido}`}));setTab('session');}} style={{...s.btnBK,fontSize:10,padding:'4px 10px'}}>Usar en sesión →</button>
                  )}
                  {isLinked&&<button onClick={()=>setSession(p=>({...p,clienteId:null,cliente:''}))} style={{...s.btnGreen,fontSize:10,padding:'4px 10px'}}>✓ Desvincular</button>}
                  <button onClick={()=>setClientWizard({cli:c,step:0})} style={{...s.btnG,fontSize:10,padding:'4px 8px'}}>Editar</button>
                  <button onClick={()=>deleteClient(c.id)} style={{...s.btnG,fontSize:10,padding:'4px 8px',color:R,borderColor:R}}>Del</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {clients.length>0&&(
        <div style={{...s.card,marginTop:8,background:G1}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:8,color:G4}}>Resumen</div>
          <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
            {Object.entries(NIVEL).map(([k,v])=>{const n=clients.filter(c=>c.nivel===k).length;return n>0&&<div key={k}><div style={{fontSize:9,color:G3,textTransform:'uppercase'}}>{v.label}</div><div style={{fontSize:18,fontWeight:700,color:v.color}}>{n}</div></div>;})}
            <div style={{borderLeft:`1px solid ${G2}`,paddingLeft:20,display:'flex',gap:14}}>
              {Object.entries(SF).map(([k,v])=>{const n=clients.filter(c=>c.semaforo===k).length;return n>0&&<div key={k}><div style={{fontSize:9,color:G3}}>{v.emoji}</div><div style={{fontSize:16,fontWeight:700,color:v.color}}>{n}</div></div>;})}
            </div>
            <div style={{borderLeft:`1px solid ${G2}`,paddingLeft:20}}>
              <div style={{fontSize:9,color:G3}}>Evaluaciones pendientes</div>
              <div style={{fontSize:16,fontWeight:700,color:'#D97706'}}>{clients.filter(c=>!c.screeningCompleto).length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── TAB: SESIÓN ────────────────────────────────────────────────────────────
  const SessionTab=()=>{
    if(!session.obj)return(
      <div style={{padding:'16px 14px'}}>
        {clients.filter(c=>c.screeningCompleto).length>0&&(
          <div style={{...s.card,marginBottom:16,borderLeft:`4px solid ${brand.colorPrimary}`}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Vincular cliente a la sesión</div>
            <select value={session.clienteId||''} onChange={e=>{const id=e.target.value;if(!id){setSession(p=>({...p,clienteId:null,cliente:''}));return;}const c=clients.find(x=>x.id===id);if(c)setSession(p=>({...p,clienteId:id,cliente:`${c.nombre} ${c.apellido}`}));}} style={{...s.sel,width:'100%',marginBottom:activeClient?8:0}}>
              <option value=''>Sin cliente vinculado</option>
              {clients.filter(c=>c.screeningCompleto).map(c=><option key={c.id} value={c.id}>{SF[c.semaforo].emoji} {c.nombre} {c.apellido} · {NIVEL[c.nivel].label}</option>)}
            </select>
            {activeClient&&<SemaforoBanner cliente={activeClient}/>}
          </div>
        )}
        {clients.filter(c=>!c.screeningCompleto).length>0&&(
          <div style={{...s.card,marginBottom:16,background:'#FFFBEB',borderColor:'#FCD34D'}}>
            <div style={{fontSize:11,color:'#92400E'}}>⏳ {clients.filter(c=>!c.screeningCompleto).length} cliente/s con evaluación pendiente — no disponibles para sesión hasta completar el screening.</div>
          </div>
        )}
        <div style={{background:BK,borderRadius:10,padding:'18px 16px',marginBottom:16,borderLeft:`4px solid ${brand.colorPrimary}`}}>
          <div style={{fontSize:15,fontWeight:800,color:WH,marginBottom:4}}>Seleccionar nivel del método</div>
          <div style={{fontSize:12,color:G3}}>La sugerencia de bloques se adapta al continuum Activa Integra.</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
          {Object.entries(OBJS).map(([k,o])=>{
            const nv=NIVEL[o.nivelKey];
            return(
              <div key={k} onClick={()=>suggestBlocks(k)} style={{cursor:'pointer',background:BK,borderRadius:10,padding:'18px 16px',border:`1px solid #333`,borderTop:`4px solid ${nv.color}`,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:0,right:0,width:70,height:70,background:nv.color,opacity:.08,borderRadius:'0 0 0 70px'}}/>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <div style={{width:38,height:38,background:nv.color,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:WH,fontWeight:900,flexShrink:0}}>{nv.badge}</div>
                  <div><div style={{fontSize:15,fontWeight:800,color:WH}}>{o.label}</div><div style={{fontSize:11,color:G3,marginTop:1}}>{o.desc}</div></div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {o.blocks.map((b,i)=>(
                    <span key={b} style={{display:'inline-flex',alignItems:'center',gap:4,background:'#2a2a2a',border:`1px solid #3a3a3a`,borderRadius:99,padding:'3px 8px'}}>
                      <span style={{color:nv.color,fontSize:9,fontWeight:800}}>{i+1}</span>
                      <span style={{color:G3,fontSize:9,fontWeight:600}}>{BLOCKS[b].label}</span>
                    </span>
                  ))}
                </div>
                <div style={{marginTop:10,fontSize:10,color:'#555',display:'flex',justifyContent:'space-between'}}>
                  <span>{o.blocks.length} bloques</span><span style={{color:nv.color,fontWeight:700}}>SELECCIONAR →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
    const statusColor=session.blocks.length>=5&&session.blocks.length<=7?'#16A34A':R;
    return(
      <div style={{padding:'12px 14px'}}>
        <div style={{...s.card,marginBottom:12,borderLeft:`4px solid ${brand.colorPrimary}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:8}}>
            <div><span style={s.lbl}>Nombre de sesión</span><input value={session.name} onChange={e=>setSession(p=>({...p,name:e.target.value}))} style={s.inp}/></div>
            <div>
              <span style={s.lbl}>Cliente</span>
              {clients.filter(c=>c.screeningCompleto).length>0
                ?<select value={session.clienteId||''} onChange={e=>{const id=e.target.value;if(!id){setSession(p=>({...p,clienteId:null,cliente:''}));return;}const c=clients.find(x=>x.id===id);if(c)setSession(p=>({...p,clienteId:id,cliente:`${c.nombre} ${c.apellido}`}));}} style={{...s.sel,width:'100%'}}>
                    <option value=''>Sin cliente</option>
                    {clients.filter(c=>c.screeningCompleto).map(c=><option key={c.id} value={c.id}>{SF[c.semaforo].emoji} {c.nombre} {c.apellido}</option>)}
                  </select>
                :<input value={session.cliente} onChange={e=>setSession(p=>({...p,cliente:e.target.value}))} placeholder="Nombre del cliente" style={s.inp}/>
              }
            </div>
            <div><span style={s.lbl}>Fecha</span><input type="date" value={session.fecha} onChange={e=>setSession(p=>({...p,fecha:e.target.value}))} style={s.inp}/></div>
          </div>
          <div><span style={s.lbl}>Notas del entrenador</span><input value={session.notas} onChange={e=>setSession(p=>({...p,notas:e.target.value}))} placeholder="Observaciones, indicaciones..." style={s.inp}/></div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,flexWrap:'wrap',gap:6}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={s.tag(NIVEL[OBJS[session.obj].nivelKey].color)}>{OBJS[session.obj].label}</span>
              <span style={{...s.tag(statusColor)}}>{session.blocks.length}/5-7 bloques</span>
              {activeClient&&<span style={{fontSize:12}}>{SF[activeClient.semaforo].emoji}</span>}
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setTab('export')} style={{...s.btnBK,fontSize:11,padding:'5px 10px'}}>Exportar →</button>
              <button onClick={()=>{setSession({obj:null,blocks:[],name:'',cliente:'',clienteId:null,fecha:new Date().toISOString().split('T')[0],notas:''});setExpandedBlock(null);setSelBlock(null);}} style={s.btnG}>← Nuevo</button>
            </div>
          </div>
        </div>
        {activeClient&&<SemaforoBanner cliente={activeClient}/>}
        {/* BLOQUEO TOTAL SEMÁFORO ROJO */}
        {activeClient&&activeClient.semaforo==='rojo'&&(
          <div style={{background:'#FEF2F2',border:`2px solid ${R}`,borderRadius:8,padding:'16px 14px',marginBottom:12,textAlign:'center'}}>
            <div style={{fontSize:18,marginBottom:6}}>🔴</div>
            <div style={{fontSize:13,fontWeight:800,color:R,marginBottom:4}}>SEMÁFORO ROJO — Entrenamiento bloqueado</div>
            <div style={{fontSize:12,color:'#666'}}>No es posible agregar ejercicios a un cliente con semáforo rojo.<br/>Derivar a fisioterapia antes de retomar el entrenamiento.</div>
          </div>
        )}
        {overrideState&&(
          <OverlayWrap>
            <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:overrideState.isRestriction?R:'#92400E'}}>
              {overrideState.isRestriction?'⚠ Restricción clínica activa':'Confirmar Override de bloque'}
            </div>
            {overrideState.isRestriction
              ?<div style={{fontSize:12,color:G4,marginBottom:10,lineHeight:1.5}}>
                  <strong>{overrideState.ex.nombre}</strong> activa una restricción de <strong>{activeClient?.nombre}</strong>.<br/>
                  Patrón: <em>{overrideState.ex.patron}</em><br/>
                  <span style={{color:R}}>Solo continuar con justificación clínica documentada.</span>
                </div>
              :<div style={{fontSize:12,color:G4,marginBottom:10}}><strong>{overrideState.ex.nombre}</strong> pertenece a <strong>{BLOCKS[overrideState.ex.bloque]?.label}</strong>, no a <strong>{BLOCKS[overrideState.blockType]?.label}</strong>.</div>
            }
            <span style={s.lbl}>Justificación {overrideState.isRestriction?'clínica (obligatoria)':'(opcional)'}</span>
            <input value={overrideState.note} onChange={e=>setOverrideState(p=>({...p,note:e.target.value}))} placeholder="Especificar justificación..." style={{...s.inp,marginBottom:10}}/>
            <div style={{display:'flex',gap:8}}>
              <button onClick={confirmOverride} disabled={overrideState.isRestriction&&!overrideState.note} style={{...s.btnR,flex:1,opacity:overrideState.isRestriction&&!overrideState.note?.4:1}}>Confirmar con override</button>
              <button onClick={()=>setOverrideState(null)} style={{...s.btnG,flex:1}}>Cancelar</button>
            </div>
          </OverlayWrap>
        )}
        {session.blocks.map(block=>{
          const bd=BLOCKS[block.type];
          const isExp=expandedBlock===block.id;
          const isSel=selBlock===block.id;
          return(
            <div key={block.id} style={{border:`1px solid ${G2}`,borderRadius:8,marginBottom:8,overflow:'hidden'}}>
              <div style={s.bHdr(block.type)}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{background:brand.colorPrimary,color:WH,width:22,height:22,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{block.position}</div>
                  <span style={{fontWeight:700,fontSize:13}}>{bd.label}</span>
                  {block.exercises.length>0&&<span style={{background:'rgba(255,255,255,.2)',borderRadius:99,fontSize:10,padding:'1px 6px'}}>{block.exercises.length} ej.</span>}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setExpandedBlock(isExp?null:block.id)} style={{background:'rgba(255,255,255,.15)',color:WH,border:'none',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:11}}>{isExp?'▲':'▼'}</button>
                  <button onClick={()=>removeBlock(block.id)} style={{background:'rgba(255,255,255,.15)',color:WH,border:'none',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:11}}>✕</button>
                </div>
              </div>
              {isExp&&(
                <div style={{padding:'10px 12px',background:'#fafafa',borderTop:`1px solid ${G2}`}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:10}}>
                    {[['series','Series'],['reps','Reps'],['rpe','RPE'],['tempo','Tempo'],['descanso','Descanso']].map(([k,lbl])=>(
                      <div key={k}><span style={s.lbl}>{lbl}</span><input value={block.params[k]} onChange={e=>updateParams(block.id,k,e.target.value)} style={s.inp}/></div>
                    ))}
                  </div>
                  {block.exercises.map(be=>{
                    const ex=exs.find(e=>e.id===be.exId);if(!ex)return null;
                    const rest=checkRestriction(ex,activeClient);
                    return(
                      <div key={be.exId} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',background:rest==='warn'?'#FFFBEB':WH,border:`1px solid ${rest==='warn'?'#FCD34D':G2}`,borderRadius:6,padding:'7px 10px',marginBottom:5}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:600}}>{ex.nombre}</div>
                          <div style={{fontSize:10,color:G3,marginTop:1}}>{ex.musculos} · <span style={{color:NIVEL_COLOR[ex.nivel]}}>{ex.nivel}</span></div>
                          {be.override&&<div style={s.ovFlag}>OVERRIDE · {be.note||'sin nota'}</div>}
                          {rest==='warn'&&<div style={{background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:4,padding:'1px 6px',fontSize:10,color:'#92400E',display:'inline-block',marginTop:2}}>⚠ Restricción activa</div>}
                        </div>
                        <button onClick={()=>removeExFromBlock(block.id,be.exId)} style={{background:'none',border:'none',color:R,cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 2px'}}>×</button>
                      </div>
                    );
                  })}
                  {block.exercises.length<5&&!(activeClient&&activeClient.semaforo==='rojo')&&(
                    <button onClick={()=>{setSelBlock(isSel?null:block.id);setExSearch('');}} style={{...s.btnBK,width:'100%',marginTop:4}}>{isSel?'✕ Cerrar':'+ Agregar ejercicio'}</button>
                  )}
                  {isSel&&(
                    <div style={{marginTop:8,background:WH,border:`1px solid ${G2}`,borderRadius:8,padding:10}}>
                      <input placeholder={`Buscar en ${bd.label}...`} value={exSearch} onChange={e=>setExSearch(e.target.value)} style={{...s.inp,marginBottom:8}}/>
                      <div style={s.lbl}>Ejercicios del bloque</div>
                      <div style={{maxHeight:160,overflowY:'auto',marginBottom:8}}>
                        {exs.filter(e=>e.bloque===block.type&&(!exSearch||e.nombre.toLowerCase().includes(exSearch.toLowerCase()))).map(ex=>{
                          const added=block.exercises.some(be=>be.exId===ex.id);
                          const rest=checkRestriction(ex,activeClient);
                          const bgColor=rest==='block'?'#FEF2F2':rest==='warn'?'#FFFBEB':WH;
                          return(
                            <div key={ex.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 6px',borderBottom:`1px solid ${G2}`,background:bgColor,opacity:added?.4:1}}>
                              <div>
                                <div style={{fontSize:11,fontWeight:600}}>{ex.nombre}
                                  {rest==='block'&&<span style={{background:'#FEF2F2',color:R,fontSize:8,padding:'1px 5px',borderRadius:99,fontWeight:700,marginLeft:4}}>BLOQUEADO</span>}
                                  {rest==='warn'&&<span style={{background:'#FEF3C7',color:'#92400E',fontSize:8,padding:'1px 5px',borderRadius:99,fontWeight:700,marginLeft:4}}>⚠ RESTRICCIÓN</span>}
                                </div>
                                <div style={{fontSize:10,color:G3}}>{ex.musculos} · <span style={{color:NIVEL_COLOR[ex.nivel]}}>{ex.nivel}</span></div>
                              </div>
                              {!added&&rest!=='block'&&<button onClick={()=>handlePickEx(block,ex)} style={{...s.btnR,padding:'3px 8px',fontSize:10,background:rest==='warn'?'#D97706':brand.colorPrimary}}>+</button>}
                              {!added&&rest==='block'&&<span style={{fontSize:10,color:R,fontWeight:700}}>🚫</span>}
                              {added&&<span style={{fontSize:10,color:G3}}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                      <details>
                        <summary style={{fontSize:10,color:G4,cursor:'pointer',fontWeight:700,userSelect:'none',padding:'4px 0'}}>OVERRIDE — otros bloques</summary>
                        <div style={{maxHeight:120,overflowY:'auto',marginTop:6,borderTop:`1px solid ${G2}`,paddingTop:6}}>
                          {exs.filter(e=>e.bloque!==block.type&&(!exSearch||e.nombre.toLowerCase().includes(exSearch.toLowerCase()))).map(ex=>{
                            const added=block.exercises.some(be=>be.exId===ex.id);
                            const rest=checkRestriction(ex,activeClient);
                            return(
                              <div key={ex.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 6px',borderBottom:`1px solid ${G2}`,opacity:added?.4:1}}>
                                <div><div style={{fontSize:11}}>{ex.nombre} <span style={{background:'#FEF3C7',color:'#92400E',fontSize:8,padding:'1px 5px',borderRadius:99,fontWeight:700}}>{BLOCKS[ex.bloque]?.tag}</span>{rest==='block'&&<span style={{background:'#FEF2F2',color:R,fontSize:8,padding:'1px 5px',borderRadius:99,fontWeight:700,marginLeft:2}}>BLOQ.</span>}</div></div>
                                {!added&&rest!=='block'&&<button onClick={()=>handlePickEx(block,ex)} style={{...s.btnG,padding:'2px 7px',fontSize:10,color:'#92400E',borderColor:'#F59E0B'}}>+</button>}
                                {!added&&rest==='block'&&<span style={{fontSize:10,color:R}}>🚫</span>}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {session.blocks.length<7&&!(activeClient&&activeClient.semaforo==='rojo')&&(
          <div style={s.card}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:8,color:G4}}>Agregar bloque manual</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 90px 80px',gap:8}}>
              <select value={addBType} onChange={e=>{setAddBType(e.target.value);setAddBPos('');}} style={s.sel}>
                <option value=''>Tipo de bloque...</option>
                {Object.entries(BLOCKS).map(([k,v])=><option key={k} value={k}>{v.label} · pos: {v.pos.join(', ')}</option>)}
              </select>
              <select value={addBPos} onChange={e=>setAddBPos(e.target.value)} style={s.sel} disabled={!addBType}>
                <option value=''>Pos.</option>
                {addBType&&BLOCKS[addBType].pos.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={addBlock} disabled={!addBType||!addBPos} style={{...s.btnR,background:brand.colorPrimary,opacity:(!addBType||!addBPos)?0.5:1}}>Agregar</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── TAB: BASE DE EJERCICIOS ───────────────────────────────────────────────
  const DBTab=()=>{
    const [editingExLocal,setEditingExLocal]=useState(null);
    const [showExFormLocal,setShowExFormLocal]=useState(false);
    const saveExLocal=(ex)=>{
      if(ex.id){setExs(p=>p.map(e=>e.id===ex.id?ex:e));}
      else{setExs(p=>[...p,{...ex,id:'u'+Date.now()}]);}
      setShowExFormLocal(false);setEditingExLocal(null);
    };
    return(
      <div style={{padding:'12px 14px'}}>
        {showExFormLocal&&(
          <OverlayWrap>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:14}}>{editingExLocal?.id?'Editar':'Nuevo'} ejercicio</div>
              <button onClick={()=>{setShowExFormLocal(false);setEditingExLocal(null);}} style={s.btnG}>✕</button>
            </div>
            {(()=>{
              const [form,setFormEx]=useState(editingExLocal||emptyEx);
              const regRef=exs.find(e=>e.id===form.regresion);const progRef=exs.find(e=>e.id===form.progresion);
              const setF=(k,v)=>setFormEx(f=>({...f,[k]:v}));
              return(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <div style={{gridColumn:'1/-1'}}><span style={s.lbl}>Nombre</span><input value={form.nombre} onChange={e=>setF('nombre',e.target.value)} style={s.inp}/></div>
                    <div><span style={s.lbl}>Bloque</span><select value={form.bloque} onChange={e=>setF('bloque',e.target.value)} style={{...s.sel,width:'100%'}}>{Object.entries(BLOCKS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
                    <div><span style={s.lbl}>Nivel</span><select value={form.nivel} onChange={e=>setF('nivel',e.target.value)} style={{...s.sel,width:'100%'}}>{['Principiante','Intermedio','Avanzado'].map(n=><option key={n}>{n}</option>)}</select></div>
                    {[['musculos','Músculos'],['contraccion','Contracción'],['patron','Patrón de movimiento'],['equipo','Equipamiento']].map(([k,lbl])=>(
                      <div key={k} style={{gridColumn:'1/-1'}}><span style={s.lbl}>{lbl}</span><input value={form[k]} onChange={e=>setF(k,e.target.value)} style={s.inp}/></div>
                    ))}
                    <div style={{gridColumn:'1/-1'}}><span style={s.lbl}>Regresión</span><input value={form.regresion} onChange={e=>setF('regresion',e.target.value)} style={s.inp}/>{regRef&&<div style={{fontSize:10,color:G3,marginTop:2}}>→ {regRef.nombre}</div>}</div>
                    <div style={{gridColumn:'1/-1'}}><span style={s.lbl}>Progresión</span><input value={form.progresion} onChange={e=>setF('progresion',e.target.value)} style={s.inp}/>{progRef&&<div style={{fontSize:10,color:G3,marginTop:2}}>→ {progRef.nombre}</div>}</div>
                  </div>
                  <button onClick={()=>saveExLocal(form)} style={{...s.btnR,width:'100%'}}>Guardar ejercicio</button>
                </div>
              );
            })()}
          </OverlayWrap>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div><div style={{fontSize:14,fontWeight:700}}>Base de ejercicios</div><div style={{fontSize:11,color:G4}}>{exs.length} registros · 11 bloques</div></div>
          <button onClick={()=>{setEditingExLocal(null);setShowExFormLocal(true);}} style={{...s.btnR,background:brand.colorPrimary}}>+ Nuevo ejercicio</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:8,marginBottom:12}}>
          <select value={dbFilter} onChange={e=>setDbFilter(e.target.value)} style={s.sel}>
            <option value='all'>Todos ({exs.length})</option>
            {Object.entries(BLOCKS).map(([k,v])=><option key={k} value={k}>{v.label} ({exs.filter(e=>e.bloque===k).length})</option>)}
          </select>
          <input value={dbSearch} onChange={e=>setDbSearch(e.target.value)} placeholder="Buscar por nombre, músculo..." style={s.inp}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:BK,color:WH}}>{['Ejercicio','Bloque','Músculos','Patrón','Nivel','Reg.','Prog.',''].map((h,i)=><th key={i} style={{padding:'8px',textAlign:'left',fontWeight:700,whiteSpace:'nowrap',fontSize:10}}>{h}</th>)}</tr></thead>
            <tbody>
              {filteredExs.map((ex,i)=>{
                const rr=exs.find(e=>e.id===ex.regresion);const pr=exs.find(e=>e.id===ex.progresion);
                return(
                  <tr key={ex.id} style={{background:i%2===0?WH:G1,borderBottom:`1px solid ${G2}`}}>
                    <td style={{padding:'7px 8px',fontWeight:600,maxWidth:160,fontSize:12}}>{ex.nombre}</td>
                    <td style={{padding:'7px 8px',whiteSpace:'nowrap'}}><span style={s.tag(BLOCKS[ex.bloque]?.color||G4)}>{BLOCKS[ex.bloque]?.tag}</span></td>
                    <td style={{padding:'7px 8px',color:G4,maxWidth:160,fontSize:10}}>{ex.musculos}</td>
                    <td style={{padding:'7px 8px',color:G4,fontSize:10,maxWidth:140}}>{ex.patron}</td>
                    <td style={{padding:'7px 8px',whiteSpace:'nowrap'}}><span style={{...s.tag(NIVEL_COLOR[ex.nivel]||G4),fontSize:9}}>{ex.nivel}</span></td>
                    <td style={{padding:'7px 8px',color:G3,fontSize:10,maxWidth:100}}>{rr?rr.nombre:ex.regresion||'—'}</td>
                    <td style={{padding:'7px 8px',color:G3,fontSize:10,maxWidth:100}}>{pr?pr.nombre:ex.progresion||'—'}</td>
                    <td style={{padding:'7px 8px',whiteSpace:'nowrap'}}>
                      <button onClick={()=>{setEditingExLocal(ex);setShowExFormLocal(true);}} style={{...s.btnG,padding:'3px 7px',fontSize:10,marginRight:4}}>Editar</button>
                      <button onClick={()=>setExs(p=>p.filter(e=>e.id!==ex.id))} style={{...s.btnG,padding:'3px 7px',fontSize:10,color:R,borderColor:R}}>Del</button>
                    </td>
                  </tr>
                );
              })}
              {filteredExs.length===0&&<tr><td colSpan={8} style={{textAlign:'center',padding:24,color:G3}}>Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── TAB: EXPORTAR ─────────────────────────────────────────────────────────
  const ExportTab=()=>{
    const hasSession=session.obj&&session.blocks.length>0;
    const totalEx=session.blocks.reduce((a,b)=>a+b.exercises.length,0);
    return(
      <div style={{padding:'16px 14px'}}>
        <div style={{background:BK,borderRadius:10,padding:'16px 18px',marginBottom:16,borderLeft:`4px solid ${hasSession?'#16A34A':brand.colorPrimary}`}}>
          <div style={{fontSize:14,fontWeight:800,color:WH,marginBottom:6}}>{hasSession?`Sesión lista: ${session.name}`:'Sin sesión activa'}</div>
          {hasSession&&(
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {[['Nivel',activeClient?NIVEL[activeClient.nivel].label:OBJS[session.obj].label],['Semáforo',activeClient?`${SF[activeClient.semaforo].emoji} ${SF[activeClient.semaforo].label}`:'—'],['Cliente',session.cliente||'Sin nombre'],['Bloques',session.blocks.length],['Ejercicios',totalEx]].map(([k,v])=>(
                <div key={k}><div style={{fontSize:9,color:G3,textTransform:'uppercase'}}>{k}</div><div style={{fontSize:13,color:WH,fontWeight:700}}>{v}</div></div>
              ))}
            </div>
          )}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{...s.card,borderTop:`4px solid ${brand.colorPrimary}`,padding:'20px 18px'}}>
            <div style={{fontSize:24,marginBottom:8}}>📄</div>
            <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>Exportar a PDF</div>
            <div style={{fontSize:11,color:G3,marginBottom:12,background:G1,borderRadius:6,padding:'8px'}}>En la ventana de impresión elegí <strong>Guardar como PDF</strong> como destino.</div>
            <button onClick={exportPDF} disabled={!hasSession} style={{...s.btnR,background:brand.colorPrimary,width:'100%',padding:'11px',opacity:!hasSession?.4:1}}>Imprimir / PDF</button>
          </div>
          <div style={{...s.card,borderTop:'4px solid #16A34A',padding:'20px 18px'}}>
            <div style={{fontSize:24,marginBottom:8}}>📊</div>
            <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>Exportar a Google Sheets</div>
            <div style={{fontSize:11,color:G3,marginBottom:12,background:G1,borderRadius:6,padding:'8px'}}>CSV con nivel, semáforo y restricciones del cliente.</div>
            <button onClick={exportCSV} disabled={!hasSession} style={{...s.btnGreen,width:'100%',padding:'11px',opacity:!hasSession?.4:1}}>Descargar CSV</button>
          </div>
        </div>
      </div>
    );
  };

  // ── TAB: CENTRO ───────────────────────────────────────────────────────────
  const BrandingTab=()=>{
    const [local,setLocal]=useState({...brand});
    const set=(k,v)=>setLocal(f=>({...f,[k]:v}));
    return(
      <div style={{padding:'16px 14px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <div style={s.card}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Identidad</div>
              <div style={{marginBottom:10}}><span style={s.lbl}>Nombre</span><input value={local.gymName} onChange={e=>set('gymName',e.target.value)} style={s.inp}/></div>
              <div style={{marginBottom:10}}><span style={s.lbl}>Subtítulo</span><input value={local.gymSub} onChange={e=>set('gymSub',e.target.value)} style={s.inp}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><span style={s.lbl}>Color primario</span><div style={{display:'flex',gap:6,alignItems:'center'}}><input type="color" value={local.colorPrimary} onChange={e=>set('colorPrimary',e.target.value)} style={{width:38,height:34,border:'none',cursor:'pointer',borderRadius:4,padding:2}}/><input value={local.colorPrimary} onChange={e=>set('colorPrimary',e.target.value)} style={{...s.inp,fontFamily:'monospace',fontSize:11}}/></div></div>
                <div><span style={s.lbl}>Color fondo</span><div style={{display:'flex',gap:6,alignItems:'center'}}><input type="color" value={local.colorBg} onChange={e=>set('colorBg',e.target.value)} style={{width:38,height:34,border:'none',cursor:'pointer',borderRadius:4,padding:2}}/><input value={local.colorBg} onChange={e=>set('colorBg',e.target.value)} style={{...s.inp,fontFamily:'monospace',fontSize:11}}/></div></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Logo</div>
              <input ref={logoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>setLocal(f=>({...f,logoImg:ev.target.result}));reader.readAsDataURL(file);}}/>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <button onClick={()=>logoInputRef.current.click()} style={{...s.btnBK,flex:1}}>Subir logo</button>
                {local.logoImg&&<button onClick={()=>set('logoImg',null)} style={{...s.btnG,color:R,borderColor:R}}>Quitar</button>}
              </div>
              {local.logoImg?<img src={local.logoImg} alt="Logo" style={{maxHeight:50,maxWidth:'100%',objectFit:'contain',display:'block'}}/>:<div style={{background:G1,padding:10,textAlign:'center',borderRadius:6,color:G3,fontSize:11}}>Logo kettlebell por defecto</div>}
            </div>
            <button onClick={()=>setBrand(local)} style={{...s.btnR,background:local.colorPrimary,width:'100%',padding:'12px'}}>Aplicar cambios</button>
          </div>
          <div>
            <div style={{background:local.colorBg,borderRadius:8,padding:'12px 16px',marginBottom:10,borderBottom:`3px solid ${local.colorPrimary}`}}>
              {local.logoImg?(
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <img src={local.logoImg} alt="logo" style={{height:44,objectFit:'contain',flexShrink:0}}/>
                  <div>
                    <div style={{fontFamily:'Arial Black,Arial,sans-serif',fontWeight:900,fontSize:18,color:local.colorPrimary,letterSpacing:2,lineHeight:1}}>{local.gymName||'NOMBRE'}</div>
                    <div style={{fontFamily:'Arial,sans-serif',fontSize:10,color:WH,letterSpacing:'3px',marginTop:2}}>{local.gymSub||'SUBTÍTULO'}</div>
                  </div>
                </div>
              ):<DefaultLogo h={44} gymName={local.gymName||'NOMBRE'} gymSub={local.gymSub||'SUBTÍTULO'}/>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredExs=useMemo(()=>exs.filter(e=>(dbFilter==='all'||e.bloque===dbFilter)&&(!dbSearch||e.nombre.toLowerCase().includes(dbSearch.toLowerCase())||e.musculos.toLowerCase().includes(dbSearch.toLowerCase()))),[exs,dbFilter,dbSearch]);
  // ── TAB: REHABILITACIÓN ──────────────────────────────────────────────────
  const RehabTab=()=>{
    const [rehabRegion,setRehabRegion]=useState('');
    const [rehabFase,setRehabFase]=useState('aguda');
    const [rehabTejido,setRehabTejido]=useState('');
    const [rehabSession,setRehabSession]=useState([]);
    const [showTejidos,setShowTejidos]=useState(false);
    const [activeClientRehab,setActiveClientRehab]=useState('');
    const [rehabNotas,setRehabNotas]=useState('');

    const ejerciciosDisponibles=rehabRegion&&REHAB_DB[rehabRegion]?REHAB_DB[rehabRegion][rehabFase]||[]:[];
    const addToSession=(ej)=>{
      if(rehabSession.find(e=>e.id===ej.id))return;
      setRehabSession(p=>[...p,{...ej,series:3,reps:ej.param,activo:true}]);
    };
    const removeFromSession=(id)=>setRehabSession(p=>p.filter(e=>e.id!==id));
    const updateEj=(id,k,v)=>setRehabSession(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));

    const exportRehabPDF=()=>{
      if(!rehabSession.length)return;
      const region=rehabRegion?REGIONES[rehabRegion]:{label:'General',color:'#374151'};
      const fase=FASES_REHAB[rehabFase];
      const rows=rehabSession.map((e,i)=>`<tr><td style="padding:7px 10px;font-weight:700;font-size:11px;background:${i%2===0?'#fff':'#f9f9f9'}">${i+1}. ${e.nombre}</td><td style="padding:7px 10px;font-size:11px;color:#555;background:${i%2===0?'#fff':'#f9f9f9'}">${e.desc}</td><td style="padding:7px 10px;font-size:11px;text-align:center;background:${i%2===0?'#fff':'#f9f9f9'};white-space:nowrap">${e.reps}</td></tr>`).join('');
      const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Protocolo Rehabilitación — ${region.label}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:28px;color:#111}.hdr{border-bottom:3px solid ${brand.colorPrimary};padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1a1a1a;color:#fff;padding:8px 10px;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.06em}td{border-bottom:1px solid #e0e0e0}.badge{display:inline-block;background:${fase.bg};border:1px solid ${fase.border};color:${fase.color};font-weight:700;font-size:11px;padding:3px 10px;border-radius:99px}.footer{margin-top:24px;font-size:10px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:10px}@media print{body{padding:16px}}</style></head><body><div class="hdr"><div><div style="font-size:22px;font-weight:900;color:${brand.colorPrimary};letter-spacing:2px">${brand.gymName}</div><div style="font-size:10px;color:#888;letter-spacing:4px;margin-top:2px">${brand.gymSub}</div></div><div style="text-align:right"><div style="font-size:15px;font-weight:800">Protocolo de Rehabilitación</div><div style="font-size:11px;color:#555;margin-top:4px">Región: ${region.label} · <span class="badge">${fase.label}</span></div>${activeClientRehab?`<div style="font-size:11px;color:#777;margin-top:3px">Paciente: ${activeClientRehab}</div>`:''}<div style="font-size:10px;color:#999;margin-top:2px">Fecha: ${new Date().toLocaleDateString('es-ES')}</div></div></div><table><thead><tr><th>Ejercicio</th><th>Descripción / Indicaciones</th><th>Parámetros</th></tr></thead><tbody>${rows}</tbody></table>${rehabNotas?`<div style="margin-top:14px;background:#f9f9f9;border-left:4px solid ${brand.colorPrimary};padding:10px 14px;font-size:11px;color:#555"><strong>Notas del fisioterapeuta:</strong> ${rehabNotas}</div>`:''}<div style="margin-top:12px;background:#fff9ec;border:1px solid #fcd34d;border-radius:6px;padding:10px 14px;font-size:10px;color:#78350f"><strong>Precaución general:</strong> Suspender si el dolor supera 4/10 durante la ejecución. Reevaluar con el fisioterapeuta ante cualquier exacerbación de síntomas.</div><div class="footer">${brand.gymName} · FisioActiva Colonia · Método Activa Integra · ${new Date().toLocaleDateString('es-ES')}</div><script>window.onload=()=>{window.print()}<\/script></body></html>`;
      const w=window.open('','_blank');w.document.write(html);w.document.close();
    };

    return(
      <div style={{padding:'12px 14px'}}>
        {/* HEADER */}
        <div style={{background:BK,borderRadius:10,padding:'14px 16px',marginBottom:14,borderLeft:`4px solid ${brand.colorPrimary}`}}>
          <div style={{fontSize:15,fontWeight:800,color:WH,marginBottom:3}}>Constructor de Sesión — Rehabilitación</div>
          <div style={{fontSize:12,color:G3}}>Nivel RESTAURA · Protocolo estructurado por región, fase y tejido</div>
        </div>

        {/* PACIENTE + FASE */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div>
            <span style={s.lbl}>Paciente</span>
            {clients.filter(c=>c.nivel==='restaura').length>0
              ?<select value={activeClientRehab} onChange={e=>setActiveClientRehab(e.target.value)} style={{...s.sel,width:'100%'}}>
                  <option value=''>Sin paciente vinculado</option>
                  {clients.filter(c=>c.nivel==='restaura').map(c=><option key={c.id} value={`${c.nombre} ${c.apellido}`}>{c.nombre} {c.apellido}</option>)}
                  {clients.filter(c=>c.nivel!=='restaura').length>0&&<optgroup label="── Otros clientes ──">{clients.filter(c=>c.nivel!=='restaura').map(c=><option key={c.id} value={`${c.nombre} ${c.apellido}`}>{c.nombre} {c.apellido} ({NIVEL[c.nivel].label})</option>)}</optgroup>}
                </select>
              :<input value={activeClientRehab} onChange={e=>setActiveClientRehab(e.target.value)} placeholder="Nombre del paciente" style={s.inp}/>
            }
          </div>
          <div>
            <span style={s.lbl}>Notas del fisioterapeuta</span>
            <input value={rehabNotas} onChange={e=>setRehabNotas(e.target.value)} placeholder="Indicaciones especiales..." style={s.inp}/>
          </div>
        </div>

        {/* SELECTOR DE REGIÓN */}
        <div style={{marginBottom:12}}>
          <span style={s.lbl}>Región anatómica</span>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginTop:4}}>
            {Object.entries(REGIONES).map(([k,v])=>(
              <div key={k} onClick={()=>{setRehabRegion(k);setRehabSession([]);}} style={{cursor:'pointer',padding:'9px 6px',borderRadius:7,border:`2px solid ${rehabRegion===k?v.color:G2}`,background:rehabRegion===k?`${v.color}15`:WH,textAlign:'center',transition:'all .15s'}}>
                <div style={{fontSize:16,marginBottom:3}}>{v.icon}</div>
                <div style={{fontSize:10,fontWeight:rehabRegion===k?700:400,color:rehabRegion===k?v.color:G4,lineHeight:1.2}}>{v.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SELECTOR DE FASE */}
        <div style={{marginBottom:12}}>
          <span style={s.lbl}>Fase de rehabilitación</span>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:4}}>
            {Object.entries(FASES_REHAB).map(([k,v])=>(
              <div key={k} onClick={()=>{setRehabFase(k);setRehabSession([]);}} style={{cursor:'pointer',padding:'10px 12px',borderRadius:7,border:`2px solid ${rehabFase===k?v.color:G2}`,background:rehabFase===k?v.bg:WH,transition:'all .15s'}}>
                <div style={{fontWeight:700,fontSize:12,color:rehabFase===k?v.color:'#333'}}>{v.label}</div>
                <div style={{fontSize:10,color:G3,marginTop:2}}>{v.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTÓN TEJIDOS */}
        <button onClick={()=>setShowTejidos(p=>!p)} style={{...s.btnBK,marginBottom:12,width:'100%',padding:'9px',fontSize:12}}>
          {showTejidos?'▲ Ocultar':'📋 Ver protocolos por tipo de tejido (fractura, tendón, ligamento, músculo, fascia)'}
        </button>

        {/* PANEL TEJIDOS */}
        {showTejidos&&(
          <div style={{marginBottom:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:10}}>
              {Object.entries(TEJIDOS_BASE).map(([k,v])=>(
                <div key={k} onClick={()=>setRehabTejido(rehabTejido===k?'':k)} style={{cursor:'pointer',padding:'10px 8px',borderRadius:7,border:`2px solid ${rehabTejido===k?R:G2}`,background:rehabTejido===k?'#FEF2F2':WH,textAlign:'center',transition:'all .15s'}}>
                  <div style={{fontSize:18,marginBottom:3}}>{v.icon}</div>
                  <div style={{fontSize:10,fontWeight:700,color:rehabTejido===k?R:G4}}>{v.label}</div>
                </div>
              ))}
            </div>
            {rehabTejido&&(()=>{
              const tj=TEJIDOS_BASE[rehabTejido];
              const fa=tj.fases[rehabFase];
              return(
                <div style={{background:WH,border:`1px solid ${G2}`,borderRadius:8,padding:'12px 14px',borderLeft:`4px solid ${R}`}}>
                  <div style={{fontWeight:800,fontSize:13,marginBottom:4}}>{tj.icon} {tj.label} — {fa.titulo}</div>
                  <div style={{fontSize:11,color:'#444',marginBottom:8,background:'#FFF9F0',borderRadius:5,padding:'6px 10px'}}><strong>Criterios:</strong> {fa.criterios}</div>
                  <div style={{fontSize:11,fontWeight:700,color:G4,marginBottom:6,textTransform:'uppercase',letterSpacing:'.04em'}}>Ejercicios base de esta fase</div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
                    {fa.ejercicios.map((ej,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:G1,borderRadius:5}}>
                        <span style={{color:R,fontWeight:700,fontSize:11,flexShrink:0}}>→</span>
                        <span style={{fontSize:11}}>{ej}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:R,background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:5,padding:'6px 10px'}}><strong>⚠ Precauciones:</strong> {tj.precauciones}</div>
                  <div style={{marginTop:8,fontSize:11,color:G3}}><strong>Principio base:</strong> {tj.criterios}</div>
                </div>
              );
            })()}
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {/* BANCO DE EJERCICIOS */}
          <div>
            <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:G4,textTransform:'uppercase',letterSpacing:'.04em'}}>
              {rehabRegion?`${REGIONES[rehabRegion].label} — ${FASES_REHAB[rehabFase].label}`:'Seleccioná una región'}
              {rehabRegion&&<span style={{marginLeft:6,fontSize:11,color:G3,fontWeight:400}}>({ejerciciosDisponibles.length} ejercicios)</span>}
            </div>
            {!rehabRegion&&(
              <div style={{...s.card,textAlign:'center',padding:24,borderStyle:'dashed',color:G3,fontSize:12}}>Seleccioná una región anatómica arriba para ver los ejercicios disponibles.</div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:480,overflowY:'auto'}}>
              {ejerciciosDisponibles.map(ej=>{
                const inSession=rehabSession.some(e=>e.id===ej.id);
                return(
                  <div key={ej.id} style={{background:inSession?'#F0FDF4':WH,border:`1px solid ${inSession?'#86EFAC':G2}`,borderRadius:7,padding:'9px 11px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,marginBottom:2}}>{ej.nombre}</div>
                        <div style={{fontSize:10,color:G4,lineHeight:1.4,marginBottom:3}}>{ej.desc}</div>
                        <div style={{fontSize:10,color:brand.colorPrimary,fontWeight:700}}>{ej.param}</div>
                      </div>
                      {!inSession
                        ?<button onClick={()=>addToSession(ej)} style={{...s.btnR,background:rehabRegion?REGIONES[rehabRegion].color:R,padding:'4px 10px',fontSize:11,flexShrink:0}}>+</button>
                        :<span style={{color:'#16A34A',fontSize:11,fontWeight:700,flexShrink:0}}>✓</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SESIÓN CONSTRUIDA */}
          <div>
            <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:G4,textTransform:'uppercase',letterSpacing:'.04em'}}>
              Sesión construida
              {rehabSession.length>0&&<span style={{marginLeft:6,fontSize:11,color:G3,fontWeight:400}}>({rehabSession.length} ejercicios)</span>}
            </div>
            {rehabSession.length===0&&(
              <div style={{...s.card,textAlign:'center',padding:24,borderStyle:'dashed',color:G3,fontSize:12}}>Agregá ejercicios del banco para construir la sesión.</div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto',marginBottom:rehabSession.length>0?10:0}}>
              {rehabSession.map((ej,i)=>(
                <div key={ej.id} style={{background:WH,border:`1px solid ${G2}`,borderRadius:7,padding:'9px 11px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6,marginBottom:5}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{background:rehabRegion?REGIONES[rehabRegion].color:BK,color:WH,fontSize:10,fontWeight:700,width:20,height:20,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                        <span style={{fontSize:12,fontWeight:700}}>{ej.nombre}</span>
                      </div>
                    </div>
                    <button onClick={()=>removeFromSession(ej.id)} style={{background:'none',border:'none',color:R,cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
                  </div>
                  <input value={ej.reps} onChange={e=>updateEj(ej.id,'reps',e.target.value)} style={{...s.inp,fontSize:11}} placeholder="Parámetros (series, reps, tiempo...)"/>
                </div>
              ))}
            </div>
            {rehabSession.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <button onClick={exportRehabPDF} style={{...s.btnR,background:brand.colorPrimary,width:'100%',padding:'10px',fontSize:12}}>📄 Exportar protocolo a PDF</button>
                <button onClick={()=>setRehabSession([])} style={{...s.btnG,width:'100%',fontSize:11,color:R,borderColor:R}}>Limpiar sesión</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const HeaderLogo=()=>brand.logoImg?(
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <img src={brand.logoImg} alt="logo" style={{height:46,objectFit:'contain',flexShrink:0}}/>
      <div>
        <div style={{fontFamily:'Arial Black,Arial,sans-serif',fontWeight:900,fontSize:20,color:brand.colorPrimary,letterSpacing:2,lineHeight:1}}>{brand.gymName}</div>
        <div style={{fontFamily:'Arial,sans-serif',fontSize:10,color:WH,letterSpacing:'3.5px',marginTop:2}}>{brand.gymSub}</div>
      </div>
    </div>
  ):<DefaultLogo h={46} gymName={brand.gymName} gymSub={brand.gymSub}/>;

  return(
    <div style={s.page}>
      {clientWizard&&<ClientWizardModal clientWizard={clientWizard} saveClient={saveClient} setClientWizard={setClientWizard} brand={brand} NIVEL={NIVEL} SF={SF} OBJS={OBJS} s={s} emptyScreening={emptyScreening}/>}
      {dbLoading&&(
        <div style={{position:'fixed',top:0,left:0,right:0,background:'#0A3D62',color:'#fff',textAlign:'center',padding:'6px',fontSize:11,zIndex:9999,fontFamily:'Arial,sans-serif'}}>
          ⏳ Conectando con la base de datos...
        </div>
      )}
      {dbError&&(
        <div style={{position:'fixed',top:0,left:0,right:0,background:'#DC2626',color:'#fff',textAlign:'center',padding:'6px',fontSize:11,zIndex:9999,fontFamily:'Arial,sans-serif'}}>
          ⚠ Error de conexión: {dbError} — Los datos no se guardarán hasta reconectar.
        </div>
      )}
      <div style={{...s.hdr,background:brand.colorBg,borderBottomColor:brand.colorPrimary}}>
        <HeaderLogo/>
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <div style={{textAlign:'right'}}>
            <div style={{color:WH,fontSize:12,fontWeight:700,letterSpacing:'.04em'}}>Método Activa Integra</div>
            <div style={{color:G3,fontSize:10,marginTop:2}}>{exs.length} ejercicios · {clients.length} clientes · v9.0</div>
          </div>
          <div style={{width:2,height:36,background:brand.colorPrimary,borderRadius:99,flexShrink:0}}/>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            {Object.entries(NIVEL).map(([k,v])=>{const n=clients.filter(c=>c.nivel===k).length;return(<div key={k} style={{display:'flex',gap:5,alignItems:'center',fontSize:10}}><span style={{color:v.color,fontWeight:700,minWidth:20}}>{v.badge}</span><span style={{color:G3}}>{n||'—'}</span></div>);})}
          </div>
        </div>
      </div>
      <div style={{...s.tabBar,background:'#141414',borderBottomColor:brand.colorPrimary}}>
        {[['clientes',`Clientes${clients.length>0?` (${clients.length})`:''}`,],['session','Constructor'],['rehab','Rehabilitación'],['fisio','🏥 FisioActiva'],['export','Exportar'],['db','Ejercicios'],['brand','Centro']].map(([k,lbl])=>(
          <button key={k} onClick={()=>setTab(k)} style={s.tb(tab===k,brand.colorPrimary)}>{lbl}</button>
        ))}
      </div>
      <div style={{maxWidth:960,margin:'0 auto',paddingBottom:32}}>
        {tab==='clientes'&&{ClientesTab()}}
        {tab==='session'&&{SessionTab()}}
        {tab==='rehab'&&{RehabTab()}}
        {tab==='fisio'&&<FisioActiva
          brand={brand}
          gymClients={clients}
          onUpdateGymClient={(gymClientId, updates)=>{
            updateClientFn(gymClientId, updates)
              .catch(e=>console.error('Error sincronizando con gym:',e));
          }}
        />}
        {tab==='export'&&{ExportTab()}}
        {tab==='db'&&{DBTab()}}
        {tab==='brand'&&{BrandingTab()}}
      </div>
    </div>
  );
}
