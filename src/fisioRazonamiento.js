// ═══════════════════════════════════════════════════════════════════════════
// EL RAZONADOR CLÍNICO
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE FALTABA, MEDIDO EL 27/11/2026
// La clínica tenía dos módulos de IA y el trabajo clínico no era el de ninguno:
//
//   · AIAnalisisEvaluacion — recibe la evaluación completa y bien serializada,
//     pero su pregunta es "sugerí dónde ubicar a la persona dentro del Método
//     Activa Integra": clasifica en restaura/activa/potencia/rinde. Eso es
//     negocio.
//   · AIGeneradorProtocolo — recibía TRES campos (EVA, diagnóstico, objetivos)
//     y devolvía 5-8 ejercicios. Un armador de sesión suelta, que además
//     recibía la fase de NEGOCIO en lugar de la fase clínica y no veía ni uno
//     de los 170 ejercicios de la biblioteca de rehab.
//
// Entre los dos no había nadie que razonara el caso: nadie interpretaba los
// hallazgos, nadie rankeaba hipótesis, nadie decidía si había que confirmar
// antes de programar, nadie definía qué medir para pasar de fase. Manu lo dijo
// así: "la IA no genera planes ni sesiones claras en función de la lesión
// cargada, los criterios de avance no están bien establecidos y no los
// contempla la programación, y el PDF no brinda información suficiente".
// El PDF era pobre porque no tenía qué imprimir.
//
// CÓMO FUNCIONA ESTA CAPA — DOS PASOS, NO UNO
// Decisión de Manu (27/11): primero el análisis, él lo valida o lo corrige, y
// recién entonces se construyen las fases y las sesiones. El motivo es el que
// él mismo escribió en su documento de referencia: la hipótesis todavía no
// está cerrada. Si la IA genera 12 semanas de una sola pasada sobre una
// hipótesis equivocada, son 12 semanas de plan equivocado.
//
//   PASO 1 · promptAnalisisClinico → interpretación, hipótesis rankeadas,
//            qué no dejar pasar, Fase 0 si hace falta, ejes de criterio,
//            qué falta en la evaluación.
//   PASO 2 · promptPlanRehab → fases, sesiones y criterios, SOBRE EL ANÁLISIS
//            YA VALIDADO por él.
import { TESTS_ESP } from "./fisioMedidas.js";
import { REGIONES, REHAB_DB, FASES_REHAB } from "./rehabDB.js";
import { METRICAS, EJES, DIRECCION_ESCALA } from "./fisioCriterios.js";

// Las fases clínicas de rehabilitación. NO son las del Método Activa Integra.
// Manu fue explícito: "criterios de avance de fases (no del método activa
// integra) sino el de rehabilitación".
export const FASES_CLINICAS = [
  { k: 'proteccion',       label: 'Protección',          prot: 'aguda',
    objetivo: 'Bajar irritabilidad sin generar descondicionamiento' },
  { k: 'carga_progresiva', label: 'Carga progresiva',    prot: 'subaguda',
    objetivo: 'Recuperar capacidad de carga del tejido' },
  { k: 'retorno_funcion',  label: 'Retorno a la función', prot: 'cronica',
    objetivo: 'Integrar la carga en las demandas reales de la persona' },
];

// ─── Las pruebas de las regiones evaluadas, con su valor diagnóstico ───────
// Esto es lo que permite rankear hipótesis en serio. Una prueba con 97% de
// sensibilidad y 22% de especificidad (ULTT) sirve para NO descartar; una con
// 96% de especificidad (Apprehension) sirve para confirmar. Sin estos números
// la IA pone "probabilidad alta" porque suena bien.
// Van también las pruebas NO HECHAS, porque son la mitad de la información:
// decirle a la IA qué podría haberse medido y no se midió es lo que le permite
// proponer una batería de confirmación en lugar de inventar certezas.
export function tablaPruebas(regiones = [], testsEsp = {}) {
  const L = [];
  regiones.forEach(rk => {
    const tests = TESTS_ESP[rk] || [];
    if (!tests.length) return;
    L.push(`── ${(REGIONES[rk]?.label || rk).toUpperCase()} ──`);
    tests.forEach(t => {
      const res = ['Derecho', 'Izquierdo'].map(lado => {
        const r = testsEsp[`${rk}::${t.n}_${lado}`] ?? testsEsp[`${t.n}_${lado}`];
        return r ? `${lado[0]}:${r}` : null;
      }).filter(Boolean);
      const nota = testsEsp[`${rk}::${t.n}_nota`] ?? testsEsp[`${t.n}_nota`];
      L.push(
        `${t.n} — ${res.length ? res.join(' ') : 'NO SE HIZO'}` +
        ` · indica: ${t.indica}` +
        ` · estructura: ${t.estructura || '—'}` +
        ` · sens ${t.sens || '?'} / esp ${t.esp || '?'}` +
        (nota ? ` · nota del clínico: "${nota}"` : '')
      );
    });
    L.push('');
  });
  return L.join('\n');
}

