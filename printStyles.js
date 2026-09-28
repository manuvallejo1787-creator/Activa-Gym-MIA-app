// printStyles.js — CSS compartido para todos los documentos imprimibles
// (clínica, gym, nutrición). Antes cada uno de los 6 templates de impresión
// tenía su propio <style> inline, sin consistencia entre sí ni separadores
// claros entre renglones. Esto centraliza la hoja de estilos y aplica la
// paleta de marca (Azul Profundo Activo / Verde Energía Controlada / Coral)
// una sola vez, en un solo lugar — si Manu cambia la marca, se cambia acá.

export const PALETA = {
  azul:'#0A3D62', verde:'#1BAA86', gris:'#ECECEC', negro:'#222222', coral:'#FF6F4C',
};

// primary: color principal del documento (permite variar por app: clínica
// puede usar el verde de FisioActiva, gym el azul, etc. — pero comparten
// estructura y reglas de separación).
export function getPrintCSS(primary=PALETA.azul, accent=PALETA.verde){
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',Arial,sans-serif;color:${PALETA.negro};padding:28px;line-height:1.5;font-size:12px}
    h1,h2,h3{font-family:'Barlow Condensed',Arial,sans-serif;letter-spacing:.2px}

    /* ── Encabezado de marca ─────────────────────────────────────────── */
    .doc-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${primary};padding-bottom:14px;margin-bottom:22px}
    .doc-header .brand{font-size:20px;font-weight:800;color:${primary}}
    .doc-header .brand-tag{font-size:10px;color:#888;font-style:italic;margin-top:2px}
    .doc-header .doc-meta{text-align:right;font-size:10px;color:#666;line-height:1.6}
    .doc-header .doc-meta strong{color:${PALETA.negro}}

    /* ── Datos del paciente/cliente — grilla con separadores ─────────── */
    .datos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:20px;border:1px solid #e2e2e2;border-radius:6px;overflow:hidden}
    .datos-grid .campo{padding:8px 12px;border-right:1px solid #ececec;border-bottom:1px solid #ececec}
    .datos-grid .campo:nth-child(3n){border-right:none}
    .datos-grid .campo .lbl{font-size:8px;color:#999;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:2px}
    .datos-grid .campo .val{font-size:12px;font-weight:700}

    /* ── Secciones ────────────────────────────────────────────────────── */
    .sec{margin-bottom:16px;page-break-inside:avoid}
    .sec-title{background:${primary};color:#fff;padding:7px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-radius:5px 5px 0 0}
    .sec-body{border:1px solid #e2e2e2;border-top:none;padding:12px 14px;border-radius:0 0 5px 5px;background:#fff}

    /* ── Renglones con separador claro (la queja original: todo se veía
       amontonado). Cada fila tiene borde inferior y padding vertical
       generoso; la última fila del bloque no lleva borde. ─────────────── */
    .filas{display:flex;flex-direction:column}
    .fila{display:flex;justify-content:space-between;align-items:center;padding:7px 2px;border-bottom:1px solid #eee}
    .fila:last-child{border-bottom:none}
    .fila:nth-child(even){background:#FAFAFA}
    .fila .fila-label{font-weight:600;color:#444}
    .fila .fila-val{font-weight:800;color:${PALETA.negro}}

    /* ── Tabla estándar (nutrición, dosis, criterios) ───────────────────── */
    table.tabla-clara{width:100%;border-collapse:collapse;font-size:11px}
    table.tabla-clara th{background:${primary}12;color:${primary};text-align:left;padding:7px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.3px;border-bottom:2px solid ${primary}}
    table.tabla-clara td{padding:7px 10px;border-bottom:1px solid #eee}
    table.tabla-clara tr:nth-child(even) td{background:#FAFAFA}
    table.tabla-clara tr:last-child td{border-bottom:none}

    /* ── Tarjetas KPI ─────────────────────────────────────────────────── */
    .kpi-grid{display:grid;gap:8px;margin-bottom:16px}
    .kpi{background:#fff;border:2px solid #eee;border-radius:8px;padding:10px;text-align:center}
    .kpi .kpi-lbl{font-size:8px;color:#999;text-transform:uppercase;margin-bottom:3px}
    .kpi .kpi-val{font-size:19px;font-weight:800}

    /* ── Criterios / listas con flecha ───────────────────────────────── */
    .criterio{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid #f2f2f2;font-size:11px}
    .criterio:last-child{border-bottom:none}
    .criterio .arrow{color:${accent};font-weight:700;flex-shrink:0}

    /* ── Alertas ──────────────────────────────────────────────────────── */
    .alerta{border-radius:7px;padding:10px 14px;margin-bottom:14px;font-size:11px;border:1px solid}
    .alerta.roja{background:#FEF2F2;border-color:#FCA5A5;color:#991B1B}
    .alerta.verde{background:#F0FDF4;border-color:#86EFAC;color:#166534}
    .alerta.ambar{background:#FFFBEB;border-color:#FDE68A;color:#92400E}

    /* ── Pie de página con numeración y datos del centro ─────────────── */
    .doc-footer{margin-top:26px;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#999}
    .doc-footer .center-name{font-weight:700;color:${primary}}
    .firma-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:30px;page-break-inside:avoid}
    .firma-linea{border-top:1px solid #333;padding-top:6px;font-size:10px;text-align:center;color:#555}

    /* ── Alias compatibles con el markup ya existente en los 6 templates
       (no hubo que reescribir el HTML de cada uno, solo esta hoja) ────── */
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${primary};padding-bottom:12px;margin-bottom:18px}
    .footer{margin-top:22px;font-size:9px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:10px}
    .crit{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#FAFAFA;border-radius:5px;margin-bottom:5px;border-bottom:1px solid #eee;font-size:11px}
    .crit:last-child{margin-bottom:0}
    .sig{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:30px;page-break-inside:avoid}
    .sig-line{border-top:1px solid #333;padding-top:6px;font-size:10px;text-align:center;color:#555}
    .title-alta{text-align:center;padding:18px;background:${accent}12;border:2px solid ${accent}55;border-radius:8px;margin-bottom:20px}

    @page{size:A4;margin:14mm}
    @media print{
      body{padding:14px}
      .sec,.kpi-grid,.firma-grid,.sig{page-break-inside:avoid}
      .doc-header,.hdr{page-break-after:avoid}
    }
  `;
}

// Header de marca reutilizable — mismo bloque en los 6 documentos.
export function brandHeaderHTML({titulo, subtitulo, centro='FisioActiva Colonia · Método Activa Integra', fecha, extraMeta=''}){
  return `
    <div class="doc-header">
      <div>
        <div class="brand">${titulo}</div>
        <div class="brand-tag">${subtitulo||centro}</div>
      </div>
      <div class="doc-meta">
        <div><strong>${fecha||new Date().toLocaleDateString('es-UY')}</strong></div>
        ${extraMeta}
      </div>
    </div>
  `;
}

export function footerHTML({centro='FisioActiva Colonia', pieTexto=''}){
  return `<div class="doc-footer"><span class="center-name">${centro}</span><span>${pieTexto}</span></div>`;
}
