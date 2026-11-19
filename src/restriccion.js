// restriccion.js — QUÉ EJERCICIO PUEDE HACER ESTE CLIENTE
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE Y QUÉ ARREGLA
// ═══════════════════════════════════════════════════════════════════════════
// Manu, 19/11/2026: "El semáforo en rojo no debe bloquear el armado de entrenos
// y lo sigue haciendo".
//
// Eran cinco bloqueos y TODOS salían de una línea, la segunda de la función
// vieja en App.jsx:
//
//     if(client.semaforo==='rojo') return 'block';
//
// De ahí colgaba el resto: el cartel "SEMÁFORO ROJO — Entrenamiento
// bloqueado", el botón de agregar ejercicio que desaparecía, el de agregar
// bloque, la alerta "🚫 Ejercicio bloqueado", y el generador devolviendo un
// plan vacío.
//
// EL NUDO: el método declara, en criterios.js, que RESTAURA tiene semáforo
// ROJO. O sea que el cliente que sale de la clínica es rojo por definición —
// y la app le prohibía entrenar exactamente a la población para la que Manu
// quiere construir la transición clínica → sala. El pedido de desbloquear el
// rojo y el pedido de fusionar fisio con entrenamiento son el MISMO pedido.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA REGLA NUEVA
// ═══════════════════════════════════════════════════════════════════════════
// El rojo deja de ser un caso especial y pasa a bloquear lo MISMO que el
// amarillo, más lo que la clínica marcó concretamente. Es la decisión que Manu
// ya había tomado el 30/10 para el escalón 2: se bloquea la zona, no el plan.
// Un pinzamiento de hombro no es razón para dejar de sentar.
//
//   1. El riel bloqueó este ejercicio (patron_bloqueado) → 'block'.
//      Es la barrera REAL y es específica: sale de una molestia reportada o de
//      una bajada de fase de la clínica, y la levanta el propio riel a las 4
//      sesiones limpias.
//   2. Las banderas del cliente (impacto / overhead / carga axial) → igual que
//      hoy para el amarillo, ahora también para el rojo.
//   3. ROJO SIN NINGUNA RESTRICCIÓN REGISTRADA → 'warn' en todo, 'block' en
//      nada.
//
// EL PUNTO 3 ES EL QUE MÁS PENSÉ Y ES DELIBERADO. Un cliente rojo sin
// banderas ni incidencias es un cliente del que la app NO SABE qué proteger.
// Dejarlo libre sería peligroso; bloquearle todo era lo que había y tampoco
// servía —terminaba en un plan vacío que nadie podía usar—. Avisar en cada
// ejercicio y no bloquear ninguno convierte un muro en información: el que
// está en sala ve que falta registrar la restricción, en lugar de encontrarse
// una pantalla que no lo deja trabajar y no le dice qué cargar.
//
// Y el 'warn' no es decorativo: en la app abre el flujo de override que ya
// existía para el amarillo —"solo continuar con justificación clínica
// documentada"—. O sea que el rojo ahora pasa por la maquinaria que ya estaba
// construida, en lugar de cortocircuitarla antes de llegar.

// Los patrones de ejercicio que el riel tiene bloqueados para un cliente.
// `incidencias` son las filas de gym_incidencias de ESE cliente; `vigente` es
// la función que decide si una incidencia sigue en pie (src/incidencias.js),
// y se inyecta para no duplicar acá la lista de estados — duplicarla en dos
// archivos es lo que dejó seis estados invisibles el 29/10.
export function patronesBloqueados(incidencias = [], vigente = null) {
  const out = new Set();
  (incidencias || []).forEach(i => {
    if (!i) return;
    if (vigente && !vigente(i)) return;
    (i.patron_bloqueado || []).forEach(id => out.add(id));
  });
  return out;
}

// ¿Tiene el cliente alguna restricción CONCRETA registrada? De esto depende el
// punto 3: sin nada registrado, el rojo avisa en todo en lugar de bloquear.
export function tieneRestriccionConcreta(client = {}, bloqueados = null) {
  const r = client?.restricciones_flags || {};
  if (r.impacto || r.overhead || r.cargaAxial) return true;
  const b = bloqueados instanceof Set ? bloqueados : new Set(bloqueados || []);
  return b.size > 0;
}