// ─── La biblioteca de rehab, para que prescriba de lo que existe ───────────
// Decisión de Manu: solo de la biblioteca, y que avise qué le faltó. Es la
// misma regla que ya usa el lado del gym con sus 434 ejercicios, y es la razón
// por la que el plan de sala sale aplicable y el clínico no: el gym manda su
// catálogo y la clínica mandaba cero.
export function tablaBiblioteca(regiones = []) {
  const L = [];
  const regs = regiones.length ? regiones : Object.keys(REHAB_DB);
  regs.forEach(rk => {
    const porFase = REHAB_DB[rk];
    if (!porFase) return;
    L.push(`── ${(REGIONES[rk]?.label || rk).toUpperCase()} (region="${rk}") ──`);
    Object.entries(porFase).forEach(([faseProt, ejs]) => {
      L.push(`  [${faseProt}] ${FASES_REHAB[faseProt]?.sub || ''}`);
      (ejs || []).forEach(e => L.push(`    ${e.id} | ${e.nombre} | ${e.param || ''}`));
    });
    L.push('');
  });
  return L.join('\n');
}

export function contarBiblioteca(regiones = []) {
  const regs = regiones.length ? regiones : Object.keys(REHAB_DB);
  return regs.reduce((n, rk) =>
    n + Object.values(REHAB_DB[rk] || {}).reduce((m, a) => m + (a || []).length, 0), 0);
}

// ─── Las reglas que valen para los dos pasos ───────────────────────────────
const REGLAS_COMUNES = `
REGLAS QUE NO SE NEGOCIAN
1. NO recalcules ningún número del bloque de hechos. Ya están verificados por
   el sistema. Si un dato tuyo difiere, manda el bloque.
2. "sin medir" / "NO SE HIZO" significa MEDICIÓN PENDIENTE, nunca mal
   resultado. No lo trates como déficit, no lo uses para justificar una fase
   más baja y no lo cuentes como criterio incumplido.
3. Esto es una HIPÓTESIS DE TRABAJO fisioterapéutica, no un diagnóstico
   médico. Decilo. Si hay algo que exige evaluación médica antes de tratar,
   ponelo en "no_dejar_pasar" y no lo escondas en una precaución.
4. El valor diagnóstico de cada prueba está en la tabla: usalo. Una prueba con
   especificidad baja (ej. 22%) NO confirma nada aunque sea positiva — sirve
   para no descartar. Una con especificidad alta (ej. 96%) sí pesa. No digas
   "probabilidad alta" sin apoyarla en qué prueba y con qué especificidad.
5. Escribí para un fisioterapeuta. Nada de rodeos ni de "se recomienda
   consultar a un profesional": el que lee ES el profesional.`;

