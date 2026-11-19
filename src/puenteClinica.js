// puenteClinica.js — LA CLÍNICA Y EL GIMNASIO, CONECTADOS
//
// ═══════════════════════════════════════════════════════════════════════════
// QUÉ CIERRA
// ═══════════════════════════════════════════════════════════════════════════
// La conexión estaba escrita en los datos, en prosa, y nadie la leía. Los
// criterios de alta de R2 que guarda fisio_planes_clinicos dicen literalmente
// "Alta clínica habilitada — puede continuar en POTENCIA/RINDE del método sin
// restricción", y la única función que traducía fase clínica → fase del método
// (mapearFaseRehabANegocio) tenía UN consumidor: una frase en pantalla que
// decía "se puede aceptar o cambiar manualmente".
//
// Medido el 30/10: de 8 clientes del gimnasio vinculados a un paciente de la
// clínica, los 6 que tienen evaluación coinciden en fase. Eso no es que la
// conexión funcione — es que alguien los puso iguales a mano y ninguno cambió
// de fase todavía. El primer cambio real iba a ser el que lo descubriera.
//
// ═══════════════════════════════════════════════════════════════════════════
// LAS DOS DECISIONES DE MANU (30/10) Y POR QUÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. DIRECCIÓN ASIMÉTRICA: hacia abajo automático, hacia arriba con un toque.
//    Los dos errores no cuestan lo mismo. Si la app tarda en bajar a alguien,
//    sigue cargando pesado una zona que la clínica ya marcó: el costo es que a
//    alguien le frenen el plan de más. Si la app sube a alguien sola, una nota
//    escrita en la clínica le habilita trabajo pesado y balístico sin que el
//    que está en sala lo haya visto: el costo es la lesión.
//    Es el mismo criterio del riel — bajar de escalón requiere veredicto,
//    nunca silencio ni tiempo.
//
// 2. SÓLO SE BLOQUEAN LOS PATRONES DE LA ZONA, no el plan entero.
//    Acá Manu corrigió una recomendación mía que estaba mal. Yo había
//    propuesto suspender todo el plan y dejar sólo el protocolo, sacándolo de
//    un texto del método: "RESTAURA no tiene periodización de fuerza". Apliqué
//    una regla escrita para una población a otra distinta. Un cliente con un
//    pinzamiento de hombro no tiene por qué dejar de sentar: desentrenar todo
//    el cuerpo por un problema localizado no se sostiene ni clínica ni
//    comercialmente.
//
// ═══════════════════════════════════════════════════════════════════════════
// LOS DOS CAMINOS, QUE SALEN DE ESA SEGUNDA DECISIÓN
// ═══════════════════════════════════════════════════════════════════════════
// Si sólo se bloquean los patrones de la zona, entonces para un cliente del
// gimnasio que se lesiona la fase del método NO tiene que bajar: si bajara, la
// etiqueta diría "sin periodización de fuerza" mientras el tipo corre un plan
// de fuerza con un patrón bloqueado. Sería mentira en los datos.
//
//   CAMINO 'ingreso'  — entró por la clínica y todavía no tiene plan de gym.
//                       Su plan ES el protocolo clínico. La fase del método la
//                       manda la clínica, y el alta lo habilita a su primer
//                       ciclo de fuerza (con el toque de confirmación).
//
//   CAMINO 'lesion'   — ya tenía plan corriendo y se lesionó. La fase NO se
//                       mueve. La clínica controla el BLOQUEO del patrón, no la
//                       fase. Al alta se libera el patrón y entra la reentrada.
//
// Lo que distingue un caso del otro es una sola cosa y está en los datos:
// ¿tenía plan de gimnasio activo cuando la clínica le abrió tratamiento?
import { direccionCambio, nivelFase, FASES_METODO } from './criterios.js';
import { regionDeZona } from './rehabPuente.js';

