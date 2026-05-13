// FisioActiva.jsx — Sistema Clínico Premium · Método Activa Integra
// Integrado con ACTIVA Fitness Club App
import { useState, useMemo, useEffect, useCallback } from "react";
import { FASES_METODO, generarCriteriosPersonalizados, checkCriteriosAvance, getSemaforoPorFase } from "./criterios.js";
import { useFisioPacientes, genId } from "./db.js";

// Alias local para compatibilidad con el código existente
const FASES_BASE=FASES_METODO;

// ─── PALETA CLÍNICA ────────────────────────────────────────────────────────
const NV='#0A3D62', TL='#1BAA86', CR='#FF6F4C';
const WH='#FFFFFF', BG='#F0F4F8', GL='#E2E8F0';
const GM='#94A3B8', GD='#475569', GDK='#1E293B';
const GN='#16A34A', AM='#D97706', RJ='#DC2626';

// ─── ROM NORMAS ────────────────────────────────────────────────────────────
const ROM_NORMS={
  cervical:[
    {mov:'Flexión',normal:50},{mov:'Extensión',normal:60},
    {mov:'Flex. Lat. D',normal:45},{mov:'Flex. Lat. I',normal:45},
    {mov:'Rot. D',normal:80},{mov:'Rot. I',normal:80},
  ],
  hombro:[
    {mov:'Flexión',normal:180},{mov:'Extensión',normal:60},
    {mov:'Abducción',normal:180},{mov:'Rot. Interna',normal:70},
    {mov:'Rot. Externa',normal:90},
  ],
  codo:[
    {mov:'Flexión',normal:150},{mov:'Extensión',normal:0},
    {mov:'Pronación',normal:80},{mov:'Supinación',normal:80},
  ],
  muneca:[
    {mov:'Flexión',normal:80},{mov:'Extensión',normal:70},
    {mov:'Desv. Radial',normal:20},{mov:'Desv. Cubital',normal:30},
  ],
  cadera:[
    {mov:'Flexión',normal:120},{mov:'Extensión',normal:30},
    {mov:'Abducción',normal:45},{mov:'Aducción',normal:30},
    {mov:'Rot. Interna',normal:45},{mov:'Rot. Externa',normal:45},
  ],
  lumbar:[
    {mov:'Flexión',normal:60},{mov:'Extensión',normal:25},
    {mov:'Flex. Lat. D',normal:25},{mov:'Flex. Lat. I',normal:25},
  ],
  columna:[
    {mov:'Flexión cervical',normal:50},{mov:'Extensión cervical',normal:60},
    {mov:'Flexión lumbar',normal:60},{mov:'Extensión lumbar',normal:25},
  ],
  rodilla:[
    {mov:'Flexión',normal:150},{mov:'Extensión',normal:0},
  ],
  tobillo:[
    {mov:'Dorsiflexión',normal:20},{mov:'Plantar-flex.',normal:50},
    {mov:'Inversión',normal:35},{mov:'Eversión',normal:15},
  ],
  esc:[
    {mov:'Elevación hombro',normal:180},{mov:'Rot. Externa',normal:90},
    {mov:'Rot. Interna',normal:70},
  ],
};

// ─── GRUPOS DE FUERZA POR REGIÓN ──────────────────────────────────────────
const FUERZA_GRUPOS={
  hombro:['Flexores','Extensores','Abductores','Rot. Internos','Rot. Externos'],
  esc:['Serrato ant.','Trapecio sup.','Trapecio med.','Trapecio inf.','Romboides'],
  codo:['Flexores codo','Extensores codo','Supinadores','Pronadores'],
  muneca:['Flexores muñeca','Extensores muñeca'],
  lumbar:['Extensores lumbares','Flexores tronco','Glúteo mayor','Glúteo medio'],
  columna:['Extensores lumbares','Flexores tronco','Glúteo mayor','Glúteo medio'],
  cadera:['Glúteo mayor','Glúteo medio','Flexores cadera','Isquiotibiales','Aductores'],
  rodilla:['Cuádriceps','Isquiotibiales','Gemelos'],
  tobillo:['Flexores dorsales','Plantar-flexores','Inversores','Eversores'],
  cervical:['Flexores profundos','Extensores cervicales','Rotadores cervicales'],
  general:['Glúteo mayor','Glúteo medio','Cuádriceps','Isquiotibiales','Core','Manguito rotador'],
};

// ─── ESCALAS CLÍNICAS ─────────────────────────────────────────────────────
const ESCALAS_INFO={
  eva:{nombre:'EVA — Escala Visual Analógica',objetivo:'Cuantificar la intensidad subjetiva del dolor.',instruccion:'Pedirle al paciente que puntúe su dolor del 0 al 10. 0 = sin dolor. 10 = peor dolor imaginable. Realizarla al inicio, en reposo y con movimiento.',interpretacion:'0–2: Leve  |  3–5: Moderado  |  6–8: Intenso  |  9–10: Insoportable',referencia:'Gift AG. Vis Analogue Scales. Nursing Research. 1989.',tiempo:'< 1 min'},
  dn4:{nombre:'DN4 — Douleur Neuropathique 4',objetivo:'Detectar componente neuropático. Score ≥4/10 = probable neuropático.',instruccion:'Preguntas 1-2: entrevista al paciente. Preguntas 3-4: exploración clínica (alodinia, hipoestesia, hiperalgesia).',interpretacion:'< 4: Dolor nociceptivo  |  ≥ 4: Probable componente neuropático',referencia:'Bouhassira D et al. Pain. 2005.',tiempo:'2–3 min'},
  odi:{nombre:'ODI — Oswestry Disability Index',objetivo:'Discapacidad funcional en lumbalgia. 10 secciones × 5 pts → %.',instruccion:'Paciente elige UNA opción por sección: Dolor, Cuidado personal, Levantar, Caminar, Sentado, De pie, Dormir, Vida sexual, Social, Viajar.',interpretacion:'0–20%: Mínima  |  21–40%: Moderada  |  41–60%: Severa  |  61–80%: Muy severa  |  81–100%: Postrado',referencia:'Fairbank JC, Pynsent PB. Spine. 2000.',tiempo:'5 min'},
  dash:{nombre:'DASH — Disabilities of Arm, Shoulder and Hand',objetivo:'Función del miembro superior. 30 ítems, 0–100. Menor = mejor.',instruccion:'Paciente califica dificultad en actividades del miembro superior (última semana). 1=Sin dificultad → 5=Incapaz.',interpretacion:'0–20: Casi normal  |  21–40: Leve  |  41–60: Moderada  |  >60: Severa. MCID=10.',referencia:'Hudak PL et al. Am J Occup Ther. 1996.',tiempo:'5–7 min'},
  koos:{nombre:'KOOS — Knee Injury and Osteoarthritis Outcome Score',objetivo:'Síntomas, dolor y función en rodilla. 5 subescalas 0–100. Mayor = mejor.',instruccion:'42 ítems en 5 subescalas. Paciente responde sobre la última semana.',interpretacion:'< 50: Comprometido  |  50–75: Moderado  |  > 75: Buena función. MCID=8–10.',referencia:'Roos EM et al. J Orthop Sports Phys Ther. 1998.',tiempo:'7–10 min'},
  lefs:{nombre:'LEFS — Lower Extremity Functional Scale',objetivo:'Función miembro inferior. 20 ítems × 4 = máx 80.',instruccion:'Paciente califica dificultad de 20 actividades. 0=Incapaz → 4=Sin dificultad.',interpretacion:'> 60: Mínima discapacidad  |  40–60: Moderada  |  < 40: Severa. MCID=9.',referencia:'Binkley JM et al. Phys Ther. 1999.',tiempo:'5 min'},
};

// ─── FMS ──────────────────────────────────────────────────────────────────
const FMS_TESTS=[
  {id:'fms1',nombre:'Sentadilla Profunda',max:3,como:'Palo overhead, pies al ancho de caderas. Sentadilla profunda. Vista frontal y lateral. 3 intentos.',puntos:[{p:3,d:'Tronco paralelo a tibia. Fémur bajo horizontal. Rodillas alineadas. Palo sobre pies.'},{p:2,d:'Con talones elevados (tabla) o palo inclinado. Puede completar.'},{p:1,d:'No puede completar ni con modificación.'},{p:0,d:'DOLOR → score 0, derivar.'}],nota:'Mejora con tabla: limitación dorsiflexión. Mejora con palo adelante: control motor/movilidad T.'},
  {id:'fms2',nombre:'Paso de Valla',max:3,como:'Valla a nivel tuberosidad tibial. Pie de apoyo en línea. Elevar pierna sin contacto. Manos en palo horizontal detrás cabeza.',puntos:[{p:3,d:'Caderas, rodillas, tobillos alineados. Sin movimiento lumbar.'},{p:2,d:'Pérdida de alineación o movimiento lumbar visible.'},{p:1,d:'Contacto con valla o pérdida de equilibrio.'},{p:0,d:'Dolor.'}],nota:'Evaluar bilateralmente.'},
  {id:'fms3',nombre:'Estocada en Línea',max:3,como:'Distancia = longitud de tibia. Pie trasero en línea. Descender rodilla trasera detrás del talón. Palo: contacto en 3 puntos.',puntos:[{p:3,d:'Palo contacta 3 puntos. Rodilla toca detrás del talón. Sin movimiento de tronco.'},{p:2,d:'Pérdida de contacto o balanceo.'},{p:1,d:'Pérdida de equilibrio.'},{p:0,d:'Dolor.'}],nota:'Diferencia ≥1 punto = asimetría significativa.'},
  {id:'fms4',nombre:'Movilidad de Hombro',max:3,como:'Puños cerrados. Medir distancia entre nudillos. Referencia: longitud de la mano.',puntos:[{p:3,d:'Distancia ≤ 1 mano.'},{p:2,d:'Entre 1 y 1.5 manos.'},{p:1,d:'> 1.5 manos.'},{p:0,d:'Dolor en clearing test.'}],nota:'Clearing test obligatorio: presión pasiva en máxima rotación.'},
  {id:'fms5',nombre:'ASLR — Elevación Activa Pierna Recta',max:3,como:'Supino. Elevar pierna activamente con rodilla extendida. Referencia: tobillo → mitad muslo → EIAS contralateral.',puntos:[{p:3,d:'Tobillo cruza la EIAS contralateral.'},{p:2,d:'Tobillo entre mitad de muslo y EIAS.'},{p:1,d:'No supera la mitad del muslo.'},{p:0,d:'Dolor.'}],nota:'Tabla bajo rodilla de apoyo: si mejora → movilidad de cadera en extensión limitada.'},
  {id:'fms6',nombre:'Estabilidad Tronco Push-Up',max:3,como:'H: manos a nivel de frente. M: manos a nivel mentón. Un solo push-up como tabla rígida.',puntos:[{p:3,d:'Cuerpo rígido. Sin caída de cadera.'},{p:2,d:'H: completa con manos al mentón / M: con manos al esternón.'},{p:1,d:'No puede completar.'},{p:0,d:'Dolor. Clearing: extensión en prono.'}],nota:'Clearing obligatorio: cobra con manos bajo hombros.'},
  {id:'fms7',nombre:'Estabilidad Rotatoria',max:3,como:'Cuadrupedia. Extender brazo y pierna IPSILATERAL. Luego codo a rodilla ipsilateral.',puntos:[{p:3,d:'Patrón ipsilateral correcto. Columna horizontal.'},{p:2,d:'Solo puede realizar patrón CONTRALATERAL.'},{p:1,d:'No puede sin compensaciones.'},{p:0,d:'Dolor. Clearing: postura del niño.'}],nota:'Diferencia ≥1 punto = asimetría. Clearing: postura del niño.'},
];

