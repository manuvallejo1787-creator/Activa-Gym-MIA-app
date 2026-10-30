// Versión del formulario del portal que este backend espera.
// Tiene que ser IGUAL a PORTAL_V en public/portal.html. Se bumpean las dos
// juntas cada vez que cambia lo que el formulario manda, y `npm run salud`
// verifica que coincidan — si no, un portal cacheado mandaría el formulario
// viejo, sin `naturaleza`, y el riel no rutearía esa molestia.
const PORTAL_V = '2026-10-30-a';

// Escalón 2. La composición del plan y el rechazo de la escritura viven en
// un módulo aparte porque los leen los dos lados —esta api y la app— y
// porque inline acá no se podían probar: la única forma de verificarlos era
// desplegar y mirar el portal de un cliente real.
import { componerPlan, bloqueoDe, mensajeBloqueo, indexarReentradas } from '../src/superposicion.js';

// api/portal.js — Portal del cliente (frontera de seguridad)
// El portal del cliente NUNCA toca Supabase directo. Pasa por acá.
// Esta función valida el token personal del cliente y usa la SERVICE ROLE KEY
// (solo en el servidor) para devolver/escribir EXCLUSIVAMENTE los datos de ese cliente.
//
// Variables de entorno necesarias en Vercel:
//   SUPABASE_URL                (ej: https://husokxkdwgpjwtgrijei.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (Supabase → Settings → API → service_role)

// Limpia barras finales y un /rest/v1 pegado de más, para evitar paths inválidos (PGRST125)
const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

