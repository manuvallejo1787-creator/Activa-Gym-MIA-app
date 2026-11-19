// qa/puenteClinica.mjs — la clínica y el gimnasio conectados
//
// POR QUÉ ESTAS PRUEBAS Y NO OTRAS
// Las dos decisiones de Manu del 30/10 son las que hay que proteger, porque si
// se rompen no se nota hasta que alguien se lesiona:
//
//   1. HACIA ABAJO AUTOMÁTICO, HACIA ARRIBA CON UN TOQUE. Los dos errores no
//      cuestan lo mismo. Bajar mal frena un plan de más; subir mal habilita
//      trabajo pesado y balístico sin que nadie en sala lo haya visto.
//      El control que más importa es el 2.1: que un ascenso NUNCA sea
//      automático, en ninguno de los dos caminos.
//
//   2. SÓLO SE BLOQUEA LA ZONA, NO EL PLAN ENTERO. Acá Manu corrigió una
//      recomendación mía equivocada: yo había propuesto suspender todo el plan
//      sacándolo de un texto del método escrito para otra población. Un
//      pinzamiento de hombro no es razón para dejar de sentar.
import { decidir, caminoDe, textoAviso, sugerirVinculos, CAMINOS } from '../src/puenteClinica.js';
import { ORDEN_FASES, nivelFase, direccionCambio } from '../src/criterios.js';

let fallos = 0;
const ok = (c, d) => { if (!c) { console.log('  ✗ ' + d); fallos++; } else console.log('  ✓ ' + d); };

const fila = (o = {}) => ({ gym_client_id: 'c1', nombre: 'Maicol', fase_gym: 'activa',
  fase_clinica: 'activa', fecha_eval: '2026-10-30', region: 'hombro',
  planes_activos: 1, incidencia_abierta: false, ...o });

console.log('\n1. El orden de las fases, que antes estaba implícito');
{
  ok(ORDEN_FASES.join('>') === 'restaura>activa>potencia>rinde',
    'restaura → activa → potencia → rinde');
  ok(nivelFase('restaura') === 0 && nivelFase('rinde') === 3, 'los niveles van de 0 a 3');
  ok(nivelFase('inventada') === -1, 'una fase desconocida da -1: ante la duda, que no parezca un ascenso');
  ok(direccionCambio('potencia', 'restaura') === 'baja', 'de potencia a restaura: baja');
  ok(direccionCambio('restaura', 'potencia') === 'sube', 'de restaura a potencia: sube');
  ok(direccionCambio('activa', 'activa') === 'igual', 'la misma fase: igual');
  ok(direccionCambio('activa', 'inventada') === null,
    'con una fase desconocida devuelve null y NO "igual": un dato roto no es "no pasa nada"');
}

console.log('\n2. UN ASCENSO NUNCA ES AUTOMÁTICO — el control que más importa');
{
  // Camino lesión: tiene plan corriendo y la clínica le da el alta.
  const d = decidir(fila({ fase_gym: 'activa', fase_clinica: 'potencia', planes_activos: 2 }));
  ok(d.accion === 'confirmar', 'con plan corriendo, un alta pide confirmación');
  ok(d.inmediato === false, 'y NO es inmediato');
  ok(d.camino === 'lesion', 'el camino se detecta por tener plan activo');
}
{
  // Camino ingreso: sin plan, la clínica le da el alta.
  const d = decidir(fila({ fase_gym: 'restaura', fase_clinica: 'activa', planes_activos: 0 }));
  ok(d.accion === 'confirmar', 'sin plan tampoco sube solo: el alta también pide confirmación');
  ok(d.camino === 'ingreso', 'y el camino es de ingreso por la clínica');
  ok(d.saltos === 1, 'dice cuántas fases salta');
}
{
  // Un salto de dos fases tampoco se automatiza.
  const d = decidir(fila({ fase_gym: 'restaura', fase_clinica: 'potencia', planes_activos: 0 }));
  ok(d.accion === 'confirmar' && d.saltos === 2, 'un salto de dos fases tampoco es automático');
}
{
  // Barrido: ningún par que suba puede dar una acción inmediata, con o sin plan.
  let malos = [];
  for (const a of ORDEN_FASES) for (const b of ORDEN_FASES) {
    if (nivelFase(b) <= nivelFase(a)) continue;
    for (const planes of [0, 1, 3]) {
      const d = decidir(fila({ fase_gym: a, fase_clinica: b, planes_activos: planes }));
      if (d.inmediato) malos.push(`${a}→${b} (${planes} planes)`);
    }
  }
  ok(malos.length === 0, `ningún ascenso es inmediato en ninguna combinación (fallaron: ${malos.join(', ') || 'ninguna'})`);
}

