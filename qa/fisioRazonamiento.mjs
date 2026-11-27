// qa/fisioRazonamiento.mjs — EL RAZONADOR CLÍNICO LE DA A LA IA LO QUE NECESITA
//
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE MANU REPORTÓ EL 27/11/2026
// "La IA no genera planes ni sesiones claras en función de la lesión cargada."
//
// La causa medida en el código: el prompt del generador clínico mandaba TRES
// campos (EVA, diagnóstico, objetivos) de los cuarenta que la evaluación
// guarda, mandaba la fase de NEGOCIO en lugar de la clínica, y mandaba CERO de
// los 170 ejercicios de la biblioteca de rehab — mientras el lado del gym le
// manda sus 434. Esa asimetría era todo el problema.
//
// LOS CONTROLES QUE MÁS IMPORTAN:
//  · que la tabla de pruebas lleve sensibilidad y especificidad, porque es lo
//    único que permite rankear hipótesis con fundamento en lugar de intuición
//  · que lleve las pruebas NO HECHAS, porque son la mitad de la información y
//    lo que permite proponer una batería de confirmación
//  · que el plan se valide contra la biblioteca: un id inventado es un fisio
//    mirando una línea vacía con un paciente adelante
import { promptAnalisisClinico, promptPlanRehab, tablaPruebas, tablaBiblioteca,
         contarBiblioteca, validarPlanContraBiblioteca, FASES_CLINICAS } from '../src/fisioRazonamiento.js';
import { REHAB_DB } from '../src/rehabDB.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

// POR QUÉ ESTA FUNCIÓN EXISTE
// Los prompts son texto con saltos de línea para que se lean en el código. Una
// afirmación sobre una frase de varias palabras falla cuando el salto cayó en
// medio de la frase: el prompt está bien y la prueba miente. Me pasó cinco
// veces escribiendo este archivo y antes en otros arneses, así que acá el
// espacio se normaliza UNA vez y el problema se termina.
const plano = (t) => String(t).replace(/\s+/g, ' ');

const TESTS_HECHOS = {
  'hombro::Empty Can (Jobe)_Derecho': 'positivo',
  'hombro::Yocum Test_Derecho': 'positivo',
  'hombro::Empty Can (Jobe)_nota': 'debilidad franca, no solo dolor',
  'ULTT (Tensión Neural MMSS)_Derecho': 'positivo',
};

console.log('\n1. LA TABLA DE PRUEBAS — el valor diagnóstico llega a la IA');
{
  const t = tablaPruebas(['hombro', 'cervical'], TESTS_HECHOS);
  ok(/sens 69% \/ esp 66%/.test(t), 'cada prueba viaja con su sensibilidad y especificidad');
  ok(/esp 96%/.test(t),
    'incluida Apprehension con 96% de especificidad: un positivo ahí pesa distinto a un ULTT positivo');
  ok(/NO SE HIZO/.test(t),
    'y las pruebas NO HECHAS también viajan: son lo que permite proponer una batería de confirmación');
  ok(/D:positivo/.test(t), 'los resultados hechos viajan con el lado');
  ok(/nota del clínico: "debilidad franca/.test(t),
    'y la nota que escribió el clínico también: "debilidad franca, no solo dolor" cambia la lectura de un Jobe positivo');
  ok(/estructura:/.test(t), 'y qué estructura evalúa cada prueba');
  ok(/HOMBRO/.test(t) && /CERVICAL/.test(t), 'agrupa por región evaluada');
}
{
  // El formato VIEJO de resultado (sin región adelante) tiene que leerse igual.
  const t = tablaPruebas(['hombro'], { 'Yocum Test_Izquierdo': 'negativo' });
  ok(/Yocum Test — I:negativo/.test(t),
    'el formato viejo de resultado (sin región) se lee: no se pierden las evaluaciones antiguas');
}
{
  const t = tablaPruebas([], TESTS_HECHOS);
  ok(t === '' , 'sin regiones no arma una tabla vacía con ruido');
}

