// ═══════════════════════════════════════════════════════════════════════════
// EL INFORME DE REHABILITACIÓN
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE MANU REPORTÓ EL 27/11/2026
// "El PDF generado no brinda información adecuada ni suficiente."
//
// LA CAUSA, QUE NO ESTABA EN EL PDF
// El PDF era pobre porque no tenía qué imprimir. La IA devolvía una lista de
// 5-8 ejercicios y tres frases de criterio, así que el PDF imprimía una lista
// de 5-8 ejercicios y tres frases. Arreglar el PDF sin arreglar lo que la IA
// produce habría sido maquillar un documento vacío.
//
// Ahora hay un razonamiento clínico completo detrás, así que esto imprime:
//   · qué NO se puede dejar pasar, primero y en rojo — si hay que derivar, eso
//     manda sobre cualquier programa de ejercicios
//   · la formulación del caso y la interpretación de los hallazgos
//   · las hipótesis rankeadas, con qué las sostiene y qué las debilita
//   · el programa por fases, con los criterios de salida de cada una y su
//     umbral concreto
//   · cada ejercicio con su PROCEDIMIENTO, no solo su nombre: un nombre no
//     alcanza para ejecutarlo, y era la mitad de la queja
//   · el semáforo de carga, la progresión y la dosis fuera de sesión
//   · qué falta medir
//
// Usa `brandHeaderHTML` y `footerHTML`, que estaban escritos y sin usar desde
// el 29/10 como deuda marcada: los 6 PDFs armaban su propio encabezado.
import { brandHeaderHTML, footerHTML, getPrintCSS } from "./printStyles.js";
import { ejercicioDeBiblioteca, FASES_CLINICAS } from "./fisioRazonamiento.js";
import { SEMAFORO_CARGA, EJES } from "./fisioCriterios.js";
import { REGIONES } from "./rehabDB.js";