export const CAMINOS = {
  ingreso: { label: 'Entró por la clínica', nota: 'Sin plan de gimnasio: la fase la manda la clínica.' },
  lesion:  { label: 'Cliente del gym lesionado', nota: 'Con plan corriendo: se bloquea la zona, la fase no se mueve.' },
};

// `planesActivos` es el conteo de planes de gimnasio vigentes del cliente.
export const caminoDe = (planesActivos) => (planesActivos || 0) > 0 ? 'lesion' : 'ingreso';

export const etiquetaFase = (f) => FASES_METODO[f]?.label || String(f || '—');

// ── QUÉ HACER CON UN CAMBIO DE FASE DE LA CLÍNICA ─────────────────────────
//
// Devuelve siempre un objeto con `accion`, para que la pantalla no tenga que
// decidir nada:
//
//   'nada'       las fases coinciden, o el cambio no aplica a este camino
//   'bajar_ya'   automático e inmediato: la fase del gimnasio baja sola
//   'bloquear'   automático e inmediato: se bloquea el patrón de la zona
//   'confirmar'  un ascenso: queda esperando el toque de alguien
//   'revisar'    algo no cierra y hay que mirarlo a mano
//
// `fila` viene de la vista gym_clinica_puente:
//   { gym_client_id, nombre, fase_gym, fase_clinica, fecha_eval, region,
//     planes_activos, incidencia_abierta }
export function decidir(fila = {}) {
  const { fase_gym, fase_clinica } = fila;
  const camino = caminoDe(fila.planes_activos);
  const base = { camino, fase_gym, fase_clinica, region: fila.region || null };

  // Sin evaluación en la clínica no hay nada que comparar. No es un problema:
  // es un paciente que todavía no fue evaluado.
  if (!fase_clinica) return { ...base, accion: 'nada', motivo: 'sin evaluación en la clínica' };

  const dir = direccionCambio(fase_gym, fase_clinica);

  // `null` significa que una de las dos fases no se reconoce. NO se trata como
  // "no pasa nada": una fase escrita a mano o de una versión más nueva es un
  // dato roto, y esconderlo es peor que mostrarlo.
  if (dir === null) {
    return { ...base, accion: 'revisar',
      motivo: `fase sin reconocer (gimnasio "${fase_gym || '—'}", clínica "${fase_clinica || '—'}")` };
  }
  if (dir === 'igual') return { ...base, accion: 'nada', motivo: 'las dos fases coinciden' };

  if (dir === 'baja') {
    // CAMINO 'lesion': la fase NO se mueve. Lo que se mueve es el bloqueo del
    // patrón de la zona, que es la decisión de Manu del 30/10.
    if (camino === 'lesion') {
      if (fila.incidencia_abierta) {
        return { ...base, accion: 'nada',
          motivo: 'ya hay una incidencia abierta sobre esa zona: el patrón está tomado' };
      }
      return { ...base, accion: 'bloquear', inmediato: true,
        regionRehab: regionDeZona(fila.region) || fila.region || null,
        motivo: `la clínica bajó a ${etiquetaFase(fase_clinica)} y tiene plan corriendo: ` +
                `se bloquea el patrón de la zona, la fase del gimnasio no se toca` };
    }
    // CAMINO 'ingreso': no hay plan que proteger, así que la fase baja sola.
    return { ...base, accion: 'bajar_ya', inmediato: true,
      motivo: `la clínica bajó a ${etiquetaFase(fase_clinica)} y no tiene plan de gimnasio: ` +
              `la fase del método la manda la clínica` };
  }

  // dir === 'sube' → NUNCA automático, en ninguno de los dos caminos.
  return { ...base, accion: 'confirmar', inmediato: false,
    saltos: nivelFase(fase_clinica) - nivelFase(fase_gym),
    motivo: camino === 'lesion'
      ? `la clínica dio el alta: corresponde liberar el patrón bloqueado y confirmar el pase a ${etiquetaFase(fase_clinica)}`
      : `la clínica dio el alta: con un toque queda habilitado para su primer ciclo en ${etiquetaFase(fase_clinica)}` };
}