// Devuelve null (libre) | 'warn' | 'block'.
//
// `bloqueados` son los exIds que el riel tiene bloqueados (de
// patronesBloqueados). Es opcional para que los llamadores viejos sigan
// funcionando: sin él, el rojo cae en el punto 3 y avisa en vez de bloquear.
export function checkRestriccion(ex, client, bloqueados = null) {
  if (!client || !ex) return null;
  if (client.semaforo === 'pendiente') return null;

  const b = bloqueados instanceof Set ? bloqueados : new Set(bloqueados || []);

  // 1) La barrera específica del riel. Va PRIMERO: es la única que sale de un
  //    hallazgo concreto y la única que se levanta sola.
  if (ex.id && b.has(ex.id)) return 'block';

  const rojo = client.semaforo === 'rojo';
  const amarillo = client.semaforo === 'amarillo';
  if (!rojo && !amarillo) return null;

  // 2) Las banderas del cliente. Mismo criterio para rojo y amarillo: la
  //    diferencia entre los dos es de gravedad clínica, no de qué patrón
  //    aguanta el tejido.
  const r = client.restricciones_flags || {};
  const patron = (ex.patron || '').toLowerCase();
  const nombre = (ex.nombre || '').toLowerCase();

  if (r.impacto && ex.bloque === 'potencia') return 'block';
  if (r.impacto && patron.includes('salto')) return 'block';
  if (r.impacto && patron.includes('pliométr')) return 'block';
  if (r.overhead && (patron.includes('overhead') || patron.includes('vertical') ||
      patron.includes('empuje v'))) return 'warn';
  if (r.cargaAxial && ex.bloque === 'fuerza' &&
      (patron.includes('bilateral') || patron.includes('bisagra'))) return 'warn';
  if (r.cargaAxial && nombre.includes('sentadilla')) return 'warn';
  if (r.cargaAxial && nombre.includes('peso muerto')) return 'warn';

  // 3) Rojo sin nada registrado: avisa en todo, bloquea nada. Ver el bloque
  //    grande de arriba — es la diferencia entre un muro y una señal.
  if (rojo && !tieneRestriccionConcreta(client, b)) return 'warn';

  return null;
}

// El texto que explica POR QUÉ, para que el aviso no sea un ícono mudo. Vive
// acá y no en la pantalla para que el arnés verifique que nombra la causa.
export function motivoRestriccion(ex, client, bloqueados = null) {
  if (!client || !ex) return '';
  const b = bloqueados instanceof Set ? bloqueados : new Set(bloqueados || []);
  if (ex.id && b.has(ex.id)) {
    return 'El riel tiene este patrón sustituido por una molestia reportada o una ' +
           'bajada de fase de la clínica. Se libera solo a las 4 sesiones ejecutadas ' +
           'sin reporte nuevo en esa zona.';
  }
  const r = client.restricciones_flags || {};
  const patron = (ex.patron || '').toLowerCase();
  const nombre = (ex.nombre || '').toLowerCase();
  if (r.impacto && (ex.bloque === 'potencia' || patron.includes('salto') || patron.includes('pliométr')))
    return 'Restricción de impacto registrada en el screening.';
  if (r.overhead && (patron.includes('overhead') || patron.includes('vertical') || patron.includes('empuje v')))
    return 'Restricción de trabajo por encima de la cabeza registrada en el screening.';
  if (r.cargaAxial && (nombre.includes('sentadilla') || nombre.includes('peso muerto') ||
      (ex.bloque === 'fuerza' && (patron.includes('bilateral') || patron.includes('bisagra')))))
    return 'Restricción de carga axial registrada en el screening.';
  if (client.semaforo === 'rojo' && !tieneRestriccionConcreta(client, b)) {
    return 'Semáforo rojo SIN restricción concreta registrada: no hay banderas en el ' +
           'screening ni patrones sustituidos por el riel. Se avisa en todos los ' +
           'ejercicios y no se bloquea ninguno, porque la app no sabe qué proteger. ' +
           'Registrá la restricción en el screening o abrí la incidencia en sala.';
  }
  return '';
}