console.log('\n2. LA BIBLIOTECA — la IA prescribe de lo que existe');
{
  const b = tablaBiblioteca(['cervical']);
  ok(/rc_a01 \| Isométrico cervical anterior/.test(b),
    'cada ejercicio viaja con su id exacto, que es lo que después se valida');
  ok(/\[aguda\]/.test(b) && /\[subaguda\]/.test(b) && /\[cronica\]/.test(b),
    'agrupados por fase del protocolo, para que no mezcle un ejercicio de crónica en protección');
  ok(/param|3×10/.test(b), 'y con su parámetro de referencia');
}
{
  const total = contarBiblioteca([]);
  const regiones = Object.keys(REHAB_DB).length;
  ok(total === 170, `la biblioteca completa son ${total} ejercicios (antes llegaban 0 a la IA)`);
  ok(regiones === 10, `en ${regiones} regiones corporales`);
  const soloHombro = contarBiblioteca(['hombro']);
  ok(soloHombro > 0 && soloHombro < total,
    `y se puede acotar a las regiones evaluadas (${soloHombro} para hombro) para no gastar el prompt en regiones que no vienen al caso`);
}

console.log('\n3. EL PROMPT DE ANÁLISIS — pide razonamiento, no una lista de ejercicios');
{
  const p = promptAnalisisClinico({
    resumenDeterminista: 'DN4: 5/7 — SUGIERE componente neuropático\nROM: Abducción 95°/180° (53%) DISFUNCIONAL',
    regiones: ['hombro', 'cervical'], testsEsp: TESTS_HECHOS,
    faseRehabActual: 'proteccion',
    historial: ['2026-11-20 · hombro · EVA 6→4'],
  });
  ok(/No armes todavía el plan de ejercicios/.test(p),
    'EL CONTROL CLAVE: el paso 1 NO pide ejercicios. Pedir las dos cosas juntas es lo que hacía que devolviera una lista y ningún razonamiento');
  ok(/"hipotesis"/.test(p) && /"a_favor"/.test(p) && /"en_contra"/.test(p),
    'pide hipótesis con lo que las sostiene Y lo que las debilita');
  ok(/apoyada en pruebas con su especificidad, no en intuición/.test(plano(p)),
    'y que la probabilidad se apoye en la especificidad de una prueba, no en intuición');
  ok(/No digas "probabilidad alta" sin apoyarla en qué prueba y con qué especificidad/.test(plano(p)),
    'con la prohibición explícita de decir "probabilidad alta" sin nombrar la prueba que la sostiene');
  ok(/especificidad baja \(ej\. 22%\) NO confirma/.test(p),
    'con la regla explícita de que una especificidad baja no confirma nada');
  ok(/"no_dejar_pasar"/.test(p) && /derivar_si/.test(p),
    'pide qué no dejar pasar y con qué derivar');
  ok(/"fase0": null/.test(p), 'Fase 0 arranca en null por defecto');
  ok(/SOLO SI las señales la justifican/.test(plano(p)) && /cuesta sesiones de las que el paciente contrató/.test(plano(p)),
    'y solo se propone si las señales la justifican, con el costo dicho: Manu eligió esto sobre meterla siempre');
  ok(/"faltantes_evaluacion"/.test(p), 'pide qué falta medir para sostener las hipótesis');
  ok(/HIPÓTESIS DE TRABAJO fisioterapéutica, no un diagnóstico médico/.test(plano(p)),
    'y deja claro que es hipótesis de trabajo y no diagnóstico médico');
}
{
  const p = promptAnalisisClinico({ resumenDeterminista: 'x', regiones: ['hombro'], testsEsp: {} });
  ok(/NO es la fase del Método Activa Integra/.test(plano(p)),
    'LA CORRECCIÓN DE FONDO: el prompt dice explícitamente que la fase clínica NO es la del Método Activa Integra. El código mandaba la de negocio (restaura/activa/potencia/rinde) — era literalmente el reclamo de Manu');
  ok(/protección \/ carga progresiva \/ retorno a la función/.test(p),
    'y nombra las tres fases clínicas que sí corresponden');
  ok(/"sin medir" \/ "NO SE HIZO" significa MEDICIÓN PENDIENTE/.test(p),
    'con la regla de que sin medir no es un mal resultado');
  ok(/el que lee ES el profesional/.test(p),
    'y que escriba para un fisioterapeuta, sin el "consulte a un profesional" que no le sirve a nadie');
}
{
  const p = promptAnalisisClinico({ resumenDeterminista: 'x', regiones: ['hombro'], testsEsp: {} });
  ok(/"rom_grados": .*necesita ref =/.test(plano(p)),
    'le dice qué necesita cada métrica para poder evaluarse sola');
  ok(/preferí estas: son las exigibles/.test(p),
    'y que prefiera las métricas automáticas, que son las que el sistema puede exigir');
  ok(/un criterio sin umbral no se puede exigir/.test(plano(p)),
    'con la advertencia de que un criterio sin umbral queda pendiente para siempre');
  ok(/dash: más alto = peor/.test(p) && /lefs: más alto = mejor/.test(p),
    'y la dirección de cada escala, porque con el operador invertido el criterio pide lo contrario de lo que se busca');
  ok(/Entre 2 y 6 criterios/.test(p), 'y acota la cantidad de criterios');
}

