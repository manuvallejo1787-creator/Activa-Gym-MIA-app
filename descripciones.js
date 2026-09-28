// ═══════════════════════════════════════════════════════════════════════════
// descripciones.js — DESCRIPCIÓN AUTOMÁTICA DE EJECUCIÓN
//
// Al agregar un ejercicio (a mano o generado) la anotación se precarga con una
// descripción genérica de cómo se ejecuta: posición inicial, ejecución, clave
// técnica y error a evitar. Es determinista e instantánea — no depende de la
// IA, no cuesta una llamada por ejercicio y está siempre, aunque no haya red.
//
// Es un punto de partida editable, no la última palabra: el entrenador la
// ajusta al cliente. Nunca pisa una anotación que ya exista.
// ═══════════════════════════════════════════════════════════════════════════

const P = [
  // ── MOVILIDAD / ACTIVACIÓN / CORE (primero: nombres muy específicos) ──
  [/cat[\s-]?camel|gato[\s-]?camello/i, 'En cuadrupedia, manos bajo hombros y rodillas bajo caderas. Alterná flexión (redondear la espalda desde la pelvis) y extensión (llevar el pecho adelante), vértebra por vértebra.', 'Movimiento lento y segmentado, guiado por la respiración.', 'Mover solo el cuello o solo la zona lumbar.'],
  [/90\/90/i, 'Sentado con ambas rodillas a 90°: una pierna en rotación externa adelante y la otra en rotación interna al costado. Tronco erguido, inclinate sobre la pierna de adelante.', 'Mantené la columna larga; el estiramiento se busca en la cadera, no redondeando la espalda.', 'Compensar con inclinación lateral del tronco.'],
  [/rotaci[oó]n tor[aá]cica/i, 'En cuadrupedia, una mano detrás de la nuca. Rotá llevando el codo hacia el techo y volvé hacia el codo contrario.', 'La rotación sale de la columna torácica; la pelvis queda quieta.', 'Rotar desde la zona lumbar o desplazar la cadera.'],
  [/rotaci[oó]n lumbar/i, 'Boca arriba, rodillas flexionadas y brazos en cruz. Dejá caer las rodillas juntas hacia un lado y volvé al centro.', 'Hombros apoyados en el suelo todo el recorrido.', 'Forzar el rango con impulso.'],
  [/tobillo.*pared|dorsiflexi[oó]n/i, 'En posición de estocada frente a la pared, pie de adelante a unos centímetros. Llevá la rodilla hacia la pared sin despegar el talón.', 'Rodilla alineada con el segundo dedo del pie.', 'Levantar el talón o colapsar el arco hacia adentro.'],
  [/dead ?bug/i, 'Boca arriba, brazos al techo y caderas y rodillas a 90°. Extendé brazo y pierna contrarios sin que la zona lumbar se despegue del suelo.', 'Exhalá al extender; el abdomen sostiene la pelvis en posición neutra.', 'Arquear la zona lumbar al alejar la pierna.'],
  [/bird ?dog/i, 'En cuadrupedia, extendé brazo y pierna contrarios hasta la horizontal y volvé con control.', 'Pelvis nivelada: imaginá un vaso de agua sobre la zona lumbar.', 'Rotar la pelvis o elevar la pierna por encima de la cadera.'],
  [/plancha|plank/i, 'Apoyo en antebrazos y puntas de pie, cuerpo en línea recta de cabeza a talones.', 'Glúteos y abdomen activos; respiración continua.', 'Hundir la cadera o elevarla en pico.'],
  [/pallof/i, 'De pie de costado a la polea, banda o cable al pecho. Empujá los brazos al frente resistiendo la rotación y volvé.', 'El tronco no rota: el ejercicio es resistir, no girar.', 'Girar el torso hacia la polea.'],
  [/puente de gl[uú]teo|glute bridge/i, 'Boca arriba, rodillas flexionadas y pies apoyados a la altura de la cadera. Elevá la pelvis hasta alinear rodillas, cadera y hombros.', 'Empujá desde los talones y apretá glúteos arriba.', 'Arquear la zona lumbar en lugar de extender la cadera.'],

  // ── EMPUJE ─────────────────────────────────────────────────────────────
  [/apertura|fly|flyes|cruce|crossover|pec ?deck/i, 'Codos levemente flexionados y fijos durante todo el recorrido. Abrí los brazos en arco hasta sentir estiramiento en el pecho y cerrá como abrazando un tronco.', 'Es un movimiento de hombro, no de codo: el ángulo del codo no cambia.', 'Convertirlo en un press doblando los codos, o bajar más allá del rango cómodo del hombro.'],
  [/flexi[oó]n|push[\s-]?up/i, 'Manos algo más anchas que los hombros, cuerpo en línea recta. Bajá el pecho hasta cerca del suelo y empujá.', 'Codos a ~45° del tronco; abdomen y glúteos activos.', 'Hundir la cadera o abrir los codos a 90°.'],
  [/press.*inclinad/i, 'Banco a 30-45°. Escápulas retraídas y deprimidas, pies firmes. Bajá la carga a la parte alta del pecho y empujá.', 'Antebrazos verticales en el punto bajo.', 'Despegar los glúteos del banco o rebotar la carga.'],
  [/press (de )?(banca|banco|pecho)|bench|press plano|chest press/i, 'Escápulas retraídas y deprimidas, arco natural, pies firmes en el suelo. Bajá controlado hasta el pecho y empujá.', 'Codos a ~45-70° del tronco; la carga baja a la altura de los pezones.', 'Rebotar en el pecho, despegar glúteos o abrir los codos a 90°.'],
  [/(elevaci[oó]n|vuelo)s?.*lateral/i, 'De pie, leve flexión de codo fija. Elevá los brazos hacia los costados hasta la altura de los hombros.', 'Guiá con los codos, no con las manos; hombros lejos de las orejas.', 'Balancear el tronco o encoger los trapecios.'],
  [/(elevaci[oó]n|vuelo)s?.*frontal/i, 'De pie, elevá los brazos al frente hasta la altura de los hombros con codos levemente flexionados.', 'Tronco quieto; bajada controlada.', 'Impulsarse con la espalda.'],
  [/p[aá]jaro|vuelos? poster|reverse fly|rear delt/i, 'Tronco inclinado con espalda neutra. Abrí los brazos hacia los costados llevando las escápulas juntas.', 'Codos levemente flexionados y fijos.', 'Tirar con los trapecios o redondear la espalda.'],
  [/press.*(militar|hombro|vertical)|overhead|arnold|push ?press/i, 'De pie o sentado, core firme y glúteos activos. Empujá la carga por encima de la cabeza hasta extender los brazos.', 'La carga sube en línea recta sobre la mitad del pie; la cabeza pasa "por la ventana" al final.', 'Hiperextender la zona lumbar para compensar.'],
  [/fondos|dips/i, 'En paralelas, hombros deprimidos. Bajá flexionando codos hasta ~90° y empujá.', 'Tronco levemente adelantado para pecho, vertical para tríceps.', 'Bajar más allá del rango cómodo del hombro.'],
  [/tr[ií]ceps|franc[eé]s|pushdown|kickback|skull/i, 'Codos fijos junto a la cabeza o al tronco según la variante. Extendé el codo completo y volvé controlado.', 'Solo se mueve el antebrazo.', 'Mover los codos o balancear el cuerpo.'],

  // ── RODILLA ────────────────────────────────────────────────────────────
  [/b[uú]lgara|split squat/i, 'Pie trasero apoyado en un banco, pie delantero adelantado. Bajá la rodilla trasera en vertical hasta cerca del suelo.', 'La mayor parte del peso en la pierna de adelante; rodilla alineada con el pie.', 'Rodilla delantera colapsando hacia adentro o tronco que se cae.'],
  [/estocada|zancada|lunge|desplante/i, 'Paso amplio, bajá las dos rodillas a ~90° con el tronco erguido y volvé empujando con el pie de adelante.', 'Rodilla alineada con el segundo dedo del pie.', 'Rodilla que se va hacia adentro o paso demasiado corto.'],
  [/step[\s-]?up|subida al/i, 'Pie completo apoyado en el cajón. Subí empujando con esa pierna, sin impulso del pie de abajo.', 'Tronco levemente adelantado; bajada controlada.', 'Impulsarse con la pierna de apoyo en el suelo.'],
  [/prensa/i, 'Espalda y cadera pegadas al respaldo, pies a la altura de la cadera en la plataforma. Bajá hasta donde la pelvis no se despegue y empujá.', 'Rodillas alineadas con los pies; no bloquear en extensión.', 'Despegar la zona lumbar al final de la bajada.'],
  [/extensi[oó]n.*(cu[aá]dricep|rodilla)|leg extension/i, 'Espalda apoyada, eje de la máquina alineado con la rodilla. Extendé la rodilla y bajá controlado.', 'Pausa breve arriba.', 'Impulsar con la cadera o soltar el peso en la bajada.'],
  [/goblet|copa/i, 'Carga sostenida al pecho con codos hacia abajo. Bajá entre las piernas manteniendo el tronco erguido.', 'Rodillas en la dirección de los pies; talones apoyados.', 'Redondear la espalda o levantar los talones.'],
  [/sentadilla|squat|hack/i, 'Pies al ancho de hombros, puntas levemente afuera. Bajá empujando la cadera atrás y abajo, pecho arriba, y subí empujando el suelo.', 'Rodillas en la dirección de los pies; talones siempre apoyados; columna neutra.', 'Rodillas colapsando hacia adentro, talones que se despegan o pérdida de la curva lumbar abajo.'],

  // ── CADERA / BISAGRA ───────────────────────────────────────────────────
  [/hip thrust|empuje de cadera/i, 'Espalda alta apoyada en el banco, carga sobre la cadera, pies a la altura de la cadera. Extendé la cadera hasta alinear rodillas, cadera y hombros.', 'Mentón hacia el pecho y tibias verticales arriba.', 'Hiperextender la zona lumbar en lugar de extender la cadera.'],
  [/rumano|rdl|stiff|piernas r[ií]gidas|good ?morning/i, 'Rodillas levemente flexionadas y fijas. Llevá la cadera atrás deslizando la carga pegada a las piernas hasta sentir tensión en isquiotibiales.', 'Columna neutra todo el recorrido; el movimiento es de cadera, no de espalda.', 'Redondear la espalda o convertirlo en una sentadilla.'],
  [/curl (femoral|isquio)|leg curl/i, 'Eje de la máquina alineado con la rodilla. Flexioná la rodilla llevando el talón hacia el glúteo y volvé controlado.', 'Cadera pegada al banco.', 'Despegar la cadera para ayudarse.'],
  [/peso muerto|deadlift|trap ?bar|sumo/i, 'Barra sobre la mitad del pie, espalda neutra, hombros apenas por delante de la barra. Empujá el suelo con las piernas y extendé la cadera al final.', 'La barra sube pegada al cuerpo; cadera y hombros suben a la vez.', 'Redondear la zona lumbar o tirar con los brazos.'],
  [/swing/i, 'Bisagra de cadera explosiva: la pesa se proyecta al frente por extensión de cadera, no por los brazos.', 'Glúteos que "chasquean" arriba; brazos relajados.', 'Convertirlo en una sentadilla o levantar con los hombros.'],
  [/abducci[oó]n|abductor|patada.*gl[uú]teo|kickback/i, 'Pelvis estable y tronco quieto. Llevá la pierna en la dirección indicada con control, sin compensar con la zona lumbar.', 'Movimiento de cadera aislado.', 'Rotar la pelvis o impulsar con el tronco.'],

  // ── TRACCIÓN ───────────────────────────────────────────────────────────
  [/face ?pull/i, 'Polea a la altura de la cara con cuerda. Tirá hacia la frente separando las manos y rotando los hombros hacia afuera.', 'Codos altos; terminás en posición de "doble bíceps".', 'Tirar con la espalda baja o dejar caer los codos.'],
  [/remo/i, 'Espalda neutra, pecho arriba. Tirá llevando los codos hacia atrás y juntando las escápulas, y volvé extendiendo con control.', 'El movimiento empieza en las escápulas, no en los brazos.', 'Encoger los hombros, tironear con impulso o redondear la espalda.'],
  [/jal[oó]n|pulldown|lat pull/i, 'Sentado con muslos trabados. Tirá la barra hacia la parte alta del pecho llevando los codos hacia abajo y atrás.', 'Pecho arriba; escápulas deprimidas antes de flexionar los codos.', 'Balancear el tronco hacia atrás o bajar la barra detrás de la nuca.'],
  [/dominada|chin[\s-]?up|pull[\s-]?up/i, 'Colgado con agarre firme. Iniciá deprimiendo las escápulas y tirá hasta pasar el mentón por encima de la barra.', 'Cuerpo firme, sin balanceo.', 'Hacer "kipping" o no completar la extensión abajo.'],
  [/curl/i, 'Codos fijos junto al tronco. Flexioná el codo llevando la carga hacia el hombro y bajá controlado.', 'Solo se mueve el antebrazo; muñeca neutra.', 'Balancear el tronco o adelantar los codos.'],
];