// ── EL TEXTO QUE VE QUIEN ESTÁ EN SALA ────────────────────────────────────
// Vive acá y no en la pantalla para que el arnés pueda verificar que dice la
// consecuencia y no sólo el hecho. Un aviso sin consecuencia se ignora, y eso
// ya está escrito como regla de diseño en la bandeja de Hoy.
export function textoAviso(d, nombre = 'El cliente') {
  const n = nombre;
  switch (d.accion) {
    case 'confirmar':
      return {
        titulo: `Alta de clínica de ${n}: confirmá el pase a ${etiquetaFase(d.fase_clinica)}`,
        porQue: d.camino === 'lesion'
          ? 'La clínica le dio el alta. Hasta que alguien lo confirme, el patrón sigue bloqueado y la fase no se mueve: un ascenso no se aplica solo porque habilita trabajo pesado sin que nadie en sala lo haya visto.'
          : 'La clínica le dio el alta y no tiene plan de gimnasio todavía. Confirmarlo lo habilita a su primer ciclo de fuerza; mientras no se confirme, su plan sigue siendo el protocolo.',
      };
    case 'bloquear':
      return {
        titulo: `La clínica bajó a ${n} de fase: bloqueá el patrón de ${d.region || 'la zona'}`,
        porQue: 'Bajó de fase en la clínica y tiene un plan de gimnasio corriendo. El resto del plan sigue igual —no se desentrena todo el cuerpo por un problema localizado— pero los patrones que cargan esa zona tienen que quedar sin carga.',
      };
    case 'bajar_ya':
      return {
        titulo: `${n} bajó a ${etiquetaFase(d.fase_clinica)} por indicación de la clínica`,
        porQue: 'Se aplicó solo: bajar de fase es el lado seguro y no espera a nadie. No tiene plan de gimnasio activo, así que su plan es el protocolo clínico.',
      };
    case 'revisar':
      return {
        titulo: `Las fases de ${n} no se pueden comparar`,
        porQue: `${d.motivo}. Una fase que la app no reconoce no se trata como "no pasa nada": o se escribió a mano, o quedó de una versión anterior.`,
      };
    default:
      return null;
  }
}

// ── PACIENTES SIN VINCULAR ────────────────────────────────────────────────
// La automatización no sirve de nada sobre vínculos que no existen: medido el
// 30/10, sólo 8 de 80 clientes activos están vinculados a un paciente de la
// clínica, y 2 pacientes no están vinculados a ningún cliente del gimnasio.
//
// Se emparejan por nombre normalizado. Es una SUGERENCIA: vincular a dos
// personas distintas que se llaman igual mezclaría dos historiales clínicos,
// así que la app propone y alguien confirma.
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export function sugerirVinculos(pacientes = [], clientes = []) {
  const yaVinculados = new Set((clientes || []).map(c => c.fisio_paciente_id).filter(Boolean));
  const porNombre = new Map();
  (clientes || []).forEach(c => {
    if (c.fisio_paciente_id) return;               // ya tiene su paciente
    if (c.activo === false) return;                // de baja: no entrena
    const k = norm(`${c.nombre} ${c.apellido || ''}`);
    if (!k) return;
    // Un nombre repetido entre clientes activos no se sugiere: emparejar al
    // equivocado mezcla dos historiales clínicos, y eso no se deshace solo.
    porNombre.set(k, porNombre.has(k) ? null : c);
  });

  const out = [];
  (pacientes || []).forEach(p => {
    if (yaVinculados.has(p.id)) return;
    const k = norm(`${p.nombre} ${p.apellido || ''}`);
    const c = k ? porNombre.get(k) : null;
    if (!c) return;
    out.push({ pacienteId: p.id, clienteId: c.id,
      nombre: `${c.nombre} ${c.apellido || ''}`.trim() });
  });
  return out;
}