console.log('\n4. EL PROMPT DE PLAN — sobre el análisis YA validado');
{
  const analisis = {
    lectura_global: 'Dolor regional amplio de miembro superior derecho',
    hipotesis: [{ n: 1, probabilidad: 'alta', titulo: 'Tendinopatía calcificada supraespinoso', fundamento: 'Jobe + con debilidad' }],
    fase0: { necesaria: true, sesiones: 2, por_que: 'ULTT positivo con hipótesis compitiendo' },
    no_dejar_pasar: [{ que: 'Origen cardiovascular', derivar_si: 'dolor con esfuerzo + disnea' }],
    criterios_propuestos: [{ eje: 'rom', que: 'Abducción activa', metrica: 'rom_grados', operador: '>=', umbral: 150, porque: 'techo funcional' }],
  };
  const p = promptPlanRehab({
    analisis, resumenDeterminista: 'DN4 5/7', regiones: ['hombro', 'cervical'],
    sesionesDisponibles: 20, frecuencia: 2,
    ocupacion: 'cocina y costura', deporte: 'ninguno', objetivoPaciente: 'volver a trabajar sin dolor',
  });
  ok(/VALIDADO POR EL FISIOTERAPEUTA/.test(p) && /ES LA BASE, NO LO DISCUTAS/.test(p),
    'el paso 2 toma el análisis como base y no lo rediscute: por eso el flujo es de dos pasos');
  ok(/FASE 0 DE CONFIRMACIÓN: 2 sesión/.test(p),
    'si el análisis pidió Fase 0, la arrastra al plan con su cantidad de sesiones');
  ok(/Origen cardiovascular — derivar si/.test(p),
    'y arrastra lo que no se puede dejar pasar: no se pierde entre los dos pasos');
  ok(/rom_grados >= 150/.test(p), 'y los criterios ya definidos, para repartirlos entre las fases');
  ok(/SESIONES CONTRATADAS: 20/.test(p) && /no puede pedir más que eso/.test(p),
    'respeta las sesiones que el paciente contrató: un plan de 30 sesiones sobre 20 contratadas no se puede ejecutar');
  ok(/Ocupación: cocina y costura/.test(p),
    'la ocupación llega al plan — es el dato que el prompt viejo tiraba y el que decide la última fase');
  ok(/Si la ocupación es parte del problema, también es parte del objetivo/.test(plano(p)),
    'con la regla de que si el trabajo es parte del problema también es parte del objetivo');
  ok(/rc_a01|rh_a01|\| /.test(p) && p.length > 8000,
    `y la biblioteca entera viaja en el prompt (${Math.round(p.length/1000)} KB)`);
  ok(/NO lo inventes dentro del plan/.test(plano(p)) && /"faltan_en_biblioteca"/.test(p),
    'si falta un ejercicio lo reporta aparte en lugar de inventarlo dentro del plan');
  ok(/"criterios_para_salir"/.test(p), 'cada fase sale con sus propios criterios de salida');
  ok(/"vigilar"/.test(p), 'y cada sesión con qué signo obliga a bajar la carga');
  ok(/"dosis_fuera_de_sesion"/.test(p),
    'y pide la dosis fuera de sesión: si se rehabilita 60 minutos y después hay 8 horas de la misma carga, la exposición total sigue siendo demasiada');
  ok(/mejor una fase bien detallada que cuatro a medias/.test(plano(p)),
    'y prefiere una fase bien detallada a cuatro a medias, en lugar de cortarse por el límite de tokens');
}
{
  const sinFase0 = promptPlanRehab({
    analisis: { lectura_global: 'x', hipotesis: [], fase0: null, criterios_propuestos: [] },
    regiones: ['hombro'],
  });
  ok(/Sin fase de confirmación/.test(sinFase0) && /arrancá por protección/.test(sinFase0),
    'sin Fase 0 arranca directo por protección');
  ok(!/SESIONES CONTRATADAS/.test(sinFase0),
    'y si no hay sesiones contratadas registradas no inventa un límite');
}