const FALLBACK_POR_BLOQUE = {
  movilidad: 'Movimiento lento y controlado dentro del rango disponible, sin dolor, guiado por la respiración.',
  activacion: 'Priorizá la calidad de la contracción sobre la cantidad: sentí el músculo objetivo trabajar.',
  propiocepcion: 'Buscá estabilidad antes que velocidad; progresá la dificultad solo cuando el control sea bueno.',
  prev_rehab: 'Ejecución lenta y sin dolor. Si aparece molestia mayor a 3/10, reducí rango o carga.',
  cardio: 'Mantené la intensidad indicada de forma sostenida; ajustá el ritmo para respetar la zona prescrita.',
  pliometria: 'Aterrizaje silencioso y amortiguado; calidad del contacto antes que altura.',
  potencia: 'Máxima intención de velocidad en cada repetición; cortá la serie si la velocidad cae.',
};

export function describirEjercicio(ex, params = {}) {
  if (!ex) return '';
  const nombre = ex.nombre || '';
  const hit = P.find(([re]) => re.test(nombre));
  const partes = [];
  if (hit) {
    const [, como, clave, error] = hit;
    partes.push(como);
    partes.push(`Clave: ${clave}`);
    partes.push(`Evitá: ${error}`);
  } else {
    const base = FALLBACK_POR_BLOQUE[ex.bloque] ||
      'Técnica controlada en todo el recorrido, respiración continua y sin compensaciones.';
    partes.push(base);
    if (ex.musculos) partes.push(`Músculos: ${ex.musculos}.`);
  }
  const tempo = params.tempo || '';
  if (tempo && tempo !== '—') partes.push(`Tempo ${tempo} (bajada-pausa-subida).`);
  if (ex.equipo && !/ninguno|sin equipo|peso corporal/i.test(ex.equipo)) partes.push(`Equipo: ${ex.equipo}.`);
  return partes.join(' ');
}