console.log('\n3. Hacia abajo sí actúa solo, y actúa distinto según el camino');
{
  // CAMINO LESIÓN: la fase NO se mueve, se bloquea la zona.
  const d = decidir(fila({ fase_gym: 'potencia', fase_clinica: 'restaura', planes_activos: 1, region: 'hombro' }));
  ok(d.accion === 'bloquear', 'con plan corriendo: se bloquea el patrón, no se baja la fase');
  ok(d.inmediato === true, 'y es inmediato: bajar es el lado seguro y no espera a nadie');
  ok(d.regionRehab === 'hombro', 'con la región de rehab resuelta para poder traer el protocolo');
  ok(!/bajar/.test(d.accion), 'la fase del gimnasio NO se toca');
}
{
  // CAMINO INGRESO: no hay plan que proteger, la fase baja sola.
  const d = decidir(fila({ fase_gym: 'activa', fase_clinica: 'restaura', planes_activos: 0 }));
  ok(d.accion === 'bajar_ya', 'sin plan de gimnasio la fase baja sola');
  ok(d.inmediato === true, 'y también es inmediato');
}
{
  // Si ya hay una incidencia abierta sobre la zona, no se duplica.
  const d = decidir(fila({ fase_gym: 'potencia', fase_clinica: 'restaura', planes_activos: 1, incidencia_abierta: true }));
  ok(d.accion === 'nada', 'con una incidencia ya abierta no se crea otra: el patrón está tomado');
}

console.log('\n4. Los casos en que no hay nada que hacer');
{
  ok(decidir(fila()).accion === 'nada', 'fases iguales: nada');
  ok(decidir(fila({ fase_clinica: null })).accion === 'nada',
    'sin evaluación en la clínica: nada, y no es un error — es un paciente sin evaluar');
  ok(decidir(fila({ fase_clinica: '' })).accion === 'nada', 'fase vacía tampoco dispara');
  ok(decidir({}).accion === 'nada', 'una fila vacía no explota');
}
{
  const d = decidir(fila({ fase_gym: 'activa', fase_clinica: 'fase_rara' }));
  ok(d.accion === 'revisar', 'una fase que no se reconoce se manda a revisar, no se ignora');
  ok(/fase_rara/.test(d.motivo), 'y el motivo dice cuál era');
}

console.log('\n5. Los dos caminos');
{
  ok(caminoDe(0) === 'ingreso', 'sin planes activos: entró por la clínica');
  ok(caminoDe(1) === 'lesion' && caminoDe(5) === 'lesion', 'con planes activos: cliente del gym lesionado');
  ok(caminoDe(null) === 'ingreso' && caminoDe(undefined) === 'ingreso',
    'sin dato de planes se asume ingreso, que es el camino conservador en cuanto a la fase');
  ok(Object.keys(CAMINOS).length === 2, 'son dos caminos y no más');
}

