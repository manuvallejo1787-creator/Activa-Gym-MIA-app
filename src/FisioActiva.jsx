// FisioActiva.jsx — Sistema Clínico Premium · Método Activa Integra
// Integrado con ACTIVA Fitness Club App
import { useState, useMemo, useEffect, useCallback } from "react";
import { FASES_METODO, generarCriteriosPersonalizados, checkCriteriosAvance, getSemaforoPorFase } from "./criterios.js";
import { useFisioPacientes, useSesionesClinicas, genId } from "./db.js";

// ─── PROTOCOLO POR REGIÓN Y FASE (para auto-carga en sesiones) ──────────────
const PROT_SESION = {
  cervical:{ aguda:['Isométrico cervical anterior','Isométrico cervical posterior','Retracción cervical en supino','Movilización escapular activa','Respiración diafragmática'], subaguda:['Chin tuck dinámico sentado','Rotación cervical activa-asistida','Flexión-extensión cervical activa','Inclinación lateral activa','Estiramiento trapecio superior','Deep neck flexor (DNF) progresivo'], cronica:['Chin tuck con banda de resistencia','Fortalecimiento extensores cervicales','Propiocepción cervical con laser pointer','Fortalecimiento postural global','Estabilización cervical en cuadrupedia'] },
  hombro:  { aguda:['Péndulo de Codman','Isométrico de hombro en posición neutra','Rotación externa isométrica 0° abd','Control escapular en reposo','Crioterapia post-actividad'], subaguda:['Polea de hombro (flexión asistida)','Rotación externa con banda (neutro)','Scaption en plano escapular','Estiramiento cápsula posterior','Retracción escapular con banda','Y/T/W en banco inclinado'], cronica:['Press de hombro con mancuerna','Remo vertical en polea','Push-up plus (protracción)','Rotación externa a 90° abducción','Entrenamiento excéntrico manguito'] },
  codo:    { aguda:['Inmovilización relativa + elevación','Isométrico de flexores de codo','Movilización activa de muñeca','Crioterapia + compresión'], subaguda:['Flexo-extensión de codo activa','Pronosupinación activa','Excéntrico extensores de muñeca','Excéntrico flexores de muñeca','Estiramiento extensores antebrazo','Fortalecimiento agarre progresivo'], cronica:['Curl de bíceps con mancuerna','Extensión de tríceps en polea','Fortalecimiento global antebrazo','Ejercicios funcionales de empuje/tracción'] },
  muneca:  { aguda:['Reposo relativo + ortesis funcional','Movilización activa dedos','Isométrico muñeca en neutro','Crioterapia + elevación'], subaguda:['Flexo-extensión muñeca activa','Desviación radial-cubital activa','Pronosupinación progresiva','Fortalecimiento agarre con pelota'], cronica:['Fortalecimiento muñeca con banda','Ejercicios propioceptivos de muñeca','Fortalecimiento funcional de pinza'] },
  esc:     { aguda:['Isométrico escapular suave','Retracción escapular pasiva','Respiración diafragmática','Control postural cervical'], subaguda:['Retracción escapular con banda','Remo con foco escapular','Serrato anterior (serratus push-up)','Y/T/W bajo peso'], cronica:['Press hombro con mancuerna','Remo en polea alta','Fortalecimiento postural integrado','Planificación funcional sobre la cabeza'] },
  columna: { aguda:['Respiración diafragmática','Movilización suave en descarga','Isométrico lumbar en neutro','Educación postural'], subaguda:['Cat-camel en cuadrupedia','Bird-dog progresivo','Puente de glúteo básico','Estiramiento cadena posterior'], cronica:['Peso muerto con barra','Sentadilla goblet','Plancha anterior y lateral','Fortalecimiento funcional integrado'] },
  lumbar:  { aguda:['Respiración diafragmática','Decúbito con almohada bajo rodillas','Movilización suave en descarga','Retracción abdominal suave'], subaguda:['Cat-camel en cuadrupedia','Bird-dog progresivo','Puente de glúteo bilateral','Estiramiento piriforme y psoas'], cronica:['Peso muerto rumano progresivo','Sentadilla goblet','Dead bug avanzado','Fortalecimiento funcional lumbar'] },
  cadera:  { aguda:['Isométrico de glúteo','Movilización activa en descarga','Retracción abdominal suave','Crioterapia si hay inflamación'], subaguda:['Clamshell con banda','Puente de glúteo unilateral','Estiramiento psoas y TFL','Sentadilla parcial con banda'], cronica:['Hip thrust con barra','Sentadilla búlgara','Peso muerto unilateral','Trabajo funcional de cadera'] },
  rodilla: { aguda:['Isométrico cuádriceps','Elevación pierna extendida','Movilización rotuliana suave','Crioterapia + compresión + elevación'], subaguda:['Sentadilla parcial','TKE (extensión terminal de rodilla)','Curl de isquiotibiales','Propiocepción básica bipodal'], cronica:['Sentadilla completa progresiva','Peso muerto rumano','Saltos reactivos progresivos','Fortalecimiento funcional de rodilla'] },
  tobillo: { aguda:['RICE: reposo relativo + hielo + compresión + elevación','Movilización activa del tobillo','Alfabeto con el pie','Peroneales isométricos'], subaguda:['Ejercicios de fuerza peroneales con banda','Elevaciones de talón en escalón','Propiocepción bipodal en superficie estable','Estiramiento del gemelo y sóleo'], cronica:['Propiocepción unipodal en inestable','Salto y aterrizaje progresivo','Fortalecimiento funcional tobillo','Deporte-específico'] },
};


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
    {n:'Hawkins-Kennedy',como:'Flex hombro 90°, codo 90°. Evaluador rota internamente el brazo de forma pasiva y forzada buscando reproducir dolor.',indica:'Pinzamiento subacromial',positivo:'Dolor en el arco de RI',sens:'79%',esp:'59%',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Hawkins-Kennedy_test.jpg/320px-Hawkins-Kennedy_test.jpg',posicion:'Sentado o de pie',estructura:'Supraespinoso, bursa subacromial'},
    {n:'Neer',como:'Estabilizar escápula con una mano. Con la otra, elevar el brazo extendido y en RI pasivamente hacia la flexión máxima. Simula compresión del supraespinoso bajo el acromion.',indica:'Pinzamiento subacromial',positivo:'Dolor en elevación anterior entre 70-120°',sens:'72%',esp:'60%',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Neer_test.jpg/320px-Neer_test.jpg',posicion:'Sentado',estructura:'Supraespinoso, bursa subacromial'},
    {n:'Empty Can (Jobe)',como:'Hombro 90° abd en plano escapular (30° anterior), RI máxima (pulgar hacia abajo). Evaluar fuerza ante resistencia en esa posición.',indica:'Lesión supraespinoso',positivo:'Debilidad y/o dolor reproducido',sens:'69%',esp:'66%',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Empty_can_test.jpg/320px-Empty_can_test.jpg',posicion:'De pie o sentado',estructura:'Supraespinoso, manguito rotador'},
    {n:"Speed's Test",como:'Hombro 90° flexión, codo extendido, supinación. Resistencia a la flexión aplicada por el evaluador. Buscar dolor localizado en la corredera bicipital.',indica:'Tendinopatía del bíceps / Lesión SLAP',positivo:'Dolor localizado en corredera bicipital anterior',sens:'54%',esp:'81%',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Speed_test.jpg/320px-Speed_test.jpg',posicion:'De pie',estructura:'Tendón del bíceps largo, labrum superior'},
    {n:'Apprehensión + Relocation',como:'Supino. Abd 90° y RE progresiva. Test + si el paciente expresa miedo o trata de frenarlo. Inmediatamente aplicar presión posterior sobre cabeza humeral (Relocation): debe desaparecer la apprehensión.',indica:'Inestabilidad glenohumeral anterior',positivo:'Sensación de inestabilidad/miedo + alivio con relocation',sens:'72%',esp:'96%',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Apprehension_test.jpg/320px-Apprehension_test.jpg',posicion:'Supino',estructura:'Ligamento glenohumeral anterior, labrum'},
    {n:"O'Brien (SLAP)",como:'90° flex, 15° aducción. Primero con RI (pulgar abajo) → resistencia a la flexión. Luego con RE (pulgar arriba) → misma resistencia. Test + si dolor en RI que desaparece o disminuye significativamente en RE.',indica:'Lesión SLAP labral',positivo:'Dolor profundo en RI que desaparece en RE',sens:'78%',esp:'91%',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/OBrien_test.jpg/320px-OBrien_test.jpg',posicion:'De pie',estructura:'Labrum superior, tendón del bíceps'},
    {n:'Yocum Test',como:'El paciente coloca la mano ipsilateral sobre el hombro contralateral. El evaluador presiona el codo hacia abajo mientras el paciente eleva activamente el codo sin elevar el hombro. Test + si reproduce dolor.',indica:'Pinzamiento subacromial / lesión manguito',positivo:'Dolor en la zona subacromial',sens:'79%',esp:'56%',img:'',posicion:'De pie o sentado',estructura:'Supraespinoso, bursa subacromial'},
    {n:'Cross-Body Adduction (Scarf)',como:'Elevar el brazo a 90° flex. El evaluador aduce horizontalmente el brazo hacia el hombro contralateral. Buscar dolor en la cara anterior del hombro (AC) o posterior (capsular).',indica:'Patología acromioclavicular / capsulitis',positivo:'Dolor en articulación AC o posterior del hombro',sens:'77%',esp:'79%',img:'',posicion:'De pie',estructura:'Articulación acromioclavicular, cápsula posterior'},
  ],
  codo:[
    {n:"Cozen's (Tenista)",como:'Paciente con puño cerrado y desviación radial. Resistencia a la extensión de muñeca con el codo extendido. Buscar dolor sobre el epicóndilo lateral.',indica:'Epicondilalgia lateral (Codo de tenista)',positivo:'Dolor sobre el epicóndilo lateral',sens:'84%',esp:'72%',img:'',posicion:'De pie o sentado',estructura:'Extensores del carpo, origen en epicóndilo lateral'},
    {n:'Test del Golfista (Medial)',como:'Resistencia a la flexión de muñeca y pronación con el codo extendido. Buscar dolor sobre el epicóndilo medial.',indica:'Epicondilalgia medial (Codo de golfista)',positivo:'Dolor sobre el epicóndilo medial',sens:'89%',esp:'55%',img:'',posicion:'De pie o sentado',estructura:'Flexores del carpo, origen en epitróclea'},
    {n:'Test de Tinel Cubital',como:'Percusión suave y progresiva sobre el canal epitrócleo-olecraneano (gotera epitroclear). Buscar parestesias distales.',indica:'Síndrome del túnel cubital',positivo:'Parestesias en dedos anular y meñique (IV-V)',sens:'70%',esp:'98%',img:'',posicion:'Codo flexionado 90°',estructura:'Nervio cubital'},
    {n:'Test del Codo de Tenista Resistido',como:'Codo a 90°, puño cerrado. Paciente extiende la muñeca contra resistencia máxima del evaluador. Variante más sensible del Cozen.',indica:'Epicondilalgia lateral',positivo:'Dolor intenso en epicóndilo lateral',sens:'88%',esp:'68%',img:'',posicion:'Sentado',estructura:'Extensor carpi radialis brevis'},
    {n:'Estrés en Valgo (LCM)',como:'Codo 20-30° de flexión para desbloquear el olécranon. Aplicar fuerza en valgo. Evaluar dolor medial o apertura articular.',indica:'Lesión del ligamento colateral medial',positivo:'Dolor medial o inestabilidad palpable',sens:'65%',esp:'60%',img:'',posicion:'Supino con codo fuera de la camilla',estructura:'Ligamento colateral medial (LCM)'},
    {n:'Prueba de Inestabilidad Lateral Rotatoria',como:'Supino, brazo overhead. Codo a 40° flex, supinación + valgo + compresión axial mientras se extiende. Test + si el paciente expresa apprehensión o se objetiva subluxación radial.',indica:'Inestabilidad lateral del codo',positivo:'Apprehensión o subluxación visible',sens:'52%',esp:'95%',img:'',posicion:'Supino',estructura:'Ligamento colateral lateral radial'},
  ],
  rodilla:[
    {n:'Lachman',como:'30° flex. Mano proximal estabiliza el fémur. Mano distal tracciona la tibia hacia anterior con firmeza y rapidez. Evaluar excursión y calidad del endpoint (duro vs blando).',indica:'Rotura total o parcial del LCA',positivo:'Traslación anterior excesiva o endpoint blando/ausente',sens:'85%',esp:'94%',img:'',posicion:'Supino',estructura:'Ligamento cruzado anterior (LCA)'},
    {n:'McMurray',como:'Flexión máxima de rodilla. Para menisco medial: RE del pie + extensión gradual. Para menisco lateral: RI del pie + extensión. Buscar click doloroso o palpable en interlínea.',indica:'Lesión meniscal',positivo:'Click audible/palpable con dolor en interlínea articular',sens:'60%',esp:'70%',img:'',posicion:'Supino',estructura:'Menisco medial / lateral'},
    {n:'Thessaly (20°)',como:'Apoyo monopodal a 20° de flexión. El evaluador sostiene las manos del paciente. Rotación interna y externa del cuerpo 3 veces en cada dirección. Buscar dolor o sensación de bloqueo en interlínea.',indica:'Lesión meniscal (más sensible que McMurray)',positivo:'Dolor o sensación de bloqueo en interlínea',sens:'89%',esp:'97%',img:'',posicion:'Monopodal',estructura:'Menisco medial / lateral'},
    {n:'Cajón Anterior',como:'90° flex, pie apoyado en la camilla. Tracción anterior de la tibia con ambas manos. Comparar excursión con el lado contralateral.',indica:'Rotura LCA (menos sensible que Lachman)',positivo:'Traslación anterior > 5mm o diferencia bilateral',sens:'62%',esp:'88%',img:'',posicion:'Supino',estructura:'Ligamento cruzado anterior'},
    {n:'Pivot Shift',como:'Extensión completa + RI de tibia + fuerza en valgo → flexionar progresivamente la rodilla. El test es + si se objetiva clunk o subluxación-reducción de la meseta tibial.',indica:'Inestabilidad rotatoria anterolateral (LCA)',positivo:'Clunk palpable o visible de subluxación/reducción',sens:'32%',esp:'98%',img:'',posicion:'Supino relajado',estructura:'LCA, banda IT, cápsula'},
    {n:'Estrés en Valgo 0°/30°',como:'Fuerza en valgo a 0° (evalúa LCM + cápsula posteromedial) y a 30° (LCM aislado). Medir apertura y dolor medial.',indica:'Lesión del ligamento colateral medial',positivo:'Apertura medial o dolor en valgo',sens:'78%',esp:'62%',img:'',posicion:'Supino',estructura:'Ligamento colateral medial'},
    {n:'Estrés en Varo',como:'Fuerza en varo a 0° y 30°.',indica:'Lesión del ligamento colateral lateral',positivo:'Apertura lateral o dolor en varo',sens:'25%',esp:'97%',img:'',posicion:'Supino',estructura:'Ligamento colateral lateral'},
    {n:'Cajón Posterior',como:'90° flex. Empuje posterior de la tibia. Comparar con contralateral.',indica:'Rotura del LCP',positivo:'Traslación posterior > 5mm',sens:'90%',esp:'99%',img:'',posicion:'Supino',estructura:'Ligamento cruzado posterior (LCP)'},
    {n:'Appley (Compresión + Tracción)',como:'Prono, rodilla 90°. Compresión axial + rotación (lesión meniscal). Tracción + rotación (lesión ligamentosa). Dolor diferencial orienta.',indica:'Lesión meniscal o ligamentosa',positivo:'Dolor en compresión: meniscal / en tracción: ligamentoso',sens:'58%',esp:'70%',img:'',posicion:'Prono',estructura:'Meniscos, ligamentos colaterales'},
  ],
  columna:[
    {n:'Slump Test',como:'Sentado. (1) Slump torácico y lumbar, (2) flex cervical máxima, (3) extensión de rodilla, (4) dorsiflexión de tobillo. Si + (síntomas): extensión cervical debe aliviarlos.',indica:'Tensión neural / hernia discal L4-S1',positivo:'Reproducción síntomas + alivio con extensión cervical',sens:'83%',esp:'55%',img:'',posicion:'Sentado al borde de camilla',estructura:'Dura madre, raíces nerviosas L4-S1'},
    {n:'SLR (Lasègue)',como:'Supino. Elevar pierna extendida pasivamente. Test + si reproduce dolor radicular entre 30-70°. Ampliar con dorsiflexión (Bragard) o flex plantar contralateral (Crossed SLR).',indica:'Compresión raíz nerviosa L4-S1',positivo:'Dolor irradiado en pierna entre 30-70° de elevación',sens:'80%',esp:'40%',img:'',posicion:'Supino',estructura:'Raíces L4, L5, S1'},
    {n:'FABER (Patrick)',como:'Supino. Posición de figura 4 (flex + abd + RE de cadera). Presión suave y progresiva sobre la rodilla. Comparar altura bilateral.',indica:'Articulación sacroilíaca / patología de cadera',positivo:'Dolor en ingle (cadera) o en SI ipsilateral',sens:'57%',esp:'71%',img:'',posicion:'Supino',estructura:'Articulación sacroilíaca, cápsula de cadera'},
    {n:"Kemp's Test",como:'Bipedestación. Extensión + rotación + inclinación lateral ipsilateral + compresión axial manual. Test muy específico para facetas.',indica:'Estenosis foraminal / patología facetaria',positivo:'Reproducción de dolor radicular ipsilateral',sens:'60%',esp:'92%',img:'',posicion:'Bipedestación',estructura:'Facetas articulares, foramen intervertebral'},
    {n:'Test de Spring (PA)',como:'Prono. Presión postero-anterior sobre apófisis espinosa de cada nivel. Evaluar dolor y movilidad segmentaria.',indica:'Hipomobilidad segmentaria / disfunción discal-facetaria',positivo:'Dolor localizado + sensación de rigidez',sens:'65%',esp:'54%',img:'',posicion:'Prono',estructura:'Disco, facetas, ligamentos interspinosos'},
    {n:'Test de Gillet (Marcha SI)',como:'Bipedestación. El evaluador coloca pulgares en EIPS y en S2. El paciente eleva la rodilla ipsilateral. El pulgar de la EIPS debe moverse hacia abajo con normalidad.',indica:'Bloqueo o hipomobilidad de articulación sacroilíaca',positivo:'Ausencia de movimiento inferior de la EIPS ipsilateral',sens:'43%',esp:'68%',img:'',posicion:'Bipedestación',estructura:'Articulación sacroilíaca'},
  ],
  lumbar:[
    {n:'SLR (Lasègue)',como:'Supino. Elevación pasiva de la pierna extendida. + si dolor radicular entre 30-70°. Ampliar con Bragard (dorsiflexión al ángulo doloroso).',indica:'Compresión raíces L4-S1 / hernia discal',positivo:'Dolor irradiado en pierna 30-70°',sens:'80%',esp:'40%',img:'',posicion:'Supino',estructura:'Raíces L4, L5, S1'},
    {n:'Slump Test',como:'Sentado. Slump → flex cervical → ext. rodilla → dorsiflexión. Extensión cervical debe aliviar.',indica:'Tensión neural lumbar',positivo:'Reproducción de síntomas + alivio extensión cervical',sens:'83%',esp:'55%',img:'',posicion:'Sentado',estructura:'Nervio ciático, meninges'},
    {n:"Kemp's Test",como:'Extensión + rotación + inclinación + compresión axial ipsilateral.',indica:'Patología facetaria lumbar',positivo:'Reproducción dolor lumbar o radicular ipsilateral',sens:'60%',esp:'92%',img:'',posicion:'Bipedestación',estructura:'Facetas articulares L1-L5'},
    {n:'Test de Schober Modificado',como:'Marcar L5-S1 y 10cm arriba. En flexión máxima la distancia debe aumentar ≥4cm. En extensión debe reducirse.',indica:'Limitación de movilidad lumbar / espondiloartropatía',positivo:'Incremento < 4cm en flexión',sens:'52%',esp:'89%',img:'',posicion:'Bipedestación',estructura:'Columna lumbar'},
    {n:'FADIR Lumbar',como:'Flexión lumbar → adición → RI de cadera en decúbito. Puede reproducir síntomas de cadera que se confunden con lumbalgia.',indica:'Diagnóstico diferencial lumbar vs cadera',positivo:'Dolor en ingle (cadera) vs dolor lumbar',sens:'57%',esp:'71%',img:'',posicion:'Supino',estructura:'Articulación coxofemoral, cápsula'},
  ],
  tobillo:[
    {n:'Cajón Anterior de Tobillo',como:'Sentado, tobillo neutro (0°). Estabilizar la tibia con una mano. Con la otra, tracción anterior firme y sostenida del calcáneo. Comparar con contralateral.',indica:'Lesión del ligamento peroneoastragalino anterior (LPAA)',positivo:'Traslación anterior > 5mm o endpoint blando/diferencia bilateral',sens:'80%',esp:'74%',img:'',posicion:'Sentado al borde',estructura:'Ligamento peroneoastragalino anterior (LPAA)'},
    {n:'Talar Tilt (Inclinación del astrágalo)',como:'Decúbito lateral. Tobillo neutro. Inversión forzada pasiva del astrágalo. Comparar con contralateral. Radiografía confirma.',indica:'Lesión ligamentaria lateral compleja (LPCA + LPAA)',positivo:'Apertura > 10° vs contralateral',sens:'65%',esp:'77%',img:'',posicion:'Supino / lateral',estructura:'Ligamento peroneocalcáneo (LPCA)'},
    {n:'Thompson (Aquiles)',como:'Prono, pie fuera de la camilla. Comprimir la masa muscular gemelar con ambas manos. Observar si se produce plantar-flexión del tobillo.',indica:'Rotura completa del tendón de Aquiles',positivo:'Ausencia de plantar-flexión al comprimir el gemelo',sens:'96%',esp:'93%',img:'',posicion:'Prono',estructura:'Tendón de Aquiles'},
    {n:'Squeeze Test (Sindesmosis)',como:'Comprimir firmemente tibia y peroné a nivel del tercio medio de la pierna. Observar dolor distal en la sindesmosis.',indica:'Lesión de la sindesmosis tibioperonea / fractura de estrés',positivo:'Dolor distal en la sindesmosis al comprimir proximal',sens:'84%',esp:'82%',img:'',posicion:'Supino',estructura:'Sindesmosis tibioperonea'},
    {n:'Ottawa Ankle Rules (screening)',como:'Evaluar: ¿dolor óseo en zona de 6cm posteriores maléolo lat/med? ¿Incapacidad para cargar peso? Si cualquiera es +, radiografía indicada.',indica:'Fractura de tobillo o pie (criterio para rx)',positivo:'Cualquier criterio positivo → derivar a rx',sens:'96–99%',esp:'26–40%',img:'',posicion:'De pie / sentado',estructura:'Maléolos, 5° metatarsiano, navicular'},
    {n:'Arco de Movimiento Doloroso (ROM)',como:'Evaluar ROM activo y pasivo: dorsiflexión, plantar-flexión, inversión, eversión. Reproducir dolor y comparar bilateral.',indica:'Lesión ligamentaria, tendinopatía, inestabilidad crónica',positivo:'Dolor reproducido en algún rango específico',sens:'N/A',esp:'N/A',img:'',posicion:'Sentado o supino',estructura:'Ligamentos, tendones, cápsula articular'},
  ],
  cadera:[
    {n:'FABER (Patrick)',como:'Supino. Figura 4: flex + abd + RE de cadera. Presión sobre rodilla. + si dolor en ingle (cadera) o SI ipsilateral.',indica:'Articulación sacroilíaca / coxofemoral',positivo:'Dolor en ingle o SI reproducido',sens:'57%',esp:'71%',img:'',posicion:'Supino',estructura:'Articulación sacroilíaca, cápsula de cadera'},
    {n:'FADIR (Pinzamiento)',como:'Supino. Flex 90° → aducción → RI pasiva máxima. Reproducir dolor en ingle anterior / lateral.',indica:'Pinzamiento femoroacetabular (FAI)',positivo:'Dolor en ingle anterior o lateral reproducido',sens:'78%',esp:'10%',img:'',posicion:'Supino',estructura:'Labrum acetabular, cuello femoral, acetábulo'},
    {n:'Thomas Test',como:'Supino. Flexionar ambas rodillas al pecho. Soltar una hacia la extensión. Evaluar si la pierna suelta alcanza la camilla.',indica:'Retracción del psoas-ilíaco / flexores de cadera',positivo:'Extensión incompleta = retracción del psoas',sens:'89%',esp:'45%',img:'',posicion:'Supino',estructura:'Psoas-ilíaco, recto femoral'},
    {n:'Ober Test',como:'Decúbito lateral, pierna inferior flexionada. Elevar y abducir la pierna superior, extender cadera y dejar caer. Si queda arriba: retracción de la banda IT.',indica:'Retracción de la banda iliotibial / TFL',positivo:'La pierna no desciende por debajo del plano de la camilla',sens:'N/A',esp:'N/A',img:'',posicion:'Decúbito lateral',estructura:'Banda iliotibial, tensor fascia lata'},
    {n:'Sign of the Buttock',como:'Supino. SLR pasivo. Si al llegar al ángulo de dolor se flexiona la rodilla y el dolor NO disminuye: buscar patología profunda del glúteo.',indica:'Masa retroglútea / bursitis / neoplasia',positivo:'Dolor NO se alivia al flexionar la rodilla',sens:'N/A',esp:'N/A',img:'',posicion:'Supino',estructura:'Región glútea profunda'},
    {n:'Trendelenburg Test',como:'Monopodal. Observar la pelvis contralateral. Normal: se mantiene horizontal o sube. Positivo: pelvis contralateral cae.',indica:'Debilidad del glúteo medio ipsilateral',positivo:'Caída de la hemipelvis contralateral',sens:'73%',esp:'77%',img:'',posicion:'Bipedestación',estructura:'Glúteo medio, TFL, fascia lata'},
  ],
  muneca:[
    {n:'Phalen Test',como:'Mantener ambas muñecas en flexión máxima (dorsos enfrentados) durante 60 segundos. Buscar parestesias.',indica:'Síndrome del túnel carpiano',positivo:'Parestesias en dedos I-III en < 60 segundos',sens:'68%',esp:'73%',img:'',posicion:'Sentado',estructura:'Nervio mediano, túnel carpiano'},
    {n:'Tinel en muñeca',como:'Percusión suave con el dedo o martillo sobre el túnel carpiano (cara anterior de muñeca).',indica:'Síndrome del túnel carpiano',positivo:'Parestesias distales en dedos I-III',sens:'50%',esp:'77%',img:'',posicion:'Sentado',estructura:'Nervio mediano'},
    {n:'Watson (Escafoides)',como:'Presión sobre el tubérculo del escafoides + desviar muñeca desde ulnar a radial. Test + si click o dolor.',indica:'Inestabilidad escafo-lunar',positivo:'Click audible/palpable o dolor en escafoides',sens:'69%',esp:'66%',img:'',posicion:'Sentado',estructura:'Ligamento escafo-lunar'},
    {n:'Test de Finkelstein',como:'Pulgar dentro del puño + desviar en cubital pasivamente. Buscar dolor en tabaquera anatómica.',indica:'Tenosinovitis de De Quervain',positivo:'Dolor intenso en la tabaquera anatómica',sens:'89%',esp:'14%',img:'',posicion:'Sentado',estructura:'Abductor largo y extensor corto del pulgar'},
    {n:'Grind Test (CMC 1°)',como:'Compresión axial + rotación del pulgar sobre el trapecio (articulación trapeciometacarpiana).',indica:'Artrosis trapeciometacarpiana (rizartrosis)',positivo:'Dolor y/o crepitación en la base del pulgar',sens:'53%',esp:'47%',img:'',posicion:'Sentado',estructura:'Articulación CMC del pulgar, trapecio'},
    {n:'Estrés TFCC (Ballotement)',como:'Sujetar cúbito y radio por separado. Movimiento anteroposterior alternado. Buscar dolor o inestabilidad.',indica:'Lesión del fibrocartílago triangular (TFCC)',positivo:'Dolor o inestabilidad distal cúbito-radio',sens:'N/A',esp:'N/A',img:'',posicion:'Sentado',estructura:'TFCC, articulación radiocubital distal'},
  ],
  esc:[
    {n:'Hawkins-Kennedy',como:'Flex hombro 90°, codo 90°. Rotación interna pasiva forzada.',indica:'Pinzamiento subacromial',positivo:'Dolor en el arco de movimiento',sens:'79%',esp:'59%',img:'',posicion:'Sentado',estructura:'Supraespinoso, bursa subacromial'},
    {n:'Escápula Alada (Activo)',como:'Push-up en pared con las dos manos a la misma altura. Observar si alguna escápula se despega del tórax durante el movimiento.',indica:'Disfunción del serrato anterior o del largo torácico',positivo:'Escápula despegada visiblemente del tórax',sens:'N/A',esp:'N/A',img:'',posicion:'De pie frente a pared',estructura:'Serrato anterior, nervio torácico largo'},
    {n:'Test de Compresión Acromioclavicular',como:'Compresión directa sobre la articulación AC. Buscar dolor localizado.',indica:'Patología de la articulación acromioclavicular',positivo:'Dolor reproducido sobre la AC',sens:'79%',esp:'50%',img:'',posicion:'Sentado',estructura:'Articulación acromioclavicular'},
    {n:'Shoulder Shrug Sign',como:'Pedirle al paciente que eleve el hombro con carga. Observar si compensa elevando el hombro antes de abducir.',indica:'Inhibición del serrato / disfunción escapular',positivo:'Elevación precoz del hombro antes de 90° abd',sens:'N/A',esp:'N/A',img:'',posicion:'De pie',estructura:'Trapecio superior, serrato anterior'},
  ],
  cervical:[
    {n:'Spurling (Compresión Foraminal)',como:'Flexión lateral cervical hacia el lado sintomático + extensión + compresión axial con las manos del evaluador. Buscar reproducción del dolor radicular ipsilateral.',indica:'Compresión radicular cervical / estenosis foraminal',positivo:'Reproducción del dolor radicular ipsilateral',sens:'30%',esp:'93%',img:'',posicion:'Sentado',estructura:'Foramen intervertebral, raíces C5-C7'},
    {n:'Distracción Cervical',como:'Tracción axial manual suave de la cabeza (5-15kg). Si los síntomas radiculares se alivian: patología compresiva. Si empeoran: patología ligamentosa.',indica:'Compresión radicular cervical',positivo:'Alivio del dolor radicular con la tracción',sens:'44%',esp:'90%',img:'',posicion:'Supino',estructura:'Raíces cervicales, disco, foramen'},
    {n:'ULTT (Tensión Neural MMSS)',como:'Depresión escapular → extensión de codo → supinación → extensión de muñeca y dedos → rotación externa de hombro → abducción → inclinación cervical contralateral.',indica:'Tensión neural miembro superior / lesión C5-C7',positivo:'Reproducción síntomas + alivio con inclinación ipsilateral',sens:'97%',esp:'22%',img:'',posicion:'Supino',estructura:'Plexo braquial, nervio mediano'},
    {n:'Test de Adson (TOS)',como:'Localizar el pulso radial. Pedirle al paciente que inspire profundo, extienda el cuello y rote la cabeza hacia el lado evaluado. Buscar desaparición del pulso.',indica:'Síndrome de salida torácica (TOS)',positivo:'Disminución o desaparición del pulso radial',sens:'79%',esp:'76%',img:'',posicion:'Sentado',estructura:'Arteria subclavia, plexo braquial'},
    {n:'Rotación Cervical en Flexión (ULFT)',como:'Flexión máxima cervical. Luego rotar hacia cada lado. ROM normal: ≥ 44°. Limitación + síntomas sugiere disfunción C1-C2.',indica:'Disfunción cervical alta C0-C1-C2 / cefalea cervicogénica',positivo:'ROM < 44° y/o reproducción de cefalea o síntomas cervicales',sens:'91%',esp:'90%',img:'',posicion:'Sentado',estructura:'C0-C1-C2, articulación atlantoaxial'},
    {n:'Test de Estabilidad del Ligamento Transverso (Sharp-Purser)',como:'Paciente sentado. Evaluador estabiliza el axis con una mano. Con la otra, presión posterior sobre la frente. + si click o reducción de síntomas neurológicos.',indica:'Inestabilidad del ligamento transverso del atlas',positivo:'Click o alivio de síntomas neurológicos con la maniobra',sens:'69%',esp:'96%',img:'',posicion:'Sentado, CONTRAINDICADO en trauma reciente',estructura:'Ligamento transverso del atlas (C1)'},
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
  {k:'cervical',label:'Cervical',     emoji:'🔵',color:'#2563EB', desc:'C0–C7'},
  {k:'hombro',  label:'Hombro',       emoji:'🟣',color:'#7C3AED', desc:'Glenohumeral'},
  {k:'codo',    label:'Codo',         emoji:'🟤',color:'#92400E', desc:'Humeroradial'},
  {k:'muneca',  label:'Muñeca',       emoji:'🟡',color:'#B45309', desc:'Radiocarpiana'},
  {k:'esc',     label:'Cintura Esc.', emoji:'⚫',color:'#374151', desc:'Escapular'},
  {k:'columna', label:'Columna',      emoji:'🟠',color:'#C2410C', desc:'Cervical-dorsal'},
  {k:'lumbar',  label:'Lumbar',       emoji:'🔴',color:'#CC0000', desc:'L1–L5'},
  {k:'cadera',  label:'Cadera',       emoji:'🟢',color:'#16A34A', desc:'Coxofemoral'},
  {k:'rodilla', label:'Rodilla',      emoji:'🔷',color:'#0284C7', desc:'Tibiofemoral'},
  {k:'tobillo', label:'Tobillo',      emoji:'🟠',color:'#EA580C', desc:'Tibiotarsiana'},
];

const EVAL_STEPS=[
  {title:'Datos y Región',icon:'📋'},{title:'Anamnesis',icon:'🗣️'},
  {title:'Red Flags',icon:'🚩'},{title:'Escalas de Dolor',icon:'🩹'},
  {title:'Escalas Funcionales',icon:'📊'},{title:'Evaluación Postural',icon:'🔍'},
  {title:'ROM — Goniometría',icon:'📐'},{title:'Fuerza Muscular',icon:'💪'},
  {title:'Control Motor',icon:'⚡'},{title:'FMS',icon:'🏃'},
  {title:'Screening Multi-Región',icon:'🎯'},{title:'Antropometría',icon:'📸'},
  {title:'Síntesis y Plan',icon:'✅'},
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
  regiones_screened:[],
  antrop:{peso:'',talla:'',imc:'',perCintura:'',perCadera:'',perBrazo:'',pliegues:'',obs:''},
  imagenes_antrop:[],
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

// ── SesionClienteComp — external component (hooks: useState + useSesionesClinicas) ──
function SesionClienteComp({ paciente }) {
  const { sesiones, saveSesion, deleteSesion } = useSesionesClinicas(paciente?.id || null);
  const [showForm, setShowForm] = useState(false);
  const [form, setF] = useState(null);
  const [exEditando, setExEditando] = useState(''); // para input nuevo ejercicio

  const NV2='#0A3D62', TL2='#1BAA86', WH2='#FFFFFF';
  const G1c='#F4F4F4', G2c='#E0E0E0', G3c='#999999', G4c='#555555';
  const GN2='#16A34A', AM2='#D97706', RJ2='#DC2626';

  const faseColors = { restaura:'#374151', activa:'#1D4ED8', potencia:'#7C3AED', rinde:'#CC0000' };
  const faseLabels = { restaura:'🔴 RESTAURA', activa:'🟡 ACTIVA', potencia:'🟣 POTENCIA', rinde:'🔥 RINDE' };

  // Obtener fase y región del paciente desde su última evaluación
  const ultimaEval = paciente?.evaluaciones?.slice(-1)[0];
  const faseActual  = ultimaEval?.fase || 'restaura';
  const regionActual = (paciente?.region || ultimaEval?.region || 'lumbar').toLowerCase();

  // ── Auto-cargar ejercicios del protocolo según región y fase ─────────────
  const protocoloEjercicios = useMemo(() => {
    const regionKey = regionActual.replace(/\s+/g,'_');
    const prot = PROT_SESION[regionKey] || PROT_SESION[regionActual] || {};
    const ejercs = prot[faseActual] || [];
    return ejercs.map((nombre, i) => ({ id: 'prot_' + i, nombre, activo: true, editado: false }));
  }, [regionActual, faseActual]);

  // ── Auto-cargar criterios de avance según fase ───────────────────────────
  const criteriosProtocolo = useMemo(() => {
    const fase = FASES_METODO[faseActual];
    if (!fase) return [];
    return fase.criterios_avance || [];
  }, [faseActual]);

  const evaColor = (v) => v<=3?GN2:v<=6?AM2:RJ2;
  const evaLabel = (v) => v===0?'Sin dolor':v<=3?'Leve':v<=6?'Moderado':'Severo';

  const newForm = () => ({
    id: 'sc_' + Date.now().toString(36),
    fecha: new Date().toISOString().split('T')[0],
    numero_sesion: sesiones.length + 1,
    fase: faseActual,
    region: regionActual,
    eva_inicio: 0,
    eva_fin: 0,
    objetivo_sesion: ultimaEval?.objetivos_tratamiento || '',
    // Auto-carga ejercicios del protocolo como array editable
    ejercicios_lista: [...protocoloEjercicios],
    respuesta: '',
    // Auto-carga criterios como strings editables
    criterios_lista: criteriosProtocolo.map((c, i) => ({ id: 'cr_'+i, texto: c, cumplido: false })),
    avance_fase: false,
    notas: '',
    proxima_sesion: '',
  });

  const s2 = {
    inp: {width:'100%',border:`1px solid ${G2c}`,borderRadius:5,padding:'5px 8px',fontSize:11,background:WH2,outline:'none'},
    lbl: {display:'block',fontSize:9,color:G3c,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3,fontWeight:700},
    sel: {border:`1px solid ${G2c}`,borderRadius:5,padding:'5px 8px',fontSize:11,background:WH2,outline:'none'},
    card: {background:WH2,borderRadius:8,padding:12,marginBottom:8,border:`1px solid ${G2c}`},
    btnR: {background:RJ2,color:WH2,border:'none',borderRadius:5,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'},
    btnG: {background:WH2,color:G4c,border:`1px solid ${G2c}`,borderRadius:5,padding:'5px 10px',fontSize:11,cursor:'pointer'},
    btnTl: {background:TL2,color:WH2,border:'none',borderRadius:5,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'},
  };

  const setEx = (id, key, val) => setF(f => ({
    ...f, ejercicios_lista: f.ejercicios_lista.map(e => e.id===id ? {...e,[key]:val,editado:true} : e)
  }));
  const removeEx = (id) => setF(f => ({...f, ejercicios_lista: f.ejercicios_lista.filter(e=>e.id!==id)}));
  const addEx = (nombre) => {
    if (!nombre.trim()) return;
    setF(f => ({...f, ejercicios_lista:[...f.ejercicios_lista,{id:'add_'+Date.now(),nombre:nombre.trim(),activo:true,editado:true}]}));
    setExEditando('');
  };
  const setCrit = (id, key, val) => setF(f => ({
    ...f, criterios_lista: f.criterios_lista.map(cr => cr.id===id ? {...cr,[key]:val} : cr)
  }));
  const removeCrit = (id) => setF(f => ({...f, criterios_lista: f.criterios_lista.filter(cr=>cr.id!==id)}));
  const addCrit = (texto) => {
    if (!texto.trim()) return;
    setF(f => ({...f, criterios_lista:[...f.criterios_lista,{id:'cr_add_'+Date.now(),texto:texto.trim(),cumplido:false}]}));
  };

  const cumplidos = form?.criterios_lista?.filter(cr=>cr.cumplido).length || 0;
  const totalCrit = form?.criterios_lista?.length || 0;
  const pctCumplido = totalCrit>0 ? Math.round(cumplidos/totalCrit*100) : 0;

  if (showForm && form) {
    const set = (k, v) => setF(f => ({...f, [k]: v}));
    return (
      <div>
        <div style={{...s2.card, borderLeft:`3px solid ${TL2}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontWeight:800,fontSize:13}}>📝 Sesión #{form.numero_sesion} — {faseLabels[form.fase]} · {form.region}</div>
            <button onClick={()=>setShowForm(false)} style={s2.btnG}>← Volver</button>
          </div>

          {/* Fecha, fase, objetivo */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:8,marginBottom:10}}>
            <div><span style={s2.lbl}>Fecha</span><input type="date" value={form.fecha} onChange={e=>set('fecha',e.target.value)} style={s2.inp}/></div>
            <div><span style={s2.lbl}>N° de sesión</span><input type="number" value={form.numero_sesion} onChange={e=>set('numero_sesion',parseInt(e.target.value)||1)} style={s2.inp}/></div>
            <div><span style={s2.lbl}>Objetivo de la sesión</span><input value={form.objetivo_sesion} onChange={e=>set('objetivo_sesion',e.target.value)} placeholder="Ej: reducir EVA, mejorar ROM..." style={s2.inp}/></div>
          </div>

          {/* EVA */}
          <div style={{background:G1c,borderRadius:7,padding:'10px 12px',marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>📊 EVA — Escala de dolor (0–10)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['eva_inicio','Entrada'],['eva_fin','Salida']].map(([k,lbl])=>(
                <div key={k}>
                  <span style={s2.lbl}>{lbl}</span>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="range" min="0" max="10" value={form[k]} onChange={e=>set(k,parseInt(e.target.value))}
                      style={{flex:1,accentColor:evaColor(form[k])}}/>
                    <span style={{fontSize:20,fontWeight:800,color:evaColor(form[k]),minWidth:22}}>{form[k]}</span>
                  </div>
                  <div style={{fontSize:9,color:evaColor(form[k]),fontWeight:700}}>{evaLabel(form[k])}</div>
                </div>
              ))}
            </div>
            {form.eva_fin!==form.eva_inicio&&(
              <div style={{marginTop:6,fontSize:10,fontWeight:700,color:form.eva_fin<form.eva_inicio?GN2:RJ2}}>
                {form.eva_fin<form.eva_inicio?`↓ Mejoró ${form.eva_inicio-form.eva_fin} pto/s en sesión`:`↑ Empeoró ${form.eva_fin-form.eva_inicio} pto/s`}
              </div>
            )}
          </div>

          {/* EJERCICIOS DEL PROTOCOLO — auto-cargados, editables */}
          <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:7,padding:'10px 12px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,color:GN2}}>
                🏥 Ejercicios del protocolo — {form.region} · {faseLabels[form.fase]}
                <span style={{fontSize:9,color:G3c,fontWeight:400,marginLeft:6}}>({form.ejercicios_lista.length} ejercicios)</span>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
              {form.ejercicios_lista.map(ej=>(
                <div key={ej.id} style={{display:'flex',gap:6,alignItems:'center',background:ej.activo?WH2:'#F9FAFB',borderRadius:5,padding:'4px 8px',border:`1px solid ${ej.activo?'#86EFAC':G2c}`,opacity:ej.activo?1:0.55}}>
                  <input type="checkbox" checked={ej.activo} onChange={e=>setEx(ej.id,'activo',e.target.checked)} style={{accentColor:TL2,flexShrink:0}}/>
                  <input value={ej.nombre} onChange={e=>setEx(ej.id,'nombre',e.target.value)}
                    style={{flex:1,border:'none',background:'transparent',fontSize:11,outline:'none',color:ej.activo?G4c:G3c}}/>
                  <button onClick={()=>removeEx(ej.id)} style={{background:'none',border:'none',color:G3c,cursor:'pointer',fontSize:14,lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:5}}>
              <input value={exEditando} onChange={e=>setExEditando(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addEx(exEditando)}
                placeholder="+ Agregar ejercicio personalizado..." style={{...s2.inp,fontSize:10,flex:1}}/>
              <button onClick={()=>addEx(exEditando)} style={{...s2.btnTl,fontSize:10,padding:'4px 8px',whiteSpace:'nowrap'}}>Agregar</button>
            </div>
          </div>

          {/* CRITERIOS DE AVANCE — auto-cargados del protocolo */}
          <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'10px 12px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:NV2}}>📋 Criterios de avance de fase — {faseLabels[form.fase]}</div>
              <div style={{fontSize:11,fontWeight:700,color:pctCumplido>=80?GN2:pctCumplido>=50?AM2:G4c}}>
                {cumplidos}/{totalCrit} cumplidos ({pctCumplido}%)
              </div>
            </div>
            {/* Barra progreso */}
            <div style={{background:G2c,borderRadius:99,height:6,marginBottom:8,overflow:'hidden'}}>
              <div style={{width:`${pctCumplido}%`,background:pctCumplido>=80?GN2:pctCumplido>=50?AM2:RJ2,height:'100%',borderRadius:99,transition:'width .4s'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
              {form.criterios_lista.map(cr=>(
                <div key={cr.id} style={{display:'flex',gap:6,alignItems:'center',background:cr.cumplido?'#DCFCE7':WH2,borderRadius:5,padding:'4px 8px',border:`1px solid ${cr.cumplido?'#86EFAC':G2c}`}}>
                  <input type="checkbox" checked={cr.cumplido} onChange={e=>setCrit(cr.id,'cumplido',e.target.checked)} style={{accentColor:GN2,flexShrink:0}}/>
                  <input value={cr.texto} onChange={e=>setCrit(cr.id,'texto',e.target.value)}
                    style={{flex:1,border:'none',background:'transparent',fontSize:11,outline:'none',color:cr.cumplido?GN2:G4c,textDecoration:cr.cumplido?'line-through':''}}/>
                  <button onClick={()=>removeCrit(cr.id)} style={{background:'none',border:'none',color:G3c,cursor:'pointer',fontSize:14,lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:5}}>
              <input placeholder="+ Agregar criterio personalizado..." style={{...s2.inp,fontSize:10,flex:1}}
                onKeyDown={e=>{if(e.key==='Enter'){addCrit(e.target.value);e.target.value='';}}}/>
              <button onMouseDown={e=>{const input=e.currentTarget.previousSibling;addCrit(input.value);input.value='';}} style={{...s2.btnG,fontSize:10,padding:'4px 8px',whiteSpace:'nowrap'}}>Agregar</button>
            </div>
            {pctCumplido===100&&(
              <div style={{marginTop:6,background:'#DCFCE7',border:'1px solid #86EFAC',borderRadius:5,padding:'6px 10px',fontSize:11,fontWeight:700,color:GN2}}>
                ✅ Todos los criterios cumplidos — el paciente está listo para avanzar de fase
              </div>
            )}
            <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8}}>
              <input type="checkbox" checked={form.avance_fase||false} onChange={e=>set('avance_fase',e.target.checked)} id="avance_fase_check2"/>
              <label htmlFor="avance_fase_check2" style={{fontSize:11,fontWeight:700,cursor:'pointer',color:form.avance_fase?GN2:G4c}}>
                {form.avance_fase?'✅ Avance de fase confirmado':'⬜ Sin avance de fase'}
              </label>
            </div>
          </div>

          {/* Respuesta + notas + próxima sesión */}
          <div style={{marginBottom:8}}>
            <span style={s2.lbl}>Respuesta del paciente</span>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {['Muy buena','Buena','Regular','Mala'].map(resp=>(
                <span key={resp} onClick={()=>set('respuesta',resp)} style={{cursor:'pointer',padding:'3px 8px',borderRadius:99,fontSize:10,fontWeight:700,border:`1px solid ${form.respuesta===resp?TL2:G2c}`,background:form.respuesta===resp?TL2:WH2,color:form.respuesta===resp?WH2:G4c}}>{resp}</span>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
            <div><span style={s2.lbl}>Próxima sesión / Progresión</span><input value={form.proxima_sesion} onChange={e=>set('proxima_sesion',e.target.value)} placeholder="Ej: progresar a excéntrico..." style={s2.inp}/></div>
            <div><span style={s2.lbl}>Notas clínicas libres</span><input value={form.notas} onChange={e=>set('notas',e.target.value)} placeholder="Observaciones..." style={s2.inp}/></div>
          </div>

          <button onClick={()=>{
            // Serialize lists to strings for storage
            const toSave={...form,
              ejercicios_realizados: form.ejercicios_lista.filter(e=>e.activo).map(e=>e.nombre).join(' · '),
              criterios_avance: form.criterios_lista.map(cr=>`${cr.cumplido?'✓':'○'} ${cr.texto}`).join(' | '),
              ejercicios_lista: JSON.stringify(form.ejercicios_lista),
              criterios_lista: JSON.stringify(form.criterios_lista),
            };
            saveSesion(toSave).catch(e=>alert('Error al guardar: '+e.message));
            setShowForm(false);setF(null);
          }} style={{...s2.btnTl,width:'100%',padding:'9px'}}>💾 Guardar registro de sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:700}}>{paciente.nombre} {paciente.apellido}</div>
          <div style={{fontSize:11,color:G3c}}>
            {faseLabels[faseActual]} · {regionActual}
            {protocoloEjercicios.length>0&&<span style={{marginLeft:8,color:TL2}}>· {protocoloEjercicios.length} ejercicios en protocolo</span>}
          </div>
        </div>
        <button onClick={()=>{setF(newForm());setShowForm(true);}} style={s2.btnTl}>+ Nueva sesión</button>
      </div>
      {/* Banner protocolo activo */}
      {protocoloEjercicios.length>0&&(
        <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:7,padding:'8px 12px',marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:GN2,marginBottom:4}}>🏥 Protocolo activo: {regionActual} — {faseLabels[faseActual]}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {protocoloEjercicios.slice(0,5).map((ej,i)=>(
              <span key={i} style={{fontSize:9,background:WH2,border:`1px solid #86EFAC`,borderRadius:5,padding:'2px 6px',color:G4c}}>{ej.nombre}</span>
            ))}
            {protocoloEjercicios.length>5&&<span style={{fontSize:9,color:G3c}}>+{protocoloEjercicios.length-5} más</span>}
          </div>
        </div>
      )}
      {sesiones.length===0&&<div style={{...s2.card,textAlign:'center',padding:20,borderStyle:'dashed',color:G3c}}>Sin sesiones registradas. Iniciá con "+ Nueva sesión".</div>}
      {sesiones.map(ses=>{
        let ejercsData, critsData;
        try{ ejercsData=JSON.parse(ses.ejercicios_lista||'[]'); }catch{ ejercsData=[]; }
        try{ critsData=JSON.parse(ses.criterios_lista||'[]'); }catch{ critsData=[]; }
        const cumplidos2=critsData.filter(c=>c.cumplido).length;
        const evaMejoro=ses.eva_fin<ses.eva_inicio;
        return(
          <div key={ses.id} style={{...s2.card,borderLeft:`4px solid ${evaMejoro?GN2:ses.eva_fin===ses.eva_inicio?AM2:RJ2}`,marginBottom:6}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700}}>Sesión #{ses.numero_sesion} · {ses.fecha}</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:10,marginTop:3}}>
                  <span style={{fontWeight:700,color:faseColors[ses.fase]||G4c}}>{faseLabels[ses.fase]||ses.fase}</span>
                  {ses.eva_inicio!==undefined&&<span>EVA: <strong style={{color:evaColor(ses.eva_inicio)}}>{ses.eva_inicio}</strong>→<strong style={{color:evaColor(ses.eva_fin)}}>{ses.eva_fin}</strong></span>}
                  {ses.respuesta&&<span style={{color:TL2}}>{ses.respuesta}</span>}
                  {ses.avance_fase&&<span style={{color:GN2,fontWeight:700}}>✅ Avance de fase</span>}
                </div>
                {ses.objetivo_sesion&&<div style={{fontSize:10,color:G4c,marginTop:2}}>🎯 {ses.objetivo_sesion}</div>}
                {critsData.length>0&&(
                  <div style={{fontSize:10,color:G4c,marginTop:2}}>
                    📋 Criterios: <strong style={{color:cumplidos2===critsData.length?GN2:AM2}}>{cumplidos2}/{critsData.length} cumplidos</strong>
                    {critsData.filter(c=>c.cumplido).slice(0,2).map((cr,i)=><span key={i} style={{marginLeft:4,color:GN2}}>· ✓ {cr.texto.slice(0,25)}</span>)}
                  </div>
                )}
                {ejercsData.filter(e=>e.activo).length>0&&<div style={{fontSize:9,color:G3c,marginTop:2}}>Ejercicios: {ejercsData.filter(e=>e.activo).map(e=>e.nombre).join(' · ')}</div>}
                {ses.proxima_sesion&&<div style={{fontSize:10,color:TL2,marginTop:2}}>→ {ses.proxima_sesion}</div>}
                {ses.notas&&<div style={{fontSize:9,color:G3c,fontStyle:'italic',marginTop:2}}>{ses.notas}</div>}
              </div>
              <button onClick={()=>deleteSesion(ses.id).catch(console.error)} style={{...s2.btnG,fontSize:9,padding:'2px 6px',color:RJ2,borderColor:RJ2,flexShrink:0}}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FisioActiva({ brand, gymClients=[], onUpdateGymClient }){
  const [view,setView]=useState('dashboard');
  // Estado levantado de sub-componentes (evita pérdida de foco en inputs)
  const [protFase,setProtFase]=useState('restaura');
  const [protReg,setProtReg]=useState('lumbar');
  const [altaPacId,setAltaPacId]=useState('');
  const [pacForm,setPacForm]=useState(null); // estado del formulario de paciente
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
  const [sesionPacId,setSesionPacId]=useState('');
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
    setPacForm(null);
  };

  // ── DASHBOARD ──────────────────────────────────────────────────────────
  const Dashboard=()=>{
    const totalEvals=pacientes.reduce((s,p)=>s+p.evaluaciones.length,0);
    const sinEval=pacientes.filter(p=>p.evaluaciones.length===0).length;
    const enRestora=pacientes.filter(p=>{const l=p.evaluaciones[p.evaluaciones.length-1];return l?.fase==='restaura';}).length;
    return(
      <div style={{padding:'14px'}}>
        <div style={{...fs.cardNV,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 18px',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:WH}}>🏥 FisioActiva — Sistema Clínico</div>
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
            {icon:'📝',label:'Registro de Sesiones',sub:'EVA y criterios de avance',action:()=>setView('sesiones'),color:'#0F766E'},
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
                  {fase&&<span style={{...fs.tag(FASES_BASE[fase]?.color||GM)}}>{FASES_BASE[fase]?.emoji||''} {FASES_BASE[fase]?.badge} {FASES_BASE[fase]?.label}</span>}
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
              <div style={{gridColumn:'1/-1'}}>
                <span style={fs.lbl}>Región principal</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginTop:4}}>
                  {REGIONES_LIST.map(r=>(
                    <div key={r.k} onClick={()=>set('region',r.k)} style={{cursor:'pointer',padding:'7px 4px',borderRadius:7,border:`2px solid ${ev.region===r.k?r.color:GL}`,background:ev.region===r.k?`${r.color}18`:WH,textAlign:'center',transition:'all .15s'}}>
                      <div style={{fontSize:18}}>{r.emoji}</div>
                      <div style={{fontSize:9,fontWeight:ev.region===r.k?700:400,color:ev.region===r.k?r.color:GD,marginTop:1,lineHeight:1.2}}>{r.label}</div>
                      <div style={{fontSize:8,color:GM}}>{r.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
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
                    <div style={{fontSize:16,marginBottom:2}}>{v.emoji||v.badge}</div>
                    <div style={{fontSize:9,fontWeight:700,color:ev.fase===k?v.color:GD}}>{v.badge}</div>
                    <div style={{fontSize:8,color:ev.fase===k?v.color:GM,marginTop:1}}>{v.label}</div>
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
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>🏃 FMS — Functional Movement Screen · Total máximo 21/21 · Score ≤ 14 = mayor riesgo de lesión · 7 patrones de movimiento</div>
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
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>
              🎯 <strong>Screening Multi-Región</strong> — Seleccioná las regiones que quieras evaluar. Podés seleccionar más de una.
            </div>
            {/* Selector de regiones — visual con emojis */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:14}}>
              {Object.keys(TESTS_ESP).map(reg=>{
                const info=REGIONES_LIST.find(r=>r.k===reg)||{label:reg,emoji:'📍',color:NV};
                const sel=(ev.regiones_screened||[]).includes(reg);
                return(
                  <div key={reg} onClick={()=>setCurrentEval(p=>({...p,regiones_screened:sel?(p.regiones_screened||[]).filter(r=>r!==reg):[...(p.regiones_screened||[]),reg]}))}
                    style={{cursor:'pointer',padding:'10px 6px',borderRadius:8,border:`2px solid ${sel?info.color:GL}`,background:sel?`${info.color}18`:WH,textAlign:'center',transition:'all .15s',boxShadow:sel?`0 2px 8px ${info.color}30`:'none'}}>
                    <div style={{fontSize:22,marginBottom:3}}>{info.emoji}</div>
                    <div style={{fontSize:10,fontWeight:sel?700:400,color:sel?info.color:GD,lineHeight:1.2}}>{info.label}</div>
                    {sel
                      ?<div style={{fontSize:9,color:TL,marginTop:3,fontWeight:700}}>✓ {(TESTS_ESP[reg]||[]).length} tests</div>
                      :<div style={{fontSize:8,color:GM,marginTop:2}}>{info.desc}</div>
                    }
                  </div>
                );
              })}
            </div>
            {(ev.regiones_screened||[]).length>0&&(
              <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:6,padding:'6px 10px',marginBottom:10,fontSize:10,color:'#1D4ED8'}}>
                <strong>Regiones seleccionadas:</strong> {(ev.regiones_screened||[]).map(r=>REGIONES_LIST.find(x=>x.k===r)?.emoji+' '+REGIONES_LIST.find(x=>x.k===r)?.label).join(' · ')}
              </div>
            )}
            {(ev.regiones_screened||[]).length===0&&(
              <div style={{...fs.card,textAlign:'center',padding:20,borderStyle:'dashed',color:GM,fontSize:12}}>Seleccioná al menos una región para ver la batería de tests correspondiente.</div>
            )}
            {/* Tests por cada región seleccionada */}
            {(ev.regiones_screened||[]).map(reg=>{
              const tests=TESTS_ESP[reg]||[];
              const regionInfo=REGIONES_LIST.find(r=>r.k===reg)||{label:reg};
              return(
                <div key={reg} style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:800,marginBottom:8,paddingBottom:6,borderBottom:`2px solid ${regionInfo.color||NV}`,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:20}}>{regionInfo.emoji}</span>
                    <span style={{color:regionInfo.color||NV}}>{regionInfo.label}</span>
                    <span style={{fontSize:10,color:GM,fontWeight:400}}>— {tests.length} tests disponibles</span>
                  </div>
                  {tests.map(t=>{
                    const resD=ev.testsEsp[t.n+'_Derecho']||'';
                    const resI=ev.testsEsp[t.n+'_Izquierdo']||'';
                    const anyPos=resD==='positivo'||resI==='positivo';
                    const anyDone=resD||resI;
                    return(
                      <div key={t.n} style={{...fs.card,borderLeft:`4px solid ${anyPos?RJ:anyDone?GN:GL}`,marginBottom:8,padding:'10px 12px'}}>
                        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                          {/* Imagen si existe */}
                          {t.img&&(
                            <div style={{flexShrink:0,width:80,height:70,borderRadius:5,overflow:'hidden',background:BG,border:`1px solid ${GL}`}}>
                              <img src={t.img} alt={t.n} style={{width:80,height:70,objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.style.background='#EFF6FF';}}/>
                            </div>
                          )}
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>
                              {t.n}
                              {anyPos&&<span style={{marginLeft:8,...fs.tag(RJ)}}>⚠ POSITIVO</span>}
                              {anyDone&&!anyPos&&<span style={{marginLeft:8,...fs.tag(GN)}}>✓ REALIZADO</span>}
                            </div>
                            <div style={{fontSize:10,color:GD,background:BG,borderRadius:5,padding:'6px 8px',marginBottom:6,lineHeight:1.6}}>
                              <strong>🏥 Indica:</strong> {t.indica}<br/>
                              <strong>📍 Posición:</strong> {t.posicion}<br/>
                              <strong>🫀 Estructura:</strong> {t.estructura}
                            </div>
                            <details style={{marginBottom:6}}>
                              <summary style={{fontSize:10,color:TL,cursor:'pointer',fontWeight:700}}>📋 Ver procedimiento detallado</summary>
                              <div style={{background:'#F0FDF4',border:`1px solid #86EFAC`,borderRadius:5,padding:'8px',marginTop:4,fontSize:11,color:GD,lineHeight:1.6}}>
                                <strong>Cómo realizar:</strong> {t.como}<br/>
                                <strong>Test positivo:</strong> {t.positivo}<br/>
                                <span style={{color:GM}}>Sensibilidad: {t.sens} · Especificidad: {t.esp}</span>
                              </div>
                            </details>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                              {['Derecho','Izquierdo'].map(lado=>{
                                const val=ev.testsEsp[t.n+'_'+lado]||'';
                                const bg=val==='positivo'?'#FEE2E2':val==='negativo'?'#DCFCE7':WH;
                                return(
                                  <div key={lado}>
                                    <span style={{...fs.lbl,marginBottom:2}}>{lado}</span>
                                    <select value={val} onChange={e=>setTestEsp(t.n+'_'+lado,e.target.value)} style={{...fs.sel,width:'100%',background:bg,borderColor:val==='positivo'?RJ:val==='negativo'?GN:GL}}>
                                      <option value=''>— Sin realizar —</option>
                                      <option value='negativo'>✓ Negativo</option>
                                      <option value='positivo'>⚠ Positivo</option>
                                      <option value='dudoso'>≈ Dudoso</option>
                                      <option value='no_aplica'>N/A</option>
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Campo notas por test */}
                            <input value={ev.testsEsp[t.n+'_nota']||''} onChange={e=>setTestEsp(t.n+'_nota',e.target.value)} placeholder="Notas de este test..." style={{...fs.inp,marginTop:5,fontSize:10}} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Resumen de la región */}
                  {tests.some(t=>ev.testsEsp[t.n+'_Derecho']||ev.testsEsp[t.n+'_Izquierdo'])&&(()=>{
                    const positivos=tests.filter(t=>ev.testsEsp[t.n+'_Derecho']==='positivo'||ev.testsEsp[t.n+'_Izquierdo']==='positivo');
                    return(
                      <div style={{background:positivos.length>0?'#FEE2E2':'#DCFCE7',border:`1px solid ${positivos.length>0?'#FCA5A5':'#86EFAC'}`,borderRadius:6,padding:'8px 12px',marginTop:4}}>
                        <div style={{fontSize:11,fontWeight:700,color:positivos.length>0?RJ:GN}}>
                          Resumen {regionInfo.label}: {positivos.length} test/s positivos
                        </div>
                        {positivos.length>0&&<div style={{fontSize:10,color:RJ,marginTop:2}}>{positivos.map(t=>t.n).join(', ')}</div>}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        );
        case 11: return(
          <div>
            <div style={{background:'#EFF6FF',border:'1px solid #93C5FD',borderRadius:7,padding:'8px 10px',marginBottom:10,fontSize:11}}>
              📸 <strong>Antropometría y Análisis Corporal</strong> — Medidas corporales + adjuntar imágenes de análisis de composición corporal.
            </div>
            {/* Medidas antropométricas */}
            <div style={{...fs.card,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Medidas antropométricas</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                {[['peso','Peso (kg)','kg'],['talla','Talla (cm)','cm'],['imc','IMC (calculado)','kg/m²'],['perCintura','Per. cintura (cm)','cm'],['perCadera','Per. cadera (cm)','cm'],['perBrazo','Per. brazo (cm)','cm']].map(([k,lbl,unit])=>{
                  const val=ev.antrop?.[k]||'';
                  let calculado='';
                  if(k==='imc'&&ev.antrop?.peso&&ev.antrop?.talla){
                    const imc=(parseFloat(ev.antrop.peso)/Math.pow(parseFloat(ev.antrop.talla)/100,2)).toFixed(1);
                    calculado=` (${imc})`;
                  }
                  return(
                    <div key={k}>
                      <span style={fs.lbl}>{lbl}{calculado}</span>
                      <input type="number" value={val} onChange={e=>setCurrentEval(p=>({...p,antrop:{...(p.antrop||{}),[k]:e.target.value}}))} placeholder={unit} style={fs.inp}/>
                    </div>
                  );
                })}
              </div>
              {/* ICC */}
              {ev.antrop?.perCintura&&ev.antrop?.perCadera&&(()=>{
                const icc=(parseFloat(ev.antrop.perCintura)/parseFloat(ev.antrop.perCadera)).toFixed(2);
                const riesgo=icc>0.9?'Riesgo alto':'Normal';
                return<div style={{background:parseFloat(icc)>0.9?'#FEE2E2':'#DCFCE7',borderRadius:5,padding:'6px 10px',fontSize:11,fontWeight:700,color:parseFloat(icc)>0.9?RJ:GN}}>ICC: {icc} — {riesgo} (umbral H: 0.90 / M: 0.85)</div>;
              })()}
              <div style={{marginTop:8}}>
                <span style={fs.lbl}>Pliegues cutáneos / % grasa corporal</span>
                <input value={ev.antrop?.pliegues||''} onChange={e=>setCurrentEval(p=>({...p,antrop:{...(p.antrop||{}),'pliegues':e.target.value}}))} placeholder="Ej: subescapular 12mm, suprailiaco 15mm, % grasa 18%" style={fs.inp}/>
              </div>
              <div style={{marginTop:8}}>
                <span style={fs.lbl}>Observaciones antropométricas</span>
                <textarea value={ev.antrop?.obs||''} onChange={e=>setCurrentEval(p=>({...p,antrop:{...(p.antrop||{}),'obs':e.target.value}}))} rows={2} style={{...fs.inp,resize:'vertical'}} placeholder="Distribución de grasa, asimetrías visibles, contextura..."/>
              </div>
            </div>
            {/* Imágenes de análisis corporal */}
            <div style={fs.card}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>📸 Imágenes de análisis corporal</div>
              <div style={{fontSize:11,color:GD,background:BG,borderRadius:5,padding:'6px 10px',marginBottom:10}}>
                Adjuntá fotos de análisis de composición corporal, scanner DEXA, InBody, o análisis postural fotográfico. Las imágenes se guardan directamente en el historial del paciente.
              </div>
              {/* Upload de imagen */}
              <div style={{marginBottom:10}}>
                <label style={{display:'block',background:'#EFF6FF',border:'2px dashed #93C5FD',borderRadius:7,padding:'14px',textAlign:'center',cursor:'pointer',fontSize:11,color:'#1D4ED8'}}>
                  <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>{
                    Array.from(e.target.files).forEach(file=>{
                      const reader=new FileReader();
                      reader.onload=ev2=>{
                        const img={id:'img_'+Date.now()+'_'+Math.random().toString(36).slice(2),nombre:file.name,tipo:file.type,data:ev2.target.result,fecha:new Date().toISOString().split('T')[0],desc:''};
                        setCurrentEval(p=>({...p,imagenes_antrop:[...(p.imagenes_antrop||[]),img]}));
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value='';
                  }}/>
                  📷 Tocá para seleccionar imágenes (JPG, PNG) — podés seleccionar varias a la vez
                </label>
              </div>
              {/* Galería de imágenes cargadas */}
              {(ev.imagenes_antrop||[]).length===0&&(
                <div style={{textAlign:'center',padding:16,color:GM,fontSize:11}}>Sin imágenes adjuntadas.</div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                {(ev.imagenes_antrop||[]).map((img,i)=>(
                  <div key={img.id} style={{background:BG,borderRadius:7,overflow:'hidden',border:`1px solid ${GL}`}}>
                    <img src={img.data} alt={img.nombre} style={{width:'100%',height:140,objectFit:'cover',display:'block'}}/>
                    <div style={{padding:'6px 8px'}}>
                      <input value={img.desc||''} onChange={e=>setCurrentEval(p=>({...p,imagenes_antrop:(p.imagenes_antrop||[]).map((x,j)=>j===i?{...x,desc:e.target.value}:x)}))} placeholder="Descripción (ej: Vista anterior, InBody 12/03)" style={{...fs.inp,fontSize:10,marginBottom:4}}/>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:GM}}>{img.fecha}</span>
                        <button onClick={()=>setCurrentEval(p=>({...p,imagenes_antrop:(p.imagenes_antrop||[]).filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',color:RJ,cursor:'pointer',fontSize:11}}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        case 12: return(
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
              {i<evalStep?'✓ '+st.icon:st.icon}
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
    const selFase=protFase; const setSelFase=setProtFase;
    const fase=FASES_BASE[selFase]||FASES_BASE['restaura'];
    const selReg=protReg; const setSelReg=setProtReg;
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
              {fase.criterios_ingreso.map((c,i)=><div key={i} style={{fontSize:11,color:GD,display:'flex',gap:5,marginBottom:4}}><span style={{color:TL,flexShrink:0}}>✓</span>{c}</div>)}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:5,textTransform:'uppercase'}}>Para avanzar a la siguiente</div>
              {fase.criterios_avance.map((c,i)=><div key={i} style={{fontSize:11,color:GD,display:'flex',gap:5,marginBottom:4}}><span style={{color:AM,flexShrink:0}}>→</span>{c}</div>)}
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
    const selPac=altaPacId; const setSelPac=setAltaPacId;
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
      ${ev.antrop&&(ev.antrop.peso||ev.antrop.talla)?`<div class="sec"><div class="sec-title">Antropometría</div><div class="sec-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px">${ev.antrop.peso?'<div>Peso: <strong>'+ev.antrop.peso+' kg</strong></div>':''}${ev.antrop.talla?'<div>Talla: <strong>'+ev.antrop.talla+' cm</strong></div>':''}${ev.antrop.imc||ev.antrop.peso&&ev.antrop.talla?'<div>IMC: <strong>'+(ev.antrop.imc||(parseFloat(ev.antrop.peso)/Math.pow(parseFloat(ev.antrop.talla)/100,2)).toFixed(1))+'</strong></div>':''}${ev.antrop.perCintura?'<div>Cin: <strong>'+ev.antrop.perCintura+' cm</strong></div>':''}${ev.antrop.perCadera?'<div>Cad: <strong>'+ev.antrop.perCadera+' cm</strong></div>':''}${ev.antrop.pliegues?'<div style="grid-column:1/-1"><strong>Pliegues:</strong> '+ev.antrop.pliegues+'</div>':''}</div></div>`:''}
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
    // Inicializar pacForm si cambió el paciente que se edita
    if(!pacForm||pacForm.id!==editingPac.id){ setPacForm({...editingPac}); return null; }
    const form=pacForm; const set=(k,v)=>setPacForm(f=>({...f,[k]:v}));
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'20px 14px'}}>
        <div style={{background:WH,borderRadius:12,padding:22,width:'100%',maxWidth:440,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontWeight:800,fontSize:14,color:NV}}>{form.nombre?`${form.nombre} ${form.apellido}`:'Nuevo paciente'}</div>
            <button onClick={()=>{setShowPacForm(false);setEditingPac(null);setPacForm(null);}} style={fs.btnG}>✕</button>
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
          <button onClick={()=>{savePaciente(pacForm);setPacForm(null);}} disabled={!pacForm?.nombre||!pacForm?.apellido||!pacForm?.documento} style={{...fs.btnTL,width:'100%',padding:'10px',opacity:(!form.nombre||!form.apellido||!form.documento)?.4:1}}>Guardar paciente</button>
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

        {(ev.imagenes_antrop||[]).length>0&&(
          <div style={{...fs.card,borderLeft:`3px solid ${TL}`}}>
            <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>📸 Análisis corporal ({ev.imagenes_antrop.length} imágenes)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {ev.imagenes_antrop.map((img,i)=>(
                <div key={i} style={{borderRadius:6,overflow:'hidden',border:`1px solid ${GL}`,cursor:'pointer'}} onClick={()=>window.open(img.data,'_blank')}>
                  <img src={img.data} alt={img.desc||img.nombre} style={{width:'100%',height:80,objectFit:'cover',display:'block'}}/>
                  {img.desc&&<div style={{padding:'4px 6px',fontSize:9,color:GD,background:BG}}>{img.desc}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
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

  // ── REGISTRO DE SESIONES CLÍNICAS ────────────────────────────────────────
  const RegistroSesiones=()=>{
    // This component has no own hooks — rendered as function call
    const pacSel=pacientes.find(p=>p.id===sesionPacId);
    return(
      <div style={{padding:'12px 14px'}}>
        <div style={{background:NV,borderRadius:10,padding:'14px 16px',marginBottom:12,borderLeft:'3px solid #1BAA86'}}>
          <div style={{fontSize:14,fontWeight:800,color:WH}}>📝 Registro de Sesiones Clínicas</div>
          <div style={{fontSize:11,color:'#93C5FD'}}>EVA de entrada y salida · Criterios de avance · Historial por paciente</div>
        </div>
        <div style={{...fs.card,marginBottom:12}}>
          <span style={fs.lbl}>Seleccionar paciente</span>
          <select value={sesionPacId} onChange={e=>setSesionPacId(e.target.value)} style={{...fs.sel,width:'100%'}}>
            <option value=''>— Seleccionar paciente —</option>
            {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellido} {p.region?`· ${p.region}`:''}</option>)}
          </select>
        </div>
        {pacSel&&<SesionClienteComp paciente={pacSel}/>}
        {!sesionPacId&&<div style={{...fs.card,textAlign:'center',padding:28,borderStyle:'dashed',color:GM}}>Seleccioná un paciente para ver y registrar sesiones.</div>}
      </div>
    );
  };

  const VIEWS={
    dashboard:Dashboard(),pacientes:PacientesView(),'ver-paciente':VerPaciente(),'nueva-eval':NuevaEval(),'ver-eval':VerEval(),
    kpis:KPIs(),protocolos:Protocolos(),altas:AltasCli(),sesiones:RegistroSesiones(),
    reevals:<div style={{padding:'14px'}}><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Re-evaluaciones</div>{pacientes.filter(p=>p.evaluaciones.length>0).map(p=>{const l=p.evaluaciones[p.evaluaciones.length-1];return(<div key={p.id} style={{...fs.card,borderLeft:`4px solid ${AM}`,marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:12,fontWeight:700}}>{p.nombre} {p.apellido}</div><div style={{fontSize:10,color:GM}}>Última eval.: {l?.fecha} · {FASES_BASE[l?.fase]?.badge}</div>{l?.objetivo&&<div style={{fontSize:10,color:TL}}>🎯 "{l.objetivo}"</div>}</div><button onClick={()=>{setCurrentPac(p);setCurrentEval({...emptyEval(),tipo:'reeval',region:p.region,objetivo:l?.objetivo||''});setEvalStep(0);setView('nueva-eval');}} style={{...fs.btnTL,fontSize:10,padding:'4px 10px'}}>Re-evaluar</button></div></div>);})}
    {pacientes.filter(p=>p.evaluaciones.length>0).length===0&&<div style={{...fs.card,textAlign:'center',padding:24,color:GM}}>Sin pacientes para re-evaluar.</div>}</div>,
  };

  return(
    <div style={{background:BG,minHeight:'100vh',fontFamily:'Arial,sans-serif'}}>
      {showPacForm&&PacienteForm()}
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
        {VIEWS[view]||Dashboard()}
      </div>
    </div>
  );
}