// ─── TESTS ORTOPÉDICOS ESPECÍFICOS ────────────────────────────────────────
const TESTS_ESP={
  hombro:[
    {n:'Hawkins-Kennedy',como:'Flex 90°, codo 90°. Rotación interna pasiva forzada.',indica:'Pinzamiento subacromial',positivo:'Dolor en el arco de RI',sens:'79%',esp:'59%'},
    {n:'Neer',como:'Estabilizar escápula. Elevar brazo en flexión con pulgar hacia abajo.',indica:'Pinzamiento subacromial',positivo:'Dolor en elevación anterior',sens:'72%',esp:'60%'},
    {n:'Empty Can (Jobe)',como:'90° abd, 30° flex, RI. Resistencia a la elevación.',indica:'Lesión supraespinoso',positivo:'Debilidad o dolor',sens:'69%',esp:'66%'},
    {n:"Speed's Test",como:'90° flex, codo extendido, supinación. Resistencia a flexión.',indica:'Tendinopatía bíceps / SLAP',positivo:'Dolor en corredera bicipital',sens:'54%',esp:'81%'},
    {n:'Apprehensión + Relocation',como:'Abd 90°, RE progresiva. + si apprehensión. Presión posterior: desaparece.',indica:'Inestabilidad glenohumeral anterior',positivo:'Sensación de inestabilidad',sens:'72%',esp:'96%'},
  ],
  codo:[
    {n:"Cozen's (Tenista)",como:'Puño cerrado, desviación radial. Resistencia a extensión de muñeca con codo extendido.',indica:'Epicondilalgia lateral',positivo:'Dolor en epicóndilo lateral',sens:'84%',esp:'72%'},
    {n:'Test del Golfista',como:'Flexión resistida de muñeca y pronación con codo extendido.',indica:'Epicondilalgia medial',positivo:'Dolor en epicóndilo medial',sens:'89%',esp:'55%'},
    {n:'Test de Tinel (cubital)',como:'Percusión sobre el canal epitrócleo-olecraneano.',indica:'Síndrome del túnel cubital',positivo:'Parestesias en dedos IV-V',sens:'70%',esp:'98%'},
  ],
  rodilla:[
    {n:'Lachman',como:'30° flex. Mano proximal fija fémur. Mano distal tracciona tibia hacia anterior.',indica:'Rotura LCA',positivo:'Traslación anterior excesiva o endpoint blando',sens:'85%',esp:'94%'},
    {n:'McMurray',como:'Flexión máxima. RE+extensión (menisco medial). RI+extensión (lateral). Buscar click.',indica:'Lesión meniscal',positivo:'Click audible/palpable + dolor en interlínea',sens:'60%',esp:'70%'},
    {n:'Thessaly (20°)',como:'Apoyo monopodal 20° flex. Rotación D e I × 3. Buscar dolor en interlínea.',indica:'Lesión meniscal',positivo:'Dolor o sensación de bloqueo',sens:'89%',esp:'97%'},
    {n:'Estrés en Valgo 0°/30°',como:'Fuerza en valgo a 0° y 30°.',indica:'Lesión LCM',positivo:'Apertura medial o dolor',sens:'78%',esp:'62%'},
    {n:'Pivot Shift',como:'Extensión+RI+valgo → flexión. Buscar clunk de subluxación.',indica:'Inestabilidad rotatoria LCA',positivo:'Clunk visible',sens:'32%',esp:'98%'},
  ],
  columna:[
    {n:'Slump Test',como:'Sentado: slump → flex cervical → extensión rodilla → dorsiflexión. Ext. cervical debe aliviar.',indica:'Tensión neural / hernia L4-S1',positivo:'Reproducción síntomas + alivio con ext. cervical',sens:'83%',esp:'55%'},
    {n:'SLR (Lasègue)',como:'Supino. Elevar pierna extendida. + si dolor irradiado entre 30-70°.',indica:'Compresión raíz L4-S1',positivo:'Dolor irradiado en pierna 30-70°',sens:'80%',esp:'40%'},
    {n:'FABER (Patrick)',como:'Posición figura 4. Presión suave sobre rodilla.',indica:'Articulación SI / patología cadera',positivo:'Dolor en ingle o SI ipsilateral',sens:'57%',esp:'71%'},
    {n:"Kemp's Test",como:'Bipedestación. Extensión + rotación + inclinación ipsilateral + compresión axial.',indica:'Estenosis foraminal / facetaria',positivo:'Reproducción dolor radicular',sens:'60%',esp:'92%'},
  ],
  lumbar:[
    {n:'SLR (Lasègue)',como:'Supino. Elevar pierna extendida. + si dolor irradiado entre 30-70°.',indica:'Compresión raíz L4-S1',positivo:'Dolor irradiado 30-70°',sens:'80%',esp:'40%'},
    {n:'Slump Test',como:'Sentado. Slump → flex cervical → ext. rodilla. Ext. cervical alivia.',indica:'Tensión neural',positivo:'Reproducción + alivio con ext. cervical',sens:'83%',esp:'55%'},
    {n:"Kemp's Test",como:'Extensión + rotación + inclinación + compresión axial.',indica:'Patología facetaria',positivo:'Dolor ipsilateral',sens:'60%',esp:'92%'},
  ],
  tobillo:[
    {n:'Cajón Anterior',como:'Sentado, tobillo neutro. Tracción anterior del calcáneo.',indica:'Lesión LPA anterior',positivo:'Traslación > 5mm o endpoint blando',sens:'80%',esp:'74%'},
    {n:'Thompson (Aquiles)',como:'Prono, pie fuera de camilla. Comprimir masa gemelar.',indica:'Rotura tendón de Aquiles',positivo:'Ausencia de plantar-flexión',sens:'96%',esp:'93%'},
    {n:'Squeeze Test',como:'Comprimir tibia y peroné en tercio medio.',indica:'Fractura / lesión sindesmosis',positivo:'Dolor distal al comprimir',sens:'84%',esp:'82%'},
  ],
  cadera:[
    {n:'FABER (Patrick)',como:'Figura 4. Presión sobre rodilla.',indica:'Articulación SI / cadera',positivo:'Dolor en ingle o SI',sens:'57%',esp:'71%'},
    {n:'FADIR',como:'Flex 90°, aducción + RI pasiva.',indica:'Pinzamiento femoroacetabular',positivo:'Dolor en ingle anterior',sens:'78%',esp:'10%'},
    {n:'Thomas Test',como:'Decúbito supino. Flexionar ambas rodillas al pecho. Soltar una.',indica:'Retracción psoas',positivo:'Extensión incompleta de cadera',sens:'89%',esp:'45%'},
  ],
  muneca:[
    {n:'Phalen Test',como:'Flexión máxima de muñeca durante 60 seg.',indica:'Síndrome del túnel carpiano',positivo:'Parestesias dedos I-III',sens:'68%',esp:'73%'},
    {n:'Tinel en muñeca',como:'Percusión sobre el túnel carpiano.',indica:'Síndrome del túnel carpiano',positivo:'Parestesias dedos I-III',sens:'50%',esp:'77%'},
    {n:'Watson (escafoides)',como:'Presión sobre escafoides + desviación radial.',indica:'Inestabilidad escafo-lunar',positivo:'Click o dolor',sens:'69%',esp:'66%'},
  ],
  esc:[
    {n:'Hawkins-Kennedy',como:'Flex 90°, codo 90°. Rotación interna pasiva.',indica:'Pinzamiento subacromial',positivo:'Dolor en el arco',sens:'79%',esp:'59%'},
    {n:'Escápula alada activa',como:'Push-up en pared. Observar protracción escapular.',indica:'Disfunción serrato anterior / largo torácico',positivo:'Escápula despegada del tórax',sens:'N/A',esp:'N/A'},
  ],
  cervical:[
    {n:'Spurling',como:'Flexión lateral + extensión + compresión axial ipsilateral.',indica:'Compresión radicular cervical',positivo:'Reproducción dolor radicular ipsilateral',sens:'30%',esp:'93%'},
    {n:'Distracción cervical',como:'Tracción manual de la cabeza.',indica:'Compresión radicular',positivo:'Alivio del dolor radicular',sens:'44%',esp:'90%'},
    {n:'Upper Limb Tension Test (ULTT)',como:'Depresión escapular + extensión codo + supinación + ext. muñeca + inclinación cervical contralateral.',indica:'Tensión neural miembro superior',positivo:'Reproducción síntomas + alivio con inclinación ipsilateral',sens:'97%',esp:'22%'},
  ],
};

// ─── RED FLAGS ────────────────────────────────────────────────────────────
const RED_FLAGS=[
  {cat:'🔴 Oncológicas',items:['Historia de cáncer previo','Pérdida de peso inexplicable > 5 kg/mes','Fatiga extrema sin causa aparente','Dolor nocturno intenso que no cede en reposo','Masa palpable de crecimiento rápido']},
  {cat:'🔴 Vasculares / Cardíacas',items:['Dolor torácico irradiado a brazo o mandíbula','Palpitaciones con disnea o síncope','Claudicación intermitente','Signos de TVP: edema, calor, dolor en pantorrilla','Pulso ausente o asimétrico']},
  {cat:'🔴 Neurológicas graves',items:['Síndrome de cauda equina (pérdida de control esfínteres, anestesia en silla de montar)','Debilidad muscular de inicio rápido (días)','Déficit neurológico progresivo bilateral','Diplopía, disfagia, disartria (sospecha vascular)','Ataxia de inicio reciente']},
  {cat:'🟠 Infecciosas / Inflamatorias',items:['Fiebre > 38°C inexplicable','Dolor que EMPEORA en reposo y MEJORA con actividad','Rigidez matutina > 1 hora','Afectación articular múltiple y simétrica','Antecedente de infección sistémica reciente']},
  {cat:'🟠 Traumáticas',items:['Trauma de alta energía reciente','Osteoporosis severa + trauma de baja energía','Fracturas patológicas previas','Uso prolongado de corticosteroides','Deformidad visible post-traumática']},
  {cat:'🟡 Yellow Flags (Psicosociales)',items:['Catastrofismo marcado','Kinesiofobia elevada (TAMPA > 37)','Trastorno depresivo activo no tratado','Conflictos laborales/legales relacionados al dolor','Expectativas muy negativas de recuperación']},
];


// ─── CRITERIOS DE ALTA CLÍNICA ────────────────────────────────────────────
const CRITERIOS_ALTA=[
  {id:'eva',label:'EVA ≤ 2/10',peso:25,icon:'🩹'},
  {id:'rom',label:'ROM > 90% del valor normal',peso:25,icon:'📐'},
  {id:'fuerza',label:'Fuerza > 90% contralateral',peso:25,icon:'💪'},
  {id:'ybal',label:'Y-Balance: asimetría < 4 cm',peso:15,icon:'⚖️'},
  {id:'fms',label:'FMS ≥ 14/21',peso:10,icon:'✅'},
];

// ─── UTILIDADES ───────────────────────────────────────────────────────────
const calcEVA=(v)=>{const n=parseFloat(v);if(isNaN(n))return null;if(n<=2)return{color:GN,label:'Leve'};if(n<=5)return{color:AM,label:'Moderado'};return{color:RJ,label:'Intenso'};};
const calcROMpct=(rom,region)=>{const norms=ROM_NORMS[region];if(!norms||!rom)return null;let t=0,c=0;norms.forEach(n=>{const v=parseFloat(rom[n.mov]);if(!isNaN(v)&&n.normal>0){t+=Math.min(v/n.normal*100,100);c++;}});return c>0?Math.round(t/c):null;};
const calcYBalanceDiff=(yb)=>{if(!yb)return null;const vals=['ant','pm','pl'].map(d=>[parseFloat(yb['d_'+d]||''),parseFloat(yb['i_'+d]||'')]);const diffs=vals.filter(([a,b])=>!isNaN(a)&&!isNaN(b)).map(([a,b])=>Math.abs(a-b));return diffs.length?Math.max(...diffs).toFixed(1):null;};
const calcFMSTotal=(fms)=>Object.values(fms||{}).reduce((s,v)=>s+(parseInt(v)||0),0);
const calcDN4=(dn4)=>Object.values(dn4||{}).filter(Boolean).length;

const REGIONES_LIST=[
  {k:'cervical',label:'Cervical'},{k:'hombro',label:'Hombro'},{k:'codo',label:'Codo'},
  {k:'muneca',label:'Muñeca'},{k:'esc',label:'Cintura Esc.'},{k:'columna',label:'Columna'},
  {k:'lumbar',label:'Lumbar'},{k:'cadera',label:'Cadera'},{k:'rodilla',label:'Rodilla'},{k:'tobillo',label:'Tobillo'},
];

const EVAL_STEPS=[
  {title:'Datos y Región',icon:'📋'},{title:'Anamnesis',icon:'🗣️'},
  {title:'Red Flags',icon:'🚩'},{title:'Escalas de Dolor',icon:'🩹'},
  {title:'Escalas Funcionales',icon:'📊'},{title:'Evaluación Postural',icon:'🔍'},
  {title:'ROM — Goniometría',icon:'📐'},{title:'Fuerza Muscular',icon:'💪'},
  {title:'Control Motor',icon:'⚡'},{title:'FMS',icon:'🏃'},
  {title:'Tests Específicos',icon:'🎯'},{title:'Síntesis y Plan',icon:'✅'},
];

const emptyEval=()=>({
  id:'eval_'+Date.now(),fecha:new Date().toISOString().split('T')[0],tipo:'inicial',region:'lumbar',evaluador:'',
  motivo:'',evolucion:'',antecedentes:'',medicacion:'',ocupacion:'',deporte:'',objetivo:'',historialLesional:'',
  redFlags:{},eva_reposo:'',eva_movimiento:'',
  dn4:{q1:false,q2:false,q3:false,q4:false,q5:false,q6:false,q7:false},
  odi:Array(10).fill(0),dash_score:'',koos_sintomas:'',koos_dolor:'',koos_avd:'',koos_sport:'',koos_qol:'',lefs_score:'',
  postural:{ant:{cabeza:'',hombros:'',cintura:'',rodillas:'',pies:''},lat:{cabeza:'',cervical:'',dorsal:'',lumbar:'',pelvis:'',rodillas:''},post:{cabeza:'',hombros:'',escapulas:'',columna:'',pelvis:'',pies:''}},
  rom:{},fuerza:{},dinamometria:{d:'',i:''},
  sls:{d:'',i:'',obs:''},ybalance:{d_ant:'',d_pm:'',d_pl:'',i_ant:'',i_pm:'',i_pl:''},
  birddog:'',deadbug:'',fms:{},testsEsp:{},
  diagnosticoPT:'',hipotesis:'',objetivos_tratamiento:'',plan:'',fase:'restaura',prox_eval:'',notas:'',
  criterios_personalizados:[],
});

const emptyPaciente=()=>({
  id:genId('pac'),nombre:'',apellido:'',documento:'',celular:'',email:'',
  fechaNac:'',genero:'',region:'lumbar',derivadoPor:'',
  evaluaciones:[],activo:true,notas:'',
  // campos de integración con la app de gym
  gym_clienteId:null,
});

