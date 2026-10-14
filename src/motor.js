// ═══════════════════════════════════════════════════════════════════════════
// motor.js — MOTOR DETERMINISTA DE EVALUACIÓN
//
// POR QUÉ EXISTE
// El análisis de una evaluación llevaba ~30 min. La app ya tenía IA para eso
// (AIAnalisisEvaluacion), pero se le pedía aritmética E interpretación al
// mismo tiempo: había que auditar cada número antes de confiar en el texto, y
// auditar cuentas ajenas cuesta casi lo mismo que hacerlas.
//
// Este módulo hace SOLO la aritmética, en JS, de forma reproducible. La IA
// después escribe prosa sobre banderas YA resueltas. Se deja de auditar
// números y se pasa a leer un texto.
//
// REGLA DE ORO — "no medido" ≠ "no cumple".
// Un criterio sin dato es una medición pendiente, no un criterio fallado.
// Confundirlos produce semáforos que parecen informados y no lo están, que es
// exactamente el modo de fallo que veníamos arrastrando (eva_reposo tapando
// eva_movimiento, columnas promovidas en null, etc.).
//
// TODAS las funciones son puras: entra data, sale objeto. Sin estado, sin red.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Escalas reales del screening del gym ──────────────────────────────────
// VERIFICADAS una por una contra los 53 clientes cargados. Cada patrón tiene
// su PROPIO vocabulario — no comparten escala. Asumir una escala única
// puntuaría mal 5 de los 6 patrones.
// Escala común de salida: 3 = óptimo · 2 = compensa/asimétrico · 1 = falla
// bilateral o marcada · 0 = no puede realizarlo.
export const CM_PATRONES = [
  { k: 'cm_squat',   label: 'Sentadilla', escala: {
      'Óptimo': 3, 'Compensaciones leves': 2, 'Compensaciones marcadas': 1, 'No puede realizarlo': 0 } },
  { k: 'cm_bisagra', label: 'Bisagra de cadera', escala: {
      'Óptimo': 3, 'Compensaciones leves': 2, 'Compensaciones marcadas': 1, 'No puede realizarlo': 0 } },
  { k: 'cm_lunge',   label: 'Zancada', escala: {
      'Óptimo D/I': 3, 'Falla derecho': 2, 'Falla izquierdo': 2, 'Falla bilateral': 1, 'No puede realizarlo': 0 },
      unilateral: true },
  { k: 'cm_sls',     label: 'Sentadilla a una pierna', escala: {
      'Estable D/I': 3, 'Inestable derecho': 2, 'Inestable izquierdo': 2, 'Inestable bilateral': 1, 'No puede realizarlo': 0 },
      unilateral: true },
  { k: 'cm_deadbug', label: 'Dead bug', escala: {
      'Óptimo': 3, 'Pierde neutro lumbar': 1, 'No puede realizarlo': 0 } },
  { k: 'cm_birddog', label: 'Bird dog', escala: {
      'Óptimo': 3, 'Rotación pélvica': 2, 'Inestabilidad marcada': 1, 'No puede realizarlo': 0 } },
];

// Detecta el lado deficitario en los patrones unilaterales
const LADO_RE = /derech/i;
const ladoDe = (valor) => {
  if (!valor) return null;
  if (/bilateral/i.test(valor)) return 'bilateral';
  if (LADO_RE.test(valor)) return 'derecho';
  if (/izquierd/i.test(valor)) return 'izquierdo';
  return null;
};

// dolorActual del screening → banda EVA equivalente
export const DOLOR_EVA = { no: 0, leve: 2, moderado: 5, intenso: 8 };

// Vigencia del dolor autoinformado en el alta. Pasado este plazo el motor lo
// considera NO MEDIDO. 60 días ≈ un ciclo de periodización.
export const VIGENCIA_SCREENING_DIAS = 60;

