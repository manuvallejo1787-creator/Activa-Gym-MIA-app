// rehabDB.js — LA BIBLIOTECA DE REHABILITACIÓN
//
// POR QUÉ ESTÁ ACÁ Y NO DENTRO DE App.jsx
// Vivía como cuatro constantes de nivel de módulo dentro de App.jsx, sin
// exportar, así que era inalcanzable para cualquier otra pantalla. Eso es lo
// que mantuvo la pestaña Rehab desconectada del riel y del plan de gym: el
// escalón 2 no podía armar un bloque dirigido porque no podía leer la
// biblioteca de ejercicios. Imprimía un PDF y nada más.
//
// Se movió tal cual el 30/10, sin tocar una coma del contenido, para que el
// escalón 2 pueda leerla y para que App.jsx deje de cargar 339 líneas de datos
// que no son de su incumbencia.
//
// DEUDA CONOCIDA, Y ES DE MÉTODO, NO DE CÓDIGO
// REHAB_DB está indexada por `aguda / subaguda / cronica`: fases de
// CALENDARIO. El método avanza por CRITERIOS —proteccion / carga_progresiva /
// retorno_funcion (R0/R1/R2), en criterios.js, con sus
// `criterios_avance_generico`— y es el mismo error que ya se corrigió dos veces
// esta semana: las 4 y 8 sesiones ejecutadas en vez de 30 días, y el test de
// fuerza por fase en vez de por fecha.
//
// Lo correcto es remapear estas listas a R0/R1/R2. Mientras no esté hecho, la
// traducción vive en UNA línea en src/rehabPuente.js (FASE_CLINICA_A_LIBRERIA)
// y no desparramada por las pantallas: el día que se remapee se borra ese mapa
// y nada más cambia.

export const REGIONES={
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

export const FASES_REHAB={
  aguda:    {label:'Fase Aguda',    sub:'0–72 h / Dolor activo',    color:'#CC0000', bg:'#FEF2F2', border:'#FCA5A5'},
  subaguda: {label:'Fase Subaguda', sub:'3 días – 6 semanas',       color:'#D97706', bg:'#FFFBEB', border:'#FCD34D'},
  cronica:  {label:'Fase Crónica / Funcional', sub:'6+ semanas / Retorno actividad', color:'#16A34A', bg:'#F0FDF4', border:'#86EFAC'},
};

export const TEJIDOS_BASE={
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

export const REHAB_DB={
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
