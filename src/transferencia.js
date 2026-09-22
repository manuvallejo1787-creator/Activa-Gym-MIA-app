// ═══════════════════════════════════════════════════════════════════════════
// transferencia.js — DE UN TEST DE 1RM A LA CARGA DE CUALQUIER EJERCICIO
//
// EL PROBLEMA
// El mapa anterior asignaba ejercicios a tests por palabra clave con
// coeficiente 1. "Aperturas en banco con mancuernas" caía en el test de press
// banca y recibía la carga relativa de un press con barra. Búlgara, goblet y
// pistol recibían la de la sentadilla trasera completa; el rumano, la del peso
// muerto convencional. Y todo lo que no coincidía con una palabra clave
// (prensa, remo en polea, curls, vuelos, extensiones) devolvía null: sin
// sugerencia.
//
// EL MODELO
// Cada ejercicio se resuelve a (test de referencia, coeficiente, modo):
//   carga_1RM_estimada = coeficiente × 1RM_del_test
//   modo 'total'    → carga externa total (barra, máquina, polea)
//   modo 'por_mano' → carga por mancuerna / por lado
//   modo 'corporal' → peso corporal: no se prescribe carga externa
// Sobre esa carga estimada se aplica después el % por repeticiones de la fase.
//
// LOS COEFICIENTES
// Son aproximaciones de práctica, no constantes físicas. Varían con la
// técnica, el equipamiento (una prensa de 45° no pesa igual en todos los
// gimnasios) y la experiencia del cliente. Por eso cada regla trae su
// CONFIANZA — alta (misma cadena, variante), media (compuesto relacionado),
// baja (monoarticular desde un compuesto) — y el sistema la muestra.
// El criterio de diseño es conservador: ante la duda se sugiere MENOS. Una
// carga baja se corrige en la primera serie; una alta puede lesionar.
//
// ORDEN: lo específico va antes que lo genérico. "Press inclinado con
// mancuernas" tiene que resolverse antes que "press inclinado", y "aperturas"
// antes que "pecho".
// ═══════════════════════════════════════════════════════════════════════════

