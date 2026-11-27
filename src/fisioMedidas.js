// ═══════════════════════════════════════════════════════════════════════════
// MEDIDAS Y LECTURA DE UNA EVALUACIÓN CLÍNICA
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE ESTE ARCHIVO
// Todo esto vivía dentro de FisioActiva.jsx, un archivo de 246 KB, y por eso
// la capa de IA no podía usarlo: no se puede importar lo que está encerrado
// en un componente. El resultado fue que el generador de planes clínicos
// recibía TRES campos de los cuarenta que la evaluación guarda —EVA,
// diagnóstico y objetivos— y tenía que inventar el resto. Manu lo reportó el
// 27/11/2026 como "la IA no genera planes en función de la lesión cargada".
// No los generaba porque nunca recibía la lesión.
//
// Acá viven las medidas (ROM contra normas, DN4, dinamometría, Y-Balance, FMS),
// la biblioteca de pruebas especiales con su sensibilidad y especificidad, y
// el serializador que convierte una evaluación entera en hechos legibles.
// Lo importa tanto la pantalla como el razonador clínico, así que los dos leen
// LA MISMA medición y no puede haber dos verdades.
//
// No importa a FisioActiva ni a la capa de IA: solo depende de rehabDB, así
// que no hay forma de que se arme un import circular.
import { REGIONES } from "./rehabDB.js";