async function sb(path, opts = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

// Valida el token y devuelve el cliente (o null)
async function clienteDeToken(token) {
  if (!token || typeof token !== "string" || token.length < 8) return null;
  const enc = encodeURIComponent(token);
  const rows = await sb(`gym_clients?portal_token=eq.${enc}&select=id,nombre,apellido,nivel,objetivo,periodizacion,periodizacion_inicio,periodizacion_fin,criterios_avance_estado,screening,fisio_paciente_id`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export default async function handler(req, res) {
  if (!URL || !KEY) {
    return res.status(500).json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel" });
  }

  try {
    // ── LECTURA: plan activo del cliente + registros ──
    if (req.method === "GET") {
      const token = req.query.token;
      const cli = await clienteDeToken(token);
      if (!cli) return res.status(403).json({ error: "Acceso no válido" });

      // Antes esto tomaba solo el plan 'activo' más reciente (limit=1). Si el
      // profesional arma varias sesiones por separado y las junta en bloque
      // para el PDF (función "Compilar bloque" del historial), esos planes
      // SIGUEN estando todos como 'activo' — nada los archiva automáticamente.
      // El portal terminaba mostrando solo el último, aunque el PDF sí las
      // mostraba todas juntas. Ahora el portal combina TODOS los planes
      // activos en un solo plan virtual, igual que hace el PDF.
      const planes = await sb(`gym_planes?gym_client_id=eq.${cli.id}&estado=eq.activo&select=id,nombre,fecha_inicio,fecha_fin_estimada,num_dias,dias,plazos,created_at&order=fecha_inicio.asc.nullslast,created_at.asc`);
      const todosActivos = Array.isArray(planes) ? planes : [];

      // ── QUE BLOQUE LE TOCA HOY ──────────────────────────────────────────
      // Varios planes activos a la vez NO son un error: es como se arma una
      // periodizacion por bloques, cada uno con su fecha de inicio. Santiago
      // Larrama tenia cuatro (Volumen 19/08, Hipertrofia 31/08, Fuerza 14/09,
      // Negativas 28/09) y el portal se los mostraba TODOS juntos: ocho
      // sesiones en pantalla en vez de las dos que le tocaban esa semana.
      //
      // Regla: de los bloques que YA EMPEZARON, vale el de fecha de inicio mas
      // reciente. Los que comparten esa misma fecha se combinan — ese es el
      // caso legitimo de armar un bloque en varios planes sueltos.
      // Un bloque con fecha de fin ya pasada se descarta, salvo que no quede
      // ninguno: mejor mostrar el ultimo plan vencido que una pantalla vacia.
      const hoyISO = new Date().toISOString().slice(0, 10);
      const planesActivos = (() => {
        if (todosActivos.length <= 1) return todosActivos;
        const empezados = todosActivos.filter(p => !p.fecha_inicio || p.fecha_inicio <= hoyISO);
        const base = empezados.length ? empezados : todosActivos;
        const vigentes = base.filter(p => !p.fecha_fin_estimada || p.fecha_fin_estimada >= hoyISO);
        const candidatos = vigentes.length ? vigentes : base;
        const ultimaFecha = candidatos
          .map(p => p.fecha_inicio || '')
          .sort()
          .slice(-1)[0];
        return candidatos.filter(p => (p.fecha_inicio || '') === ultimaFecha);
      })();
      let plan = null;
      let superposicion = [];
      let logs = [];
      let nombres = {};
      let media = {};
      if (planesActivos.length) {
        const diasCombinados = [];
        planesActivos.forEach(p => {
          (p.dias || []).forEach(d => diasCombinados.push({ ...d, _planId: p.id }));
        });
        plan = {
          // Cuantos bloques del plan quedaron fuera por no ser el vigente.
          _bloquesOcultos: todosActivos.length - planesActivos.length,
          id: planesActivos.length === 1 ? planesActivos[0].id : "combinado",
          nombre: planesActivos.length === 1 ? planesActivos[0].nombre : planesActivos.map(p => p.nombre).join(" + "),
          fecha_inicio: planesActivos[0].fecha_inicio,
          fecha_fin_estimada: planesActivos[planesActivos.length - 1].fecha_fin_estimada,
          dias: diasCombinados,
        };
        const idsList = planesActivos.map(p => `"${p.id}"`).join(",");

        // Solo los ejercicios que REALMENTE están en el plan de este cliente.
        // Antes se pedían los 424 de la base en cada carga del portal, aunque
        // un plan típico use ~25. Eso hacía una respuesta de ~87 kB y, en free
        // tier con arranque en frío, la cadena de consultas superaba el tiempo
        // límite: Supabase devolvía "Bad Gateway" o "Failed to get project
        // config" de forma intermitente.
        const idsEjercicios = new Set();
        planesActivos.forEach(pl => (pl.dias || []).forEach(d =>
          (d.blocks || []).forEach(b => (b.exercises || []).forEach(e => {
            if (e && e.exId) idsEjercicios.add(e.exId);
          }))));

        // Las dos consultas restantes no dependen entre sí: van en paralelo.
        const [logsRes, ejs] = await Promise.all([
          // `fecha` NO se mandaba, y es el día que el cliente declara en
          // "¿Qué día entrenaste?". Sin ese campo el calendario del portal no
          // tenía más remedio que agrupar por updated_at, o sea por cuándo se
          // TOCÓ el registro: el que entrenaba el miércoles y cargaba el
          // jueves quedaba marcado el jueves, y el que corregía un peso viejo
          // pintaba hoy como día de entrenamiento. Eso ensuciaba el registro
          // de asistencias, que es lo que se exporta a Gestión-Activa.
          //
          // LÍMITE: era 600 y el portal muestra 8 semanas. Un plan de 4 días
          // con 18 ejercicios son 576 registros: el tope quedaba justo sobre
          // el tamaño de un plan normal. Mónica Ortega va 590 de 600, y al
          // cruzarlo el portal le habría descartado registros en silencio.
          //
          // ORDEN: por `fecha`. Si alguna vez recorta, tiene que descartar lo
          // más viejo que entrenó, no lo que hace más tiempo que nadie toca.
          //
          // OJO AL EDITAR ESTA LÍNEA: el 16/10 una edición partió el template
          // literal y los comentarios quedaron DENTRO de la URL. `node
          // --check` no lo detectó (parsea como CommonJS; hay que usar
          // --input-type=module) y `vite build` ni mira api/. El portal
          // estuvo devolviendo 500 a los clientes en plena sala. Los
          // comentarios van ARRIBA de la llamada, nunca partiéndola, y se
          // verifica con `node verificar-api.mjs`.
          sb(`ejecucion_registros?plan_id=in.(${idsList})&select=plan_id,dia_id,ejercicio_id,semana,peso_real,reps_real,rpe_real,series_detalle,fecha,updated_at&order=fecha.desc,updated_at.desc&limit=1500`),
          idsEjercicios.size
            ? sb(`ejercicios?id=in.(${[...idsEjercicios].map(i => `"${i}"`).join(",")})&select=id,nombre,media_url,media_tipo,media_desc`)
            : Promise.resolve([]),
        ]);
        logs = logsRes;
        (ejs || []).forEach(e => {
          nombres[e.id] = e.nombre;
          if (e.media_url) media[e.id] = { url: e.media_url, tipo: e.media_tipo || "imagen", desc: e.media_desc || "" };
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // SUPERPOSICIÓN DEL RIEL — ESCALÓN 2
      // ══════════════════════════════════════════════════════════════════════
      // Decisión de Manu el 30/10: el bloque dirigido se inserta en el plan de
      // gym SIN borrar la rutina original; se bloquea la carga del patrón
      // afectado y a continuación se agrega el bloque nuevo.
      //
      // Se compone ACÁ, al leer, y no se escribe en gym_planes.dias. Escribirlo
      // obligaría a des-escribirlo cuando el bloqueo se levanta, y eso es un
      // segundo mecanismo que puede fallar dejando el plan mutado para siempre
      // con un bloque de rehab que ya no corresponde — y nadie se enteraría,
      // porque el plan se vería normal. Como superposición, cuando
      // tg_liberar_patron pasa la incidencia a 'resuelta' las vistas dejan de
      // devolver la fila y la rutina vuelve intacta sola.
      let bloqueados = {};      // exId → por qué está bloqueado
      let reentradas = {};      // exId → regla de reentrada en curso
      try {
        const enc = encodeURIComponent(cli.id);
        const [sup, reen] = await Promise.all([
          sb(`gym_superposicion?gym_client_id=eq.${enc}&select=incidencia_id,estado,zona,escalon,patron_bloqueado,patron_dias,bloque_dirigido,bloquea_carga,suma_bloque,motivo`),
          sb(`gym_reentrada?gym_client_id=eq.${enc}&select=ejercicio_id,incidencia_id,zona,liberado_el,pct,sesiones_req,sesiones_hechas,sesiones_restantes`),
        ]);
        superposicion = Array.isArray(sup) ? sup : [];
        reentradas = indexarReentradas(reen);

        const comp = componerPlan({ plan, superposicion });
        plan = comp.plan;
        bloqueados = comp.bloqueados;
        Object.assign(nombres, comp.nombres);
        Object.assign(media, comp.media);
      } catch (e) {
        // Que falle la superposición no puede dejar al cliente sin plan. En el
        // lado seguro: sin superposición el plan se ve completo y el bloqueo se
        // sigue rechazando en el POST, que es la barrera que importa.
        console.error("superposicion:", e.message);
      }
      // Criterios de avance de la fase actual del cliente (plantilla, no editable acá)
      let criterios = [];
      if (cli.nivel) {
        const rows = await sb(`criterios_avance_template?fase=eq.${encodeURIComponent(cli.nivel)}&select=criterios`);
        criterios = Array.isArray(rows) && rows.length ? (rows[0].criterios || []) : [];
      }
      // Marca del centro (para que el portal use la paleta real, no una fija)
      let brand = null;
      try {
        const brandRows = await sb(`centro_config?id=eq.default&select=gym_name,gym_sub,logo_img,color_primary,color_bg`);
        if (Array.isArray(brandRows) && brandRows.length) brand = brandRows[0];
      } catch {}

      // Si el cliente está vinculado a un paciente de FisioActiva, resumen
      // clínico (objetivo + evolución EVA/ROM inicial vs. más reciente) para
      // mostrar en el portal — el mismo "antes y después" del checkpoint,
      // en versión compacta.
      let clinico = null;
      if (cli.fisio_paciente_id) {
        try {
          const evsRows = await sb(`fisio_evaluaciones?paciente_id=eq.${cli.fisio_paciente_id}&select=tipo,fecha,fase,objetivo,eva_reposo,rom_pct&order=fecha.asc`);
          if (Array.isArray(evsRows) && evsRows.length) {
            const inicial = evsRows.find(e => e.tipo === "inicial") || evsRows[0];
            const final = evsRows[evsRows.length - 1];
            clinico = {
              objetivo: final.objetivo || inicial.objetivo || "",
              fase: final.fase || null,
              evaInicial: inicial.eva_reposo, evaActual: final.eva_reposo,
              romInicial: inicial.rom_pct, romActual: final.rom_pct,
              tieneComparativa: evsRows.length >= 2,
            };
          }
        } catch {}
      }

      // ── METAS MEDIBLES ──
      // El valor de HOY no se guarda: se calcula en cada lectura a partir de
      // las dos fuentes reales, la del cliente y la del profesional. Guardarlo
      // obligaría a recalcularlo en cada carga del portal y en cada test, y
      // cualquier olvido dejaría la barra mintiendo.
      let metas = [], medidas = [];
      try {
        medidas = await sb(`gym_medidas?gym_client_id=eq.${cli.id}&select=id,fecha,fuente,peso,pct_grasa,nota&order=fecha.asc`) || [];
      } catch {}
      try {
        // Solo metas APROBADAS. Una propuesta de la IA sin revisar puede tener
        // un objetivo mal calibrado; mostrársela al cliente antes de que el
        // profesional la valide es peor que no mostrarle nada.
        const rows = await sb(`gym_metas?gym_client_id=eq.${cli.id}&estado=in.(activa,lograda)&select=*&order=principal.desc,created_at.asc`) || [];
        if (rows.length) {
          // Mejor carga del cliente por ejercicio (portal). Contempla las dos
          // formas de registro: peso único de la fila y detalle por serie.
          const mejorPorEjercicio = {};
          (logs || []).forEach(l => {
            if (!l.ejercicio_id) return;
            const cand = [];
            if (l.peso_real != null) cand.push(parseFloat(l.peso_real));
            if (Array.isArray(l.series_detalle)) l.series_detalle.forEach(x => cand.push(parseFloat(x && x.peso)));
            cand.forEach(v => {
              if (isNaN(v)) return;
              if (mejorPorEjercicio[l.ejercicio_id] == null || v > mejorPorEjercicio[l.ejercicio_id])
                mejorPorEjercicio[l.ejercicio_id] = v;
            });
          });

          // ── MEDICIONES CORPORALES ──
          // Para una meta de recomposición el valor de hoy sale de la serie de
          // gym_medidas, no del screening: el screening es un solo punto.
          // Prioridad: la última medición del PROFESIONAL. La del cliente se
          // usa solo si es posterior, y se marca como tal, porque báscula de
          // casa y medición en ayunas con el mismo equipo no son comparables.
          const comp = (m) => {
            const p = m && m.peso != null ? parseFloat(m.peso) : null;
            const g = m && m.pct_grasa != null ? parseFloat(m.pct_grasa) : null;
            if (p == null || isNaN(p)) return null;
            if (g == null || isNaN(g)) return { peso: p, grasa: null, magra: null, fino: false };
            return { peso: p, grasa: Math.round(p * g / 100 * 10) / 10,
                     magra: Math.round(p * (100 - g) / 100 * 10) / 10, fino: true };
          };
          const primeraMed = medidas[0] || null;
          const ultProf = [...medidas].reverse().find(m => m.fuente === 'profesional') || null;
          const ultCual = medidas[medidas.length - 1] || null;
          // Si la del cliente es más reciente que la tuya, se usa esa pero se
          // avisa en el portal de dónde salió.
          const ultMed = (ultProf && ultCual && ultCual.fecha > ultProf.fecha) ? ultCual : (ultProf || ultCual);

          // Tests de fuerza cargados por el profesional.
          let tests = [];
          try {
            tests = await sb(`fuerza_tests?gym_client_id=eq.${cli.id}&select=test_id,fecha,peso_levantado,rm1_calculado,rm1_real&order=fecha.asc`) || [];
          } catch {}
          const mejorTest = {}, primerTest = {};
          tests.forEach(t => {
            const v = parseFloat(t.rm1_real != null ? t.rm1_real : (t.rm1_calculado != null ? t.rm1_calculado : t.peso_levantado));
            if (isNaN(v) || !t.test_id) return;
            if (primerTest[t.test_id] == null) primerTest[t.test_id] = v;
            if (mejorTest[t.test_id] == null || v > mejorTest[t.test_id]) mejorTest[t.test_id] = v;
          });

          metas = rows.map(m => {
            let actual = null, fuente = null;
            if (m.tipo === 'carga' && m.ejercicio_id) {
              const delPortal = mejorPorEjercicio[m.ejercicio_id];
              const delTest = m.test_id ? mejorTest[m.test_id] : null;
              if (delPortal != null && (delTest == null || delPortal >= delTest)) { actual = delPortal; fuente = 'portal'; }
              else if (delTest != null) { actual = delTest; fuente = 'test'; }
            } else if (m.tipo === 'test' && m.test_id) {
              if (mejorTest[m.test_id] != null) { actual = mejorTest[m.test_id]; fuente = 'test'; }
            } else if (m.tipo === 'recomposicion') {
              // subtipo: masa_grasa | masa_magra | peso.
              // 'peso' es el respaldo para quien no tiene % de grasa medido:
              // menos fino, pero preferible a no mostrar nada.
              const ini = comp(primeraMed), act = comp(ultMed);
              const leer = (c) => !c ? null
                : m.subtipo === 'masa_grasa' ? c.grasa
                : m.subtipo === 'masa_magra' ? c.magra
                : c.peso;
              actual = leer(act);
              if (actual == null && act) { actual = act.peso; }   // cae al peso
              if (m.valor_inicial == null && ini) {
                const vi = leer(ini); m = { ...m, valor_inicial: vi != null ? vi : ini.peso };
              }
              fuente = ultMed ? (ultMed.fuente === 'cliente' ? 'portal' : 'evaluacion') : null;
            } else if (m.tipo === 'manual') {
              if (m.valor_manual != null) { actual = parseFloat(m.valor_manual); fuente = 'evaluacion'; }
            }
            // Sin punto de arranque explícito se usa el primer test registrado;
            // si tampoco hay, el valor de hoy (progreso 0, no una barra falsa).
            let inicial = m.valor_inicial != null ? parseFloat(m.valor_inicial)
              : (m.test_id && primerTest[m.test_id] != null ? primerTest[m.test_id] : actual);
            const obj = parseFloat(m.valor_objetivo);
            let pct = null;
            if (actual != null && inicial != null && !isNaN(obj)) {
              const span = obj - inicial;
              pct = span === 0 ? (actual >= obj ? 100 : 0)
                : Math.max(0, Math.min(100, Math.round(((actual - inicial) / span) * 100)));
            }
            const lograda = actual != null && !isNaN(obj) &&
              (m.direccion === 'bajar' ? actual <= obj : actual >= obj);
            return { id: m.id, titulo: m.titulo, tipo: m.tipo, unidad: m.unidad || 'kg',
              ejercicioId: m.ejercicio_id, criterioId: m.criterio_id, principal: !!m.principal,
              inicial, actual, objetivo: isNaN(obj) ? null : obj, pct, fuente, lograda,
              origen: m.origen || 'cliente', subtipo: m.subtipo || null,
              fino: m.tipo === 'recomposicion' ? !!(comp(ultMed) || {}).fino : null,
              medFecha: ultMed ? ultMed.fecha : null,
              direccion: m.direccion || 'subir', fechaObjetivo: m.fecha_objetivo };
          });
        }
      } catch {}

      // Feedback de sesión (RPE) del cliente — alimenta el portal y, del otro
      // lado, el motor y la IA cuando se arma el plan siguiente.
      let feedback = [];
      try {
        feedback = await sb(`gym_sesion_feedback?gym_client_id=eq.${cli.id}&select=dia_id,dia_nombre,semana,fecha,rpe_sesion,energia,dolor,dolor_zona,nota,llegada,molestia,naturaleza,momento,ahora,intensidad&order=fecha.desc&limit=60`) || [];
      } catch {}

      return res.status(200).json({
        feedback,
        cliente: { nombre: cli.nombre, apellido: cli.apellido, nivel: cli.nivel, objetivo: cli.objetivo,
          periodizacion: cli.periodizacion, periodizacionInicio: cli.periodizacion_inicio, periodizacionFin: cli.periodizacion_fin,
          criteriosEstado: cli.criterios_avance_estado || {}, screening: cli.screening || {} },
        criterios, metas, medidas, brand, plan, logs: logs || [], nombres, media, clinico,
        // Escalón 2: qué está bloqueado y qué patrón está en reentrada. El
        // plan ya viene con las marcas puestas; esto es para que el portal
        // pueda explicar y para que la app lea la misma regla que la api.
        bloqueados, reentradas,
        // Versión que este backend espera del portal. Si el cliente trae una
        // distinta, su portal.html está cacheado y manda el formulario viejo:
        // sin `naturaleza` el riel no rutea su molestia y nadie se entera.
        // Se bumpea junto con PORTAL_V en public/portal.html; salud verifica
        // que las dos coincidan.
        portalV: PORTAL_V,
      });
    }

    // ── ESCRITURA: el cliente registra lo que hizo ──
    if (req.method === "POST") {
      const b = req.body || {};

      // Fecha de ENTRENAMIENTO que declara el cliente. Por defecto hoy, pero
      // puede ser anterior: a veces carga al otro día por olvido, o repasa su
      // seguimiento y corrige. Se acota a 30 días atrás y nunca al futuro —
      // un registro adelantado no es un olvido, es un error o una invención.
      const fechaEntreno = (() => {
        // "Hoy" en hora de Uruguay. En UTC, lo cargado después de las 21 h
        // quedaba fechado al día siguiente.
        const hoyUY = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' });
        const hoy = hoyUY(Date.now());
        const f = String(b.fecha || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return hoy;
        if (f > hoy) return hoy;
        const limite = hoyUY(Date.now() - 30 * 864e5);
        return f < limite ? limite : f;
      })();
      const cli = await clienteDeToken(b.token);
      if (!cli) return res.status(403).json({ error: "Acceso no válido" });

      // ── MEDICIÓN CORPORAL CARGADA POR EL CLIENTE ──────────────────────
      // Siempre fuente 'cliente': nunca pisa una medición del profesional.
      // El índice único por (cliente, fecha, fuente) hace que recargar el día
      // actualice en vez de duplicar.
      if (b.accion === "medicion") {
        const num = (v, min, max) => {
          const x = parseFloat(String(v ?? '').replace(',', '.'));
          if (isNaN(x)) return null;
          return (x < min || x > max) ? null : Math.round(x * 10) / 10;
        };
        const peso = num(b.peso, 25, 250);
        const pct  = num(b.pct_grasa, 3, 65);
        if (peso == null && pct == null)
          return res.status(400).json({ error: "Poné al menos un peso válido" });
        const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
        const fila = {
          id: `med_cli_${cli.id}_${hoy}`,
          gym_client_id: cli.id, fecha: hoy, fuente: "cliente",
          peso, pct_grasa: pct,
          nota: (b.nota || "").slice(0, 300) || null,
        };
        try {
          await sb(`gym_medidas?on_conflict=gym_client_id,fecha,fuente`, {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(fila),
          });
        } catch (e) {
          return res.status(500).json({ error: e.message });
        }
        return res.status(200).json({ ok: true });
      }

      // ── RPE de la sesión ──────────────────────────────────────────────
      // Una fila por (cliente, día, semana): el índice único hace que se
      // renueve sola cada semana en vez de acumular duplicados.
      if (b.accion === "feedback") {
        if (!b.dia_id || !b.semana) return res.status(400).json({ error: "Faltan datos del feedback" });
        const n = (v, min, max) => {
          const x = parseInt(v);
          return isNaN(x) ? null : Math.max(min, Math.min(max, x));
        };
        // Lo que manda el cliente no se valida solo. Estos campos los consume
        // el riel para decidir una conducta clínica, así que un valor fuera de
        // la lista no puede entrar: el trigger compara texto exacto, y un
        // 'nerviosaa' pasaría silenciosamente por la rama equivocada.
        const unoDe = (v, lista) => lista.includes(String(v || "")) ? String(v) : null;
        const naturaleza = unoDe(b.naturaleza, ["muscular", "articular", "nerviosa"]);
        const momento    = unoDe(b.momento,    ["nueva", "previa"]);
        const ahora      = unoDe(b.ahora,      ["se_fue", "sigue"]);
        const intensidad = unoDe(b.intensidad, ["apenas", "bastante", "mucho"]);
        const llegada    = unoDe(b.llegada,    ["pilas", "medio", "cansado"]);
        // Una molestia sin naturaleza o sin zona no es ruteable: el riel la
        // descarta. Se guarda como "sin molestia" en lugar de dejar una fila a
        // medias que nadie puede leer ni el riel usar.
        const zonaOk = /^[a-z]+(_(izq|der|ambos))?$/.test(String(b.dolor_zona || ""));
        const molestia = !!b.molestia && !!naturaleza && zonaOk;
        const fila = {
          // La clave lleva semana Y fecha: si el cliente repite la misma
          // sesión dos veces en la semana, son dos encuestas, no una que pisa
          // a la otra.
          id: `${cli.id}__${b.dia_id}__w${b.semana}__${fechaEntreno}`,
          gym_client_id: cli.id,
          plan_id: b.plan_id || null,
          dia_id: b.dia_id,
          dia_nombre: b.dia_nombre || "",
          semana: parseInt(b.semana),
          fecha: fechaEntreno,
          cargado_el: new Date().toISOString(),
          // RPE de sesión: intensidad del ENTRENAMIENTO, 1-10. No se tocó.
          rpe_sesion: n(b.rpe_sesion, 1, 10),
          // Los campos nuevos, que son los que el riel consume.
          llegada,
          molestia,
          naturaleza: molestia ? naturaleza : null,
          momento:    molestia ? momento    : null,
          ahora:      molestia ? ahora      : null,
          intensidad: molestia ? intensidad : null,
          // La zona solo tiene sentido si hay molestia.
          dolor_zona: molestia ? String(b.dolor_zona).slice(0, 40) : "",
          // `dolor` y `energia` se siguen escribiendo DERIVADOS de los campos
          // nuevos. No es redundancia: el panel de Hoy, el informe de IA y el
          // riel de sala ya leen esas dos columnas, y dejarlas en null los
          // rompería en silencio. Mapeo explícito para que la equivalencia
          // quede documentada donde se hace, y no haya que deducirla.
          dolor:   molestia ? ({ apenas: 2, bastante: 5, mucho: 8 })[intensidad] ?? 2 : 0,
          energia: ({ cansado: 1, medio: 3, pilas: 5 })[llegada] ?? null,
          nota: (b.nota || "").toString().slice(0, 500),
          updated_at: new Date().toISOString(),
        };
        await sb(`gym_sesion_feedback?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(fila),
        });
        return res.status(200).json({ ok: true });
      }

      const { plan_id, dia_id, dia_nombre, ejercicio_id, ejercicio_nombre, semana } = b;
      if (!plan_id || !dia_id || !ejercicio_id || !semana) {
        return res.status(400).json({ error: "Faltan datos del registro" });
      }
      // El plan debe pertenecer a este cliente
      const owns = await sb(`gym_planes?id=eq.${encodeURIComponent(plan_id)}&gym_client_id=eq.${cli.id}&select=id`);
      if (!Array.isArray(owns) || !owns.length) {
        return res.status(403).json({ error: "El plan no corresponde a este cliente" });
      }

      // ── PATRÓN BLOQUEADO: EL RECHAZO VA ACÁ, NO EN EL PORTAL ────────────
      // Pintar el ejercicio de solo-lectura en portal.html no alcanza: un
      // portal cacheado manda el POST igual, y cachés viejos del portal son un
      // problema OBSERVADO en este proyecto — es la razón por la que existe
      // PORTAL_V. Si la única barrera estuviera en el cliente, el patrón que
      // el riel bloqueó seguiría recibiendo carga sin que nadie se enterara.
      //
      // 409 y no 403: no es un problema de permisos, es un estado del sistema
      // que el portal tiene que poder explicar. El motivo viaja en la
      // respuesta para que el cliente lea POR QUÉ y no "error al guardar".
      try {
        const bloq = await sb(`gym_superposicion?gym_client_id=eq.${encodeURIComponent(cli.id)}&bloquea_carga=is.true&select=incidencia_id,zona,escalon,estado,patron_bloqueado,patron_dias,motivo,bloquea_carga`);
        const hit = bloqueoDe(Array.isArray(bloq) ? bloq : [], ejercicio_id, dia_id);
        if (hit) {
          return res.status(409).json({
            error: "patron_bloqueado",
            zona: hit.zona || null, escalon: hit.escalon, estado: hit.estado,
            motivo: hit.motivo || "", mensaje: mensajeBloqueo(hit),
          });
        }
      } catch (e) {
        // Si la verificación falla no se bloquea la carga: perder el registro
        // del cliente es peor que dejar pasar una serie en un patrón
        // sustituido. Queda en los logs para verlo con query_logs.
        console.error("verificacion patron_bloqueado:", e.message);
      }

      const id = `${plan_id}__${dia_id}__${ejercicio_id}__w${semana}__${fechaEntreno}`;
      // ═══════════════════════════════════════════════════════════════════
      // ACTUALIZACIÓN PARCIAL — solo se escriben los campos que cambiaron.
      //
      // BUG QUE ESTO CORRIGE: antes se mandaba la fila COMPLETA en cada
      // guardado. El cliente escribía kg, pasaba a reps, y el guardado de reps
      // salía con el peso VIEJO (el primero todavía no había vuelto). El upsert
      // pisaba la fila entera: quedaban las reps y se borraban los kg. Lo mismo
      // con series_detalle (siempre iba []) y rpe_real (siempre iba '').
      //
      // Ahora el upsert solo incluye las columnas que corresponden. PostgREST,
      // con merge-duplicates, actualiza únicamente las columnas presentes en
      // el JSON: las demás quedan intactas aunque lleguen dos pedidos cruzados.
      //
      // Reglas:
      //  · b.campo === 'peso' | 'reps' → se escribe ESE campo, aunque venga
      //    vacío (el cliente lo borró a propósito).
      //  · Sin b.campo (portal viejo todavía abierto en algún celular) → solo
      //    se escribe lo que venga con valor. Un vacío NUNCA pisa un dato.
      //  · series_detalle solo si viene como array (carga por serie).
      // ═══════════════════════════════════════════════════════════════════
      const vacio = (v) => v === "" || v == null;
      const aNumero = (v) => { const n = Number(String(v).replace(",", ".")); return isNaN(n) ? null : n; };
      const row = {
        id,
        gym_client_id: cli.id,
        plan_id, dia_id,
        dia_nombre: dia_nombre || "",
        ejercicio_id,
        ejercicio_nombre: ejercicio_nombre || "",
        semana: parseInt(semana),
        // Día en que ENTRENÓ (lo declara el cliente) vs. momento real de carga.
        // Antes `fecha` se llenaba con el día de carga en los 6.523 registros:
        // el campo existía pero no distinguía nada.
        fecha: fechaEntreno,
        cargado_el: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const campo = b.campo;
      if (campo === "peso") row.peso_real = vacio(b.peso_real) ? null : aNumero(b.peso_real);
      else if (!campo && !vacio(b.peso_real)) row.peso_real = aNumero(b.peso_real);

      if (campo === "reps") row.reps_real = (b.reps_real ?? "").toString().trim();
      else if (!campo && !vacio(b.reps_real)) row.reps_real = b.reps_real.toString().trim();

      if (!vacio(b.rpe_real)) row.rpe_real = b.rpe_real.toString();

      if (Array.isArray(b.series_detalle)) {
        row.series_detalle = b.series_detalle.slice(0, 12).map((x, i) => ({
          s: i + 1,
          peso: (x && x.peso != null) ? String(x.peso) : "",
          reps: (x && x.reps != null) ? String(x.reps) : "",
        }));
        // El resumen se recalcula acá, en el servidor, desde el detalle:
        // no depende de lo que el celular haya calculado con datos viejos.
        const pesos = row.series_detalle.map(x => aNumero(x.peso)).filter(v => v != null && v > 0);
        const reps = row.series_detalle.map(x => aNumero(x.reps)).filter(v => v != null);
        if (pesos.length) row.peso_real = Math.max(...pesos);
        if (reps.length) row.reps_real = String(reps.reduce((a, c) => a + c, 0));
      }

      await sb(`ejecucion_registros?on_conflict=id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