const num = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1) CALIDAD DE MOVIMIENTO — equivalente funcional del FMS, con lo que
//    realmente se mide en el gym: 6 patrones × 3 puntos = 18.
// ═══════════════════════════════════════════════════════════════════════════
export function calcCalidadMovimiento(screening = {}) {
  const detalle = [], faltantes = [], desconocidos = [], asimetrias = [];
  let total = 0, n = 0;
  CM_PATRONES.forEach(p => {
    const raw = screening[p.k];
    if (raw === undefined || raw === null || raw === '') { faltantes.push(p.label); return; }
    const pts = p.escala[raw];
    if (pts === undefined) { desconocidos.push(`${p.label}: "${raw}"`); return; }
    total += pts; n++;
    const lado = p.unilateral ? ladoDe(raw) : null;
    if (lado && lado !== 'bilateral') asimetrias.push({ patron: p.label, lado, valor: raw });
    detalle.push({ patron: p.label, valor: raw, puntos: pts, lado });
  });
  if (n === 0) return { medido: false, total: null, max: 0, pct: null, detalle: [], faltantes, desconocidos, asimetrias: [], deficits: [] };
  const max = n * 3;
  return {
    medido: true, total, max, n,
    pct: Math.round(total / max * 100),
    // Escalado a 21 para comparar con los umbrales tipo FMS de checkCriteriosAvance
    equivalenteFMS: Math.round(total / max * 21),
    detalle: detalle.slice().sort((a, b) => a.puntos - b.puntos),
    faltantes, desconocidos, asimetrias,
    deficits: detalle.filter(d => d.puntos <= 1).map(d => `${d.patron}: ${d.valor}`),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) Y-BALANCE — asimetría entre lados. Compuesto ant + posteromedial +
//    posterolateral. Es la única medida bilateral real que existe hoy.
// ═══════════════════════════════════════════════════════════════════════════
export function calcYBalance(screening = {}) {
  const g = (k) => num(screening[k]);
  const dAnt = g('yreach_d_ant'), iAnt = g('yreach_i_ant');
  if (dAnt === null || iAnt === null) {
    return { medido: false, difCm: null, difAntCm: null, simetrico: null };
  }
  const compD = dAnt + (g('yreach_d_pm') ?? 0) + (g('yreach_d_pl') ?? 0);
  const compI = iAnt + (g('yreach_i_pm') ?? 0) + (g('yreach_i_pl') ?? 0);
  const difAnt = Math.abs(dAnt - iAnt);
  const mayor = Math.max(compD, compI);
  return {
    medido: true,
    compD: Math.round(compD * 10) / 10,
    compI: Math.round(compI * 10) / 10,
    difCm: Math.round(Math.abs(compD - compI) * 10) / 10,
    difAntCm: Math.round(difAnt * 10) / 10,
    difPct: mayor > 0 ? Math.round(Math.abs(compD - compI) / mayor * 1000) / 10 : null,
    // Umbral habitual de riesgo en alcance anterior: > 4 cm entre lados
    simetrico: difAnt < 4,
    ladoCorto: compD < compI ? 'derecho' : 'izquierdo',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) EVA RECTOR — el dolor que gobierna la tolerancia a la carga.
//    Prioridad: incidencia de sala reciente > evaluación clínica > screening.
//    Entre reposo y movimiento manda SIEMPRE el peor (ver syncConGym).
// ═══════════════════════════════════════════════════════════════════════════
export function calcEva({ screening = {}, evaluacion = null, incidencias = [] } = {}, diasVigencia = 21) {
  const limite = Date.now() - diasVigencia * 864e5;

  const recientes = (incidencias || [])
    .filter(i => i.eva != null && new Date(i.fecha).getTime() >= limite)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (recientes.length) {
    const peor = Math.max(...recientes.map(i => num(i.eva) ?? 0));
    return { medido: true, eva: peor, origen: 'incidencia de sala', fecha: recientes[0].fecha };
  }

  if (evaluacion) {
    const r = num(evaluacion.eva_reposo) ?? num(evaluacion.data?.eva_reposo);
    const m = num(evaluacion.eva_mov) ?? num(evaluacion.eva_movimiento) ?? num(evaluacion.data?.eva_movimiento);
    if (r !== null || m !== null) {
      return {
        medido: true,
        eva: Math.max(r ?? 0, m ?? 0),
        origen: 'evaluación clínica',
        fecha: evaluacion.fecha,
        detalle: { reposo: r, movimiento: m },
      };
    }
  }

  // Último recurso: el dolorActual del screening de alta.
  // Es categórico y se toma una sola vez, así que envejece mal. Un "no"
  // de hace tres meses no dice nada sobre la tolerancia a la carga de hoy.
  // Si está vencido se reporta como NO MEDIDO, no como dolor 0: tratar un
  // dato viejo como válido es lo que promovería gente de fase a ciegas.
  const d = screening.dolorActual;
  if (d && DOLOR_EVA[d] !== undefined) {
    const fEval = screening.fechaEvaluacion ? new Date(screening.fechaEvaluacion) : null;
    let dias = fEval && !isNaN(fEval) ? Math.round((Date.now() - fEval.getTime()) / 864e5) : null;
    // Guarda contra fechas corruptas: en la base hay un "262026-12-06" que
    // producía -94.963.132 días y pasaba el control de vigencia como si fuera
    // reciente. Cualquier valor negativo o mayor a 10 años es un dato inválido,
    // no un dato viejo: se reporta como no medido.
    if (dias !== null && (dias < 0 || dias > 3650)) dias = null;
    const vencido = dias === null || dias > VIGENCIA_SCREENING_DIAS;
    if (vencido) {
      return {
        medido: false, eva: null, origen: 'screening vencido',
        aproximado: true, dias,
        motivo: dias === null
          ? 'El screening no tiene fecha — no se puede saber si el dato sigue vigente'
          : `El dato de dolor tiene ${dias} días (vence a los ${VIGENCIA_SCREENING_DIAS}). Hace falta un dato nuevo.`,
      };
    }
    return { medido: true, eva: DOLOR_EVA[d], origen: `screening (dolor ${d}, ${dias} días)`, aproximado: true, dias };
  }
  return { medido: false, eva: null, origen: null };
}


// ═══════════════════════════════════════════════════════════════════════════
// 3-bis) ROM DEL GIMNASIO
//
// El screening del gym carga ángulos articulares en `mov_*_grados` como texto
// libre ("Der 180 / Izq 180"). Hasta ahora el motor solo leía `rom_pct` de las
// evaluaciones clínicas de FisioActiva — y como ningún cliente del gym tiene
// paciente de fisio vinculado, ROM salía "sin medir" incluso para quien tenía
// los siete movimientos cargados. El informe PDF sí los mostraba: la pantalla
// y el motor decían cosas distintas sobre el mismo cliente.
//
// Referencias normativas alineadas con las del informe.
// ═══════════════════════════════════════════════════════════════════════════
// `mdc` = cambio mínimo detectable, en GRADOS. Es el piso por debajo del cual
// una diferencia entre lados no se distingue del error del instrumento, así
// que no se puede llamar asimetría. Sin este piso, el criterio del 15% sobre
// movimientos de arco corto exige una precisión que ningún método tiene:
// en rotación interna de cadera, 15% de 40° son 6°, y el MDC publicado para
// goniometría de rotación de cadera es de 6,1° a 8,6° (Gradoz 2018,
// J Sport Rehabil, DOI 10.1123/jsr.2017-0243). O sea que el umbral estaba
// apoyado exactamente sobre el piso de ruido. Peor: la confiabilidad
// INTER-evaluador para rotaciones de cadera es pobre (ICC -0,33 a 0,04,
// Stołowski 2023, Sensors, DOI 10.3390/s23218782), así que medir más
// despacio y a mano tampoco compra esa precisión.
//
// `corte` = umbral absoluto de limitación cuando el movimiento tiene un punto
// de corte clínico establecido. Tiene prioridad sobre el 80% de la referencia,
// que es una heurística buena para arcos largos y mala para arcos cortos.
//
// `maxPlausible` = techo anatómico. Un valor por encima no es una medición
// fuera de rango: es una medición de otra cosa. Se excluye del promedio en vez
// de aportar un 100% falso.
export const ROM_GYM = [
  { k: 'mov_hombro_flex', label: 'Flexión de hombro',            ref: 180, mdc: 8  },
  { k: 'mov_hombro_re',   label: 'Rotación externa de hombro',   ref: 90,  mdc: 8  },
  { k: 'mov_hombro_ri',   label: 'Rotación interna de hombro',   ref: 70,  mdc: 8  },
  { k: 'mov_tor_rot',     label: 'Rotación torácica',            ref: 45,  mdc: 8  },
  { k: 'mov_cad_flex',    label: 'Flexión de cadera',            ref: 120, mdc: 10 },

  // ─── Rotación de cadera ────────────────────────────────────────────────────
  // Protocolo: prono, rodillas a 90°, dejando caer las tibias. Hacia afuera =
  // rotación INTERNA; cruzando hacia la línea media = rotación EXTERNA.
  // En prono se mide más rango rotacional que en sedestación y en supino
  // (Bierma-Zeinstra 1998, Clin Rehabil, DOI 10.1191/026921598677459668), y
  // las posiciones no son intercambiables: una referencia tomada de
  // sedestación no aplica acá.
  //
  // POR QUÉ NO ALCANZA CON LA RI SOLA: medida sobre los 66 registros de la
  // base, la RI va de 13° a 68° con un CV del 36%, contra 15-19% de las
  // rotaciones de hombro en la misma población. Esa dispersión es versión
  // femoral — anteversión sube la RI y baja la RE, retroversión lo inverso —
  // y es hueso, no tejido blando. Con un umbral absoluto sobre la RI quedaba
  // marcado el 55% de los clientes como limitados, mezclando restricción real
  // con arquitectura normal. Prescribir movilidad contra una retroversión no
  // mejora la cadera: el segmento que cede es el lumbar.
  //
  // El discriminador es el ARCO TOTAL (RI + RE): la cadera retrovertida tiene
  // RI baja, RE alta y arco normal; la restringida tiene el arco reducido.
  { k: 'mov_cad_rot',     label: 'Rotación interna de cadera',   ref: 45,  mdc: 8,
    arco: { par: 'mov_cad_rot_ext', min: 70, etiqueta: 'Arco de rotación de cadera' } },
  { k: 'mov_cad_rot_ext', label: 'Rotación externa de cadera',   ref: 45,  mdc: 8  },

  // ─── Tobillo ───────────────────────────────────────────────────────────────
  // Protocolo nuevo: test de lunge en carga (WBLT) con ángulo calculado por
  // trigonometría sobre el segmento tibial. Es el método más repetible de los
  // cinco comparados: ICC 0,98 y MDC 1,7° para un lado, ICC 0,85 y MDC 2,1°
  // para la asimetría (Howe 2020, Int J Sports Phys Ther, PMC7015029), contra
  // más de 6° de error del inclinómetro (Langarika-Rocafort 2016, Phys Ther
  // Sport, DOI 10.1016/j.ptsp.2016.06.010). Dos landmarks, plano sagital: lo
  // mide el estimador de pose mejor que el goniómetro.
  // Bandas y umbral de asimetría según el protocolo de Manu (14/10/2026),
  // medido con regla desde el maléolo externo hasta la rodilla:
  //   ≥35° óptimo · 30-35° funcional pero limitado · <30° disfuncional
  //   ≥4° de diferencia entre lados = asimetría relevante
  // El criterio de asimetría es ABSOLUTO y reemplaza al 15% relativo: 15% de
  // 38° serían 5,7°, más permisivo que el criterio clínico. Y 4° está por
  // encima del MDC del método dentro de una misma sesión (2,1° para la
  // asimetría, Howe 2020), así que es detectable.
  //
  // OJO con el seguimiento entre sesiones: medido a mano con regla, el MDC del
  // WBLT sube a 4,6-4,7° (Powden 2015, DOI 10.1016/j.math.2015.01.004). Un
  // cambio de 4° entre una evaluación y la siguiente NO es distinguible del
  // error si se midió a mano; medido por pose, sí (MDC 1,7°).
  { k: 'mov_tobillo_wblt', label: 'Dorsiflexión de tobillo (WBLT)', ref: 38,
    bandas: [{ bajo: 30, nivel: 'disfuncional' }, { bajo: 35, nivel: 'funcional pero limitado' }],
    asimAbs: 4, mdc: 2 },

  // Protocolo viejo: campo `mov_tobillo`. Se conserva SOLO para no perder el
  // histórico. El cálculo anterior tomaba el ángulo rodilla-tobillo-dedos y le
  // restaba 90, pero ese ángulo ya vale 110-125° con el tobillo en neutro
  // porque el vector apunta a la punta del pie. Resultado medido sobre los 30
  // clientes cargados: mediana 41°, máximo 56°, y 59 de 60 mediciones por
  // encima del techo anatómico del movimiento. Lo que quedó registrado es, en
  // buena parte, el largo del pie. Nunca disparó una limitación: 0 de 60.
  //
  // Los dos métodos NO son intercambiables — Langarika-Rocafort midió sesgos
  // de 1,93° a 14,42° entre métodos del propio WBLT. Por eso el campo es otro
  // y no la misma clave con otra referencia: si compartieran clave, la primera
  // reevaluación de cada cliente mostraría una "mejora" de 20° que sería puro
  // cambio de instrumento.
  { k: 'mov_tobillo', label: 'Dorsiflexión de tobillo (protocolo anterior)',
    ref: 20, mdc: 5, legacy: true, maxPlausible: 25 },
];

// Los grados vienen como texto libre y sin formato uniforme.
// Verificado contra los 13 formatos presentes en la base.
export function parseGrados(t) {
  if (!t) return { der: null, izq: null };
  const d = /de?r\.?\s*:?\s*(\d+(?:[.,]\d+)?)/i.exec(t);
  const i = /izq\.?\s*:?\s*(\d+(?:[.,]\d+)?)/i.exec(t);
  if (d || i) return { der: d ? num(d[1]) : null, izq: i ? num(i[1]) : null };
  const solo = /(\d+(?:[.,]\d+)?)/.exec(t);
  return { der: solo ? num(solo[1]) : null, izq: null };
}

export function calcROMGym(screening = {}) {
  const detalle = [], limitados = [], asimetrias = [], invalidos = [];
  // `estructurales`: déficit explicado por arquitectura ósea, no entrenable.
  // `ambiguos`: falta el componente opuesto para poder decidir.
  const estructurales = [], ambiguos = [];
  // Movimientos que se juzgan por el arco combinado y NO por su propio valor
  // absoluto. Si emitieran las dos cosas, una RI de 35° con RE de 35° daría
  // arco normal de 70° y además dos limitaciones por el 80% de la referencia:
  // tres veredictos contradictorios sobre la misma cadera.
  const porArco = new Set();
  ROM_GYM.filter(m => m.arco).forEach(m => { porArco.add(m.k); porArco.add(m.arco.par); });
  let suma = 0, n = 0;
  // Si el tobillo ya está medido con el protocolo nuevo, el campo viejo no
  // vuelve a entrar al cálculo: queda solo como histórico.
  const tieneWBLT = parseGrados(screening['mov_tobillo_wblt_grados']).der != null;

  ROM_GYM.forEach(m => {
    const { der, izq } = parseGrados(screening[m.k + '_grados']);
    const lados = [der, izq].filter(v => v != null);
    if (!lados.length) return;
    if (m.legacy && tieneWBLT) return;

    // Un valor por encima del techo anatómico no es movilidad excepcional:
    // es otra medición metida en el campo. No se promedia ni se interpreta.
    if (m.maxPlausible != null && Math.max(...lados) > m.maxPlausible) {
      invalidos.push({
        mov: m.label, der, izq, max: m.maxPlausible,
        motivo: `${der ?? '–'}°/${izq ?? '–'}° supera el techo anatómico de ${m.maxPlausible}°`,
      });
      return;
    }

    lados.forEach(v => { suma += Math.min(v / m.ref * 100, 100); n++; });
    const peor = Math.min(...lados);
    const pct = Math.round(Math.min(peor / m.ref * 100, 100));
    detalle.push({ mov: m.label, der, izq, ref: m.ref, pct });

    // Bandas clínicas si el movimiento las tiene (se evalúa de peor a mejor);
    // si no, punto de corte absoluto; si no, 80% de la referencia.
    if (porArco.has(m.k)) {
      // El veredicto lo da el bloque de arco, más abajo.
    } else if (m.bandas) {
      const banda = [...m.bandas].sort((a, b) => a.bajo - b.bajo).find(b => peor < b.bajo);
      if (banda) limitados.push(`${m.label}: ${peor}° — ${banda.nivel} (<${banda.bajo}°)`);
    } else {
      const umbral = m.corte != null ? m.corte : 0.8 * m.ref;
      if (peor < umbral) {
        limitados.push(m.corte != null
          ? `${m.label}: ${peor}° (corte <${m.corte}°)`
          : `${m.label}: ${pct}% del rango normal`);
      }
    }

    if (der != null && izq != null) {
      const may = Math.max(der, izq);
      const dif = Math.abs(der - izq);
      const difPct = may > 0 ? dif / may * 100 : 0;
      // Dos criterios posibles. `asimAbs` = umbral clínico en grados, y manda
      // solo. Si no, relativo Y absoluto: el 15% por sí mismo no alcanza —
      // sobre arcos cortos se cumple con diferencias que caen dentro del error
      // del instrumento.
      const marca = m.asimAbs != null
        ? dif >= m.asimAbs
        : (difPct >= 15 && dif >= (m.mdc ?? 0));
      if (marca) asimetrias.push({
        mov: m.label, der, izq, dif,
        difPct: Math.round(difPct * 10) / 10,
        mdc: m.mdc ?? 0,
        criterio: m.asimAbs != null ? `≥${m.asimAbs}°` : '≥15%',
        ladoCorto: der < izq ? 'derecho' : 'izquierdo',
      });
    }
  });

  // ─── Arco de rotación: separa restricción real de versión femoral ─────────
  // Una cadera retrovertida tiene RI baja, RE alta y arco total normal. Una
  // cadera restringida tiene el arco reducido. Sin los dos componentes, una RI
  // baja es ambigua y no se puede decidir si el déficit es entrenable.
  ROM_GYM.filter(m => m.arco).forEach(m => {
    const a = parseGrados(screening[m.k + '_grados']);
    const b = parseGrados(screening[m.arco.par + '_grados']);
    const otro = ROM_GYM.find(x => x.k === m.arco.par);
    ['der', 'izq'].forEach(lado => {
      if (a[lado] == null) return;
      const nombreLado = lado === 'der' ? 'derecha' : 'izquierda';
      // Sin el componente de rotación externa no se puede interpretar.
      if (b[lado] == null) {
        if (a[lado] < 0.8 * m.ref) ambiguos.push({
          mov: m.label, lado: nombreLado, valor: a[lado],
          motivo: `${a[lado]}° de ${m.label.toLowerCase()} (${nombreLado}) sin ${otro?.label.toLowerCase() || 'el componente opuesto'}: `
                + `no se puede distinguir restricción de versión femoral. Falta medir el arco completo.`,
        });
        return;
      }
      const arco = a[lado] + b[lado];
      detalle.push({ mov: `${m.arco.etiqueta} (${nombreLado})`, der: null, izq: null,
                     ref: m.arco.min, pct: Math.round(Math.min(arco / m.arco.min * 100, 100)), arco });
      const refRI = m.ref, refRE = otro?.ref ?? m.ref;
      if (arco < m.arco.min) {
        limitados.push(`${m.arco.etiqueta} ${nombreLado}: ${arco}° (RI ${a[lado]}° + RE ${b[lado]}°, mínimo ${m.arco.min}°) — restricción real`);
      } else if (a[lado] < 0.8 * refRI && b[lado] >= refRE) {
        // Arco normal, RI baja y RE por encima de su referencia: la movilidad
        // total está y lo que cambia es el reparto. Eso es geometría del cuello
        // femoral, no tejido blando, y no es un objetivo de movilidad.
        // Hace falta que la RE esté ALTA: si ambas están bajas con arco apenas
        // suficiente, no es un patrón de versión — es un arco en el límite.
        estructurales.push({
          mov: m.label, lado: nombreLado, ri: a[lado], re: b[lado], arco,
          nota: `RI ${a[lado]}° con RE ${b[lado]}° y arco de ${arco}° (normal ≥${m.arco.min}°): `
              + `compatible con retroversión femoral, no con restricción de tejido blando. `
              + `No prescribir movilidad rotacional por este hallazgo. `
              + `Para confirmarlo: test de Craig en la misma posición de prono.`,
        });
      } else if (b[lado] < 0.8 * refRE && a[lado] >= refRI) {
        estructurales.push({
          mov: otro?.label || 'Rotación externa de cadera', lado: nombreLado, ri: a[lado], re: b[lado], arco,
          nota: `RE ${b[lado]}° con RI ${a[lado]}° y arco de ${arco}° (normal ≥${m.arco.min}°): `
              + `compatible con anteversión femoral, no con restricción de tejido blando. `
              + `Para confirmarlo: test de Craig en la misma posición de prono.`,
        });
      }
    });
  });

  if (n === 0) return { medido: false, pct: null, detalle: [], limitados: [], asimetrias: [], invalidos, estructurales, ambiguos };
  return {
    medido: true,
    pct: Math.round(suma / n),
    detalle: detalle.sort((a, b) => a.pct - b.pct),
    limitados, asimetrias, invalidos, estructurales, ambiguos, n,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) BANDERAS CLÍNICAS
// ═══════════════════════════════════════════════════════════════════════════
export function calcBanderas(screening = {}, incidencias = []) {
  const activas = [];
  if (screening.banderaRoja === 'si')    activas.push({ nivel: 'roja',    texto: 'Bandera roja en screening' });
  if (screening.banderaNaranja === 'si') activas.push({ nivel: 'naranja', texto: 'Bandera naranja en screening' });
  if (screening.banderaAmarilla === 'si')activas.push({ nivel: 'amarilla',texto: 'Bandera amarilla en screening' });
  (incidencias || [])
    .filter(i => i.bandera_activa && !i.resuelto)
    .forEach(i => activas.push({
      nivel: 'roja',
      texto: `Incidencia sin resolver — ${i.ejercicio_nombre || 'sin ejercicio'} (${new Date(i.fecha).toLocaleDateString('es-UY')})`,
    }));
  return { hay: activas.length > 0, activas, bloqueante: activas.some(a => a.nivel === 'roja') };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) ASIMETRÍA DE FUERZA
//    Hoy NO es computable: no hay tests bilaterales cargados (bench, squat,
//    deadlift, hip thrust, dominadas, remo, press militar — todos bilaterales
//    de barra). Devolver `medido:false` en vez de un número inventado.
// ═══════════════════════════════════════════════════════════════════════════
export function calcAsimetriaFuerza(tests = []) {
  const uni = (tests || []).filter(t => /izq|der|unilat|single|una pierna|un brazo/i.test(t.test_nombre || ''));
  if (uni.length < 2) {
    return { medido: false, pct: null, motivo: 'No hay tests unilaterales cargados' };
  }
  const izq = uni.filter(t => /izq/i.test(t.test_nombre)).map(t => num(t.rm1_calculado ?? t.rm1_real)).filter(Boolean);
  const der = uni.filter(t => /der/i.test(t.test_nombre)).map(t => num(t.rm1_calculado ?? t.rm1_real)).filter(Boolean);
  if (!izq.length || !der.length) return { medido: false, pct: null, motivo: 'Falta un lado' };
  const mi = Math.max(...izq), md = Math.max(...der), may = Math.max(mi, md);
  return { medido: true, pct: Math.round(Math.abs(mi - md) / may * 1000) / 10, izq: mi, der: md };
}


// ═══════════════════════════════════════════════════════════════════════════
// 10) FEEDBACK DEL PORTAL — RPE percibido, energía y molestia
// El cliente reporta al terminar cada sesión. Es el único dato del sistema que
// viene del propio cliente y no de una medición del profesional: dice cómo se
// siente la carga que prescribimos, que es distinto de cuánta carga movió.
// ═══════════════════════════════════════════════════════════════════════════
export function calcFeedback(feedback = [], dias = 28) {
  const limite = Date.now() - dias * 864e5;
  const recientes = (feedback || []).filter(f => f.fecha && new Date(f.fecha + 'T12:00').getTime() >= limite);
  if (!recientes.length) return { medido: false, n: 0 };

  const prom = (k) => {
    const v = recientes.map(f => num(f[k])).filter(x => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
  };
  const rpe = prom('rpe_sesion'), energia = prom('energia'), dolor = prom('dolor');
  const conDolor = recientes.filter(f => num(f.dolor) >= 4);

  // Lectura de la carga percibida. Referencia habitual de RPE de sesión:
  // 5-7 sostenible, 8+ sostenido indica acumulación de fatiga.
  let lectura = null, ajuste = null;
  if (rpe != null) {
    if (rpe >= 8.5) { lectura = 'Carga percibida muy alta de forma sostenida'; ajuste = 'bajar'; }
    else if (rpe >= 7.5) { lectura = 'Carga exigente — sostenible solo por bloques cortos'; ajuste = 'vigilar'; }
    else if (rpe <= 5) { lectura = 'Carga percibida baja: hay margen para progresar'; ajuste = 'subir'; }
    else { lectura = 'Carga percibida en rango sostenible'; ajuste = 'mantener'; }
  }
  return {
    medido: true, n: recientes.length, rpe, energia, dolor, lectura, ajuste,
    sesionesConDolor: conDolor.length,
    notas: recientes.filter(f => (f.nota || '').trim()).slice(0, 5).map(f => ({ fecha: f.fecha, nota: f.nota })),
    tendencia: (() => {
      const ord = recientes.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      if (ord.length < 4) return null;
      const mitad = Math.floor(ord.length / 2);
      const p = (arr) => { const v = arr.map(f => num(f.rpe_sesion)).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const a = p(ord.slice(0, mitad)), b = p(ord.slice(mitad));
      if (a == null || b == null) return null;
      const d = Math.round((b - a) * 10) / 10;
      return { delta: d, texto: d >= 1 ? `El esfuerzo percibido SUBIÓ ${d} puntos: puede ser progreso de carga o fatiga acumulada` : d <= -1 ? `El esfuerzo percibido BAJÓ ${Math.abs(d)} puntos: la misma carga se siente más fácil` : 'Esfuerzo percibido estable' };
    })(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) COMPUTAR TODAS LAS MÉTRICAS
// ═══════════════════════════════════════════════════════════════════════════
export function computarMetricas(cliente = {}, { evaluacion = null, tests = [], incidencias = [], feedback = [] } = {}) {
  const sc = cliente.screening || {};
  const incCliente = (incidencias || []).filter(i => i.gym_client_id === cliente.id);

  const calidad  = calcCalidadMovimiento(sc);
  const ybalance = calcYBalance(sc);
  const evaR     = calcEva({ screening: sc, evaluacion, incidencias: incCliente });
  const banderas = calcBanderas(sc, incCliente);
  const fuerza   = calcAsimetriaFuerza(tests);
  const fb       = calcFeedback(feedback);

  // ROM %: prioriza la evaluación clínica (goniometría formal) y cae al ROM
  // del screening del gym si no hay paciente de fisio vinculado.
  const romGym = calcROMGym(sc);
  const romPct = evaluacion?.rom_pct ?? (romGym.medido ? romGym.pct : null);
  const romOrigen = evaluacion?.rom_pct != null ? 'evaluación clínica'
                  : romGym.medido ? 'screening del gimnasio' : null;

  return {
    calidad, ybalance, eva: evaR, banderas, fuerza, romPct, romGym, romOrigen, feedback: fb,
    // Forma que espera checkCriteriosAvance()
    paraCheck: {
      eva: evaR.medido ? evaR.eva : null,
      romPct,
      ybDiff: ybalance.medido ? ybalance.difAntCm : null,
      fmsTotal: calidad.medido ? calidad.equivalenteFMS : null,
      fuerzaAsimetria: fuerza.medido ? fuerza.pct : null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) VEREDICTO DE AVANCE
//    Separa explícitamente tres estados por criterio: cumple / no cumple /
//    sin medir. El avance solo se propone si TODOS los medibles cumplen y no
//    queda ninguno sin medir.
// ═══════════════════════════════════════════════════════════════════════════
export function evaluarAvance(fase, metricas, checkFn) {
  const res = checkFn(fase, metricas.paraCheck, metricas) || [];
  // ORDEN IMPORTANTE: la ausencia de dato se evalúa PRIMERO. Si el valor es
  // '—' el criterio está SIN MEDIR, sin importar qué devuelva `pass`.
  // (Bug corregido: antes un pass=null por falta de dato se clasificaba como
  // 'clinico' — o sea, "listo, solo falta tu firma" — cuando en realidad no
  // se había medido nada. Es exactamente el error que este motor evita.)
  const clasificados = res.map(r => {
    const sinDato = r.val === '—' || r.val == null || r.val === '';
    return {
      ...r,
      estado: sinDato ? 'sin_medir'
            : r.pass === true  ? 'cumple'
            : r.pass === false ? 'no_cumple'
            : 'clinico',   // pass === null CON dato → requiere criterio profesional
    };
  });

  const cumplen   = clasificados.filter(c => c.estado === 'cumple');
  const noCumplen = clasificados.filter(c => c.estado === 'no_cumple');
  const sinMedir  = clasificados.filter(c => c.estado === 'sin_medir');
  const clinicos  = clasificados.filter(c => c.estado === 'clinico');

  let veredicto, resumen;
  if (metricas.banderas.bloqueante) {
    veredicto = 'bloqueado';
    resumen = 'Bandera clínica activa — no evaluar avance hasta resolverla.';
  } else if (noCumplen.length > 0) {
    veredicto = 'no_avanza';
    resumen = `Falta cumplir ${noCumplen.length} criterio${noCumplen.length > 1 ? 's' : ''}: ${noCumplen.map(c => c.label).join(', ')}.`
            + (sinMedir.length ? ` Además falta medir: ${sinMedir.map(c => c.label).join(', ')}.` : '');
  } else if (sinMedir.length > 0) {
    veredicto = 'faltan_datos';
    resumen = `Cumple todo lo medido, pero falta medir ${sinMedir.length}: ${sinMedir.map(s => s.label).join(', ')}.`;
  } else if (clinicos.length > 0) {
    veredicto = 'listo_con_criterio';
    resumen = 'Todos los criterios objetivos cumplen. Queda tu confirmación clínica.';
  } else {
    veredicto = 'listo';
    resumen = 'Todos los criterios cumplen.';
  }

  return { veredicto, resumen, criterios: clasificados, cumplen, noCumplen, sinMedir, clinicos };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8) RESUMEN PARA LA IA
//    Bloque de HECHOS YA CALCULADOS. La IA no vuelve a hacer una sola cuenta:
//    solo redacta sobre esto. Ese es el ahorro de tiempo de revisión.
// ═══════════════════════════════════════════════════════════════════════════
export function resumenDeterminista(cliente, metricas, avance) {
  const L = [];
  L.push(`Cliente: ${cliente.nombre} ${cliente.apellido} · Fase actual: ${(cliente.nivel || '—').toUpperCase()}`);
  L.push(`Objetivo declarado: ${cliente.objetivo || cliente.screening?.objetivoPrincipal || '—'}`);

  const e = metricas.eva;
  L.push(e.medido
    ? `DOLOR: EVA ${e.eva}/10 (fuente: ${e.origen}${e.detalle ? `; reposo ${e.detalle.reposo ?? '—'} / movimiento ${e.detalle.movimiento ?? '—'}` : ''})`
    : `DOLOR: sin medir`);

  const c = metricas.calidad;
  L.push(c.medido
    ? `CALIDAD DE MOVIMIENTO: ${c.total}/${c.max} (${c.pct}%). Peores patrones: ${c.detalle.slice(0, 3).map(d => `${d.patron}=${d.valor}`).join('; ')}`
    : `CALIDAD DE MOVIMIENTO: sin medir`);
  if (c.faltantes?.length) L.push(`  · patrones sin evaluar: ${c.faltantes.join(', ')}`);

  const y = metricas.ybalance;
  L.push(y.medido
    ? `Y-BALANCE: compuesto D ${y.compD} / I ${y.compI} · alcance anterior dif. ${y.difAntCm} cm — ${y.simetrico ? 'simétrico' : `ASIMÉTRICO, lado corto ${y.ladoCorto}`}`
    : `Y-BALANCE: sin medir`);

  if (metricas.romPct != null) {
    L.push(`ROM: ${metricas.romPct}% del rango normativo (fuente: ${metricas.romOrigen})`);
    const rg = metricas.romGym;
    if (rg?.medido) {
      if (rg.limitados.length) L.push(`  · limitados: ${rg.limitados.join('; ')}`);
      if (rg.asimetrias.length) L.push(`  · asimetrías ≥15% y por encima del error de medición: ${rg.asimetrias.map(a => `${a.mov} D ${a.der}° / I ${a.izq}° (${a.difPct}%, ${a.dif}°, corto ${a.ladoCorto})`).join('; ')}`);
      if (rg.estructurales?.length) L.push(`  · déficit NO entrenable (arquitectura ósea): ${rg.estructurales.map(e => `${e.mov} ${e.lado} — ${e.nota}`).join(' | ')}`);
      if (rg.ambiguos?.length) L.push(`  · sin interpretar: ${rg.ambiguos.map(a => a.motivo).join(' | ')}`);
      if (rg.invalidos?.length) L.push(`  · SIN MEDIR por protocolo inválido: ${rg.invalidos.map(i => `${i.mov} (${i.motivo})`).join('; ')}`);
    }
  } else L.push(`ROM: sin medir`);
  L.push(metricas.fuerza.medido ? `ASIMETRÍA DE FUERZA: ${metricas.fuerza.pct}%` : `ASIMETRÍA DE FUERZA: ${metricas.fuerza.motivo}`);

  const fb2 = metricas.feedback;
  if (fb2?.medido) {
    L.push(`PERCEPCIÓN DEL CLIENTE (${fb2.n} sesiones reportadas desde el portal):`);
    L.push(`  · RPE de sesión promedio: ${fb2.rpe}/10 — ${fb2.lectura}`);
    if (fb2.energia != null) L.push(`  · Energía con la que llega: ${fb2.energia}/5`);
    if (fb2.dolor != null && fb2.dolor > 0) L.push(`  · Molestia promedio: ${fb2.dolor}/10${fb2.sesionesConDolor ? ` · ${fb2.sesionesConDolor} sesiones con molestia ≥4` : ''}`);
    if (fb2.tendencia) L.push(`  · ${fb2.tendencia.texto}`);
    fb2.notas.forEach(n => L.push(`  · Nota del cliente (${n.fecha}): "${n.nota}"`));
  } else L.push('PERCEPCIÓN DEL CLIENTE: sin reportes de RPE desde el portal');
  if (metricas.banderas.hay) L.push(`BANDERAS: ${metricas.banderas.activas.map(a => `[${a.nivel}] ${a.texto}`).join(' · ')}`);
  else L.push(`BANDERAS: ninguna activa`);

  L.push(`VEREDICTO DE AVANCE (calculado): ${avance.veredicto.toUpperCase()} — ${avance.resumen}`);
  avance.criterios.forEach(cr => L.push(`  · ${cr.label}: ${cr.val} → ${cr.estado}`));

  return L.join('\n');
}

// Prompt para la capa interpretativa. Prohíbe explícitamente recalcular.
export const PROMPT_INTERPRETACION = `Sos fisioterapeuta y preparador físico. Abajo hay un bloque de HECHOS YA CALCULADOS sobre un cliente.

REGLAS ESTRICTAS:
1. NO recalcules ningún número. Los valores del bloque son definitivos.
2. NO inventes datos. Si algo dice "sin medir", tratalo como pendiente de medición, NUNCA como un mal resultado.
3. NO contradigas el VEREDICTO DE AVANCE.

Redactá en español rioplatense (voseo), tono profesional y directo, sin relleno:
- INTERPRETACIÓN (3-4 oraciones): qué significa este cuadro en conjunto.
- PRIORIDADES (máximo 3, ordenadas): en qué enfocar el entrenamiento, con el porqué.
- PRECAUCIONES: qué evitar o regresar, si corresponde. Si no hay, decilo.
- QUÉ FALTA MEDIR: listá lo pendiente y por qué importa. Omitir si no falta nada.`;


// ═══════════════════════════════════════════════════════════════════════════
// 9) CRITERIOS DE AVANCE PARA CLIENTES DE GIMNASIO
//
// PROBLEMA DETECTADO al correr el motor contra los 53 clientes reales:
// checkCriteriosAvance() exige "ROM > 85%", y rom_pct solo existe si el
// cliente tiene una evaluación clínica de FisioActiva. Hoy 0 de 53 clientes
// del gym tienen paciente de fisio vinculado. Resultado: el criterio queda
// SIEMPRE "sin medir" y NINGÚN cliente puede alcanzar el veredicto "listo".
// Los criterios estaban diseñados para el recorrido clínico y se aplicaban
// al recorrido del gimnasio. Por eso el panel de avance quedó sin usar:
// solo 3 de 53 clientes tienen criterios tildados a mano.
//
// Esta versión usa lo que el gimnasio SÍ mide: dolor, calidad de movimiento
// (6 patrones) y Y-Balance. ROM pasa a ser opcional: suma si existe, no
// bloquea si no. checkCriteriosAvance() queda intacta para el lado clínico.
// ═══════════════════════════════════════════════════════════════════════════
export function checkCriteriosGym(fase, m) {
  const r = [];
  const cal = m.calidad, yb = m.ybalance, ev = m.eva;
  const evaOk = (max) => ev.medido ? ev.eva <= max : null;
  const pushEva = (max) => r.push({
    label: `Dolor EVA ≤ ${max}/10`,
    pass: evaOk(max),
    val: ev.medido ? `${ev.eva}/10` : '—',
  });
  const pushCal = (min) => r.push({
    label: `Calidad de movimiento ≥ ${min}%`,
    pass: cal.medido ? cal.pct >= min : null,
    val: cal.medido ? `${cal.pct}% (${cal.total}/${cal.max})` : '—',
  });
  const pushYb = (max) => r.push({
    label: `Y-Balance: diferencia anterior < ${max} cm`,
    pass: yb.medido ? yb.difAntCm < max : null,
    val: yb.medido ? `${yb.difAntCm} cm` : '—',
  });
  const pushSim = () => r.push({
    label: 'Sin asimetría unilateral en patrones',
    pass: cal.medido ? cal.asimetrias.length === 0 : null,
    val: cal.medido ? (cal.asimetrias.length ? cal.asimetrias.map(a => `${a.patron} (${a.lado})`).join(', ') : 'Simétrico') : '—',
  });

  if (fase === 'restaura') { pushEva(3); pushCal(50); }
  if (fase === 'activa')   { pushEva(2); pushCal(70); pushYb(6); }
  if (fase === 'potencia') { pushEva(2); pushCal(85); pushYb(4); pushSim(); }
  if (fase === 'rinde')    { pushEva(1); pushCal(90); pushYb(4); pushSim(); }

  // ROM: opcional. Suma si existe, no bloquea si no. La etiqueta declara de
  // dónde salió, porque goniometría clínica y screening de sala no tienen la
  // misma precisión y el que lee el informe tiene que poder distinguirlas.
  if (m.romPct != null) {
    const min = fase === 'restaura' ? 70 : fase === 'activa' ? 85 : 90;
    const fuente = m.romOrigen === 'evaluación clínica' ? 'clínico' : 'screening';
    r.push({ label: `ROM > ${min}% (${fuente})`, pass: m.romPct > min, val: `${m.romPct}%` });
  }
  // Asimetría articular marcada: no bloquea el avance por sí sola, pero se
  // reporta para que quede a la vista en el informe.
  if (m.romGym?.medido && m.romGym.asimetrias.length) {
    r.push({
      label: 'Sin asimetría articular ≥15%',
      pass: false,
      val: m.romGym.asimetrias.map(a => `${a.mov} (${a.difPct}%)`).join(', '),
    });
  }
  return r;
}

// evaluarAvance espera checkFn(fase, metricas.paraCheck). checkCriteriosGym
// necesita el objeto completo, así que se adapta acá.
export const adaptadorGym = (fase, _paraCheck, metricas) => checkCriteriosGym(fase, metricas);