export const REGLAS_TRANSFERENCIA = [
  // ── EXCEPCIONES QUE TIENEN QUE GANAR PRIMERO ──────────────────────────
  // Encontradas corriendo el modelo contra el catálogo real: cada una era un
  // error de clasificación, varios por SOBREESTIMACIÓN de carga.
  // Sin test de referencia (test:null): se sugiere desde el historial propio
  // del cliente o se pide cargar a mano. Mejor sin número que con uno falso.
  { re: /sentadilla.*pausa|pause squat/i,                    test: 'squat', coef: 0.88, modo: 'total', conf: 'alta', nota: 'La pausa elimina el reflejo de estiramiento: ~10-15% menos.' },
  { re: /renegade/i,                                         test: 'remo_apoyo', coef: 0.25, modo: 'por_mano', conf: 'baja', nota: 'Lo limita la estabilidad en plancha, no la tracción.' },
  { re: /extensi[oó]n de espalda|hiperextensi[oó]n|banco romano/i, test: null, coef: 0, modo: 'corporal', conf: 'alta', nota: 'Peso corporal; lastrar con disco al pecho.' },
  { re: /sprint|aceleraci[oó]n|agility|cambios? de direcci[oó]n|escalera de coordinaci|crawl|reptaci[oó]n|bear|animal|get[\s-]?up/i, test: null, coef: 0, modo: 'corporal', conf: 'alta', nota: 'Se dosifica por distancia, tiempo o calidad, no por kg.' },
  { re: /gemelo|pantorrilla|calf|s[oó]leo/i,                 test: null, coef: null, modo: 'total', conf: 'baja', nota: 'Tríceps sural: sin transferencia confiable desde ningún test.' },
  { re: /banda|el[aá]stic|resistencia variable/i,            test: null, coef: null, modo: 'total', conf: 'baja', nota: 'Resistencia elástica: se dosifica por tensión de banda, no por kg.' },
  { re: /kettlebell|\bkb\b|sandbag|saco|bal[oó]n|slam|wall ball|battle|carry|trineo|sled|llanta|tire/i, test: null, coef: null, modo: 'total', conf: 'baja', nota: 'Implemento o carga balística: se elige por velocidad y técnica.' },
  { re: /fitball|pelota suiza/i,                             test: null, coef: 0, modo: 'corporal', conf: 'alta', nota: 'Peso corporal sobre superficie inestable.' },
  { re: /svend/i,                                            test: 'bench', coef: 0.08, modo: 'total', conf: 'baja', nota: 'Compresión isométrica de un disco: carga mínima.' },
  { re: /thruster.*mancuern/i,                               test: 'press_mil', coef: 0.36, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna: lo limita el press.' },
  { re: /thruster/i,                                         test: 'press_mil', coef: 0.90, modo: 'total', conf: 'media', nota: 'Lo limita el press, no la sentadilla.' },
  { re: /(clean|cargada|snatch|arrancada)(?!.*press)/i,      test: 'deadlift', coef: 0.50, modo: 'total', conf: 'baja', nota: 'Levantamiento olímpico: lo limita la técnica y la velocidad. Verificá con el cliente.' },
  { re: /sentadilla.*landmine|landmine.*sentadilla/i,        test: 'squat', coef: 0.45, modo: 'total', conf: 'baja', nota: 'Carga en el extremo de la barra.' },
  { re: /remo.*landmine|landmine.*remo/i,                    test: 'remo_apoyo', coef: 0.55, modo: 'total', conf: 'baja', nota: 'Carga en el extremo de la barra.' },
  { re: /sentadilla.*hack|hack/i,                            test: 'squat', coef: 0.90, modo: 'total', conf: 'media', nota: 'Depende de la máquina.' },
  { re: /p[aá]jaro|aperturas? invers|vuelos? poster|reverse fly|rear delt/i, test: 'press_mil', coef: 0.10, modo: 'por_mano', conf: 'baja', nota: 'Deltoides posterior: carga mínima.' },
  { re: /extensi[oó]n de cadera|patada de burro|kickback(?!.*tr[ií]ceps)|patada.*gl[uú]teo/i, test: 'hip_thrust', coef: 0.12, modo: 'total', conf: 'baja', nota: 'Monoarticular de cadera.' },
  { re: /abe?ducci[oó]n|abductor/i,                          test: 'hip_thrust', coef: 0.35, modo: 'total', conf: 'baja', nota: 'Depende de la máquina.' },
  { re: /aducci[oó]n de cadera|aductor/i,                    test: 'hip_thrust', coef: 0.30, modo: 'total', conf: 'baja', nota: 'Depende de la máquina.' },
  { re: /curl.*mu[ñn]eca|flexi[oó]n de mu[ñn]eca/i,          test: 'remo_apoyo', coef: 0.10, modo: 'total', conf: 'baja', nota: 'Antebrazo: carga mínima.' },
  { re: /(rumano|rdl|peso muerto).*(split|kickstand)/i,      test: 'deadlift', coef: 0.28, modo: 'por_mano', conf: 'media', nota: 'Split: apoyo asistido, casi unilateral.' },
  { re: /(rumano|rdl|peso muerto).*(unilateral|contralateral|ipsilateral|una pierna)/i, test: 'deadlift', coef: 0.20, modo: 'por_mano', conf: 'media', nota: 'Unilateral: limita el equilibrio.' },
  { re: /(b[uú]lgara|zancada|estocada).*barra/i,             test: 'squat', coef: 0.45, modo: 'total', conf: 'media', nota: 'Unilateral con barra: carga total.' },
  { re: /push ?press.*mancuern/i,                            test: 'press_mil', coef: 0.42, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna.' },
  { re: /jal[oó]n.*unilateral|unilateral.*jal[oó]n/i,        test: 'pull_ups', coef: 0.40, modo: 'total', conf: 'media', nota: 'Unilateral.' },
  { re: /curl.*unilateral.*polea|curl.*polea.*unilateral/i,  test: 'remo_apoyo', coef: 0.15, modo: 'total', conf: 'baja', nota: 'Unilateral en polea.' },
  { re: /press (banca|banco).*(cerrad|estrech)|close[\s-]?grip/i, test: 'bench', coef: 0.88, modo: 'total', conf: 'alta', nota: 'Agarre cerrado: más tríceps, ~10% menos.' },
  { re: /press.*(piso|suelo)|floor press/i,                  test: 'bench', coef: 0.90, modo: 'total', conf: 'alta', nota: 'Rango acortado.' },
  { re: /(rompe ?cr[aá]neo|skull ?crusher).*mancuern/i,       test: 'bench', coef: 0.12, modo: 'por_mano', conf: 'baja', nota: 'Por mancuerna.' },
  { re: /rompe ?cr[aá]neo|skull ?crusher/i,                  test: 'bench', coef: 0.25, modo: 'total', conf: 'baja', nota: 'Con mancuernas, por mancuerna ~la mitad.' },
  { re: /franc[eé]s.*mancuern(?!as)/i,                       test: 'bench', coef: 0.13, modo: 'total', conf: 'baja', nota: 'Una mancuerna.' },
  { re: /fondos.*lastr|dips.*lastr/i,                        test: 'bench', coef: 0.20, modo: 'total', conf: 'baja', nota: 'Carga = lastre, además del peso corporal.' },
  { re: /^laterales|laterales en (cable|polea)/i,            test: 'press_mil', coef: 0.10, modo: 'por_mano', conf: 'baja', nota: 'Monoarticular en polea.' },

  // ── PESO CORPORAL (se evalúa primero: no llevan carga externa) ─────────
  { re: /flexi[oó]n|push[\s-]?up|lagartija/i,               test: 'bench', coef: 0, modo: 'corporal', conf: 'alta', nota: 'Se progresa por palanca, tempo o lastre, no por kg.' },
  { re: /fondos(?!.*lastr)|dips(?!.*lastr)/i,                                      test: 'bench', coef: 0, modo: 'corporal', conf: 'alta', nota: 'Peso corporal; lastrar solo con técnica sólida.' },
  { re: /dominada(?!.*lastr)|chin[\s-]?up|pull[\s-]?up(?!.*lastr)/i, test: 'pull_ups', coef: 0, modo: 'corporal', conf: 'alta', nota: 'Peso corporal.' },
  { re: /remo invertido|remo australiano|inverted row|trx/i, test: 'remo_apoyo', coef: 0, modo: 'corporal', conf: 'alta', nota: 'Se progresa bajando el ángulo del cuerpo.' },
  { re: /pistol|nordic|n[oó]rdico/i,                          test: 'squat', coef: 0, modo: 'corporal', conf: 'alta', nota: 'Peso corporal: la dificultad la da el brazo de palanca.' },
  { re: /sin peso|sin carga|plancha|plank|dead ?bug|bird ?dog|puente de gl[uú]teo isom/i, test: null, coef: 0, modo: 'corporal', conf: 'alta', nota: 'Sin carga externa.' },

  // ── EMPUJE HORIZONTAL → test press banca ────────────────────────────────
  { re: /(apertura|fly|flyes|cruce|crossover).*(polea|cable)|(polea|cable).*(apertura|cruce)/i, test: 'bench', coef: 0.12, modo: 'por_mano', conf: 'baja', nota: 'Monoarticular en polea: por lado.' },
  { re: /pec ?deck|peck ?deck|contractora/i,                  test: 'bench', coef: 0.45, modo: 'total', conf: 'baja', nota: 'Varía mucho según la máquina.' },
  { re: /apertura|fly|flyes/i,                                test: 'bench', coef: 0.17, modo: 'por_mano', conf: 'baja', nota: 'Monoarticular con brazo de palanca largo: una fracción del press.' },
  { re: /press.*inclinad.*mancuern|mancuern.*press.*inclinad/i, test: 'bench', coef: 0.32, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna.' },
  { re: /press.*(banca|banco|pecho|plano).*mancuern|mancuern.*press.*(banca|banco|pecho)/i, test: 'bench', coef: 0.37, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna: la estabilización reduce la carga total ~20-25%.' },
  { re: /press.*inclinad/i,                                   test: 'bench', coef: 0.82, modo: 'total', conf: 'alta', nota: 'La inclinación resta ~15-20% respecto al plano.' },
  { re: /press.*declinad/i,                                   test: 'bench', coef: 1.00, modo: 'total', conf: 'alta', nota: '' },
  { re: /floor press|press.*suelo/i,                          test: 'bench', coef: 0.90, modo: 'total', conf: 'alta', nota: 'Rango acortado.' },
  { re: /(chest press|press.*m[aá]quina|m[aá]quina.*press.*pecho)/i, test: 'bench', coef: 0.85, modo: 'total', conf: 'media', nota: 'Depende de la máquina.' },
  { re: /press (de )?(banca|banco|pecho)|bench press|press plano/i, test: 'bench', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Ejercicio del test.' },

  // ── TRÍCEPS → desde press banca (baja confianza) ────────────────────────
  { re: /patada.*tr[ií]ceps|kickback/i,                       test: 'bench', coef: 0.07, modo: 'por_mano', conf: 'baja', nota: '' },
  { re: /tr[ií]ceps.*(polea|cuerda|cable)|pushdown|jal[oó]n.*tr[ií]ceps/i, test: 'bench', coef: 0.30, modo: 'total', conf: 'baja', nota: '' },
  { re: /(press )?franc[eé]s|skull ?crusher|extensi[oó]n.*tr[ií]ceps|tr[ií]ceps.*(copa|nuca)/i, test: 'bench', coef: 0.25, modo: 'total', conf: 'baja', nota: '' },

  // ── EMPUJE VERTICAL → test press militar ───────────────────────────────
  { re: /(elevaci[oó]n|vuelo)s?.*lateral|lateral raise/i,     test: 'press_mil', coef: 0.13, modo: 'por_mano', conf: 'baja', nota: 'Monoarticular: una fracción mínima del press.' },
  { re: /(elevaci[oó]n|vuelo)s?.*frontal|front raise/i,       test: 'press_mil', coef: 0.15, modo: 'por_mano', conf: 'baja', nota: '' },
  { re: /p[aá]jaro|(vuelo|elevaci[oó]n)s?.*poster|reverse fly|rear delt|deltoides poster/i, test: 'press_mil', coef: 0.10, modo: 'por_mano', conf: 'baja', nota: '' },
  { re: /arnold/i,                                            test: 'press_mil', coef: 0.33, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna.' },
  { re: /press.*(hombro|militar|vertical|overhead).*mancuern|mancuern.*press.*(hombro|militar)/i, test: 'press_mil', coef: 0.38, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna.' },
  { re: /push ?press|push ?jerk/i,                            test: 'press_mil', coef: 1.15, modo: 'total', conf: 'media', nota: 'La ayuda de piernas permite superar el estricto.' },
  { re: /press.*landmine|landmine.*press/i,                  test: 'press_mil', coef: 0.60, modo: 'total', conf: 'baja', nota: 'Carga en el extremo de la barra.' },
  { re: /press (militar|hombro|vertical)|overhead press|military/i, test: 'press_mil', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Ejercicio del test.' },

  // ── DOMINANTE DE RODILLA → test sentadilla ─────────────────────────────
  { re: /prensa/i,                                            test: 'squat', coef: 1.40, modo: 'total', conf: 'media', nota: 'Sin contar el peso del carro. Varía mucho entre máquinas: ajustá en la primera serie.' },
  { re: /hack/i,                                              test: 'squat', coef: 0.90, modo: 'total', conf: 'media', nota: 'Depende de la máquina.' },
  { re: /extensi[oó]n.*(cu[aá]dricep|rodilla)|sill[oó]n de cu[aá]dricep|leg extension/i, test: 'squat', coef: 0.35, modo: 'total', conf: 'baja', nota: 'Monoarticular en máquina.' },
  { re: /b[uú]lgara|split squat|sentadilla dividida/i,        test: 'squat', coef: 0.22, modo: 'por_mano', conf: 'media', nota: 'Unilateral: por mancuerna.' },
  { re: /estocada|zancada|lunge|desplante/i,                  test: 'squat', coef: 0.20, modo: 'por_mano', conf: 'media', nota: 'Unilateral: por mancuerna.' },
  { re: /step[\s-]?up|subida al (caj[oó]n|banco)/i,           test: 'squat', coef: 0.18, modo: 'por_mano', conf: 'media', nota: 'Unilateral: por mancuerna.' },
  { re: /goblet|copa/i,                                       test: 'squat', coef: 0.38, modo: 'total', conf: 'media', nota: 'Una mancuerna o pesa rusa. Limita el agarre, no las piernas.' },
  { re: /(sentadilla )?frontal|front squat/i,                 test: 'squat', coef: 0.82, modo: 'total', conf: 'alta', nota: 'La posición de la barra resta ~15-20%.' },
  { re: /sentadilla|squat/i,                                  test: 'squat', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Ejercicio del test.' },

  // ── BISAGRA → test peso muerto ─────────────────────────────────────────
  { re: /(peso muerto|rdl|rumano).*(una pierna|unilateral|single)|single[\s-]?leg rdl/i, test: 'deadlift', coef: 0.20, modo: 'por_mano', conf: 'media', nota: 'Unilateral: limita el equilibrio.' },
  { re: /(rumano|rdl|stiff|piernas r[ií]gidas).*mancuern|mancuern.*(rumano|rdl)/i, test: 'deadlift', coef: 0.30, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna.' },
  { re: /rumano|rdl|romanian|stiff|piernas r[ií]gidas/i,      test: 'deadlift', coef: 0.72, modo: 'total', conf: 'alta', nota: 'Sin despegar del suelo: ~70-75% del convencional.' },
  { re: /good ?morning|buenos d[ií]as/i,                      test: 'deadlift', coef: 0.45, modo: 'total', conf: 'media', nota: 'Brazo de palanca largo sobre la columna.' },
  { re: /curl (femoral|isquio)|leg curl|femoral (tumbado|sentado|acostado)/i, test: 'deadlift', coef: 0.22, modo: 'total', conf: 'baja', nota: 'Monoarticular en máquina.' },
  { re: /swing|kettlebell swing|balanceo/i,                   test: 'deadlift', coef: 0.30, modo: 'total', conf: 'baja', nota: 'Balístico: se elige por velocidad, no por % 1RM.' },
  { re: /trap ?bar|hex ?bar|barra hexagonal/i,                test: 'deadlift', coef: 1.05, modo: 'total', conf: 'alta', nota: '' },
  { re: /sumo/i,                                              test: 'deadlift', coef: 1.00, modo: 'total', conf: 'alta', nota: '' },
  { re: /peso muerto|deadlift/i,                              test: 'deadlift', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Ejercicio del test.' },

  // ── GLÚTEO → test hip thrust ───────────────────────────────────────────
  { re: /hip thrust.*(una pierna|unilateral|single)/i,        test: 'hip_thrust', coef: 0.30, modo: 'total', conf: 'media', nota: 'Unilateral.' },
  { re: /patada.*gl[uú]teo|kickback.*gl[uú]teo|glute kickback/i, test: 'hip_thrust', coef: 0.12, modo: 'total', conf: 'baja', nota: '' },
  { re: /abducci[oó]n|abductor/i,                             test: 'hip_thrust', coef: 0.35, modo: 'total', conf: 'baja', nota: 'Depende de la máquina.' },
  { re: /puente de gl[uú]teo|glute bridge/i,                  test: 'hip_thrust', coef: 0.70, modo: 'total', conf: 'media', nota: 'Rango menor que el hip thrust.' },
  { re: /hip thrust|empuje de cadera/i,                       test: 'hip_thrust', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Ejercicio del test.' },

  // ── TRACCIÓN HORIZONTAL → test remo con apoyo ──────────────────────────
  { re: /face ?pull|jal[oó]n a la cara/i,                     test: 'remo_apoyo', coef: 0.25, modo: 'total', conf: 'baja', nota: '' },
  { re: /remo al ment[oó]n|upright row/i,                     test: 'remo_apoyo', coef: 0.40, modo: 'total', conf: 'baja', nota: '' },
  { re: /pull[\s-]?over/i,                                        test: 'remo_apoyo', coef: 0.25, modo: 'total', conf: 'baja', nota: 'Una mancuerna.' },
  { re: /curl.*(martillo|hammer)/i,                           test: 'remo_apoyo', coef: 0.16, modo: 'por_mano', conf: 'baja', nota: '' },
  { re: /curl.*(polea|cable)/i,                               test: 'remo_apoyo', coef: 0.30, modo: 'total', conf: 'baja', nota: '' },
  { re: /curl.*(barra|z|ez)/i,                                test: 'remo_apoyo', coef: 0.35, modo: 'total', conf: 'baja', nota: '' },
  { re: /curl.*(b[ií]ceps|mancuern|concentrad|alterno)|curl de b[ií]ceps|^curl/i, test: 'remo_apoyo', coef: 0.15, modo: 'por_mano', conf: 'baja', nota: 'Monoarticular: por mancuerna.' },
  { re: /remo.*(mancuern|un brazo|unilateral)|serrucho|dumbbell row/i, test: 'remo_apoyo', coef: 0.45, modo: 'por_mano', conf: 'media', nota: 'Por mancuerna, con apoyo.' },
  { re: /remo.*(polea|sentado|bajo|medio|cable)|seated row/i, test: 'remo_apoyo', coef: 0.85, modo: 'total', conf: 'media', nota: 'Depende de la polea.' },
  { re: /remo.*(m[aá]quina|hammer)/i,                         test: 'remo_apoyo', coef: 0.90, modo: 'total', conf: 'media', nota: '' },
  { re: /remo (a caballo|con apoyo)|t[\s-]?bar|seal row|chest[\s-]?supported/i, test: 'remo_apoyo', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Ejercicio del test.' },
  { re: /remo (con barra|pendlay|inclinado)|bent[\s-]?over|barbell row/i, test: 'remo_apoyo', coef: 1.00, modo: 'total', conf: 'alta', nota: '' },
  { re: /remo/i,                                              test: 'remo_apoyo', coef: 0.80, modo: 'total', conf: 'baja', nota: 'Variante de remo no tipificada: estimación conservadora.' },

  // ── TRACCIÓN VERTICAL → test dominadas ─────────────────────────────────
  { re: /dominada.*lastr|pull[\s-]?up.*lastr/i,               test: 'pull_ups', coef: 1.00, modo: 'total', conf: 'alta', nota: 'Carga = lastre.' },
  { re: /jal[oó]n|pulldown|lat pull/i,                        test: 'pull_ups', coef: 0.75, modo: 'total', conf: 'media', nota: 'Referido al peso movido en dominada.' },
];

const TEST_NOMBRE = {
  squat: 'Sentadilla trasera', deadlift: 'Peso muerto', bench: 'Press banca',
  press_mil: 'Press militar', hip_thrust: 'Hip thrust', pull_ups: 'Dominadas',
  remo_apoyo: 'Remo con apoyo',
};

// Ratios de 1RM / peso corporal para un nivel "débil" (percentil bajo), por
// sexo. Se usan SOLO cuando no hay test: dan una carga de arranque
// deliberadamente baja, nunca una estimación de rendimiento.
const RATIO_CONSERVADOR = {
  squat:      { m: 0.80, f: 0.55 }, deadlift:   { m: 1.00, f: 0.70 },
  bench:      { m: 0.50, f: 0.30 }, press_mil:  { m: 0.35, f: 0.20 },
  hip_thrust: { m: 1.00, f: 0.80 }, remo_apoyo: { m: 0.45, f: 0.30 },
  pull_ups:   { m: 0.60, f: 0.40 },
};

export function resolverTransferencia(nombre) {
  if (!nombre) return null;
  const regla = REGLAS_TRANSFERENCIA.find(r => r.re.test(nombre));
  if (!regla) return null;
  return {
    testId: regla.test,
    testNombre: TEST_NOMBRE[regla.test] || regla.test,
    coef: regla.coef, modo: regla.modo, confianza: regla.conf, nota: regla.nota,
  };
}

export function estimacionConservadora(testId, pesoCorporal, sexo) {
  const r = RATIO_CONSERVADOR[testId];
  const pc = parseFloat(pesoCorporal);
  if (!r || isNaN(pc) || pc <= 0) return null;
  return pc * (/^f/i.test(sexo || '') ? r.f : r.m);
}

export const ETIQUETA_CONFIANZA = {
  alta: 'misma cadena de movimiento', media: 'compuesto relacionado', baja: 'monoarticular desde un compuesto',
};