const esc = (t) => String(t ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const COLOR_PROB = { alta: '#CC0000', 'moderada-alta': '#D97706', moderada: '#CA8A04', baja: '#777' };

const seccion = (titulo, cuerpo) =>
  cuerpo ? `<div class="sec"><div class="sec-title">${esc(titulo)}</div><div class="sec-body">${cuerpo}</div></div>` : '';

// ─── El informe ────────────────────────────────────────────────────────────
// `programaGuardado` es lo que quedó en propuesta_ia: {analisis, criterios,
// programa}. `evaluados` es el resultado de evaluarFase, para poder imprimir
// el estado real de cada criterio y no solo su enunciado.
export function informeRehabHTML({
  paciente, evaluacion, analisis, criterios = [], programa,
  evaluados = null, marca = {}, evaluador = '',
}) {
  const nav = marca.colorPrimary || '#1A2744';
  const regs = (programa?.regiones || evaluacion?.regiones ||
                (evaluacion?.region ? [evaluacion.region] : []))
               .map(r => REGIONES[r]?.label || r).filter(Boolean);

  // ── Lo que no se puede dejar pasar: primero, siempre ──
  const alertas = (analisis?.no_dejar_pasar || []).length ? `
    <div style="border:2px solid #CC0000;background:#FEF2F2;border-radius:7px;padding:11px 13px;margin:12px 0">
      <div style="font-size:12px;font-weight:800;color:#CC0000;margin-bottom:6px">
        ANTES DE TRATAR — NO DEJAR PASAR
      </div>
      ${analisis.no_dejar_pasar.map(x => `
        <div style="margin-bottom:7px">
          <div style="font-size:11px;font-weight:700">${esc(x.que)}</div>
          <div style="font-size:10px;color:#555">${esc(x.por_que)}</div>
          <div style="font-size:10px;color:#CC0000;font-weight:700">Derivar si: ${esc(x.derivar_si)}</div>
        </div>`).join('')}
    </div>` : '';

  const interpretacion = (analisis?.interpretacion || []).map(s => `
    <div style="margin-bottom:9px;padding-left:9px;border-left:3px solid ${nav}">
      <div style="font-size:11px;font-weight:800">${esc(s.sistema)}</div>
      ${(s.hallazgos || []).map(h => `<div style="font-size:10px;color:#555">· ${esc(h)}</div>`).join('')}
      ${s.lectura ? `<div style="font-size:10px;font-style:italic;color:#1D4ED8;margin-top:3px;line-height:1.5">${esc(s.lectura)}</div>` : ''}
    </div>`).join('');

  const hipotesis = (analisis?.hipotesis || []).map(h => `
    <div style="border:1px solid #E0E0E0;border-radius:6px;padding:9px 11px;margin-bottom:7px">
      <div style="margin-bottom:4px">
        <span style="background:${COLOR_PROB[h.probabilidad] || '#777'};color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase">${esc(h.probabilidad)}</span>
        <strong style="font-size:11px;margin-left:6px">${esc(h.n)}. ${esc(h.titulo)}</strong>
      </div>
      ${h.fundamento ? `<div style="font-size:10px;color:#555;line-height:1.5;margin-bottom:4px">${esc(h.fundamento)}</div>` : ''}
      <table style="width:100%;font-size:9px;border:none"><tr style="border:none">
        <td style="width:50%;vertical-align:top;border:none;padding:0 6px 0 0">
          <div style="color:#16A34A;font-weight:700">A favor</div>
          ${(h.a_favor || []).map(x => `<div style="color:#555">+ ${esc(x)}</div>`).join('')}
        </td>
        <td style="width:50%;vertical-align:top;border:none;padding:0">
          <div style="color:#D97706;font-weight:700">En contra o falta</div>
          ${(h.en_contra || []).map(x => `<div style="color:#555">− ${esc(x)}</div>`).join('')}
        </td>
      </tr></table>
      ${(h.como_confirmar || []).length ? `<div style="font-size:9px;background:#EFF6FF;border-radius:4px;padding:4px 7px;margin-top:5px"><strong style="color:#1D4ED8">Para confirmarla:</strong> ${esc(h.como_confirmar.join(' · '))}</div>` : ''}
    </div>`).join('');

  const fase0 = analisis?.fase0?.necesaria ? `
    <div style="background:#EFF6FF;border:1px solid #93C5FD;border-radius:7px;padding:10px 12px;margin:10px 0">
      <div style="font-size:11px;font-weight:800;color:#1D4ED8">
        Fase 0 — confirmación clínica · ${esc(analisis.fase0.sesiones)} sesión(es)
      </div>
      <div style="font-size:10px;color:#555;margin:3px 0 6px">${esc(analisis.fase0.por_que)}</div>
      ${(analisis.fase0.bateria || []).map(b =>
        `<div style="font-size:10px"><strong>${esc(b.area)}:</strong> ${esc((b.pruebas || []).join(', '))}</div>`).join('')}
      ${analisis.fase0.que_decide ? `<div style="font-size:10px;font-style:italic;color:#1D4ED8;margin-top:5px">Qué decide: ${esc(analisis.fase0.que_decide)}</div>` : ''}
    </div>` : '';

  // ── Los criterios, con su umbral y su estado real ──
  // El estado es lo que vuelve exigible el criterio: "falta medir" dice qué ir
  // a medir en lugar de dejar el pase de fase a criterio del momento.
  const estadoDe = (id) => (evaluados?.criterios || []).find(c => c.id === id);
  const tablaCriterios = (lista, titulo) => !lista?.length ? '' : `
    <div style="margin:8px 0">
      <div style="font-size:9px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${esc(titulo)}</div>
      <table style="width:100%;font-size:9px;border-collapse:collapse">
        <tr style="background:#F4F4F4">
          <th style="text-align:left;padding:3px 5px">Eje</th>
          <th style="text-align:left;padding:3px 5px">Qué se mide</th>
          <th style="text-align:left;padding:3px 5px">Se pide</th>
          <th style="text-align:left;padding:3px 5px">Hoy</th>
        </tr>
        ${lista.map(c => {
          const e = estadoDe(c.id);
          const col = e?.estado === 'cumplido' ? '#16A34A' : e?.estado === 'no_cumplido' ? '#CC0000' : '#777';
          return `<tr>
            <td style="padding:3px 5px;color:#555">${esc(EJES[c.eje]?.label || c.eje)}</td>
            <td style="padding:3px 5px">${esc(c.que)}${c.lado ? ` <span style="color:#999">(${esc(c.lado)})</span>` : ''}</td>
            <td style="padding:3px 5px;font-weight:700">${esc(c.operador)} ${esc(c.umbral)}</td>
            <td style="padding:3px 5px;color:${col};font-weight:700">${esc(e ? (e.valor || e.estado) : '—')}</td>
          </tr>${c.porque ? `<tr><td></td><td colspan="3" style="padding:0 5px 3px;font-size:8px;color:#999;font-style:italic">${esc(c.porque)}</td></tr>` : ''}`;
        }).join('')}
      </table>
    </div>`;

  // ── El programa, fase por fase ──
  // Cada ejercicio sale con su PROCEDIMIENTO. Un nombre no alcanza para
  // ejecutarlo, y era la mitad de la queja sobre el PDF.
  const fases = (programa?.fases || []).map(f => {
    const faseInfo = FASES_CLINICAS.find(x => x.k === f.k);
    return `
    <div style="border:1px solid #E0E0E0;border-left:4px solid ${nav};border-radius:6px;padding:10px 12px;margin-bottom:9px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between">
        <div style="font-size:12px;font-weight:800">${esc(f.label)}</div>
        <div style="font-size:9px;color:#777">semanas ${esc(f.semanas)} · ${esc(f.sesiones)} sesiones · ${esc(f.frecuencia)}</div>
      </div>
      <div style="font-size:10px;color:#555;margin:3px 0 6px">${esc(f.objetivo || faseInfo?.objetivo || '')}</div>
      ${tablaCriterios(f.criterios_para_salir, 'Para salir de esta fase')}
      ${(f.sesiones_detalle || []).map(s => `
        <div style="background:#FAFAFA;border-radius:5px;padding:7px 9px;margin-bottom:5px">
          <div style="font-size:10px;font-weight:800;margin-bottom:4px">Sesión ${esc(s.n)} — ${esc(s.titulo)}</div>
          ${(s.bloques || []).map(b => `
            <div style="margin-bottom:5px">
              <div style="font-size:8px;color:${nav};font-weight:800;text-transform:uppercase;letter-spacing:.05em">${esc(b.tipo)}</div>
              ${(b.ejercicios || []).map(e => {
                const ex = ejercicioDeBiblioteca(e.id);
                return `<div style="margin:3px 0 3px 6px">
                  <div style="font-size:10px"><strong>${esc(ex ? ex.nombre : `⚠ ${e.id} — no está en la biblioteca`)}</strong>
                    <span style="color:${nav};font-weight:700"> · ${esc(e.param || ex?.param || '')}</span></div>
                  ${ex?.desc ? `<div style="font-size:9px;color:#666;line-height:1.45">${esc(ex.desc)}</div>` : ''}
                  ${e.nota ? `<div style="font-size:9px;color:#1D4ED8">Para este paciente: ${esc(e.nota)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>`).join('')}
          ${s.vigilar ? `<div style="font-size:9px;color:#D97706;margin-top:3px"><strong>Vigilar:</strong> ${esc(s.vigilar)}</div>` : ''}
        </div>`).join('')}
    </div>`;
  }).join('');

  const semaforo = `
    <table style="width:100%;font-size:9px;border-collapse:collapse">
      ${SEMAFORO_CARGA.map(s => `<tr>
        <td style="padding:4px 6px;white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${s.color}"></span>
          <strong style="color:${s.color};margin-left:4px">${esc(s.rango)}</strong></td>
        <td style="padding:4px 6px;font-weight:700;white-space:nowrap">${esc(s.accion)}</td>
        <td style="padding:4px 6px;color:#555">${esc(s.regla)}</td>
      </tr>`).join('')}
    </table>
    <div style="font-size:9px;color:#777;font-style:italic;margin-top:5px">
      No se aplica la regla de "si duele, parar todo": el objetivo de la rehabilitación es recuperar capacidad de carga, no que cada movimiento sea asintomático desde el principio.
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Programa de rehabilitación — ${esc(paciente?.nombre || '')} ${esc(paciente?.apellido || '')}</title>
<style>${getPrintCSS(nav, marca.colorSecondary || '#4A9B9B')}
  table{border-collapse:collapse}
  th,td{border-bottom:1px solid #EEE}
  @media print{.sec{page-break-inside:avoid}}
</style></head><body>

${brandHeaderHTML({
  titulo: 'Programa de rehabilitación',
  subtitulo: 'FisioActiva Colonia · Razonamiento clínico y planificación',
  extraMeta: `<div style="font-size:10px;color:#666">${esc(paciente?.nombre || '')} ${esc(paciente?.apellido || '')}</div>
              ${regs.length ? `<div style="font-size:10px;color:#666">${esc(regs.join(' · '))}</div>` : ''}
              ${evaluador ? `<div style="font-size:10px;color:#666">${esc(evaluador)}</div>` : ''}`,
})}

${programa?.titulo ? `<div style="margin:10px 0">
  <div style="font-size:16px;font-weight:800;color:${nav}">${esc(programa.titulo)}</div>
  ${programa.objetivo_global ? `<div style="font-size:11px;color:#444;margin-top:4px;line-height:1.5">${esc(programa.objetivo_global)}</div>` : ''}
  <div style="font-size:10px;color:#777;margin-top:5px">
    ${esc(programa.semanas_total || '?')} semanas · ${esc(programa.sesiones_total || '?')} sesiones
    ${evaluacion?.fecha ? ` · sobre la evaluación del ${esc(evaluacion.fecha)}` : ''}
  </div>
</div>` : ''}

${alertas}
${analisis?.lectura_global ? seccion('Formulación del caso', `<div style="font-size:11px;line-height:1.65">${esc(analisis.lectura_global)}</div>`) : ''}
${seccion('Interpretación de los hallazgos', interpretacion)}
${seccion('Hipótesis de trabajo, en orden de probabilidad', hipotesis)}
${fase0}
${tablaCriterios(criterios, 'Criterios de avance de fase definidos para este caso')}
${seccion('El programa', fases)}
${(programa?.progresion || []).length ? seccion('Progresión de carga del programa',
  `<div style="font-size:10px;color:#555;line-height:1.8">${esc(programa.progresion.join('  →  '))}</div>`) : ''}
${seccion('Semáforo de carga durante la sesión', semaforo)}
${programa?.dosis_fuera_de_sesion ? seccion('Fuera de la sesión',
  `<div style="font-size:10px;color:#555;line-height:1.55">${esc(programa.dosis_fuera_de_sesion)}</div>`) : ''}
${(programa?.educacion_paciente || []).length ? seccion('Para explicarle al paciente',
  programa.educacion_paciente.map(x => `<div style="font-size:10px;color:#555;margin-bottom:3px">· ${esc(x)}</div>`).join('')) : ''}
${(analisis?.faltantes_evaluacion || []).length ? seccion('Falta medir',
  analisis.faltantes_evaluacion.map(f => `<div style="font-size:10px;margin-bottom:3px"><strong>${esc(f.que)}</strong> <span style="color:#666">— ${esc(f.por_que)}</span></div>`).join('')) : ''}
${(programa?.faltan_en_biblioteca || []).length ? seccion('Ejercicios que faltan en la biblioteca',
  `<div style="font-size:9px;color:#777;margin-bottom:4px">El programa no los incluye. Agregalos a la biblioteca y reconstruilo si los querés usar.</div>` +
  programa.faltan_en_biblioteca.map(x => `<div style="font-size:10px">· <strong>${esc(x.nombre)}</strong> — ${esc(x.para_que)}</div>`).join('')) : ''}
${programa?.razonamiento ? seccion('Por qué este programa',
  `<div style="font-size:10px;color:#555;font-style:italic;line-height:1.55">${esc(programa.razonamiento)}</div>`) : ''}

${analisis?.advertencia ? `<div style="font-size:9px;color:#666;font-style:italic;background:#F4F4F4;border-radius:5px;padding:7px 10px;margin:10px 0">
  ${esc(analisis.advertencia)}
</div>` : ''}

<div class="sig" style="margin-top:18px">
  <div class="sig-line">Fisioterapeuta<br/>${esc(evaluador || '_______________')}</div>
  <div class="sig-line">Paciente<br/>${esc(paciente?.nombre || '')} ${esc(paciente?.apellido || '')}</div>
</div>

${footerHTML({ pieTexto: `Hipótesis de trabajo fisioterapéutica, no diagnóstico médico · ${new Date().toLocaleDateString('es-UY')}` })}
<script>window.onload=()=>{window.print()}<\/script></body></html>`;
}