// ─── ESTILOS ──────────────────────────────────────────────────────────────
const fs={
  page:{fontFamily:'Arial,sans-serif',background:BG,minHeight:'100vh'},
  card:{background:WH,border:`1px solid ${GL}`,borderRadius:10,padding:'14px 16px',marginBottom:10},
  cardNV:{background:NV,borderRadius:10,padding:'14px 16px',marginBottom:10},
  inp:{width:'100%',padding:'7px 9px',border:`1px solid ${GL}`,borderRadius:5,fontSize:12,outline:'none',fontFamily:'Arial,sans-serif',boxSizing:'border-box',background:WH},
  sel:{padding:'7px 9px',border:`1px solid ${GL}`,borderRadius:5,fontSize:12,background:WH,outline:'none',fontFamily:'Arial,sans-serif'},
  lbl:{display:'block',fontSize:10,fontWeight:700,color:GD,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3},
  btnNV:{background:NV,color:WH,border:'none',borderRadius:5,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Arial,sans-serif'},
  btnTL:{background:TL,color:WH,border:'none',borderRadius:5,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Arial,sans-serif'},
  btnG:{background:'none',border:`1px solid ${GL}`,borderRadius:5,padding:'6px 12px',cursor:'pointer',fontSize:12,color:GD,fontFamily:'Arial,sans-serif'},
  tag:(c)=>({display:'inline-block',background:c,color:WH,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:99}),
};

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// Props: { brand, gymClients, onUpdateGymClient }
// gymClients = lista de clientes de la app de gym (para vincular)
// onUpdateGymClient = callback para actualizar semáforo/nivel en la app de gym
// ══════════════════════════════════════════════════════════════════════════
export default function FisioActiva({ brand, gymClients=[], onUpdateGymClient }){
  const [view,setView]=useState('dashboard');
  // ── DATOS EN TIEMPO REAL (Supabase) ──────────────────────────────────────
  const { pacientes: dbPacientes, loading: dbLoading, error: dbError, savePaciente: dbSavePaciente, deletePaciente: dbDeletePaciente, saveEvaluacion: dbSaveEvaluacion } = useFisioPacientes();
  const [pacientes, setPacientes] = useState([]);

  useEffect(()=>{ setPacientes(dbPacientes); }, [dbPacientes]);
  const [currentPac,setCurrentPac]=useState(null);
  const [currentEval,setCurrentEval]=useState(null);
  const [evalStep,setEvalStep]=useState(0);
  const [editingPac,setEditingPac]=useState(null);
  const [showPacForm,setShowPacForm]=useState(false);
  const [viewingEval,setViewingEval]=useState(null);
  const [filterRegion,setFilterRegion]=useState('');
  const [searchPac,setSearchPac]=useState('');
  const BPrimary=brand?.colorPrimary||NV;

  const filteredPacs=useMemo(()=>pacientes.filter(p=>{
    const q=searchPac.toLowerCase();
    return(!q||(p.nombre+' '+p.apellido).toLowerCase().includes(q)||p.documento.includes(q))&&(!filterRegion||p.region===filterRegion);
  }),[pacientes,searchPac,filterRegion]);

  // ── SINCRONIZAR CON APP DE GYM ─────────────────────────────────────────
  // Cuando se guarda una evaluación con síntesis, actualiza el cliente en la app de gym
  const syncConGym=(pac,eval_)=>{
    if(!pac.gym_clienteId||!onUpdateGymClient)return;
    const fase=eval_.fase||'restaura';
    const semaforoNuevo=FASES_BASE[fase]?.semaforo||'pendiente';
    const restricciones=[];
    if(eval_.redFlags&&Object.values(eval_.redFlags).some(Boolean))restricciones.push('Red flag activa — solo fisioterapia');
    if(eval_.eva_reposo&&parseFloat(eval_.eva_reposo)>6)restricciones.push('Dolor intenso activo');
    onUpdateGymClient(pac.gym_clienteId,{
      nivel:fase,
      semaforo:semaforoNuevo,
      restricciones:restricciones.join(' · '),
      restricciones_flags:{
        impacto:fase==='restaura'||parseFloat(eval_.eva_reposo||'0')>5,
        overhead:(['hombro','esc','cervical'].includes(eval_.region)&&parseFloat(eval_.eva_reposo||'0')>3),
        cargaAxial:(['lumbar','columna'].includes(eval_.region)&&parseFloat(eval_.eva_reposo||'0')>4),
      },
      fechaEval:eval_.fecha,
      screeningCompleto:true,
      notasInternas:`Actualizado desde FisioActiva · ${eval_.fecha} · ${eval_.diagnosticoPT||''}`.slice(0,200),
    });
  };

  const saveEval=()=>{
    if(!currentPac||!currentEval)return;
    const criterios=generarCriteriosPersonalizados(currentEval.objetivo,currentEval.fase,currentEval.eva_reposo,calcROMpct(currentEval.rom,currentEval.region));
    const evalFinal={...currentEval,id:genId('eval'),criterios_personalizados:criterios};
    // Persistir en Supabase
    dbSaveEvaluacion(currentPac.id, evalFinal)
      .catch(e=>console.error('Error guardando evaluación:',e));
    // Sincronizar con gym
    syncConGym(currentPac, evalFinal);
    setView('ver-paciente');
  };

  const savePaciente=(p)=>{
    dbSavePaciente(p).catch(e=>console.error('Error guardando paciente:',e));
    setShowPacForm(false);
    setEditingPac(null);
  };

  // ── DASHBOARD ──────────────────────────────────────────────────────────
  const Dashboard=()=>{
    const totalEvals=pacientes.reduce((s,p)=>s+p.evaluaciones.length,0);
    const sinEval=pacientes.filter(p=>p.evaluaciones.length===0).length;
    const enRestora=pacientes.filter(p=>{const l=p.evaluaciones[p.evaluaciones.length-1];return l?.fase==='restaura';}).length;
    return(
      <div style={{padding:'14px'}}>
        <div style={{...fs.cardNV,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 18px'}}>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:WH}}>FisioActiva — Sistema Clínico</div>
            <div style={{fontSize:11,color:'#93C5FD',marginTop:2}}>Evaluación Funcional · Rehabilitación · Alta Clínica · Método Activa Integra</div>
          </div>
          <div style={{display:'flex',gap:16}}>
            {[['Pacientes',pacientes.length],['Evaluaciones',totalEvals],['En RESTAURA',enRestora]].map(([l,v])=>(
              <div key={l} style={{textAlign:'right'}}><div style={{fontSize:20,fontWeight:800,color:WH}}>{v}</div><div style={{fontSize:9,color:'#93C5FD',textTransform:'uppercase'}}>{l}</div></div>
            ))}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
          {[
            {icon:'➕',label:'Nueva Evaluación',sub:'Iniciar evaluación funcional',action:()=>{if(pacientes.length===0){setEditingPac(emptyPaciente());setShowPacForm(true);}else{setCurrentPac(pacientes[0]);setCurrentEval(emptyEval());setEvalStep(0);setView('nueva-eval');}},color:TL},
            {icon:'👥',label:'Pacientes',sub:`${pacientes.length} registrados`,action:()=>setView('pacientes'),color:NV},
            {icon:'📊',label:'KPIs Clínicos',sub:'Progreso y métricas',action:()=>setView('kpis'),color:'#7C3AED'},
            {icon:'📋',label:'Protocolos',sub:'Fases y criterios',action:()=>setView('protocolos'),color:'#0284C7'},
            {icon:'🏥',label:'Altas Clínicas',sub:'Validar criterios',action:()=>setView('altas'),color:GN},
            {icon:'🔄',label:'Re-evaluaciones',sub:`${sinEval} pendientes`,action:()=>setView('reevals'),color:AM},
          ].map((c,i)=>(
            <div key={i} onClick={c.action} style={{...fs.card,cursor:'pointer',borderTop:`3px solid ${c.color}`,padding:'14px',textAlign:'center',marginBottom:0}}>
              <div style={{fontSize:26,marginBottom:6}}>{c.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:GDK,marginBottom:2}}>{c.label}</div>
              <div style={{fontSize:10,color:GM}}>{c.sub}</div>
            </div>
          ))}
        </div>
        {/* Panel de integración con app de gym */}
        {gymClients.length>0&&(
          <div style={{...fs.card,borderLeft:`4px solid ${TL}`}}>
            <div style={{fontSize:11,fontWeight:700,marginBottom:8,color:GD}}>🔗 CLIENTES VINCULADOS CON ACTIVA FITNESS CLUB</div>
            <div style={{fontSize:11,color:GD,marginBottom:8}}>Los cambios de fase y semáforo en FisioActiva actualizan automáticamente el perfil del cliente en la app de gym.</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {gymClients.slice(0,5).map(c=>(
                <span key={c.id} style={{background:BG,border:`1px solid ${GL}`,borderRadius:5,padding:'3px 8px',fontSize:11,color:GD}}>{c.nombre} {c.apellido}</span>
              ))}
              {gymClients.length>5&&<span style={{fontSize:11,color:GM}}>+{gymClients.length-5} más</span>}
            </div>
          </div>
        )}
        {pacientes.length>0&&(
          <div style={fs.card}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:GD}}>Actividad reciente</div>
            {pacientes.slice(-4).reverse().map(p=>{
              const last=p.evaluaciones[p.evaluaciones.length-1];
              const ei=last?.eva_reposo?calcEVA(last.eva_reposo):null;
              return(
                <div key={p.id} onClick={()=>{setCurrentPac(p);setView('ver-paciente');}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:7,cursor:'pointer',marginBottom:5,background:BG,border:`1px solid ${GL}`}}>
                  <div><div style={{fontSize:12,fontWeight:700}}>{p.nombre} {p.apellido}</div><div style={{fontSize:10,color:GM}}>{REGIONES_LIST.find(r=>r.k===p.region)?.label} · {p.evaluaciones.length} eval.</div></div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {last?.fase&&<span style={{...fs.tag(FASES_BASE[last.fase]?.color||GM)}}>{FASES_BASE[last.fase]?.badge}</span>}
                    {ei&&<span style={{...fs.tag(ei.color)}}>EVA {last.eva_reposo}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pacientes.length===0&&(
          <div style={{...fs.card,textAlign:'center',padding:32,borderStyle:'dashed'}}>
            <div style={{fontSize:32,marginBottom:10}}>🏥</div>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Sin pacientes registrados</div>
            <div style={{fontSize:12,color:GM,marginBottom:16}}>Registrá el primer paciente para comenzar.</div>
            <button onClick={()=>{setEditingPac(emptyPaciente());setShowPacForm(true);}} style={fs.btnTL}>+ Nuevo paciente</button>
          </div>
        )}
      </div>
    );
  };

  // ── PACIENTES ─────────────────────────────────────────────────────────
  const PacientesView=()=>(
    <div style={{padding:'14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div><div style={{fontSize:14,fontWeight:700}}>Pacientes</div><div style={{fontSize:11,color:GM}}>{filteredPacs.length} de {pacientes.length}</div></div>
        <button onClick={()=>{setEditingPac(emptyPaciente());setShowPacForm(true);}} style={fs.btnTL}>+ Nuevo paciente</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <input value={searchPac} onChange={e=>setSearchPac(e.target.value)} placeholder="Buscar..." style={fs.inp}/>
        <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{...fs.sel,width:'100%'}}>
          <option value=''>Todas las regiones</option>
          {REGIONES_LIST.map(r=><option key={r.k} value={r.k}>{r.label}</option>)}
        </select>
      </div>
      {filteredPacs.map(p=>{
        const last=p.evaluaciones[p.evaluaciones.length-1];
        const ei=last?.eva_reposo?calcEVA(last.eva_reposo):null;
        const rp=last?calcROMpct(last.rom,p.region):null;
        const fase=last?.fase;
        return(
          <div key={p.id} style={{...fs.card,borderLeft:`4px solid ${fase?FASES_BASE[fase].color:TL}`,marginBottom:8,padding:'12px 14px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                  <span style={{fontSize:14,fontWeight:700}}>{p.nombre} {p.apellido}</span>
                  {p.documento&&<span style={{fontSize:10,color:GM}}>CI {p.documento}</span>}
                  {fase&&<span style={{...fs.tag(FASES_BASE[fase]?.color||GM)}}>{FASES_BASE[fase]?.badge} {FASES_BASE[fase]?.label}</span>}
                  {ei&&<span style={{...fs.tag(ei.color)}}>EVA {last.eva_reposo}</span>}
                  {rp&&<span style={{...fs.tag(rp>90?GN:rp>70?AM:RJ)}}>ROM {rp}%</span>}
                  {p.gym_clienteId&&<span style={{background:'#EFF6FF',color:'#1D4ED8',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:99,border:'1px solid #93C5FD'}}>🔗 GYM</span>}
                </div>
                <div style={{fontSize:10,color:GM,display:'flex',gap:10}}>
                  {p.celular&&<span>📱 {p.celular}</span>}
                  <span>📋 {p.evaluaciones.length} eval.</span>
                  {p.derivadoPor&&<span>Derivado: {p.derivadoPor}</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap'}}>
                <button onClick={()=>{setCurrentPac(p);setCurrentEval(emptyEval());setEvalStep(0);setView('nueva-eval');}} style={{...fs.btnTL,fontSize:10,padding:'4px 10px'}}>Evaluar</button>
                <button onClick={()=>{setCurrentPac(p);setView('ver-paciente');}} style={{...fs.btnNV,fontSize:10,padding:'4px 10px'}}>Ver</button>
                <button onClick={()=>{setEditingPac(p);setShowPacForm(true);}} style={{...fs.btnG,fontSize:10,padding:'4px 8px'}}>Editar</button>
              </div>
            </div>
          </div>
        );
      })}
      {filteredPacs.length===0&&<div style={{...fs.card,textAlign:'center',padding:24,color:GM}}>Sin resultados.</div>}
    </div>
  );

  // ── VER PACIENTE ──────────────────────────────────────────────────────
  const VerPaciente=()=>{
    if(!currentPac)return null;
    const evals=currentPac.evaluaciones||[];
    const last=evals[evals.length-1];
    const ei=last?.eva_reposo?calcEVA(last.eva_reposo):null;
    const rp=last?calcROMpct(last.rom,currentPac.region):null;
    const yb=last?calcYBalanceDiff(last.ybalance):null;
    const fmsT=last?calcFMSTotal(last.fms):null;
    const fase=last?.fase||'restaura';
    const faseInfo=FASES_BASE[fase];
    // Criterios personalizados del última evaluación
    const criterios=last?.criterios_personalizados||faseInfo?.criterios_base_avance||[];
    // Chequeo de criterios para avanzar de fase
    const checkAvance={
      eva:last?.eva_reposo&&parseFloat(last.eva_reposo)<=(fase==='restaura'?3:2),
      rom:rp&&rp>(fase==='restaura'?70:fase==='activa'?85:90),
      ybal:yb&&parseFloat(yb)<(fase==='restaura'?99:fase==='activa'?6:4),
      fms:fmsT&&fmsT>=(fase==='potencia'?14:0),
    };
    const criteriosCumplidos=Object.values(checkAvance).filter(Boolean).length;
    return(
      <div style={{padding:'14px'}}>
        <button onClick={()=>setView('pacientes')} style={{...fs.btnG,marginBottom:12,fontSize:11}}>← Volver</button>
        <div style={{...fs.cardNV,padding:'16px 18px',marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:WH}}>{currentPac.nombre} {currentPac.apellido}</div>
              <div style={{fontSize:11,color:'#93C5FD',marginTop:2}}>
                {currentPac.documento&&`CI ${currentPac.documento} · `}
                {currentPac.celular&&`📱 ${currentPac.celular} · `}
                {REGIONES_LIST.find(r=>r.k===currentPac.region)?.label}
                {currentPac.gym_clienteId&&' · 🔗 Vinculado al gym'}
              </div>
              {last?.objetivo&&<div style={{fontSize:11,color:'#BAE6FD',marginTop:4}}>🎯 Objetivo: "{last.objetivo}"</div>}
            </div>
            <button onClick={()=>{setCurrentEval(emptyEval());setEvalStep(0);setView('nueva-eval');}} style={fs.btnTL}>+ Nueva evaluación</button>
          </div>
        </div>
        {/* KPIs */}
        {last&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
            {[
              {l:'EVA',v:last.eva_reposo||'—',c:ei?.color||GM,s:ei?.label||''},
              {l:'ROM %',v:rp?`${rp}%`:'—',c:rp?(rp>90?GN:rp>70?AM:RJ):GM,s:rp?(rp>90?'Bueno':rp>70?'Moderado':'Limitado'):''},
              {l:'Y-Balance Δ',v:yb?`${yb} cm`:'—',c:yb?(parseFloat(yb)<4?GN:parseFloat(yb)<8?AM:RJ):GM,s:yb?(parseFloat(yb)<4?'Normal':'Asimetría'):''},
              {l:'FMS',v:fmsT||'—',c:fmsT?(fmsT>=14?GN:fmsT>=11?AM:RJ):GM,s:fmsT?(fmsT>=14?'Óptimo':fmsT>=11?'Moderado':'Riesgo'):''},
            ].map((k,i)=>(
              <div key={i} style={{...fs.card,textAlign:'center',borderTop:`3px solid ${k.c}`,padding:'10px 8px',marginBottom:0}}>
                <div style={{fontSize:9,color:GM,textTransform:'uppercase',marginBottom:3}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:800,color:k.c}}>{k.v}</div>
                <div style={{fontSize:10,color:k.c}}>{k.s}</div>
              </div>
            ))}
          </div>
        )}
        {/* Fase actual y criterios de evolución personalizados */}
        {last&&(
          <div style={{...fs.card,borderLeft:`4px solid ${faseInfo.color}`,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:faseInfo.color}}>{faseInfo.badge} · {faseInfo.label}</div>
                <div style={{fontSize:11,color:GM}}>Criterios para avanzar a la siguiente fase</div>
              </div>
              <div style={{fontSize:20,fontWeight:800,color:criteriosCumplidos>=3?GN:AM}}>{criteriosCumplidos}/4</div>
            </div>
            {/* Criterios personalizados basados en el objetivo del paciente */}
            <div style={{background:BG,borderRadius:7,padding:'10px 12px',marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:6,textTransform:'uppercase'}}>
                Criterios personalizados — Objetivo: "{last.objetivo||'No especificado'}"
              </div>
              {criterios.map((c,i)=>{
                // Evaluar automáticamente los criterios medibles
                let cumplido=null;
                if(c.includes('EVA')&&last.eva_reposo){
                  const target=fase==='restaura'?3:2;
                  cumplido=parseFloat(last.eva_reposo)<=target;
                }
                if(c.includes('ROM')&&rp){cumplido=rp>(fase==='restaura'?70:85);}
                if(c.includes('Y-Balance')&&yb){cumplido=parseFloat(yb)<(fase==='activa'?6:4);}
                if(c.includes('FMS')&&fmsT){cumplido=fmsT>=14;}
                return(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'5px 0',borderBottom:i<criterios.length-1?`1px solid ${GL}`:'none'}}>
                    <span style={{color:cumplido===true?GN:cumplido===false?RJ:AM,flexShrink:0,fontWeight:700,fontSize:12}}>
                      {cumplido===true?'✓':cumplido===false?'✗':'→'}
                    </span>
                    <span style={{fontSize:11,color:cumplido===true?GD:cumplido===false?RJ:GD,lineHeight:1.4}}>{c}</span>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div style={{background:GL,borderRadius:99,height:6,flex:1,overflow:'hidden'}}>
                <div style={{width:(criteriosCumplidos/4*100)+'%',background:criteriosCumplidos>=3?GN:AM,height:'100%',borderRadius:99}}/>
              </div>
              {criteriosCumplidos>=3&&<span style={{fontSize:11,fontWeight:700,color:GN}}>Listo para avanzar →</span>}
            </div>
          </div>
        )}
        {/* Historial */}
        <div style={fs.card}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Historial ({evals.length} evaluaciones)</div>
          {evals.length===0&&<div style={{textAlign:'center',padding:20,color:GM,fontSize:12}}>Sin evaluaciones registradas.</div>}
          {evals.map((ev,i)=>(
            <div key={ev.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:7,background:BG,marginBottom:6,border:`1px solid ${GL}`}}>
              <div>
                <div style={{fontSize:12,fontWeight:700}}>
                  {ev.tipo==='inicial'?'Evaluación Inicial':ev.tipo==='reeval'?'Re-evaluación':'Alta Clínica'} · {ev.fecha}
                </div>
                <div style={{fontSize:10,color:GM}}>
                  {REGIONES_LIST.find(r=>r.k===ev.region)?.label}
                  {ev.eva_reposo&&` · EVA ${ev.eva_reposo}`}
                  {ev.fase&&` · ${FASES_BASE[ev.fase]?.badge}`}
                  {ev.objetivo&&` · "${ev.objetivo.slice(0,30)}..."`}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>{setViewingEval(ev);setView('ver-eval');}} style={{...fs.btnNV,fontSize:10,padding:'3px 9px'}}>Ver</button>
                {i===evals.length-1&&<button onClick={()=>{setCurrentEval({...emptyEval(),tipo:'reeval',region:ev.region,objetivo:ev.objetivo});setEvalStep(0);setView('nueva-eval');}} style={{...fs.btnTL,fontSize:10,padding:'3px 9px'}}>Reeval.</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── WIZARD DE EVALUACIÓN ──────────────────────────────────────────────
  const NuevaEval=()=>{
    if(!currentEval)return null;
    const ev=currentEval;
    const set=(k,v)=>setCurrentEval(p=>({...p,[k]:v}));
    const setROM=(mov,val)=>setCurrentEval(p=>({...p,rom:{...p.rom,[mov]:val}}));
    const setFuerza=(k,v)=>setCurrentEval(p=>({...p,fuerza:{...p.fuerza,[k]:v}}));
    const setFMS=(id,v)=>setCurrentEval(p=>({...p,fms:{...p.fms,[id]:v}}));
    const setTestEsp=(nombre,res)=>setCurrentEval(p=>({...p,testsEsp:{...p.testsEsp,[nombre]:res}}));
    const setPostural=(vista,campo,val)=>setCurrentEval(p=>({...p,postural:{...p.postural,[vista]:{...p.postural[vista],[campo]:val}}}));
    const setDN4=(k,v)=>setCurrentEval(p=>({...p,dn4:{...p.dn4,[k]:v}}));
    const romKeys=ROM_NORMS[ev.region]||ROM_NORMS.lumbar;
    const fuerzaKeys=FUERZA_GRUPOS[ev.region]||FUERZA_GRUPOS.general;
    const testsKeys=TESTS_ESP[ev.region]||TESTS_ESP.columna;
    const dn4Score=calcDN4(ev.dn4);
    const romPct=calcROMpct(ev.rom,ev.region);

    const renderStep=()=>{
      switch(evalStep){
        case 0: return(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><span style={fs.lbl}>Tipo</span><select value={ev.tipo} onChange={e=>set('tipo',e.target.value)} style={{...fs.sel,width:'100%'}}><option value='inicial'>Evaluación Inicial</option><option value='reeval'>Re-evaluación</option><option value='alta'>Evaluación de Alta</option></select></div>
              <div><span style={fs.lbl}>Región</span><select value={ev.region} onChange={e=>set('region',e.target.value)} style={{...fs.sel,width:'100%'}}>{REGIONES_LIST.map(r=><option key={r.k} value={r.k}>{r.label}</option>)}</select></div>
              <div><span style={fs.lbl}>Fecha</span><input type="date" value={ev.fecha} onChange={e=>set('fecha',e.target.value)} style={fs.inp}/></div>
              <div><span style={fs.lbl}>Evaluador/a</span><input value={ev.evaluador||''} onChange={e=>set('evaluador',e.target.value)} style={fs.inp} placeholder="Nombre del profesional"/></div>
            </div>
            <div style={{...fs.card,background:'#EFF6FF',border:'1px solid #93C5FD',padding:'10px 12px'}}>
              <span style={{...fs.lbl,color:'#1D4ED8'}}>🎯 OBJETIVO DEL PACIENTE — Condiciona los criterios de evolución</span>
              <input value={ev.objetivo||''} onChange={e=>set('objetivo',e.target.value)} placeholder="¿Qué quiere lograr el paciente? (Ej: volver a correr, trabajar sin dolor, levantar a mi hijo...)" style={{...fs.inp,marginTop:4}}/>
              <div style={{fontSize:10,color:'#1D4ED8',marginTop:5}}>Este objetivo se utilizará para personalizar los criterios de evolución entre fases del método.</div>
            </div>
            <div><span style={fs.lbl}>Fase inicial del método</span>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginTop:4}}>
                {Object.entries(FASES_BASE).map(([k,v])=>(
                  <div key={k} onClick={()=>set('fase',k)} style={{padding:'9px 6px',borderRadius:7,border:`2px solid ${ev.fase===k?v.color:GL}`,background:ev.fase===k?`${v.color}15`:WH,cursor:'pointer',textAlign:'center'}}>
                    <div style={{fontSize:10,fontWeight:700,color:ev.fase===k?v.color:GD}}>{v.badge}</div>
                    <div style={{fontSize:9,color:ev.fase===k?v.color:GM,marginTop:2}}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Vincular con cliente de gym */}
            {gymClients.length>0&&(
              <div><span style={fs.lbl}>Vincular con cliente del gym</span>
                <select value={ev.gym_clienteId||''} onChange={e=>set('gym_clienteId',e.target.value)} style={{...fs.sel,width:'100%'}}>
                  <option value=''>Sin vinculación</option>
                  {gymClients.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
                <div style={{fontSize:10,color:GM,marginTop:3}}>Al guardar la evaluación, el semáforo y fase del cliente en el gym se actualizarán automáticamente.</div>
              </div>
            )}
          </div>
        );
        case 1: return(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div><span style={fs.lbl}>Motivo de consulta</span><textarea value={ev.motivo||''} onChange={e=>set('motivo',e.target.value)} rows={2} style={{...fs.inp,resize:'vertical'}}/></div>
            <div><span style={fs.lbl}>Evolución y cronología</span><textarea value={ev.evolucion||''} onChange={e=>set('evolucion',e.target.value)} rows={3} style={{...fs.inp,resize:'vertical'}}/></div>
            <div><span style={fs.lbl}>Antecedentes médicos / quirúrgicos</span><textarea value={ev.antecedentes||''} onChange={e=>set('antecedentes',e.target.value)} rows={2} style={{...fs.inp,resize:'vertical'}}/></div>
            <div><span style={fs.lbl}>Medicación actual</span><input value={ev.medicacion||''} onChange={e=>set('medicacion',e.target.value)} style={fs.inp} placeholder="Fármacos, dosis, tiempo"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><span style={fs.lbl}>Ocupación</span><input value={ev.ocupacion||''} onChange={e=>set('ocupacion',e.target.value)} style={fs.inp}/></div>
              <div><span style={fs.lbl}>Deporte / Actividad</span><input value={ev.deporte||''} onChange={e=>set('deporte',e.target.value)} style={fs.inp}/></div>
            </div>
            <div><span style={fs.lbl}>Historial lesional previo</span><textarea value={ev.historialLesional||''} onChange={e=>set('historialLesional',e.target.value)} rows={2} style={{...fs.inp,resize:'vertical'}}/></div>
          </div>
        );
        case 2: return(
          <div>
            <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:11}}>🚨 <strong>Red Flags:</strong> Su presencia requiere derivación médica inmediata antes de continuar el tratamiento.</div>
            {RED_FLAGS.map((g,i)=>(
              <div key={i} style={{...fs.card,marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>{g.cat}</div>
                {g.items.map((item,j)=>(
                  <label key={j} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:5,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!ev.redFlags[`${i}_${j}`]} onChange={e=>setCurrentEval(p=>({...p,redFlags:{...p.redFlags,[`${i}_${j}`]:e.target.checked}}))} style={{marginTop:2,flexShrink:0}}/>
                    <span style={{fontSize:11,lineHeight:1.5}}>{item}</span>
                  </label>
                ))}
              </div>
            ))}
            {Object.values(ev.redFlags).some(Boolean)&&<div style={{background:'#FEF2F2',border:`2px solid ${RJ}`,borderRadius:8,padding:'12px',fontSize:12,fontWeight:700,color:RJ}}>⚠️ Red flag positiva — Derivar a médico especialista.</div>}
          </div>
        );
        case 3: return(
          <div>
            <div style={{...fs.card,borderLeft:`4px solid ${TL}`}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{ESCALAS_INFO.eva.nombre}</div>
              <div style={{fontSize:11,color:GD,background:BG,borderRadius:6,padding:'8px',marginBottom:10,lineHeight:1.6}}><strong>Objetivo:</strong> {ESCALAS_INFO.eva.objetivo}<br/><strong>Instrucción:</strong> {ESCALAS_INFO.eva.instruccion}<br/><strong>Interpretación:</strong> {ESCALAS_INFO.eva.interpretacion}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[['eva_reposo','EVA en reposo (0–10)'],['eva_movimiento','EVA en movimiento (0–10)']].map(([k,lbl])=>(
                  <div key={k}>
                    <span style={fs.lbl}>{lbl}</span>
                    <input type="number" min="0" max="10" step="0.5" value={ev[k]||''} onChange={e=>set(k,e.target.value)} style={fs.inp}/>
                    {ev[k]&&(()=>{const i=calcEVA(ev[k]);return<div style={{marginTop:4,...fs.tag(i.color),padding:'2px 8px'}}>{i.label}</div>})()}
                  </div>
                ))}
              </div>
            </div>
            <div style={{...fs.card,borderLeft:`4px solid ${CR}`}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{ESCALAS_INFO.dn4.nombre}</div>
              <div style={{fontSize:11,color:GD,background:BG,padding:'8px',borderRadius:6,marginBottom:10,lineHeight:1.6}}><strong>Objetivo:</strong> {ESCALAS_INFO.dn4.objetivo}<br/><strong>Instrucción:</strong> {ESCALAS_INFO.dn4.instruccion}</div>
              <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:GD}}>Entrevista (paciente describe):</div>
              {[['q1','¿El dolor tiene carácter de quemazón?'],['q2','¿Produce sensación de frío doloroso?'],['q3','¿Se parece a descargas eléctricas?'],['q4','¿Hay hormigueo en la zona dolorosa?']].map(([k,label])=>(
                <label key={k} style={{display:'flex',gap:8,alignItems:'center',marginBottom:5,cursor:'pointer'}}><input type="checkbox" checked={!!ev.dn4[k]} onChange={e=>setDN4(k,e.target.checked)}/><span style={{fontSize:11}}>{label}</span></label>
              ))}
              <div style={{fontSize:11,fontWeight:700,marginTop:10,marginBottom:6,color:GD}}>Exploración (evaluador examina):</div>
              {[['q5','¿Hay hipoestesia al tacto?'],['q6','¿Hay hipoestesia al pinchazo?'],['q7','¿El roce suave produce o aumenta el dolor? (alodinia)']].map(([k,label])=>(
                <label key={k} style={{display:'flex',gap:8,alignItems:'center',marginBottom:5,cursor:'pointer'}}><input type="checkbox" checked={!!ev.dn4[k]} onChange={e=>setDN4(k,e.target.checked)}/><span style={{fontSize:11}}>{label}</span></label>
              ))}
              <div style={{marginTop:8,padding:'8px 10px',borderRadius:6,background:dn4Score>=4?'#FEE2E2':'#DCFCE7',border:`1px solid ${dn4Score>=4?'#FCA5A5':'#86EFAC'}`,display:'flex',gap:10,alignItems:'center'}}>
                <div style={{fontSize:20,fontWeight:800,color:dn4Score>=4?RJ:GN}}>{dn4Score}/7</div>
                <div style={{fontSize:12,fontWeight:700,color:dn4Score>=4?RJ:GN}}>{dn4Score>=4?'Componente neuropático probable':'Dolor nociceptivo'}</div>
              </div>
            </div>
          </div>
        );
        case 4: return(
          <div>
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:11}}>📊 Escalas seleccionadas según la región del paciente.</div>
            {(ev.region==='lumbar'||ev.region==='columna')&&(
              <div style={{...fs.card,borderLeft:`4px solid ${NV}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{ESCALAS_INFO.odi.nombre}</div>
                <div style={{fontSize:11,color:GD,background:BG,padding:'8px',borderRadius:6,marginBottom:10,lineHeight:1.6}}><strong>Objetivo:</strong> {ESCALAS_INFO.odi.objetivo}<br/><strong>Interpretación:</strong> {ESCALAS_INFO.odi.interpretacion}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {['Dolor','Cuidado personal','Levantar objetos','Caminar','Sentado','De pie','Dormir','Vida sexual','Vida social','Viajar'].map((item,i)=>(
                    <div key={i}><span style={fs.lbl}>S{i+1}. {item}</span><select value={ev.odi[i]} onChange={e=>{const arr=[...ev.odi];arr[i]=Number(e.target.value);set('odi',arr);}} style={{...fs.sel,width:'100%'}}>{[0,1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}</select></div>
                  ))}
                </div>
                {(()=>{const t=ev.odi.reduce((s,v)=>s+v,0);const p=Math.round((t/50)*100);const c=p<=20?GN:p<=40?AM:RJ;return<div style={{marginTop:8,padding:'8px',borderRadius:6,background:BG,display:'flex',gap:12,alignItems:'center'}}><div style={{fontSize:18,fontWeight:800,color:c}}>{p}%</div><div style={{fontSize:11,color:GD}}>{p<=20?'Discapacidad mínima':p<=40?'Moderada':p<=60?'Severa':'Muy severa'}</div></div>})()}
              </div>
            )}
            {(['hombro','codo','muneca','esc'].includes(ev.region))&&(
              <div style={{...fs.card,borderLeft:`4px solid ${CR}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{ESCALAS_INFO.dash.nombre}</div>
                <div style={{fontSize:11,color:GD,background:BG,padding:'8px',borderRadius:6,marginBottom:10}}><strong>Objetivo:</strong> {ESCALAS_INFO.dash.objetivo}<br/><strong>Interpretación:</strong> {ESCALAS_INFO.dash.interpretacion}</div>
                <div><span style={fs.lbl}>Score DASH (0–100)</span><input type="number" min="0" max="100" value={ev.dash_score||''} onChange={e=>set('dash_score',e.target.value)} style={fs.inp} placeholder="Puntaje calculado"/></div>
                {ev.dash_score&&<div style={{marginTop:6,padding:'6px 10px',borderRadius:6,background:BG,fontSize:11,fontWeight:700,color:parseFloat(ev.dash_score)<=20?GN:parseFloat(ev.dash_score)<=40?AM:RJ}}>{parseFloat(ev.dash_score)<=20?'Casi normal':parseFloat(ev.dash_score)<=40?'Leve':parseFloat(ev.dash_score)<=60?'Moderada':'Severa'}</div>}
              </div>
            )}
            {ev.region==='rodilla'&&(
              <div style={{...fs.card,borderLeft:`4px solid ${TL}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{ESCALAS_INFO.koos.nombre}</div>
                <div style={{fontSize:11,color:GD,background:BG,padding:'8px',borderRadius:6,marginBottom:10}}><strong>Interpretación:</strong> {ESCALAS_INFO.koos.interpretacion}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[['koos_sintomas','Síntomas (0-100)'],['koos_dolor','Dolor (0-100)'],['koos_avd','Función AVD (0-100)'],['koos_sport','Deporte (0-100)'],['koos_qol','Calidad vida (0-100)']].map(([k,lbl])=>(
                    <div key={k}><span style={fs.lbl}>{lbl}</span><input type="number" min="0" max="100" value={ev[k]||''} onChange={e=>set(k,e.target.value)} style={fs.inp}/></div>
                  ))}
                </div>
              </div>
            )}
            {(['cadera','rodilla','tobillo'].includes(ev.region))&&(
              <div style={{...fs.card,borderLeft:`4px solid ${AM}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{ESCALAS_INFO.lefs.nombre}</div>
                <div style={{fontSize:11,color:GD,background:BG,padding:'8px',borderRadius:6,marginBottom:10}}><strong>Interpretación:</strong> {ESCALAS_INFO.lefs.interpretacion}</div>
                <div><span style={fs.lbl}>Score LEFS (0–80)</span><input type="number" min="0" max="80" value={ev.lefs_score||''} onChange={e=>set('lefs_score',e.target.value)} style={fs.inp}/></div>
                {ev.lefs_score&&<div style={{marginTop:6,padding:'6px 10px',borderRadius:6,background:BG,fontSize:11,fontWeight:700,color:parseFloat(ev.lefs_score)>60?GN:parseFloat(ev.lefs_score)>40?AM:RJ}}>{parseFloat(ev.lefs_score)>60?'Mínima discapacidad':parseFloat(ev.lefs_score)>40?'Moderada':'Severa'}</div>}
              </div>
            )}
          </div>
        );
        case 5: return(
          <div>
            {[{vista:'ant',label:'Vista Anterior',campos:[['cabeza','Cabeza'],['hombros','Hombros'],['cintura','Cintura pélvica'],['rodillas','Rodillas'],['pies','Pies']]},{vista:'lat',label:'Vista Lateral',campos:[['cabeza','Cabeza'],['cervical','Cervical'],['dorsal','Dorsal'],['lumbar','Lumbar'],['pelvis','Pelvis'],['rodillas','Rodillas']]},{vista:'post',label:'Vista Posterior',campos:[['cabeza','Cabeza'],['hombros','Hombros'],['escapulas','Escápulas'],['columna','Columna'],['pelvis','Pelvis'],['pies','Pies']]}].map(({vista,label,campos})=>(
              <div key={vista} style={{...fs.card,marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:NV}}>👁️ {label}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {campos.map(([campo,lbl])=>(
                    <div key={campo}><span style={fs.lbl}>{lbl}</span>
                      <select value={ev.postural[vista]?.[campo]||''} onChange={e=>setPostural(vista,campo,e.target.value)} style={{...fs.sel,width:'100%'}}>
                        <option value=''>—</option>
                        {({cabeza:['Centrada','Lat. D','Lat. I','Antepulsión'],hombros:['Simétrico','Elevado D','Elevado I'],cintura:['Neutra','Inclinada D','Inclinada I'],rodillas:['Neutro','Valgo bil.','Varo bil.','Hiperextensión'],pies:['Neutro','Pronación','Supinación','Asimétrico'],cervical:['Normal','Hiperlordosis','Rectificación'],dorsal:['Normal','Hipercifosis','Rectificación'],lumbar:['Normal','Hiperlordosis','Rectificación'],pelvis:['Neutra','Anteversión','Retroversión','Inclinación D','Inclinación I'],escapulas:['Simétricas','Alada bilateral','Alada D','Alada I'],columna:['Recta','Escoliosis D','Escoliosis I','En S']}[campo]||['Normal','Alterado']).map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
        case 6: return(
          <div>
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>📐 Goniómetro. Registrar en grados. El sistema calcula el % respecto al valor normal.</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:6}}>
              <div style={{fontSize:10,color:GM,fontWeight:700,textTransform:'uppercase'}}>Movimiento</div>
              <div style={{fontSize:10,color:GM,fontWeight:700,textTransform:'uppercase',textAlign:'center'}}>Normal (°)</div>
              <div style={{fontSize:10,color:GM,fontWeight:700,textTransform:'uppercase',textAlign:'center'}}>Medido (°)</div>
            </div>
            {romKeys.map(n=>{
              const val=ev.rom[n.mov]||'';const pct=val&&n.normal>0?Math.round(parseFloat(val)/n.normal*100):null;const col=pct?(pct>90?GN:pct>70?AM:RJ):GL;
              return(<div key={n.mov} style={{display:'grid',gridTemplateColumns:'1fr 70px 1fr',gap:6,alignItems:'center',background:WH,border:`1px solid ${GL}`,borderLeft:`3px solid ${col}`,borderRadius:6,padding:'6px 10px',marginBottom:4}}>
                <div><div style={{fontSize:11,fontWeight:600}}>{n.mov}</div>{pct&&<div style={{...fs.tag(col),fontSize:9,marginTop:1}}>{pct}%</div>}</div>
                <div style={{textAlign:'center',fontSize:12,color:GM,fontWeight:600}}>{n.normal}°</div>
                <input type="number" min="0" value={val} onChange={e=>setROM(n.mov,e.target.value)} placeholder="°" style={{...fs.inp,textAlign:'center'}}/>
              </div>);
            })}
            {romPct&&<div style={{marginTop:8,padding:'10px',borderRadius:7,background:romPct>90?'#DCFCE7':romPct>70?'#FEF9C3':'#FEE2E2',border:`1px solid ${romPct>90?'#86EFAC':romPct>70?'#FDE047':'#FCA5A5'}`,display:'flex',gap:12,alignItems:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:romPct>90?GN:romPct>70?AM:RJ}}>{romPct}%</div>
              <div><div style={{fontSize:12,fontWeight:700,color:romPct>90?GN:romPct>70?AM:RJ}}>ROM promedio {romPct>90?'Normal':romPct>70?'Moderado':'Limitado'}</div><div style={{fontSize:10,color:GD}}>Criterio de alta: {'>'} 90%</div></div>
            </div>}
          </div>
        );
        case 7: return(
          <div>
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>💪 Escala MRC (0–5). Evaluar bilateral. 0=Sin contracción · 3=Contra gravedad · 5=Normal</div>
            {fuerzaKeys.map(grupo=>(
              <div key={grupo} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,alignItems:'center',background:WH,border:`1px solid ${GL}`,borderRadius:6,padding:'7px 10px',marginBottom:5}}>
                <span style={{fontSize:11,fontWeight:600}}>{grupo}</span>
                {['d','i'].map(lado=>(
                  <div key={lado}><span style={{...fs.lbl,marginBottom:1}}>{lado==='d'?'Der':'Izq'}</span>
                    <select value={ev.fuerza[grupo+'_'+lado]||''} onChange={e=>setFuerza(grupo+'_'+lado,e.target.value)} style={{...fs.sel,width:'100%',fontSize:11}}>
                      <option value=''>—</option>{[0,1,2,3,4,5].map(v=><option key={v} value={v}>{v}/5</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
            <div style={fs.card}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Dinamometría de agarre</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div><span style={fs.lbl}>Mano dominante (kg)</span><input type="number" value={ev.dinamometria.d} onChange={e=>setCurrentEval(p=>({...p,dinamometria:{...p.dinamometria,d:e.target.value}}))} style={fs.inp} placeholder="kg"/></div>
                <div><span style={fs.lbl}>Mano no dominante (kg)</span><input type="number" value={ev.dinamometria.i} onChange={e=>setCurrentEval(p=>({...p,dinamometria:{...p.dinamometria,i:e.target.value}}))} style={fs.inp} placeholder="kg"/></div>
              </div>
              {ev.dinamometria.d&&ev.dinamometria.i&&(()=>{const d=Math.abs(parseFloat(ev.dinamometria.d)-parseFloat(ev.dinamometria.i));const p=(d/Math.max(parseFloat(ev.dinamometria.d),parseFloat(ev.dinamometria.i))*100).toFixed(0);return<div style={{marginTop:6,padding:'6px 10px',borderRadius:5,background:BG,fontSize:11}}>Déficit: <strong style={{color:parseFloat(p)>10?RJ:GN}}>{p}%</strong> {parseFloat(p)>10?'— Asimetría significativa':'— Normal'}</div>})()}
            </div>
          </div>
        );
        case 8: return(
          <div>
            {[{titulo:'Single Leg Stance (SLS)',inst:'Apoyo monopodal, ojos abiertos. Normal: > 30 seg. Progresión: ojos cerrados.',campos:[{k:'sls.d',l:'Pierna D (seg)'},{k:'sls.i',l:'Pierna I (seg)'}],obs:'sls.obs',refVal:30},{titulo:'Y-Balance Test',inst:'Apoyo monopodal. Alcance máximo en 3 direcciones. Asimetría ANT > 4 cm = riesgo lesión.'}].map((t,ti)=>(
              ti===0?(
                <div key={ti} style={{...fs.card,borderLeft:`4px solid ${TL}`}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{t.titulo}</div>
                  <div style={{fontSize:11,color:GD,background:BG,padding:'7px',borderRadius:5,marginBottom:8}}>{t.inst}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
                    <div><span style={fs.lbl}>Tiempo pierna D (seg)</span><input type="number" value={ev.sls.d} onChange={e=>setCurrentEval(p=>({...p,sls:{...p.sls,d:e.target.value}}))} style={fs.inp}/></div>
                    <div><span style={fs.lbl}>Tiempo pierna I (seg)</span><input type="number" value={ev.sls.i} onChange={e=>setCurrentEval(p=>({...p,sls:{...p.sls,i:e.target.value}}))} style={fs.inp}/></div>
                  </div>
                  <div><span style={fs.lbl}>Observaciones</span><input value={ev.sls.obs} onChange={e=>setCurrentEval(p=>({...p,sls:{...p.sls,obs:e.target.value}}))} style={fs.inp} placeholder="Compensaciones, estrategias..."/></div>
                </div>
              ):(
                <div key={ti} style={{...fs.card,borderLeft:`4px solid ${NV}`}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{t.titulo}</div>
                  <div style={{fontSize:11,color:GD,background:BG,padding:'7px',borderRadius:5,marginBottom:8}}>{t.inst}</div>
                  <div style={{display:'grid',gridTemplateColumns:'80px 1fr 1fr 1fr',gap:5,marginBottom:4}}>
                    <div/>{['ANT','PM','PL'].map(d=><div key={d} style={{fontSize:9,color:GM,textAlign:'center',fontWeight:700}}>{d}</div>)}
                  </div>
                  {['d','i'].map(lado=>(
                    <div key={lado} style={{display:'grid',gridTemplateColumns:'80px 1fr 1fr 1fr',gap:5,alignItems:'center',marginBottom:5}}>
                      <span style={{fontSize:11,fontWeight:600}}>Pierna {lado==='d'?'D':'I'}</span>
                      {['ant','pm','pl'].map(dir=><input key={dir} type="number" value={ev.ybalance[lado+'_'+dir]||''} onChange={e=>setCurrentEval(p=>({...p,ybalance:{...p.ybalance,[lado+'_'+dir]:e.target.value}}))} placeholder="cm" style={{...fs.inp,textAlign:'center'}}/>)}
                    </div>
                  ))}
                  {(()=>{const diff=calcYBalanceDiff(ev.ybalance);return diff&&<div style={{marginTop:4,padding:'6px 10px',borderRadius:5,background:parseFloat(diff)<4?'#DCFCE7':'#FEE2E2',fontSize:11,fontWeight:700,color:parseFloat(diff)<4?GN:RJ}}>Asimetría: {diff} cm — {parseFloat(diff)<4?'Normal':'Riesgo elevado de lesión'}</div>})()}
                </div>
              )
            ))}
            <div style={{...fs.card,borderLeft:`4px solid ${AM}`}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Bird Dog</div>
              <div style={{fontSize:11,color:GD,background:BG,padding:'7px',borderRadius:5,marginBottom:6}}>Cuadrupedia. Brazo y pierna contralaterales. Columna neutra. Evalúa control rotacional lumbo-pélvico.</div>
              <select value={ev.birddog||''} onChange={e=>set('birddog',e.target.value)} style={{...fs.sel,width:'100%'}}>
                <option value=''>— Seleccionar —</option>
                <option>Óptimo — Sin compensaciones. Columna neutra.</option>
                <option>Leve compensación — Rotación pélvica.</option>
                <option>Compensación marcada.</option>
                <option>No puede realizar.</option>
              </select>
            </div>
            <div style={{...fs.card,borderLeft:`4px solid ${CR}`}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Dead Bug</div>
              <div style={{fontSize:11,color:GD,background:BG,padding:'7px',borderRadius:5,marginBottom:6}}>Supino, caderas 90°. Extensión contralateral brazo-pierna. Espalda baja pegada.</div>
              <select value={ev.deadbug||''} onChange={e=>set('deadbug',e.target.value)} style={{...fs.sel,width:'100%'}}>
                <option value=''>— Seleccionar —</option>
                <option>Óptimo — Mantiene neutro lumbar.</option>
                <option>Pierde neutro lumbar.</option>
                <option>No puede realizar con extensión completa.</option>
              </select>
            </div>
          </div>
        );
        case 9: return(
          <div>
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>🏃 FMS — Total máximo 21. Score ≤ 14: mayor riesgo de lesión.</div>
            {FMS_TESTS.map(t=>{
              const score=ev.fms[t.id];
              return(
                <div key={t.id} style={{...fs.card,borderLeft:`3px solid ${score===0?RJ:score>=3?GN:score>=2?AM:GL}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <div style={{fontSize:12,fontWeight:700}}>{t.nombre}</div>
                    <div style={{display:'flex',gap:4}}>
                      {[0,1,2,3].map(v=>(
                        <button key={v} onClick={()=>setFMS(t.id,v)} style={{width:28,height:28,borderRadius:5,border:`2px solid ${score===v?(v===0?RJ:v>=2?GN:AM):GL}`,background:score===v?(v===0?'#FEE2E2':v>=2?'#DCFCE7':'#FEF9C3'):WH,cursor:'pointer',fontSize:11,fontWeight:700,color:score===v?(v===0?RJ:v>=2?GN:AM):GD}}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <details><summary style={{fontSize:10,color:TL,cursor:'pointer',fontWeight:700}}>Ver instrucción</summary>
                    <div style={{background:BG,borderRadius:5,padding:'8px',marginTop:4,fontSize:11,color:GD,lineHeight:1.6}}>
                      <strong>Cómo:</strong> {t.como}<br/><br/>
                      {t.puntos.map((p,i)=><div key={i} style={{marginBottom:2}}><strong style={{color:p.p===0?RJ:p.p>=2?GN:AM}}>Punt. {p.p}:</strong> {p.d}</div>)}
                      {t.nota&&<div style={{marginTop:4,fontStyle:'italic',color:GM}}>💡 {t.nota}</div>}
                    </div>
                  </details>
                </div>
              );
            })}
            {(()=>{const t=calcFMSTotal(ev.fms);const sc=Object.keys(ev.fms).length;return sc>0&&<div style={{padding:'10px',borderRadius:7,background:t>=14?'#DCFCE7':t>=11?'#FEF9C3':'#FEE2E2',display:'flex',gap:12,alignItems:'center',marginTop:4}}><div style={{fontSize:26,fontWeight:800,color:t>=14?GN:t>=11?AM:RJ}}>{t}</div><div><div style={{fontSize:12,fontWeight:700,color:t>=14?GN:t>=11?AM:RJ}}>{t>=14?'Riesgo bajo':t>=11?'Riesgo moderado':'Riesgo elevado'}</div><div style={{fontSize:10,color:GD}}>FMS Total ({sc}/7) · Umbral alta: ≥14</div></div></div>})()}
          </div>
        );
        case 10: return(
          <div>
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>🎯 Tests ortopédicos específicos — {REGIONES_LIST.find(r=>r.k===ev.region)?.label}</div>
            {testsKeys.map(t=>(
              <div key={t.n} style={fs.card}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{t.n}</div>
                <div style={{fontSize:11,color:GD,background:BG,padding:'8px',borderRadius:5,marginBottom:8,lineHeight:1.6}}>
                  <strong>Cómo:</strong> {t.como}<br/><strong>Indica:</strong> {t.indica}<br/>
                  <strong>Positivo:</strong> {t.positivo}<br/>
                  <span style={{color:GM}}>Sens: {t.sens} · Esp: {t.esp}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {['Derecho','Izquierdo'].map(lado=>(
                    <div key={lado}><span style={fs.lbl}>{lado}</span>
                      <select value={ev.testsEsp[t.n+'_'+lado]||''} onChange={e=>setTestEsp(t.n+'_'+lado,e.target.value)} style={{...fs.sel,width:'100%'}}>
                        <option value=''>— Sin realizar —</option>
                        <option value='negativo'>Negativo ✓</option>
                        <option value='positivo'>Positivo ⚠</option>
                        <option value='dudoso'>Dudoso ≈</option>
                        <option value='no_aplica'>No aplica</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
        case 11: return(
          <div>
            {/* Resumen de KPIs */}
            {(()=>{
              const ei=ev.eva_reposo?calcEVA(ev.eva_reposo):null;
              const rp=calcROMpct(ev.rom,ev.region);
              const yb=calcYBalanceDiff(ev.ybalance);
              const fmsT=calcFMSTotal(ev.fms);
              const dn4Sc=calcDN4(ev.dn4);
              return(
                <div style={{...fs.card,marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Resumen de la evaluación</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                    {[{l:'EVA Reposo',v:ev.eva_reposo||'—',c:ei?.color||GM,s:ei?.label||''},{l:'ROM %',v:rp?rp+'%':'—',c:rp?(rp>90?GN:rp>70?AM:RJ):GM},{l:'DN4',v:dn4Sc+'/7',c:dn4Sc>=4?RJ:GN,s:dn4Sc>=4?'Neuropático':'Nociceptivo'},{l:'Y-Balance Δ',v:yb?yb+' cm':'—',c:yb?(parseFloat(yb)<4?GN:RJ):GM},{l:'FMS Total',v:fmsT||'—',c:fmsT?(fmsT>=14?GN:fmsT>=11?AM:RJ):GM}].map((k,i)=>(
                      <div key={i} style={{background:BG,borderRadius:6,padding:'8px',textAlign:'center',border:`2px solid ${k.c}20`}}>
                        <div style={{fontSize:9,color:GM,textTransform:'uppercase',marginBottom:2}}>{k.l}</div>
                        <div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.v}</div>
                        {k.s&&<div style={{fontSize:9,color:k.c}}>{k.s}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div style={fs.card}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Diagnóstico y Plan</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div><span style={fs.lbl}>Diagnóstico fisioterapéutico</span><textarea value={ev.diagnosticoPT||''} onChange={e=>set('diagnosticoPT',e.target.value)} rows={2} style={{...fs.inp,resize:'vertical'}}/></div>
                <div><span style={fs.lbl}>Hipótesis de tratamiento</span><textarea value={ev.hipotesis||''} onChange={e=>set('hipotesis',e.target.value)} rows={2} style={{...fs.inp,resize:'vertical'}}/></div>
                <div><span style={fs.lbl}>Objetivos de tratamiento (corto / medio / largo)</span><textarea value={ev.objetivos_tratamiento||''} onChange={e=>set('objetivos_tratamiento',e.target.value)} rows={3} style={{...fs.inp,resize:'vertical'}} placeholder="Objetivo 1 semana / 1 mes / alta clínica..."/></div>
                <div><span style={fs.lbl}>Plan de tratamiento</span><textarea value={ev.plan||''} onChange={e=>set('plan',e.target.value)} rows={3} style={{...fs.inp,resize:'vertical'}}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div><span style={fs.lbl}>Fase del método asignada</span>
                    <select value={ev.fase} onChange={e=>set('fase',e.target.value)} style={{...fs.sel,width:'100%'}}>
                      {Object.entries(FASES_BASE).map(([k,v])=><option key={k} value={k}>{v.badge} — {v.label}</option>)}
                    </select>
                  </div>
                  <div><span style={fs.lbl}>Re-evaluación en</span>
                    <select value={ev.prox_eval||''} onChange={e=>set('prox_eval',e.target.value)} style={{...fs.sel,width:'100%'}}>
                      <option value=''>Seleccionar</option>
                      {['1 semana','2 semanas','1 mes','6 semanas','2 meses','3 meses'].map(v=><option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {/* Criterios personalizados generados a partir del objetivo */}
            {ev.objetivo&&(
              <div style={{...fs.card,borderLeft:`4px solid ${FASES_BASE[ev.fase]?.color||NV}`,background:'#EFF6FF'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#1D4ED8',marginBottom:8}}>🎯 Criterios de evolución personalizados para: "{ev.objetivo}"</div>
                <div style={{fontSize:11,color:GD,marginBottom:8}}>Estos criterios quedarán guardados en la ficha y condicionarán el avance a la siguiente fase.</div>
                {generarCriteriosPersonalizados(ev.objetivo,ev.fase,ev.eva_reposo,calcROMpct(ev.rom,ev.region)).map((c,i)=>(
                  <div key={i} style={{display:'flex',gap:6,alignItems:'flex-start',fontSize:11,color:GD,padding:'4px 0',borderBottom:i>0?`1px solid ${GL}`:'none'}}>
                    <span style={{color:FASES_BASE[ev.fase]?.color,fontWeight:700,flexShrink:0}}>→</span>{c}
                  </div>
                ))}
              </div>
            )}
            {gymClients.length>0&&ev.gym_clienteId&&(
              <div style={{...fs.card,borderLeft:`4px solid ${TL}`,background:'#F0FDF4'}}>
                <div style={{fontSize:11,fontWeight:700,color:TL,marginBottom:4}}>🔗 Sincronización con ACTIVA Fitness Club</div>
                <div style={{fontSize:11,color:GD}}>
                  Al guardar esta evaluación, el cliente vinculado en el gym recibirá:<br/>
                  • Nivel del método: <strong>{FASES_BASE[ev.fase]?.badge} {FASES_BASE[ev.fase]?.label}</strong><br/>
                  • Semáforo: <strong>{FASES_BASE[ev.fase]?.semaforo}</strong><br/>
                  • Restricciones actualizadas según la evaluación
                </div>
              </div>
            )}
          </div>
        );
        default: return null;
      }
    };

    return(
      <div style={{padding:'12px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <button onClick={()=>setView('ver-paciente')} style={{...fs.btnG,fontSize:11}}>← Cancelar</button>
          <div style={{fontWeight:700,fontSize:12,color:GDK}}>{currentPac?.nombre} {currentPac?.apellido}</div>
          <div style={{fontSize:10,color:GM}}>{evalStep+1}/{EVAL_STEPS.length}</div>
        </div>
        <div style={{display:'flex',gap:3,marginBottom:10,overflowX:'auto',paddingBottom:2}}>
          {EVAL_STEPS.map((st,i)=>(
            <div key={i} onClick={()=>i<evalStep&&setEvalStep(i)} style={{padding:'4px 7px',borderRadius:5,background:i===evalStep?NV:i<evalStep?GL:BG,color:i===evalStep?WH:GD,fontSize:9,fontWeight:i===evalStep?700:400,cursor:i<evalStep?'pointer':'default',flexShrink:0,border:`1px solid ${i===evalStep?NV:GL}`}}>
              {i<evalStep?'✓':st.icon} {i+1}
            </div>
          ))}
        </div>
        <div style={{background:NV,borderRadius:7,padding:'9px 12px',marginBottom:10,borderLeft:`3px solid ${TL}`}}>
          <div style={{color:WH,fontWeight:700,fontSize:12}}>{EVAL_STEPS[evalStep].icon} {EVAL_STEPS[evalStep].title}</div>
          {ev.objetivo&&evalStep>0&&<div style={{color:'#BAE6FD',fontSize:10,marginTop:2}}>🎯 Objetivo: "{ev.objetivo.slice(0,50)}{ev.objetivo.length>50?'...':''}"</div>}
        </div>
        <div style={{maxHeight:'52vh',overflowY:'auto',paddingRight:2}}>{renderStep()}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:8,borderTop:`1px solid ${GL}`}}>
          <button onClick={()=>setEvalStep(p=>p-1)} disabled={evalStep===0} style={{...fs.btnG,opacity:evalStep===0?.3:1}}>← Anterior</button>
          {evalStep===EVAL_STEPS.length-1
            ?<button onClick={saveEval} style={{...fs.btnTL,padding:'9px 20px'}}>✓ Guardar evaluación</button>
            :<button onClick={()=>setEvalStep(p=>p+1)} style={fs.btnNV}>Siguiente →</button>
          }
        </div>
      </div>
    );
  };

  // ── KPIs CLÍNICOS ──────────────────────────────────────────────────────
  const KPIs=()=>(
    <div style={{padding:'14px'}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>KPIs Clínicos</div>
      {pacientes.filter(p=>p.evaluaciones.length>0).length===0&&<div style={{...fs.card,textAlign:'center',padding:24,color:GM}}>Sin evaluaciones registradas.</div>}
      {pacientes.filter(p=>p.evaluaciones.length>0).map(p=>{
        const last=p.evaluaciones[p.evaluaciones.length-1];
        const ei=last?.eva_reposo?calcEVA(last.eva_reposo):null;
        const rp=calcROMpct(last?.rom,p.region);
        const yb=last?calcYBalanceDiff(last.ybalance):null;
        const fmsT=last?calcFMSTotal(last.fms):null;
        const fase=last?.fase||'restaura';
        const checks=[
          {id:'eva',label:'EVA ≤ 2',pass:last?.eva_reposo&&parseFloat(last.eva_reposo)<=2,val:last?.eva_reposo||'—',peso:25},
          {id:'rom',label:'ROM > 90%',pass:rp&&rp>90,val:rp?rp+'%':'—',peso:25},
          {id:'ybal',label:'Y-Bal < 4cm',pass:yb&&parseFloat(yb)<4,val:yb?yb+' cm':'—',peso:15},
          {id:'fms',label:'FMS ≥ 14',pass:fmsT&&fmsT>=14,val:fmsT?fmsT+'/21':'—',peso:10},
        ];
        const altaPct=Math.round(checks.filter(c=>c.pass).reduce((s,c)=>s+c.peso,0));
        const criteriosPers=last?.criterios_personalizados||[];
        return(
          <div key={p.id} style={{...fs.card,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontSize:13,fontWeight:700}}>{p.nombre} {p.apellido}</div>
                <div style={{fontSize:10,color:GM}}>{REGIONES_LIST.find(r=>r.k===p.region)?.label} · {p.evaluaciones.length} eval. · {FASES_BASE[fase]?.badge} {FASES_BASE[fase]?.label}</div>
                {last?.objetivo&&<div style={{fontSize:10,color:TL,marginTop:2}}>🎯 "{last.objetivo}"</div>}
              </div>
              <button onClick={()=>{setCurrentPac(p);setView('ver-paciente');}} style={{...fs.btnNV,fontSize:10,padding:'4px 10px'}}>Ver</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:10}}>
              {[{l:'EVA',v:last?.eva_reposo||'—',c:ei?.color||GM,t:'≤ 2'},{l:'ROM',v:rp?rp+'%':'—',c:rp?(rp>90?GN:rp>70?AM:RJ):GM,t:'>90%'},{l:'Y-Balance',v:yb?yb+' cm':'—',c:yb?(parseFloat(yb)<4?GN:RJ):GM,t:'<4cm'},{l:'FMS',v:fmsT?fmsT+'/21':'—',c:fmsT?(fmsT>=14?GN:fmsT>=11?AM:RJ):GM,t:'≥14'}].map((k,i)=>(
                <div key={i} style={{background:BG,borderRadius:6,padding:'8px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:GM,textTransform:'uppercase'}}>{k.l}</div>
                  <div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.v}</div>
                  <div style={{fontSize:9,color:GM}}>Meta: {k.t}</div>
                </div>
              ))}
            </div>
            {/* Barra de alta */}
            <div style={{background:BG,borderRadius:7,padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:11,fontWeight:700}}>Progreso hacia el alta clínica</span>
                <span style={{fontSize:14,fontWeight:800,color:altaPct>=75?GN:altaPct>=50?AM:RJ}}>{altaPct}%</span>
              </div>
              <div style={{background:GL,borderRadius:99,height:8,overflow:'hidden',marginBottom:8}}>
                <div style={{width:altaPct+'%',background:altaPct>=75?GN:altaPct>=50?AM:RJ,height:'100%',borderRadius:99,transition:'width .4s'}}/>
              </div>
              {criteriosPers.length>0&&(
                <div>
                  <div style={{fontSize:9,color:GM,fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Criterios personalizados ({criteriosPers.length})</div>
                  {criteriosPers.slice(0,3).map((c,i)=><div key={i} style={{fontSize:10,color:GD,display:'flex',gap:4,marginBottom:2}}><span style={{color:AM}}>→</span>{c}</div>)}
                  {criteriosPers.length>3&&<div style={{fontSize:10,color:GM}}>+{criteriosPers.length-3} más</div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── PROTOCOLOS ────────────────────────────────────────────────────────
  const Protocolos=()=>{
    const [selFase,setSelFase]=useState('restaura');
    const fase=FASES_BASE[selFase];
    const [selReg,setSelReg]=useState('lumbar');
    return(
      <div style={{padding:'14px'}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Protocolos y Criterios de Evolución</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div><span style={fs.lbl}>Fase del Método</span>
            <select value={selFase} onChange={e=>setSelFase(e.target.value)} style={{...fs.sel,width:'100%'}}>
              {Object.entries(FASES_BASE).map(([k,v])=><option key={k} value={k}>{v.badge} — {v.label}</option>)}
            </select>
          </div>
          <div><span style={fs.lbl}>Región para tests</span>
            <select value={selReg} onChange={e=>setSelReg(e.target.value)} style={{...fs.sel,width:'100%'}}>
              {REGIONES_LIST.map(r=><option key={r.k} value={r.k}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{...fs.card,borderLeft:`4px solid ${fase.color}`,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:fase.color,marginBottom:10}}>{fase.badge} · {fase.label} — Criterios de evolución</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:5,textTransform:'uppercase'}}>Para ingresar a esta fase</div>
              {fase.criterios_base_ingreso.map((c,i)=><div key={i} style={{fontSize:11,color:GD,display:'flex',gap:5,marginBottom:4}}><span style={{color:TL,flexShrink:0}}>✓</span>{c}</div>)}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:5,textTransform:'uppercase'}}>Para avanzar a la siguiente</div>
              {fase.criterios_base_avance.map((c,i)=><div key={i} style={{fontSize:11,color:GD,display:'flex',gap:5,marginBottom:4}}><span style={{color:AM,flexShrink:0}}>→</span>{c}</div>)}
            </div>
          </div>
          <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:6,padding:'10px 12px'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#1D4ED8',marginBottom:6,textTransform:'uppercase'}}>Ejemplo de criterios personalizados por objetivo declarado</div>
            {[['Volver a correr (deportivo)',fase.label],['Retorno al trabajo (laboral)',fase.label],['Caminar sin dolor (AVDs)',fase.label]].map(([obj],i)=>(
              <div key={i} style={{marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:3}}>🎯 "{obj}"</div>
                {generarCriteriosPersonalizados(obj,selFase,'5',60).slice(-2).map((c,j)=><div key={j} style={{fontSize:10,color:GD,display:'flex',gap:4,marginBottom:1}}><span style={{color:fase.color}}>→</span>{c}</div>)}
              </div>
            ))}
          </div>
          <div style={{marginTop:10,padding:'8px',borderRadius:6,background:BG,fontSize:11}}>
            <strong>Semáforo de carga asignado en esta fase:</strong>{' '}
            <span style={{fontWeight:700,color:fase.semaforo==='verde'?GN:fase.semaforo==='amarillo'?AM:RJ}}>
              {fase.semaforo==='verde'?'🟢 Verde':fase.semaforo==='amarillo'?'🟡 Amarillo':'🔴 Rojo'}
            </span>{' '}→ Se actualiza automáticamente en la app de gym al guardar la evaluación.
          </div>
        </div>
        <div style={fs.card}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Tests ortopédicos — {REGIONES_LIST.find(r=>r.k===selReg)?.label}</div>
          {(TESTS_ESP[selReg]||TESTS_ESP.columna).map(t=>(
            <div key={t.n} style={{marginBottom:8,padding:'9px 10px',background:BG,borderRadius:7,border:`1px solid ${GL}`}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{t.n}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:11,color:GD}}>
                <div><strong>Indica:</strong> {t.indica}</div>
                <div><strong>Sens/Esp:</strong> {t.sens} / {t.esp}</div>
                <div style={{gridColumn:'1/-1'}}><strong>Técnica:</strong> {t.como}</div>
                <div style={{gridColumn:'1/-1'}}><strong>+:</strong> {t.positivo}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── ALTAS CLÍNICAS ────────────────────────────────────────────────────
  const AltasCli=()=>{
    const [selPac,setSelPac]=useState('');
    const pac=pacientes.find(p=>p.id===selPac);
    const last=pac?.evaluaciones[pac.evaluaciones.length-1];
    const rp=last?calcROMpct(last.rom,pac.region):null;
    const yb=last?calcYBalanceDiff(last.ybalance):null;
    const fmsT=last?calcFMSTotal(last.fms):null;
    const checks=last?[
      {id:'eva',label:'EVA ≤ 2/10',pass:last.eva_reposo&&parseFloat(last.eva_reposo)<=2,val:last.eva_reposo?last.eva_reposo+'/10':'Sin dato',peso:25},
      {id:'rom',label:'ROM > 90%',pass:rp&&rp>90,val:rp?rp+'%':'Sin dato',peso:25},
      {id:'ybal',label:'Y-Balance < 4 cm',pass:yb&&parseFloat(yb)<4,val:yb?yb+' cm':'Sin dato',peso:15},
      {id:'fms',label:'FMS ≥ 14/21',pass:fmsT&&fmsT>=14,val:fmsT?fmsT+'/21':'Sin dato',peso:10},
      {id:'dn4',label:'DN4 < 4',pass:calcDN4(last.dn4)<4,val:calcDN4(last.dn4)+'/7',peso:10},
    ]:[];
    // Verificar también criterios personalizados
    const criteriosPers=last?.criterios_personalizados||[];
    const allPass=checks.length>0&&checks.every(c=>c.pass);
    const pct=checks.length>0?Math.round(checks.filter(c=>c.pass).reduce((s,c)=>s+c.peso,0)):0;
    const exportAltaPDF=()=>{
      if(!pac||!last)return;
      const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Alta Clínica — ${pac.nombre}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:24px;color:#111}.hdr{border-bottom:3px solid ${NV};padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between}.title-alta{text-align:center;padding:16px;background:#F0FDF4;border:2px solid #86EFAC;border-radius:8px;margin-bottom:20px}.crit{display:flex;justify-content:space-between;padding:8px 12px;background:#f9f9f9;border-radius:5px;margin-bottom:5px;font-size:11px}.footer{margin-top:24px;font-size:10px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:10px}.sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}.sig-line{border-top:1px solid #333;padding-top:6px;font-size:10px;text-align:center}</style></head>
      <body><div class="hdr"><div><div style="font-size:18px;font-weight:900;color:${NV}">FisioActiva Colonia</div><div style="font-size:10px;color:#666;letter-spacing:3px">MÉTODO ACTIVA INTEGRA</div></div><div style="text-align:right"><div style="font-size:11px;color:#666">Alta Clínica · ${new Date().toLocaleDateString('es-ES')}</div></div></div>
      <div class="title-alta"><div style="font-size:22px;font-weight:800;color:${GN}">✓ ALTA CLÍNICA FUNCIONAL</div><div style="font-size:14px;color:#4A5568;margin-top:6px">${pac.nombre} ${pac.apellido}</div><div style="font-size:11px;color:#666;margin-top:4px">Región: ${REGIONES_LIST.find(r=>r.k===pac.region)?.label} · ${last.fecha}</div>${last.objetivo?`<div style="font-size:11px;color:#1D4ED8;margin-top:6px;font-style:italic">Objetivo alcanzado: "${last.objetivo}"</div>`:''}</div>
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">Criterios clínicos validados:</div>
      ${checks.map(c=>`<div class="crit"><span>${c.label}</span><span style="font-weight:700;color:${c.pass?GN:RJ}">${c.pass?'✓ CUMPLIDO':'✗ NO CUMPLIDO'} (${c.val})</span></div>`).join('')}
      ${criteriosPers.length>0?`<div style="margin-top:14px;font-size:11px;font-weight:700">Criterios personalizados cumplidos:</div>${criteriosPers.slice(0,4).map(c=>`<div style="font-size:11px;padding:4px 8px;color:#555">→ ${c}</div>`).join('')}`:''}
      ${last.diagnosticoPT?`<div style="margin-top:14px;font-size:11px"><strong>Diagnóstico PT:</strong> ${last.diagnosticoPT}</div>`:''}
      ${last.plan?`<div style="margin-top:6px;font-size:11px"><strong>Indicaciones post-alta:</strong> ${last.plan}</div>`:''}
      <div class="sig"><div class="sig-line">Firma del Fisioterapeuta<br/>${last.evaluador||'_______________'}</div><div class="sig-line">Firma del Paciente<br/>${pac.nombre} ${pac.apellido}</div></div>
      <div class="footer">FisioActiva Colonia · Método Activa Integra · ${new Date().toLocaleDateString('es-ES')}</div>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
      const w=window.open('','_blank');w.document.write(html);w.document.close();
    };
    return(
      <div style={{padding:'14px'}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Sistema de Alta Clínica</div>
        <div style={{...fs.card,marginBottom:12}}>
          <span style={fs.lbl}>Seleccionar paciente</span>
          <select value={selPac} onChange={e=>setSelPac(e.target.value)} style={{...fs.sel,width:'100%'}}>
            <option value=''>— Seleccionar —</option>
            {pacientes.filter(p=>p.evaluaciones.length>0).map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellido} · {FASES_BASE[p.evaluaciones[p.evaluaciones.length-1]?.fase]?.badge||''}</option>)}
          </select>
        </div>
        {pac&&last&&(
          <>
            {last.objetivo&&<div style={{...fs.card,background:'#EFF6FF',border:'1px solid #93C5FD',marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:'#1D4ED8',marginBottom:2}}>🎯 Objetivo declarado por el paciente</div><div style={{fontSize:12,color:GDK}}>"{last.objetivo}"</div></div>}
            <div style={{...fs.card,borderLeft:`4px solid ${allPass?GN:AM}`,marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700}}>{pac.nombre} {pac.apellido}</div>
                <div style={{fontSize:22,fontWeight:800,color:allPass?GN:pct>60?AM:RJ}}>{pct}%</div>
              </div>
              <div style={{background:GL,borderRadius:99,height:10,overflow:'hidden',marginBottom:12}}>
                <div style={{width:pct+'%',background:allPass?GN:pct>60?AM:RJ,height:'100%',borderRadius:99,transition:'width .5s'}}/>
              </div>
              {checks.map(c=>(
                <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:6,background:c.pass?'#F0FDF4':'#FEF2F2',border:`1px solid ${c.pass?'#86EFAC':'#FCA5A5'}`,marginBottom:5}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:15,color:c.pass?GN:RJ}}>{c.pass?'✓':'✗'}</span>
                    <span style={{fontSize:12,fontWeight:600}}>{c.label}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:c.pass?GN:RJ}}>{c.val}</span>
                </div>
              ))}
            </div>
            {allPass
              ?<div style={{...fs.card,background:'#F0FDF4',border:`2px solid ${GN}`,textAlign:'center',padding:'20px'}}>
                  <div style={{fontSize:24,marginBottom:6}}>🎉</div>
                  <div style={{fontSize:14,fontWeight:800,color:GN,marginBottom:4}}>¡Alta clínica aprobada!</div>
                  {last.objetivo&&<div style={{fontSize:12,color:GD,marginBottom:8}}>Objetivo alcanzado: "{last.objetivo}"</div>}
                  <button onClick={exportAltaPDF} style={{...fs.btnTL,padding:'10px 24px'}}>📄 Generar informe de alta PDF</button>
                </div>
              :<div style={{...fs.card,background:'#FFFBEB',border:`1px solid #FDE047`}}>
                  <div style={{fontSize:12,fontWeight:700,color:AM,marginBottom:4}}>Criterios pendientes</div>
                  <div style={{fontSize:11,color:GD}}>{checks.filter(c=>!c.pass).map(c=>c.label).join(' · ')}</div>
                </div>
            }
          </>
        )}
      </div>
    );
  };

  // ── FORMULARIO PACIENTE ───────────────────────────────────────────────
  const PacienteForm=()=>{
    if(!editingPac)return null;
    const [form,setForm]=useState({...editingPac});
    const set=(k,v)=>setForm(f=>({...f,[k]:v}));
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'20px 14px'}}>
        <div style={{background:WH,borderRadius:12,padding:22,width:'100%',maxWidth:440,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontWeight:800,fontSize:14,color:NV}}>{form.nombre?`${form.nombre} ${form.apellido}`:'Nuevo paciente'}</div>
            <button onClick={()=>{setShowPacForm(false);setEditingPac(null);}} style={fs.btnG}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div><span style={fs.lbl}>Nombre *</span><input value={form.nombre} onChange={e=>set('nombre',e.target.value)} style={fs.inp}/></div>
            <div><span style={fs.lbl}>Apellido *</span><input value={form.apellido} onChange={e=>set('apellido',e.target.value)} style={fs.inp}/></div>
            <div><span style={fs.lbl}>N° Documento *</span><input value={form.documento} onChange={e=>set('documento',e.target.value)} style={fs.inp} placeholder="CI / Pasaporte"/></div>
            <div><span style={fs.lbl}>Celular</span><input value={form.celular||''} onChange={e=>set('celular',e.target.value)} style={fs.inp}/></div>
            <div><span style={fs.lbl}>Fecha de nacimiento</span><input type="date" value={form.fechaNac||''} onChange={e=>set('fechaNac',e.target.value)} style={fs.inp}/></div>
            <div><span style={fs.lbl}>Género</span><select value={form.genero||''} onChange={e=>set('genero',e.target.value)} style={{...fs.sel,width:'100%'}}><option value=''>Seleccionar</option><option value='masculino'>Masculino</option><option value='femenino'>Femenino</option></select></div>
            <div><span style={fs.lbl}>Región principal</span><select value={form.region} onChange={e=>set('region',e.target.value)} style={{...fs.sel,width:'100%'}}>{REGIONES_LIST.map(r=><option key={r.k} value={r.k}>{r.label}</option>)}</select></div>
            <div><span style={fs.lbl}>Derivado por</span><input value={form.derivadoPor||''} onChange={e=>set('derivadoPor',e.target.value)} style={fs.inp} placeholder="Médico, especialidad..."/></div>
            {gymClients.length>0&&<div style={{gridColumn:'1/-1'}}><span style={fs.lbl}>Vincular con cliente del gym</span><select value={form.gym_clienteId||''} onChange={e=>set('gym_clienteId',e.target.value)} style={{...fs.sel,width:'100%'}}><option value=''>Sin vinculación</option>{gymClients.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}</select></div>}
            <div style={{gridColumn:'1/-1'}}><span style={fs.lbl}>Notas internas</span><textarea value={form.notas||''} onChange={e=>set('notas',e.target.value)} rows={2} style={{...fs.inp,resize:'vertical'}}/></div>
          </div>
          <button onClick={()=>savePaciente(form)} disabled={!form.nombre||!form.apellido||!form.documento} style={{...fs.btnTL,width:'100%',padding:'10px',opacity:(!form.nombre||!form.apellido||!form.documento)?.4:1}}>Guardar paciente</button>
        </div>
      </div>
    );
  };

  // ── VER EVALUACIÓN ────────────────────────────────────────────────────
  const VerEval=()=>{
    if(!viewingEval)return null;
    const ev=viewingEval;
    const ei=ev.eva_reposo?calcEVA(ev.eva_reposo):null;
    const rp=calcROMpct(ev.rom,ev.region||'lumbar');
    const yb=calcYBalanceDiff(ev.ybalance);
    const exportPDF=()=>{
      const pac=currentPac;
      const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Evaluación ${pac?.nombre}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:24px;color:#111}.hdr{border-bottom:3px solid ${NV};padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between}.sec{margin-bottom:14px}.sec-title{background:${NV};color:#fff;padding:6px 12px;font-size:11px;font-weight:700;border-radius:4px 4px 0 0}.sec-body{border:1px solid #e0e0e0;border-top:none;padding:10px 12px;font-size:11px;border-radius:0 0 4px 4px}.footer{margin-top:20px;font-size:10px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:8px}@media print{body{padding:14px}}</style></head>
      <body><div class="hdr"><div><div style="font-size:18px;font-weight:900;color:${NV}">FisioActiva Colonia</div><div style="font-size:10px;color:#666;letter-spacing:3px">MÉTODO ACTIVA INTEGRA</div></div><div style="text-align:right"><div style="font-size:14px;font-weight:700">${pac?.nombre} ${pac?.apellido}</div><div style="font-size:11px;color:#666">${ev.tipo==='inicial'?'Evaluación Inicial':'Re-evaluación'} · ${ev.fecha} · ${REGIONES_LIST.find(r=>r.k===ev.region)?.label}</div>${ev.objetivo?`<div style="font-size:10px;color:#1D4ED8;margin-top:2px">Objetivo: "${ev.objetivo}"</div>`:''}</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        ${[['EVA Reposo',ev.eva_reposo||'—',ei?.color||'#999'],['ROM %',rp?rp+'%':'—',rp?(rp>90?GN:rp>70?AM:RJ):'#999'],['Fase',FASES_BASE[ev.fase]?.badge||'—',FASES_BASE[ev.fase]?.color||'#999']].map(([l,v,c])=>`<div style="background:#f9f9f9;padding:8px;border-radius:5px;text-align:center"><div style="font-size:9px;color:#999;text-transform:uppercase">${l}</div><div style="font-size:18px;font-weight:800;color:${c}">${v}</div></div>`).join('')}
      </div>
      ${ev.motivo?`<div class="sec"><div class="sec-title">Anamnesis</div><div class="sec-body"><strong>Motivo:</strong> ${ev.motivo}${ev.evolucion?'<br/><strong>Evolución:</strong> '+ev.evolucion:''}</div></div>`:''}
      ${Object.keys(ev.rom||{}).length>0?`<div class="sec"><div class="sec-title">ROM Goniometría</div><div class="sec-body" style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${(ROM_NORMS[ev.region]||ROM_NORMS.lumbar).filter(n=>ev.rom[n.mov]).map(n=>{const v=ev.rom[n.mov];const p=n.normal>0?Math.round(parseFloat(v)/n.normal*100):0;return`<div>${n.mov}: <strong>${v}°</strong> / ${n.normal}° (${p}%)</div>`}).join('')}</div></div>`:''}
      ${ev.diagnosticoPT?`<div class="sec"><div class="sec-title">Diagnóstico y Plan</div><div class="sec-body">${ev.diagnosticoPT?'<strong>DX PT:</strong> '+ev.diagnosticoPT+'<br/>':''}${ev.plan?'<strong>Plan:</strong> '+ev.plan:''}</div></div>`:''}
      ${ev.criterios_personalizados?.length>0?`<div class="sec"><div class="sec-title">Criterios de Evolución Personalizados</div><div class="sec-body">${ev.criterios_personalizados.map(c=>`<div>→ ${c}</div>`).join('')}</div></div>`:''}
      <div class="footer">FisioActiva Colonia · Método Activa Integra · ${new Date().toLocaleDateString('es-ES')}</div>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
      const w=window.open('','_blank');w.document.write(html);w.document.close();
    };
    return(
      <div style={{padding:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <button onClick={()=>{setView('ver-paciente');setViewingEval(null);}} style={{...fs.btnG,fontSize:11}}>← Volver</button>
          <button onClick={exportPDF} style={{...fs.btnNV,fontSize:11}}>📄 Exportar PDF</button>
        </div>
        <div style={{...fs.cardNV,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:800,color:WH}}>{ev.tipo==='inicial'?'Evaluación Inicial':'Re-evaluación'}</div>
          <div style={{fontSize:11,color:'#93C5FD'}}>{ev.fecha} · {REGIONES_LIST.find(r=>r.k===ev.region)?.label} {ev.evaluador?'· '+ev.evaluador:''}</div>
          {ev.objetivo&&<div style={{fontSize:11,color:'#BAE6FD',marginTop:3}}>🎯 "{ev.objetivo}"</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {[{l:'EVA',v:ev.eva_reposo||'—',c:ei?.color||GM},{l:'ROM',v:rp?rp+'%':'—',c:rp?(rp>90?GN:rp>70?AM:RJ):GM},{l:'DN4',v:calcDN4(ev.dn4)+'/7',c:calcDN4(ev.dn4)>=4?RJ:GN},{l:'Y-Balance',v:yb?yb+' cm':'—',c:yb?(parseFloat(yb)<4?GN:RJ):GM},{l:'FMS',v:calcFMSTotal(ev.fms)||'—',c:calcFMSTotal(ev.fms)>=(14)?GN:AM},{l:'Fase',v:FASES_BASE[ev.fase]?.badge||'—',c:FASES_BASE[ev.fase]?.color||GM}].map((k,i)=>(
            <div key={i} style={{background:WH,border:`1px solid ${GL}`,borderTop:`3px solid ${k.c}`,borderRadius:7,padding:'9px',textAlign:'center'}}>
              <div style={{fontSize:9,color:GM,textTransform:'uppercase'}}>{k.l}</div>
              <div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
        {ev.motivo&&<div style={fs.card}><div style={{fontSize:11,fontWeight:700,marginBottom:4}}>Anamnesis</div><div style={{fontSize:12,color:GD}}>{ev.motivo}</div></div>}
        {Object.keys(ev.rom||{}).length>0&&<div style={fs.card}><div style={{fontSize:11,fontWeight:700,marginBottom:8}}>ROM</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>{(ROM_NORMS[ev.region]||ROM_NORMS.lumbar).filter(n=>ev.rom[n.mov]).map(n=>{const v=ev.rom[n.mov];const p=n.normal>0?Math.round(parseFloat(v)/n.normal*100):0;return<div key={n.mov} style={{display:'flex',justifyContent:'space-between',padding:'4px 7px',background:BG,borderRadius:4,fontSize:11}}><span>{n.mov}</span><span style={{fontWeight:700,color:p>90?GN:p>70?AM:RJ}}>{v}° ({p}%)</span></div>})}</div></div>}
        {ev.diagnosticoPT&&<div style={{...fs.card,borderLeft:`3px solid ${TL}`}}><div style={{fontSize:11,fontWeight:700,marginBottom:4}}>Diagnóstico PT</div><div style={{fontSize:12,color:GD}}>{ev.diagnosticoPT}</div></div>}
        {ev.criterios_personalizados?.length>0&&(
          <div style={{...fs.card,borderLeft:`3px solid ${NV}`,background:'#EFF6FF'}}>
            <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:'#1D4ED8'}}>Criterios de evolución personalizados</div>
            {ev.criterios_personalizados.map((c,i)=><div key={i} style={{fontSize:11,color:GD,display:'flex',gap:5,marginBottom:3}}><span style={{color:NV}}>→</span>{c}</div>)}
          </div>
        )}
      </div>
    );
  };

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────
  const VIEWS={
    dashboard:<Dashboard/>,pacientes:<PacientesView/>,'ver-paciente':<VerPaciente/>,'nueva-eval':<NuevaEval/>,'ver-eval':<VerEval/>,
    kpis:<KPIs/>,protocolos:<Protocolos/>,altas:<AltasCli/>,
    reevals:<div style={{padding:'14px'}}><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Re-evaluaciones</div>{pacientes.filter(p=>p.evaluaciones.length>0).map(p=>{const l=p.evaluaciones[p.evaluaciones.length-1];return(<div key={p.id} style={{...fs.card,borderLeft:`4px solid ${AM}`,marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:12,fontWeight:700}}>{p.nombre} {p.apellido}</div><div style={{fontSize:10,color:GM}}>Última eval.: {l?.fecha} · {FASES_BASE[l?.fase]?.badge}</div>{l?.objetivo&&<div style={{fontSize:10,color:TL}}>🎯 "{l.objetivo}"</div>}</div><button onClick={()=>{setCurrentPac(p);setCurrentEval({...emptyEval(),tipo:'reeval',region:p.region,objetivo:l?.objetivo||''});setEvalStep(0);setView('nueva-eval');}} style={{...fs.btnTL,fontSize:10,padding:'4px 10px'}}>Re-evaluar</button></div></div>);})}
    {pacientes.filter(p=>p.evaluaciones.length>0).length===0&&<div style={{...fs.card,textAlign:'center',padding:24,color:GM}}>Sin pacientes para re-evaluar.</div>}</div>,
  };

  return(
    <div style={{background:BG,minHeight:'100vh',fontFamily:'Arial,sans-serif'}}>
      {showPacForm&&<PacienteForm/>}
      {dbLoading&&(
        <div style={{background:'#0A3D62',color:'#fff',textAlign:'center',padding:'5px',fontSize:11,fontFamily:'Arial,sans-serif'}}>
          ⏳ Sincronizando datos...
        </div>
      )}
      {dbError&&(
        <div style={{background:'#DC2626',color:'#fff',textAlign:'center',padding:'5px',fontSize:11,fontFamily:'Arial,sans-serif'}}>
          ⚠ Error de conexión — {dbError}
        </div>
      )}
      <div style={{background:NV,borderBottom:`2px solid ${TL}`,padding:'0 14px',display:'flex',gap:2,overflowX:'auto',flexShrink:0}}>
        {[['dashboard','Dashboard'],['pacientes','Pacientes'],['kpis','KPIs'],['protocolos','Protocolos'],['altas','Altas'],['reevals','Re-eval.']].map(([k,lbl])=>(
          <button key={k} onClick={()=>setView(k)} style={{padding:'9px 12px',border:'none',background:'none',color:view===k?TL:'#93C5FD',cursor:'pointer',fontSize:11,fontWeight:view===k?700:400,fontFamily:'Arial,sans-serif',borderBottom:view===k?`3px solid ${TL}`:'3px solid transparent',marginBottom:-2,whiteSpace:'nowrap',flexShrink:0}}>
            {lbl}
          </button>
        ))}
        <button onClick={()=>{if(pacientes.length>0){setCurrentPac(pacientes[0]);setCurrentEval(emptyEval());setEvalStep(0);setView('nueva-eval');}else{setEditingPac(emptyPaciente());setShowPacForm(true);}}} style={{marginLeft:'auto',padding:'5px 12px',border:'none',background:TL,color:WH,cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Arial,sans-serif',borderRadius:5,margin:'5px 0',flexShrink:0}}>
          + Evaluación
        </button>
      </div>
      <div style={{maxWidth:960,margin:'0 auto',paddingBottom:32}}>
        {VIEWS[view]||<Dashboard/>}
      </div>
    </div>
  );
}
