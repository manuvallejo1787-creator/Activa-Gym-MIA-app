// criterios.js — Archivo compartido entre FisioActiva y ACTIVA Gym App
// Fuente única de verdad para fases, semáforos y criterios de evolución

// ─── FASES DEL MÉTODO ACTIVA INTEGRA ─────────────────────────────────────
export const FASES_METODO={
  restaura:{
    label:'RESTAURA', badge:'N0', color:'#374151', semaforo:'rojo', emoji:'🔴',
    criterios_ingreso:[
      'Dolor activo > 4/10 en reposo',
      'Déficit ROM > 30%',
      'Fuerza < 3/5 MRC',
      'Red flag descartada previamente',
    ],
    criterios_avance:[
      'EVA ≤ 3/10 en movimiento',
      'ROM > 70% del normal',
      'Fuerza ≥ 3/5 MRC',
      'Control motor básico presente',
      'Sin signos inflamatorios activos',
    ],
    objetivos:[
      'Control del dolor y la inflamación',
      'Restaurar movilidad básica',
      'Activar musculatura estabilizadora',
      'Reeducar patrones de movimiento',
      'Preparar para carga funcional',
    ],
    semaforo_avance:'amarillo',
    desc_clinica:'Fase de rehabilitación activa. Conduce el fisioterapeuta. El entrenador no interviene hasta semáforo amarillo.',
  },
  activa:{
    label:'ACTIVA', badge:'N1', color:'#1D4ED8', semaforo:'amarillo', emoji:'🟡',
    criterios_ingreso:[
      'EVA ≤ 3/10 en movimiento',
      'ROM > 70% del normal',
      'Fuerza ≥ 3/5 MRC',
      'Tolerancia a la carga básica',
    ],
    criterios_avance:[
      'EVA ≤ 2/10',
      'ROM > 85% del normal',
      'Fuerza ≥ 4/5 MRC',
      'Control motor funcional establecido',
      'Y-Balance: asimetría < 6 cm',
    ],
    objetivos:[
      'Recuperar rango de movimiento completo',
      'Fortalecer cadenas musculares primarias',
      'Mejorar control motor y propiocepción',
      'Introducir carga progresiva',
      'Integrar patrones funcionales de movimiento',
    ],
    semaforo_avance:'amarillo',
    desc_clinica:'Fase de base de movimiento. El entrenador trabaja en coordinación con el fisio. Restricciones activas documentadas.',
  },
  potencia:{
    label:'POTENCIA', badge:'N2', color:'#7C3AED', semaforo:'amarillo', emoji:'🟣',
    criterios_ingreso:[
      'EVA ≤ 2/10',
      'ROM > 85% del normal',
      'Fuerza 4/5 MRC',
      'Y-Balance: asimetría < 6 cm',
    ],
    criterios_avance:[
      'EVA ≤ 2/10',
      'ROM > 90% del normal',
      'Fuerza > 90% del lado contralateral',
      'Y-Balance: asimetría < 4 cm',
      'FMS ≥ 14/21',
    ],
    objetivos:[
      'Maximizar fuerza funcional',
      'Desarrollar potencia y velocidad',
      'Optimizar control neuromuscular',
      'Preparar retorno deportivo o laboral',
      'Periodización de carga avanzada',
    ],
    semaforo_avance:'verde',
    desc_clinica:'Fase de desarrollo de capacidades. El entrenador lidera. Fisio preventivo activo en monitoreo.',
  },
  rinde:{
    label:'RINDE', badge:'N3', color:'#CC0000', semaforo:'verde', emoji:'🔥',
    criterios_ingreso:[
      'Alta clínica funcional emitida',
      'Todos los criterios de alta cumplidos',
    ],
    criterios_avance:[
      'Mantenimiento de capacidades',
      'Prevención de recidivas',
    ],
    objetivos:[
      'Alto rendimiento deportivo o funcional',
      'Prevención primaria de lesiones',
      'Optimización del rendimiento específico',
      'Monitoreo ACWR en carga de entrenamiento',
    ],
    semaforo_avance:'verde',
    desc_clinica:'Alto rendimiento. Fisio preventivo activo. Sin restricciones de carga.',
  },
};

