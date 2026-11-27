// qa/pdfRehab.mjs — EL INFORME TIENE QUÉ IMPRIMIR
//
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE MANU REPORTÓ EL 27/11/2026
// "El PDF generado no brinda información adecuada ni suficiente."
//
// La causa no estaba en el PDF: la IA devolvía una lista de 5-8 ejercicios y
// tres frases de criterio, así que el PDF imprimía eso. Maquillar el documento
// sin arreglar lo que la IA produce habría sido pintar una hoja vacía.
//
// LOS CONTROLES QUE MÁS IMPORTAN:
//  · que cada ejercicio salga con su PROCEDIMIENTO y no solo con su nombre
//    (un nombre no alcanza para ejecutarlo, y era la mitad de la queja)
//  · que lo que no se puede dejar pasar salga ANTES del programa
//  · que los criterios salgan con su umbral y su estado, no como enunciados
//  · que un ejercicio inventado se vea en el papel en lugar de salir en blanco
import { informeRehabHTML } from '../src/pdfRehab.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };
const plano = (t) => String(t).replace(/\s+/g, ' ');

// POR QUÉ ESTA FUNCIÓN EXISTE
// Afirmar sobre texto plano dentro de HTML falla por dos razones que no tienen
// nada que ver con el documento: las etiquetas parten las frases
// ("Vigilar:</strong> irradiación...") y el escapado convierte >= en &gt;=.
// `texto()` lee el documento como lo lee una PERSONA en el papel: sin
// etiquetas y sin entidades. Es lo que realmente se quiere probar, y además
// las afirmaciones quedan legibles.
const texto = (html) => plano(
  String(html).replace(/<[^>]*>/g, ' ')
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

const ANALISIS = {
  lectura_global: 'Dolor regional amplio del miembro superior derecho con participación cervical',
  interpretacion: [{ sistema: 'Hombro', hallazgos: ['Jobe positivo con debilidad'], lectura: 'Compatible con participación del manguito' }],
  hipotesis: [
    { n: 1, titulo: 'Tendinopatía calcificada del supraespinoso', probabilidad: 'alta',
      fundamento: 'Jobe positivo (esp 66%) con debilidad franca y diagnóstico previo por imagen',
      a_favor: ['Jobe +', 'dolor >90° abducción'], en_contra: ['no explica el dolor distal'],
      como_confirmar: ['ecografía de control'] },
    { n: 2, titulo: 'Componente cervicobraquial con mecanosensibilidad neural', probabilidad: 'moderada-alta',
      fundamento: 'ULTT positivo, pero su especificidad es 22%: no confirma por sí solo',
      a_favor: ['ULTT +', 'DN4 5/7'], en_contra: ['falta fuerza miotómica'], como_confirmar: ['Spurling', 'reflejos'] },
  ],
  no_dejar_pasar: [{ que: 'Descartar origen cardiovascular', por_que: 'dolor de hombro, brazo, cuello y mandíbula a los 60 años',
                     derivar_si: 'dolor con esfuerzo, disnea, sudoración o náuseas' }],
  fase0: { necesaria: true, sesiones: 2, por_que: 'dos hipótesis compitiendo',
           bateria: [{ area: 'Cervical', pruebas: ['Spurling', 'ULTT1', 'reflejos'] }],
           que_decide: 'si el componente neural es mecanosensibilidad o radiculopatía' },
  faltantes_evaluacion: [{ que: 'Dinamometría de prensión bilateral', por_que: 'sostiene o descarta la hipótesis 2' }],
  advertencia: 'Hipótesis de trabajo fisioterapéutica, no diagnóstico médico.',
};
const CRITERIOS = [
  { id: 'c1', eje: 'rom', que: 'Abducción activa de hombro', metrica: 'rom_grados', operador: '>=', umbral: 150, lado: 'derecho', porque: 'techo funcional para su trabajo' },
  { id: 'c2', eje: 'neural', que: 'Sin aumento de irradiación distal', metrica: 'sin_empeorar', operador: 'cumplido', umbral: null, porque: 'el criterio que no se puede saltear' },
];
const EVALUADOS = { criterios: [
  { id: 'c1', estado: 'no_cumplido', valor: '95°' },
  { id: 'c2', estado: 'pendiente', valor: null },
]};
const PROGRAMA = {
  titulo: 'Rehabilitación de miembro superior derecho', objetivo_global: 'Volver a cocinar y coser sin que el sistema se irrite',
  semanas_total: 12, sesiones_total: 22, regiones: ['hombro', 'cervical'],
  progresion: ['Movilidad', 'Isométricos', 'Fuerza', 'Prensión y transporte', 'Simulación laboral'],
  fases: [{ k: 'proteccion', label: 'Protección', semanas: '1-3', sesiones: 6, frecuencia: '2/semana',
    objetivo: 'Bajar irritabilidad sin descondicionar',
    criterios_para_salir: [{ id: 'c1', eje: 'rom', que: 'Abducción activa', operador: '>=', umbral: 120, porque: 'piso para cargar' }],
    sesiones_detalle: [{ n: 1, titulo: 'Movilidad y activación', vigilar: 'irradiación por debajo del codo',
      bloques: [{ tipo: 'movilidad', ejercicios: [
        { id: 'rc_a04', param: '3×10 · hold 5s', nota: 'sin llegar al tope' },
        { id: 'inventado_99', param: '3×10' },
      ]}]}]}],
  faltan_en_biblioteca: [{ nombre: 'Slider del nervio mediano', para_que: 'neurodinamia en protección', fase: 'proteccion' }],
  educacion_paciente: ['Molestia 3-4/10 durante el ejercicio es aceptable y no es daño'],
  dosis_fuera_de_sesion: 'Bajar a 4 horas diarias de costura durante las primeras 3 semanas',
  razonamiento: 'Se prioriza la desensibilización antes de cargar porque el componente neural domina el cuadro',
};

const html = informeRehabHTML({
  paciente: { nombre: 'Ana', apellido: 'Pérez' },
  evaluacion: { fecha: '2026-11-25', regiones: ['hombro', 'cervical'] },
  analisis: ANALISIS, criterios: CRITERIOS, programa: PROGRAMA, evaluados: EVALUADOS,
  marca: { colorPrimary: '#1A2744' }, evaluador: 'Lic. Mariana Napolitani',
});
const p = plano(html);
const T = texto(html);   // el documento como lo lee una persona en el papel

console.log('\n1. EL ORDEN — lo que no se puede dejar pasar va primero');
{
  const iAlerta = html.indexOf('NO DEJAR PASAR');
  const iPrograma = html.indexOf('El programa');
  ok(iAlerta > 0 && iAlerta < iPrograma,
    'la alerta de derivación aparece ANTES del programa: si hay que derivar, eso manda sobre cualquier ejercicio');
  ok(/Derivar si: dolor con esfuerzo, disnea/.test(T), 'y dice con qué signos derivar');
  ok(/#CC0000/.test(html.slice(iAlerta - 400, iAlerta)), 'y va en rojo, no como una nota al pie');
}

console.log('\n2. CADA EJERCICIO CON SU PROCEDIMIENTO, no solo el nombre');
{
  ok(/Retracción cervical en supino/.test(p),
    'el nombre sale de la biblioteca a partir del id (rc_a04), no del texto de la IA');
  ok(/Chin tuck suave en decúbito/.test(p),
    'EL CONTROL QUE ARREGLA LA QUEJA: sale el PROCEDIMIENTO del ejercicio. Un nombre no alcanza para ejecutarlo');
  ok(/3×10 · hold 5s/.test(p), 'con el parámetro que puso el programa');
  ok(/Para este paciente: sin llegar al tope/.test(T),
    'y la nota específica de este paciente, distinguida del procedimiento general');
}
{
  ok(/no está en la biblioteca/.test(p),
    'EL CONTROL QUE EVITA EL PAPELÓN: un id inventado se IMPRIME como advertencia en lugar de salir como una línea en blanco que nadie entiende');
}

console.log('\n3. LOS CRITERIOS: umbral y estado, no enunciados');
{
  ok(/Se pide/.test(T) && />= 150/.test(T),
    'cada criterio sale con su umbral concreto, que es lo que lo vuelve exigible');
  ok(/&gt;= 150/.test(p),
    'y el ">=" va escapado en el HTML: sin eso el navegador se come el operador y el criterio sale sin su umbral');
  ok(/95°/.test(p), 'y con el valor medido hoy al lado');
  ok(/#16A34A|#CC0000/.test(html), 'con color según cumple o no');
  ok(/techo funcional para su trabajo/.test(p),
    'y por qué ese criterio en este caso: el fundamento clínico queda en el papel');
  ok(/Movilidad \(ROM\)|Síntomas neurales/.test(p), 'con el eje al que pertenece cada uno');
  ok(/Para salir de esta fase/.test(p), 'y cada fase imprime sus propios criterios de salida');
}

console.log('\n4. EL RAZONAMIENTO CLÍNICO ENTERO');
{
  ok(/Formulación del caso/.test(p) && /Dolor regional amplio/.test(p), 'la formulación del caso');
  ok(/Interpretación de los hallazgos/.test(p) && /Compatible con participación del manguito/.test(p),
    'la interpretación por sistema');
  ok(/en orden de probabilidad/.test(p), 'las hipótesis rankeadas');
  ok(/su especificidad es 22%: no confirma por sí solo/.test(p),
    'con el fundamento que apoya la probabilidad en la especificidad de la prueba');
  ok(/A favor/.test(p) && /En contra o falta/.test(p), 'qué sostiene y qué debilita cada hipótesis');
  ok(/Para confirmarla: ecografía de control/.test(T), 'y cómo confirmarla');
  ok(/alta/.test(T) && /moderada-alta/.test(T) && /text-transform:uppercase/.test(html),
    'con la probabilidad como etiqueta de color, puesta en mayúscula por estilo y no por texto');
  ok(/Fase 0 — confirmación clínica · 2 sesión/.test(p), 'la Fase 0 con su cantidad de sesiones');
  ok(/Spurling, ULTT1, reflejos/.test(p), 'y su batería de pruebas');
  ok(/si el componente neural es mecanosensibilidad o radiculopatía/.test(p), 'y qué decide');
}

console.log('\n5. LO QUE HACE QUE EL PROGRAMA SE PUEDA EJECUTAR');
{
  ok(/Semáforo de carga durante la sesión/.test(p), 'el semáforo de carga');
  ok(/0–2\/10/.test(p) && /≥5\/10/.test(p), 'con sus tres rangos');
  ok(/no se para todo: se ajusta la dosis|No se aplica la regla de "si duele, parar todo"/.test(p),
    'y la regla de fondo: el objetivo es recuperar capacidad de carga, no que no duela nada');
  ok(/Vigilar: irradiación por debajo del codo/.test(T), 'qué vigilar en cada sesión');
  ok(/Bajar a 4 horas diarias de costura/.test(p),
    'la dosis fuera de sesión: si se rehabilita 1 hora y después hay 8 de la misma carga, la exposición total sigue siendo demasiada');
  ok(/Molestia 3-4\/10 durante el ejercicio es aceptable y no es daño/.test(T),
    'y qué explicarle al paciente, en lenguaje de paciente');
  ok(/Progresión de carga del programa/.test(p) && /Simulación laboral/.test(p),
    'la progresión completa, de movilidad a simulación laboral');
}
{
  ok(/Falta medir/.test(p) && /Dinamometría de prensión bilateral/.test(p),
    'qué falta medir, con qué hipótesis sostiene');
  ok(/Ejercicios que faltan en la biblioteca/.test(p) && /Slider del nervio mediano/.test(p),
    'y qué ejercicio le faltó a la biblioteca, en lugar de haberlo inventado dentro del plan');
  ok(/Por qué este programa/.test(p) && /se prioriza la desensibilización/i.test(p), 'y por qué este programa y no otro');
}

console.log('\n6. Forma del documento');
{
  ok(/^<!DOCTYPE html>/.test(html), 'documento HTML completo');
  ok(/class="doc-header"/.test(html),
    'usa el encabezado unificado brandHeaderHTML, que estaba escrito y sin usar desde el 29/10 como deuda marcada');
  ok(/class="doc-footer"/.test(html), 'y el pie unificado');
  ok(/Lic\. Mariana Napolitani/.test(p), 'con el evaluador');
  ok(/Hombro · Columna Cervical/.test(T),
    'y las regiones evaluadas con su nombre real de la biblioteca ("Columna Cervical", no "cervical")');
  ok(/window\.print\(\)/.test(html), 'y se manda a imprimir solo');
  ok(/Hipótesis de trabajo fisioterapéutica, no diagnóstico médico/.test(p),
    'con la salvedad en el pie de CADA página: es lo que separa una hipótesis de un diagnóstico');
  ok(/page-break-inside:avoid/.test(html), 'y las fases no se cortan entre páginas');
}
{
  // El escapado: el nombre de un paciente con un & o un < no puede romper el
  // documento ni abrir la puerta a que un texto se interprete como marcado.
  const h2 = informeRehabHTML({
    paciente: { nombre: 'Ana & <b>Luz</b>', apellido: 'P' },
    analisis: { lectura_global: '<script>x</script>' }, criterios: [], programa: { fases: [] },
  });
  ok(/Ana &amp; &lt;b&gt;Luz&lt;\/b&gt;/.test(h2), 'el nombre del paciente se escapa');
  ok(/&lt;script&gt;/.test(h2) && !/<script>x<\/script>/.test(h2),
    'y un texto con marcado no se interpreta: queda como texto');
}
{
  // Sin análisis ni programa no puede reventar: se abre con lo que haya.
  const vacio = informeRehabHTML({ paciente: { nombre: 'X' }, criterios: [], programa: null, analisis: null });
  ok(/^<!DOCTYPE html>/.test(vacio) && vacio.length > 500,
    'sin análisis ni programa igual produce un documento válido en lugar de romperse');
  ok(!/undefined|NaN|\[object/.test(plano(vacio)),
    'y no imprime "undefined" ni "[object Object]" en la hoja del paciente');
}
{
  // Sin el resultado de la evaluación de criterios, la columna "Hoy" no puede
  // decir que cumple.
  const sinEval = informeRehabHTML({
    paciente: { nombre: 'X' }, analisis: ANALISIS, criterios: CRITERIOS, programa: PROGRAMA, evaluados: null,
  });
  ok(/—/.test(plano(sinEval)) && !/95°/.test(plano(sinEval)),
    'sin la evaluación de los criterios la columna "Hoy" queda en guión, no inventa un estado');
}

console.log(fallos === 0 ? '\n✅ informe de rehabilitación: todo pasa\n' : `\n❌ informe de rehabilitación: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