// ═══════════════════════════════════════════════════════════════════════════
// PASO 1 — EL ANÁLISIS
// ═══════════════════════════════════════════════════════════════════════════
export function promptAnalisisClinico({
  resumenDeterminista = '', regiones = [], testsEsp = {},
  historial = [], ctxReglasTexto = '', faseRehabActual = '',
}) {
  const ejes = Object.entries(EJES).map(([k, v]) => `"${k}" (${v.label})`).join(', ');
  const metricasAuto = Object.entries(METRICAS).filter(([, m]) => m.auto)
    .map(([k, m]) => `"${k}": ${m.label} — necesita ${m.pide}`).join('\n  ');
  const metricasManual = Object.entries(METRICAS).filter(([, m]) => !m.auto)
    .map(([k, m]) => `"${k}": ${m.label}`).join('\n  ');

  return `Sos el fisioterapeuta de referencia de FisioActiva Colonia y tenés que razonar este caso antes de programar nada. No armes todavía el plan de ejercicios: eso es el paso siguiente, y recién después de que el clínico valide tu análisis.

${'='.repeat(70)}
HECHOS YA CALCULADOS POR EL SISTEMA — SON DEFINITIVOS
${'='.repeat(70)}
${resumenDeterminista}
${'='.repeat(70)}

PRUEBAS ESPECIALES DISPONIBLES, SU RESULTADO Y SU VALOR DIAGNÓSTICO
(las que dicen NO SE HIZO son las que podrías pedir para confirmar)
${tablaPruebas(regiones, testsEsp)}

FASE CLÍNICA DE REHABILITACIÓN REGISTRADA HOY: ${faseRehabActual || 'no registrada'}
(protección / carga progresiva / retorno a la función — NO es la fase del
Método Activa Integra, que es clasificación de negocio y acá no se usa)
${historial.length ? `\nSESIONES PREVIAS:\n${historial.map(h => '· ' + h).join('\n')}` : ''}
${ctxReglasTexto}${REGLAS_COMUNES}

QUÉ TENÉS QUE PRODUCIR
Un razonamiento clínico, no un listado. Concretamente:

· Interpretá los hallazgos por sistema o región, diciendo qué leés en ellos.
· Rankeá las hipótesis. Puede haber una o varias, y pueden convivir. Para cada
  una: qué la sostiene, qué la debilita, y cómo se confirmaría. La probabilidad
  tiene que estar apoyada en pruebas con su especificidad, no en intuición.
· Si hay algo que NO se puede dejar pasar antes de tratar (banderas rojas,
  dolor que sugiere origen no musculoesquelético, síntomas neurológicos
  progresivos), decilo primero y con qué derivar.
· FASE 0 — proponé una fase de confirmación clínica SOLO SI las señales la
  justifican: hipótesis que compiten, dolor regional amplio, banderas neurales,
  o hallazgos que no cierran entre sí. Si el caso es claro, poné
  "fase0": null y arrancá directo: no metas una fase de confirmación por
  prolijidad, porque cuesta sesiones de las que el paciente contrató.
· Proponé los EJES DE CRITERIO de avance de fase para ESTE caso. Vos elegís
  cuáles aplican —un caso con componente neural no se mide con los mismos ejes
  que un esguince— pero cada criterio tiene que venir con umbral concreto y
  medible, porque el sistema los evalúa solo contra la evaluación guardada.
· Decí qué le falta a la evaluación para poder sostener o descartar tus
  hipótesis.

Respondé ÚNICAMENTE con este JSON:
{
  "lectura_global": "la formulación del caso en 3-5 líneas, como se la contarías a un colega: qué cuadro es, qué lo explica, y qué queda abierto",
  "interpretacion": [
    {
      "sistema": "nombre de la región o el sistema (ej: Hombro, Componente neural, Complejo codo-muñeca-mano)",
      "hallazgos": ["el hallazgo concreto, con su número o su resultado"],
      "lectura": "qué significan juntos esos hallazgos, 2-3 líneas. Acá es donde decís si una prueba positiva alcanza para afirmar algo o no, y por qué"
    }
  ],
  "hipotesis": [
    {
      "n": 1,
      "titulo": "la hipótesis en una línea",
      "probabilidad": "alta" | "moderada-alta" | "moderada" | "baja",
      "fundamento": "por qué esa probabilidad, nombrando las pruebas y su especificidad",
      "a_favor": ["qué la sostiene"],
      "en_contra": ["qué la debilita o qué falta para sostenerla"],
      "como_confirmar": ["qué prueba o medición la confirmaría o la descartaría"]
    }
  ],
  "no_dejar_pasar": [
    {
      "que": "qué hay que descartar o vigilar",
      "por_que": "en qué dato de la evaluación te apoyás",
      "derivar_si": "con qué signos se deriva y a quién"
    }
  ],
  "fase0": null,
  "criterios_propuestos": [
    {
      "eje": uno de: ${ejes},
      "que": "qué se mide, en palabras, como se va a leer en el informe del paciente",
      "metrica": "una de las de abajo",
      "ref": "según lo que pida la métrica",
      "region": "clave de región",
      "lado": "derecho" | "izquierdo" | "bilateral" | null,
      "operador": ">=" | "<=" | "==" | "negativo",
      "umbral": número,
      "porque": "por qué ESTE criterio en ESTE caso, 1 línea",
      "obligatorio": true
    }
  ],
  "faltantes_evaluacion": [
    { "que": "qué medir o registrar", "por_que": "qué hipótesis permite sostener o descartar" }
  ],
  "advertencia": "la salvedad de que es una hipótesis de trabajo y qué queda sin cerrar"
}

Si proponés Fase 0, "fase0" tiene esta forma en lugar de null:
{
  "necesaria": true,
  "por_que": "qué señal concreta la justifica",
  "sesiones": 1 o 2,
  "bateria": [ { "area": "Cervical", "pruebas": ["nombre de la prueba"] } ],
  "que_decide": "qué vas a saber después de esta fase que hoy no sabés"
}

MÉTRICAS QUE EL SISTEMA EVALÚA SOLO (preferí estas: son las exigibles)
  ${metricasAuto}

MÉTRICAS QUE TIENE QUE CONFIRMAR EL CLÍNICO A MANO (usalas solo cuando no hay
forma de medirlo con lo que la evaluación guarda)
  ${metricasManual}

DIRECCIÓN DE LAS ESCALAS — si invertís el operador, el criterio pide lo
contrario de lo que buscás:
  ${Object.entries(DIRECCION_ESCALA).map(([k, v]) => `${k}: ${v}`).join(' · ')}

Entre 2 y 6 criterios. Cada uno con umbral real: un criterio sin umbral no se
puede exigir y el sistema lo marca como pendiente para siempre.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 2 — EL PLAN, SOBRE EL ANÁLISIS YA VALIDADO
// ═══════════════════════════════════════════════════════════════════════════
export function promptPlanRehab({
  analisis, resumenDeterminista = '', regiones = [],
  sesionesDisponibles = null, frecuencia = 2, ctxReglasTexto = '',
  ocupacion = '', deporte = '', objetivoPaciente = '',
}) {
  const a = analisis || {};
  const hip = (a.hipotesis || []).map(h =>
    `${h.n}. [${h.probabilidad}] ${h.titulo} — ${h.fundamento}`).join('\n');
  const crit = (a.criterios_propuestos || []).map(c =>
    `· [${c.eje}] ${c.que}: ${c.metrica} ${c.operador} ${c.umbral}${c.lado ? ` (${c.lado})` : ''} — ${c.porque}`).join('\n');

  return `El análisis clínico de este caso ya está hecho y VALIDADO POR EL FISIOTERAPEUTA. Tu trabajo ahora es convertirlo en un programa de rehabilitación por fases, con sus sesiones.

${'='.repeat(70)}
ANÁLISIS VALIDADO — ES LA BASE, NO LO DISCUTAS
${'='.repeat(70)}
LECTURA GLOBAL: ${a.lectura_global || '—'}

HIPÓTESIS DE TRABAJO:
${hip || '—'}

${a.fase0?.necesaria ? `FASE 0 DE CONFIRMACIÓN: ${a.fase0.sesiones} sesión(es) — ${a.fase0.por_que}\nIncluila como primera fase del programa.\n` : 'Sin fase de confirmación: el caso está claro, arrancá por protección.\n'}
${(a.no_dejar_pasar || []).length ? `NO DEJAR PASAR:\n${a.no_dejar_pasar.map(x => `· ${x.que} — derivar si: ${x.derivar_si}`).join('\n')}\n` : ''}
CRITERIOS DE AVANCE YA DEFINIDOS (repartilos entre las fases donde corresponda):
${crit || '—'}
${'='.repeat(70)}

HECHOS DEL PACIENTE
${resumenDeterminista}

CONTEXTO QUE TIENE QUE APARECER EN LA ÚLTIMA FASE
Ocupación: ${ocupacion || 'no registrada'}
Deporte / actividad: ${deporte || 'no registrado'}
Objetivo del paciente: ${objetivoPaciente || 'no registrado'}
${sesionesDisponibles ? `\nSESIONES CONTRATADAS: ${sesionesDisponibles}. El programa completo no puede pedir más que eso.` : ''}
Frecuencia prevista: ${frecuencia} sesiones por semana.

${'='.repeat(70)}
BIBLIOTECA DE EJERCICIOS DE REHABILITACIÓN — PRESCRIBÍ SOLO DE ACÁ
${'='.repeat(70)}
${tablaBiblioteca(regiones)}
${'='.repeat(70)}

REGLA DE LA BIBLIOTECA (no negociable)
Cada ejercicio que prescribas tiene que tener el "id" exacto de la lista de
arriba. Si el protocolo necesita algo que NO está en la biblioteca, NO lo
inventes dentro del plan: ponelo en "faltan_en_biblioteca" con el nombre y por
qué lo necesitás, para que el clínico lo agregue. Un plan con ejercicios
inventados no se puede ejecutar en sala.
${ctxReglasTexto}${REGLAS_COMUNES}

FASES CLÍNICAS DISPONIBLES
${FASES_CLINICAS.map(f => `"${f.k}" (${f.label}) — ${f.objetivo} — usa ejercicios del bloque [${f.prot}]`).join('\n')}
La última fase tiene que ser de RETORNO A LA FUNCIÓN y tiene que entrenar las
demandas reales de la persona: su trabajo y su deporte, no ejercicio
terapéutico genérico. Si la ocupación es parte del problema, también es parte
del objetivo.

Respondé ÚNICAMENTE con este JSON:
{
  "titulo": "nombre del programa",
  "objetivo_global": "qué tiene que poder hacer esta persona al terminar, en términos de su vida y no de su dolor",
  "semanas_total": número,
  "sesiones_total": número,
  "progresion": ["los escalones de carga del programa, de principio a fin, en orden"],
  "fases": [
    {
      "k": "fase0" | "proteccion" | "carga_progresiva" | "retorno_funcion",
      "label": "nombre de la fase",
      "semanas": "1-3",
      "sesiones": número,
      "frecuencia": "2/semana",
      "objetivo": "qué busca esta fase",
      "criterios_para_salir": [ { "eje": "...", "que": "...", "metrica": "...", "ref": "...", "region": "...", "lado": null, "operador": ">=", "umbral": número, "porque": "...", "obligatorio": true } ],
      "sesiones_detalle": [
        {
          "n": 1,
          "titulo": "qué se trabaja en esta sesión",
          "bloques": [
            {
              "tipo": "movilidad" | "activacion" | "fuerza" | "neurodinamia" | "funcional" | "educacion",
              "ejercicios": [
                { "id": "el id EXACTO de la biblioteca", "param": "series×reps · descanso · RPE o hold", "nota": "el ajuste para ESTE paciente, o vacío" }
              ]
            }
          ],
          "vigilar": "qué signo obliga a bajar la carga en esta sesión"
        }
      ]
    }
  ],
  "faltan_en_biblioteca": [ { "nombre": "...", "para_que": "...", "fase": "..." } ],
  "educacion_paciente": ["qué tiene que entender el paciente, en lenguaje de paciente"],
  "dosis_fuera_de_sesion": "qué hace en casa o en el trabajo entre sesiones, y qué exposición tiene que bajar",
  "razonamiento": "por qué este programa y no otro, 3-4 líneas apoyadas en el análisis"
}

Si no hace falta detallar las sesiones de todas las fases, detallá las de la
primera fase completa y en las siguientes poné una sesión tipo por fase: el
clínico va a reprogramar según la respuesta real. Es mejor una fase bien
detallada que cuatro a medias.`;
}

// ─── Control de lo que devuelve la IA en el paso 2 ─────────────────────────
// La regla de la biblioteca hay que verificarla, no confiarla: si la IA
// devuelve un id que no existe, el plan se abre en sala con un ejercicio
// fantasma y el fisio queda mirando una línea vacía con un paciente adelante.
export function validarPlanContraBiblioteca(plan, regiones = []) {
  const validos = new Set();
  (regiones.length ? regiones : Object.keys(REHAB_DB)).forEach(rk =>
    Object.values(REHAB_DB[rk] || {}).forEach(arr =>
      (arr || []).forEach(e => validos.add(e.id))));

  const fantasmas = [];
  let total = 0;
  (plan?.fases || []).forEach(f =>
    (f.sesiones_detalle || []).forEach(s =>
      (s.bloques || []).forEach(b =>
        (b.ejercicios || []).forEach(e => {
          total++;
          if (!validos.has(e.id)) fantasmas.push({ id: e.id, fase: f.k, sesion: s.n });
        }))));

  return {
    ok: fantasmas.length === 0,
    total, fantasmas,
    mensaje: fantasmas.length
      ? `${fantasmas.length} de ${total} ejercicios no existen en la biblioteca: ${fantasmas.map(f => f.id).join(', ')}. Regenerá el plan.`
      : `Los ${total} ejercicios existen en la biblioteca.`,
  };
}

// ─── El nombre de un ejercicio a partir de su id ───────────────────────────
// El programa guarda ids (que son lo que se valida contra la biblioteca) pero
// la pantalla y el PDF tienen que mostrar nombres: un fisio no lee "rc_a01".
// Se arma un índice una sola vez y no en cada render, porque esto se llama una
// vez por ejercicio por sesión por fase y son cientos de llamadas.
const INDICE_EJ = (() => {
  const m = new Map();
  Object.entries(REHAB_DB).forEach(([rk, porFase]) =>
    Object.entries(porFase || {}).forEach(([fase, arr]) =>
      (arr || []).forEach(e => m.set(e.id, { ...e, region: rk, fase }))));
  return m;
})();

export const ejercicioDeBiblioteca = (id) => INDICE_EJ.get(id) || null;

export const nombreDeEjercicio = (id) => {
  const e = INDICE_EJ.get(id);
  // Si el id no existe, se dice: así el fantasma se ve en pantalla en lugar de
  // aparecer como una línea en blanco que nadie entiende.
  return e ? e.nombre : `⚠ ${id} (no está en la biblioteca)`;
};