console.log('\n5. LA VALIDACIÓN CONTRA LA BIBLIOTECA — ningún ejercicio fantasma');
{
  const bueno = { fases: [{ k: 'proteccion', sesiones_detalle: [{ n: 1, bloques: [
    { tipo: 'movilidad', ejercicios: [{ id: 'rc_a01' }, { id: 'rc_a04' }] }] }] }] };
  const v = validarPlanContraBiblioteca(bueno, ['cervical']);
  ok(v.ok && v.total === 2, `plan con ids reales: ${v.mensaje}`);

  const malo = { fases: [{ k: 'proteccion', sesiones_detalle: [{ n: 1, bloques: [
    { tipo: 'movilidad', ejercicios: [{ id: 'rc_a01' }, { id: 'inventado_99' }] }] }] }] };
  const v2 = validarPlanContraBiblioteca(malo, ['cervical']);
  ok(!v2.ok && v2.fantasmas.length === 1 && v2.fantasmas[0].id === 'inventado_99',
    'EL CONTROL QUE EVITA EL PAPELÓN: un id inventado se detecta antes de abrir el plan en sala');
  ok(/Regenerá el plan/.test(v2.mensaje), 'y dice qué hacer');
  ok(v2.fantasmas[0].fase === 'proteccion' && v2.fantasmas[0].sesion === 1,
    'y en qué fase y sesión está el fantasma');

  ok(validarPlanContraBiblioteca({ fases: [] }, ['cervical']).ok,
    'un plan vacío no se marca como corrupto: no tiene ejercicios, no tiene fantasmas');
  ok(validarPlanContraBiblioteca(null, []).ok, 'y un plan nulo no revienta');
}
{
  // Si se valida contra la región equivocada, un ejercicio bueno pasa por
  // fantasma. Por eso la validación recibe las regiones del plan.
  const plan = { fases: [{ k: 'proteccion', sesiones_detalle: [{ n: 1, bloques: [
    { ejercicios: [{ id: 'rc_a01' }] }] }] }] };
  ok(validarPlanContraBiblioteca(plan, ['rodilla']).ok === false,
    'validar contra la región equivocada da falso: hay que pasarle las regiones del plan');
  ok(validarPlanContraBiblioteca(plan, []).ok === true,
    'y sin regiones valida contra la biblioteca entera, que es el default seguro');
}

console.log('\n6. Las fases clínicas, no las de negocio');
{
  ok(FASES_CLINICAS.length === 3, 'tres fases clínicas de rehabilitación');
  ok(FASES_CLINICAS.map(f => f.k).join(',') === 'proteccion,carga_progresiva,retorno_funcion',
    'protección → carga progresiva → retorno a la función');
  const negocio = ['restaura', 'activa', 'potencia', 'rinde'];
  ok(!FASES_CLINICAS.some(f => negocio.includes(f.k)),
    'y ninguna es una fase del Método Activa Integra: son dos vocabularios distintos y mezclarlos era el bug');
  ok(FASES_CLINICAS.every(f => f.prot && f.objetivo),
    'cada una sabe de qué bloque de la biblioteca saca ejercicios y qué busca');
  ok(FASES_CLINICAS.map(f => f.prot).join(',') === 'aguda,subaguda,cronica',
    'y el mapeo a los bloques de la biblioteca es el correcto');
}

console.log(fallos === 0 ? '\n✅ razonador clínico: todo pasa\n' : `\n❌ razonador clínico: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