// ─── GENERADOR DE CRITERIOS PERSONALIZADOS ────────────────────────────────
// Toma el objetivo declarado por el paciente/cliente al inicio
// y genera criterios de evolución adaptados que condicionan el avance entre fases
export const generarCriteriosPersonalizados=(objetivo='', fase='restaura', eva_inicial='', rom_inicial_pct=null)=>{
  const obj=(objetivo||'').toLowerCase();

  // Clasificación del objetivo
  const esDeportivo=obj.includes('deport')||obj.includes('jugar')||obj.includes('correr')||
    obj.includes('fútbol')||obj.includes('entrenar')||obj.includes('competir')||
    obj.includes('rugby')||obj.includes('tenis')||obj.includes('nataci')||obj.includes('ciclismo');

  const esLaboral=obj.includes('trabajo')||obj.includes('laboral')||obj.includes('oficio')||
    obj.includes('profesion')||obj.includes('construcc')||obj.includes('carga');

  const esAVD=obj.includes('caminar')||obj.includes('subir')||obj.includes('vestir')||
    obj.includes('vida diaria')||obj.includes('actividad diaria')||obj.includes('escalera')||
    obj.includes('hijo')||obj.includes('nieto')||obj.includes('levantar');

  const esFuerza=obj.includes('fuerza')||obj.includes('hipertrofia')||obj.includes('músculo')||
    obj.includes('masa')||obj.includes('levantamiento');

  const esEstetico=obj.includes('estétic')||obj.includes('composici')||obj.includes('figura')||
    obj.includes('peso')||obj.includes('adelgaz');

  const esPreventivo=obj.includes('preveni')||obj.includes('evitar')||obj.includes('no lesion');

  // Criterios base de la fase
  const base=[...(FASES_METODO[fase]?.criterios_avance||[])];

  // Criterios específicos al objetivo
  const extras=[];

  if(fase==='restaura'){
    if(objetivo)extras.push(`Dolor vinculado al objetivo "${objetivo.slice(0,40)}" controlado: EVA ≤ 3/10 en la actividad específica`);
    if(esDeportivo)extras.push('Tolerancia a actividad aeróbica suave (caminar/trote 10-15 min) sin exacerbación');
    if(esLaboral)extras.push('Tolerancia a postura de trabajo básica sin exacerbación del cuadro');
    if(esAVD)extras.push('Realización de AVDs básicas (vestirse, ducharse, desplazarse) con EVA ≤ 3/10');
    if(eva_inicial&&parseFloat(eva_inicial)>5)extras.push(`Reducción de al menos 50% del dolor inicial (EVA inicial: ${eva_inicial}/10 → meta: ≤ ${Math.ceil(parseFloat(eva_inicial)/2)}/10)`);
  }

  if(fase==='activa'){
    if(objetivo)extras.push(`Retomar actividades intermedias relacionadas con: "${objetivo.slice(0,40)}"`);
    if(esDeportivo)extras.push('Tolerancia a trote suave continuo 15-20 min sin dolor residual');
    if(esLaboral)extras.push('Retorno parcial al trabajo con adaptaciones del puesto (50-75% de la jornada)');
    if(esAVD)extras.push('AVDs completas sin limitación funcional ni compensaciones visibles');
    if(esFuerza)extras.push('Tolerancia a carga bilateral progresiva: sentadilla y peso muerto sin dolor');
    if(esEstetico)extras.push('Tolerancia a entrenamiento de composición corporal (3 sesiones/sem) sin síntomas');
    if(eva_inicial)extras.push(`EVA reducida ≥ 60% vs. evaluación inicial (inicial: ${eva_inicial}/10)`);
  }

  if(fase==='potencia'){
    if(objetivo)extras.push(`Capacidad funcional completa para: "${objetivo.slice(0,40)}"`);
    if(esDeportivo)extras.push('Retorno progresivo al deporte específico: entrenamiento grupal sin restricciones');
    if(esLaboral)extras.push('Retorno completo al trabajo con plena capacidad funcional');
    if(esAVD)extras.push('AVDs ilimitadas incluyendo actividades de alta demanda sin restricciones');
    if(esFuerza)extras.push('Fuerza bilateral simétrica: diferencia < 10% entre lados en ejercicios de base');
    if(esPreventivo)extras.push('FMS ≥ 14/21 con patrón de movimiento sin asimetrías ≥ 1 punto');
    extras.push('Criterio de alta clínica iniciado: todos los indicadores ≥ 90%');
  }

  if(fase==='rinde'){
    if(objetivo)extras.push(`Objetivo alcanzado: "${objetivo.slice(0,60)}" — mantenimiento y prevención de recidiva`);
    extras.push('Monitoreo mensual de carga: ACWR entre 0.8 y 1.3');
    extras.push('Sin episodios de dolor > 3/10 durante 4 semanas consecutivas');
  }

  // Eliminar duplicados y devolver
  const todos=[...base,...extras];
  return todos;
};