// ─── Regiones como lista, para los selectores ───────────────────────────
export const REGIONES_LIST=[
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

// ─── Normas de ROM por región ──────────────────────────────────────────────
// `normal` es el rango de referencia: el porcentaje que se calcula contra él
// es lo que decide si una región está limitada, así que estos números son
// clínicos y no cosméticos.
export const ROM_NORMS={
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

// ─── Pruebas especiales con sensibilidad y especificidad ───────────────────
// `sens` y `esp` no son decoración: son lo que permite rankear hipótesis con
// fundamento. ULTT tiene 97% de sensibilidad y 22% de especificidad, así que
// un ULTT positivo sirve para NO descartar un componente neural, nunca para
// confirmarlo. Apprehension tiene 96% de especificidad: ahí un positivo pesa.
// La capa de IA recibe estos números junto con cada resultado, para que la
// probabilidad de cada hipótesis se apoye en algo y no en cómo suena.
export const TESTS_ESP={
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

// ─── Lectura del ROM ───────────────────────────────────────────────────────
// Hay dos formatos guardados en la base: el viejo (un número suelto por
// movimiento) y el actual (un objeto con grados, si es funcional y el EVA de
// ese movimiento). `romNodo` absorbe los dos, así que las evaluaciones viejas
// se siguen leyendo.
export const romNodo=(rom,mov,region)=>{
  if(!rom)return null;
  if(region&&rom[region]&&typeof rom[region]==='object'&&!('grados' in rom[region]))return rom[region][mov]??null;
  return rom[mov]??null;
};

export const romGrados=(rom,mov,region)=>{const r=romNodo(rom,mov,region);if(r==null)return null;return typeof r==='object'?r.grados:r;};

export const romObjDe=(rom,mov,region)=>{const r=romNodo(rom,mov,region);return (typeof r==='object'&&r)||{};};

export const calcROMpct=(rom,region)=>{const norms=ROM_NORMS[region];if(!norms||!rom)return null;let t=0,c=0;norms.forEach(n=>{const v=parseFloat(romGrados(rom,n.mov,region));if(!isNaN(v)&&n.normal>0){t+=Math.min(v/n.normal*100,100);c++;}});return c>0?Math.round(t/c):null;};

export const calcROMpctMulti=(rom,regiones)=>{const ps=(regiones||[]).map(r=>calcROMpct(rom,r)).filter(v=>v!=null);return ps.length?Math.round(ps.reduce((a,b)=>a+b,0)/ps.length):null;};

// ─── Escalas ───────────────────────────────────────────────────────────────
// DN4 ≥4/7 sugiere componente neuropático (Bouhassira 2005). Es el tamiz que
// separa un dolor nociceptivo de uno con participación neural, y cambia por
// completo la programación: con componente neural se empieza con sliders y no
// con tensores, y se vigila la irradiación distal antes que el EVA.
export const calcDN4=(dn4)=>Object.values(dn4||{}).filter(Boolean).length;

export const calcYBalanceDiff=(yb)=>{if(!yb)return null;const vals=['ant','pm','pl'].map(d=>[parseFloat(yb['d_'+d]||''),parseFloat(yb['i_'+d]||'')]);const diffs=vals.filter(([a,b])=>!isNaN(a)&&!isNaN(b)).map(([a,b])=>Math.abs(a-b));return diffs.length?Math.max(...diffs).toFixed(1):null;};

export const calcFMSTotal=(fms)=>Object.values(fms||{}).reduce((s,v)=>s+(parseInt(v)||0),0);

// ─── El serializador: una evaluación entera como hechos ────────────────────
// Lo que entra acá es lo único que la IA va a saber del paciente. Si un dato
// no aparece en este texto, para la IA no existe.
// "sin medir" se escribe explícitamente y NO es lo mismo que un mal resultado:
// es una medición pendiente, y la capa de IA tiene la regla de no tratarlo
// como déficit.
export const resumenClinicoMultiRegion=(pac,ev)=>{
  if(!ev)return '';
  const L=[];
  const regs=(ev.regiones&&ev.regiones.length)?ev.regiones:[ev.region||'lumbar'];
  const lbl=(rk)=>REGIONES_LIST.find(r=>r.k===rk)?.label||rk;
  L.push(`Paciente: ${pac.nombre} ${pac.apellido}`);
  L.push(`Evaluación ${ev.tipo||'inicial'} del ${ev.fecha||'—'} · evaluador: ${ev.evaluador||'—'}`);
  L.push(`REGIONES EVALUADAS (${regs.length}): ${regs.map(lbl).join(', ')} · principal: ${lbl(ev.region)}`);
  L.push('');
  L.push(`Motivo: ${ev.motivo||'—'}`);
  L.push(`Evolución: ${ev.evolucion||'—'} · Antecedentes: ${ev.antecedentes||'—'}`);
  L.push(`Objetivo del paciente: ${ev.objetivo||'—'}`);
  L.push(`DOLOR: EVA reposo ${ev.eva_reposo||'—'}/10 · EVA movimiento ${ev.eva_movimiento||'—'}/10`);
  const rf=Object.entries(ev.redFlags||{}).filter(([,v])=>v).map(([k])=>k);
  L.push(`BANDERAS ROJAS: ${rf.length?rf.join(', '):'ninguna marcada'}`);
  const dn4=calcDN4(ev.dn4);
  if(dn4!=null)L.push(`DN4 (dolor neuropático): ${dn4}/7 — ${dn4>=4?'SUGIERE componente neuropático':'no sugiere componente neuropático'}`);

  regs.forEach(rk=>{
    L.push('');
    L.push(`══ ${lbl(rk).toUpperCase()} ══`);
    const tj=(ev.tejidos?.[rk])||(rk===ev.region?ev.tejidoSospechado:'')||'';
    L.push(`Tejido/hipótesis: ${tj||'screening amplio, sin tejido definido'}`);
    const norms=ROM_NORMS[rk]||[];
    const filas=norms.map(n=>{
      const v=romGrados(ev.rom,n.mov,rk);
      if(v==null||v==='')return null;
      const o=romObjDe(ev.rom,n.mov,rk);
      const pct=n.normal>0?Math.round(parseFloat(v)/n.normal*100):null;
      return `${n.mov} ${v}°/${n.normal}°${pct!=null?` (${pct}%)`:''}${o.funcional===false?' DISFUNCIONAL':o.funcional===true?' funcional':''}${o.eva!==undefined&&o.eva!==''?` EVA ${o.eva}`:''}`;
    }).filter(Boolean);
    L.push(filas.length?`ROM: ${filas.join(' · ')}`:'ROM: sin medir');
    const pctR=calcROMpct(ev.rom,rk);
    if(pctR!=null)L.push(`ROM promedio de la región: ${pctR}%`);
    const tests=(TESTS_ESP[rk]||[]);
    const pos=[],neg=[];
    tests.forEach(t=>['Derecho','Izquierdo'].forEach(lado=>{
      const r=ev.testsEsp?.[rk+'::'+t.n+'_'+lado] ?? ev.testsEsp?.[t.n+'_'+lado];
      if(r==='positivo')pos.push(`${t.n} (${lado})`);
      else if(r==='negativo')neg.push(`${t.n} (${lado})`);
    }));
    L.push(`Tests positivos: ${pos.length?pos.join(', '):'ninguno'}`);
    if(neg.length)L.push(`Tests negativos: ${neg.join(', ')}`);
  });

  const fz=Object.entries(ev.fuerza||{}).filter(([,v])=>v!=='' &&v!=null);
  L.push('');
  L.push(`FUERZA (MRC 0-5): ${fz.length?fz.map(([k,v])=>`${k}=${v}`).join(' · '):'sin medir'}`);
  const yb=calcYBalanceDiff(ev.ybalance);
  L.push(`Y-BALANCE: ${yb!=null?`diferencia máxima ${yb} cm`:'sin medir'}`);
  const fms=calcFMSTotal(ev.fms);
  L.push(`FMS: ${fms>0?`${fms}/21`:'sin medir'}`);
  const a=ev.antrop||{};
  L.push(`ANTROPOMETRÍA: ${a.peso?`peso ${a.peso} kg`:'peso sin registrar'}${a.talla?`, talla ${a.talla} cm`:''}${a.imc?`, IMC ${a.imc}`:''}`);
  L.push('');
  L.push(`DIAGNÓSTICO FISIOTERAPÉUTICO: ${ev.diagnosticoPT||'no registrado'}`);
  L.push(`HIPÓTESIS: ${ev.hipotesis||'no registrada'}`);
  L.push(`FASE ACTUAL: ${ev.fase||'—'} (rehab: ${ev.faseRehab||'—'})`);
  L.push(`OBJETIVOS DE TRATAMIENTO: ${ev.objetivos_tratamiento||'no registrados'}`);
  return L.join('\n');
};