console.log('\n6. El aviso dice la CONSECUENCIA, no sólo el hecho');
{
  const d = decidir(fila({ fase_gym: 'activa', fase_clinica: 'potencia', planes_activos: 1 }));
  const t = textoAviso(d, 'Maicol Pérez');
  ok(/Maicol Pérez/.test(t.titulo), 'el título nombra a la persona');
  ok(/confirm/i.test(t.titulo), 'y dice que hay que confirmar');
  ok(/trabajo pesado/.test(t.porQue), 'el porqué explica el riesgo de que suba solo');
  ok(/patrón sigue bloqueado/.test(t.porQue), 'y qué pasa mientras nadie lo confirme');
}
{
  const d = decidir(fila({ fase_gym: 'potencia', fase_clinica: 'restaura', planes_activos: 1, region: 'rodilla' }));
  const t = textoAviso(d, 'Ana Ruiz');
  ok(/rodilla/.test(t.titulo), 'el aviso de bloqueo nombra la zona');
  ok(/resto del plan sigue igual/.test(t.porQue),
    'y dice explícitamente que el resto del plan sigue: es la corrección de Manu, escrita donde se lee');
}
{
  const d = decidir(fila({ fase_gym: 'activa', fase_clinica: 'restaura', planes_activos: 0 }));
  const t = textoAviso(d, 'Juan');
  ok(/bajó a/.test(t.titulo), 'el aviso de bajada avisa de algo YA HECHO');
  ok(/se aplicó solo/i.test(t.porQue), 'y aclara que fue automático, para que nadie lo busque');
}
{
  ok(textoAviso({ accion: 'nada' }) === null, 'sin acción no hay aviso');
}

console.log('\n7. Pacientes sin vincular: la app propone, alguien confirma');
const PAC = [
  { id: 'p1', nombre: 'Damián', apellido: 'Baldi' },
  { id: 'p2', nombre: 'Jose', apellido: 'Fernandez' },
  { id: 'p3', nombre: 'Nadie', apellido: 'Coincide' },
];
{
  const CLI = [
    { id: 'c1', nombre: 'Damian', apellido: 'Baldi', activo: true, fisio_paciente_id: null },
    { id: 'c2', nombre: 'Jose', apellido: 'Fernandez', activo: true, fisio_paciente_id: 'p2' },
  ];
  const s = sugerirVinculos(PAC, CLI);
  ok(s.length === 1, 'sugiere sólo el que falta vincular');
  ok(s[0].pacienteId === 'p1' && s[0].clienteId === 'c1',
    'empareja "Damián Baldi" con "Damian Baldi": las tildes no cuentan');
  ok(!s.some(x => x.pacienteId === 'p2'), 'el que ya está vinculado no se sugiere');
  ok(!s.some(x => x.pacienteId === 'p3'), 'y uno sin par tampoco');
}
{
  // EL CASO PELIGROSO: dos clientes activos con el mismo nombre. Emparejar al
  // equivocado mezcla dos historiales clínicos y eso no se deshace solo.
  const CLI = [
    { id: 'c1', nombre: 'Jose', apellido: 'Fernandez', activo: true },
    { id: 'c9', nombre: 'José', apellido: 'Fernández', activo: true },
  ];
  const s = sugerirVinculos(PAC, CLI);
  ok(!s.some(x => x.pacienteId === 'p2'),
    'con dos clientes activos del mismo nombre NO sugiere: mezclar dos historiales no se deshace');
}
{
  const CLI = [{ id: 'c1', nombre: 'Damian', apellido: 'Baldi', activo: false }];
  ok(sugerirVinculos(PAC, CLI).length === 0, 'un cliente de baja no se sugiere: no entrena');
}
{
  ok(sugerirVinculos([], []).length === 0, 'listas vacías: nada');
  ok(sugerirVinculos(null, null).length === 0, 'nulas tampoco rompen');
  ok(sugerirVinculos(PAC, [{ id: 'c1', activo: true }]).length === 0,
    'un cliente sin nombre no se empareja con nadie');
}

console.log(fallos === 0 ? '\n✅ puente clínica-gimnasio: todo pasa\n' : `\n❌ puente clínica-gimnasio: ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