// ─── CHEQUEO AUTOMÁTICO DE CRITERIOS ─────────────────────────────────────
// Dado un set de métricas, determina cuántos criterios se cumplen
export const checkCriteriosAvance=(fase, metricas={})=>{
  const { eva, romPct, ybDiff, fmsTotal, fuerzaAsimetria } = metricas;
  const resultados=[];

  if(fase==='restaura'){
    resultados.push({label:'EVA ≤ 3/10 en movimiento',pass:eva!=null&&parseFloat(eva)<=3,val:eva?`${eva}/10`:'—'});
    resultados.push({label:'ROM > 70%',pass:romPct!=null&&romPct>70,val:romPct?`${romPct}%`:'—'});
    resultados.push({label:'Sin signos inflamatorios activos',pass:null,val:'Evaluación clínica'});
  }
  if(fase==='activa'){
    resultados.push({label:'EVA ≤ 2/10',pass:eva!=null&&parseFloat(eva)<=2,val:eva?`${eva}/10`:'—'});
    resultados.push({label:'ROM > 85%',pass:romPct!=null&&romPct>85,val:romPct?`${romPct}%`:'—'});
    resultados.push({label:'Y-Balance < 6 cm',pass:ybDiff!=null&&parseFloat(ybDiff)<6,val:ybDiff?`${ybDiff} cm`:'—'});
  }
  if(fase==='potencia'){
    resultados.push({label:'EVA ≤ 2/10',pass:eva!=null&&parseFloat(eva)<=2,val:eva?`${eva}/10`:'—'});
    resultados.push({label:'ROM > 90%',pass:romPct!=null&&romPct>90,val:romPct?`${romPct}%`:'—'});
    resultados.push({label:'Y-Balance < 4 cm',pass:ybDiff!=null&&parseFloat(ybDiff)<4,val:ybDiff?`${ybDiff} cm`:'—'});
    resultados.push({label:'FMS ≥ 14/21',pass:fmsTotal!=null&&fmsTotal>=14,val:fmsTotal?`${fmsTotal}/21`:'—'});
    resultados.push({label:'Fuerza > 90% contralateral',pass:fuerzaAsimetria!=null&&fuerzaAsimetria<=10,val:fuerzaAsimetria!=null?`Δ${fuerzaAsimetria}%`:'—'});
  }
  return resultados;
};

// ─── MAPA DE SEMÁFORO POR FASE ────────────────────────────────────────────
export const getSemaforoPorFase=(fase)=>{
  return FASES_METODO[fase]?.semaforo||'pendiente';
};

// ─── ETIQUETA LEGIBLE DE FASE ─────────────────────────────────────────────
export const getFaseLabel=(fase)=>{
  const f=FASES_METODO[fase];
  if(!f)return fase;
  return `${f.badge} · ${f.label}`;
};
