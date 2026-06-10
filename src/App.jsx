import { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard,BookOpen,Users,CreditCard,BarChart3,CheckSquare,Settings,
  Bell,Plus,Search,X,AlertTriangle,TrendingUp,TrendingDown,LogOut,Menu,
  CheckCircle2,Circle,Clock,Target,Activity,Filter,Download,ChevronRight,
  Package,Zap,ArrowUpRight,ArrowDownRight,Stethoscope,UserPlus,DollarSign,
  Wallet,RefreshCw,Eye,EyeOff,Edit2,Trash2,ChevronDown,Calendar
} from "lucide-react";
import {
  AreaChart,Area,BarChart,Bar,LineChart,Line,PieChart,Pie,Cell,
  XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid,Legend
} from "recharts";

// ── SUPABASE CLIENT ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://zqqqeckdgiyhwwnjjiwp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcXFlY2tkZ2l5aHd3bmpqaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTUyNzAsImV4cCI6MjA5NTQ5MTI3MH0.ZiaSEbWQUT9tUCxN0fPmwv10ig1beiMDEsI0l6ny3co";

async function sbFetch(tableAndFilter, options={}) {
  const { method="GET", body=null, filter="", upsert=false } = options;
  const url = `${SUPABASE_URL}/rest/v1/${tableAndFilter}${filter}`;
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
  if(method==="GET") headers["Accept"] = "application/json";
  if(method==="POST"||method==="PATCH") headers["Prefer"] = "return=representation";
  if(upsert) headers["Prefer"] = "return=representation,resolution=merge-duplicates";
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if(!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}


async function sbInsert(table, row) {
  return sbFetch(table, {method:"POST", body:row});
}
async function sbUpsert(table, rows) {
  return sbFetch(table, {method:"POST", body:rows, upsert:true});
}
async function sbUpdate(table, id, row) {
  return sbFetch(table, {method:"PATCH", body:row, filter:`?id=eq.${id}`});
}
async function sbDelete(table, id) {
  return sbFetch(table, {method:"DELETE", filter:`?id=eq.${id}`});
}

// Auth helpers
async function sbSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error_description || data.error);
  return data;
}
async function sbSignOut(token) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
  });
}

// ── BRAND ────────────────────────────────────────────────────────────────────
const RED="#CC0000",BG="#0F0F0F",SURF="#1A1A1A",SURF2="#222222",SURF3="#2A2A2A",
      BORD="#2E2E2E",GR="#555",GRLT="#888",GRLTT="#BBB",WH="#FFFFFF",
      GRN="#27AE60",YLW="#E67E22",BLU="#2471A3",PURP="#8E44AD";

const f$=n=>`$${Number(n).toLocaleString("es-UY")}`;
const fD=s=>new Date(s+"T12:00:00").toLocaleDateString("es-UY",{day:"2-digit",month:"2-digit",year:"2-digit"});
const TODAY=new Date("2026-05-23");
const dTo=s=>Math.round((new Date(s+"T12:00:00")-TODAY)/86400000);
const sc=p=>p>=90?GRN:p>=70?YLW:RED;

// ── EXPORT PDF (via print dialog → guardar como PDF) ──────────────────────────
function exportarPDF(titulo,htmlContenido){
  const w=window.open("","_blank");
  if(!w){alert("Permití las ventanas emergentes para exportar PDF");return;}
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    *{font-family:Arial,sans-serif;box-sizing:border-box}
    body{margin:0;padding:32px;color:#1a1a1a}
    h1{font-size:22px;color:#CC0000;margin:0 0 4px;border-bottom:3px solid #CC0000;padding-bottom:8px}
    .sub{font-size:12px;color:#666;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}
    th{background:#1a1a1a;color:#fff;padding:7px 9px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:6px 9px;border-bottom:1px solid #ddd}
    tr:nth-child(even){background:#f7f7f7}
    .tot{font-weight:bold;font-size:13px;margin:6px 0}
    .ing{color:#27AE60}.egr{color:#CC0000}
    .card{border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:12px}
    .label{font-size:10px;color:#888;text-transform:uppercase}
    .val{font-size:16px;font-weight:bold}
    @media print{body{padding:12px}}
  </style></head><body>
  <h1>${titulo}</h1>
  <div class="sub">ACTIVA Fitness Club + FisioActiva Colonia · Generado ${new Date().toLocaleDateString("es-UY")}</div>
  ${htmlContenido}
  <script>setTimeout(()=>{window.print();},300);</script>
  </body></html>`);
  w.document.close();
}

const priC=p=>p==="alta"?RED:p==="media"?YLW:GRLT;
const ngColor=ng=>ng==="Gym"?BLU:(ng==="Clinica"||ng==="Clínica")?GRN:(ng==="Compartido")?YLW:GRLT;

// ── CATALOGOS ────────────────────────────────────────────────────────────────
const METODOS=["Efectivo","Débito/Crédito","Transferencia BROU","Transferencia BBVA","MercadoPago"];
const CAT_ING_GYM=["Planes Gym","Venta Bebidas","Venta Comida Cremani","Fisio Activa","Otros Ingresos"];
const CAT_EGR_GYM=["Alquiler","Salario Manu","Salario Santiago","Creditos","Compra Bebidas","ANTEL","BPS","OSE","UTE","Seguros","Spotify","Papeleria","Otros Gastos"];
const CAT_ING_CLI=["Sesion Fisio Individual","Pack Fisio","Promo Lanzamiento","Sesion Evaluacion"];
const CAT_EGR_CLI=["Creditos","Salario Manu","Insumos Clinica","Otros Gastos"];
const CAT_ING=CAT_ING_GYM; const CAT_EGR=CAT_EGR_GYM;
const NEGOCIOS=["Gym","Clínica","Compartido"];
const PLANES={
  pro:          {l:"Plan PRO",           p:2300, cat:"presencial"},
  performance:  {l:"Plan Performance",   p:1600, cat:"presencial"},
  movete:       {l:"Plan Movete",        p:1400, cat:"presencial"},
  start:        {l:"Plan Start",         p:1200, cat:"presencial"},
  sala_x1:      {l:"Sala/Funcional x1",  p:700,  cat:"simple"},
  funcional_x2: {l:"Funcional x2",       p:1200, cat:"simple"},
  online_full:  {l:"Online Full",        p:1900, cat:"online"},
  nutri_trans:  {l:"Nutri Transforma",   p:4800, cat:"nutri"},
  nutri_pro:    {l:"Nutri Pro",          p:3600, cat:"nutri"},
  nutri_start:  {l:"Nutri Start",        p:2000, cat:"nutri"},
  protocolo:    {l:"Protocolo Activa 8s",p:15000,cat:"especial"},
};
const PLANES_MEM=["pro","performance","movete","start"];
const PACKS={
  individual:     {l:"Sesion Individual",                ses:1, gym:false,p:1000, costo:550},
  evaluacion:     {l:"Sesion Evaluacion",                ses:1, gym:false,p:1200, costo:550},
  promo:          {l:"Promo Lanzamiento",                ses:1, gym:false,p:1200, costo:770},
  fase_aguda:     {l:"Fase Aguda (7 ses)",               ses:7, gym:false,p:5200, costo:3850},
  rehab_completa: {l:"Rehab Completa (15 ses + 2m gym)", ses:15,gym:true, p:15950,costo:8250},
  mantenimiento:  {l:"Mantenimiento (2 ses/mes + gym)",  ses:2, gym:true, p:3500, costo:2200},
  prevencion:     {l:"Prevencion (4 ses/mes + gym)",     ses:4, gym:true, p:3500, costo:2200},
};
const FRENTES=["Conversión","Marketing","Integración","Pricing","Finanzas","Operaciones"];

// ── CATALOGOS DINAMICOS (se rellenan desde la base al iniciar) ────────────────
// PLANES, PACKS y las listas CAT_* arrancan con los valores de arriba como
// RESPALDO. Si la base responde, estos helpers los rellenan con los datos
// guardados (editables y persistentes). Si la base falla, queda el respaldo y
// nada se rompe. Mantienen la MISMA referencia de objeto/array, asi todos los
// lugares de la app que leen PLANES[clave] o CAT_ING siguen funcionando igual.
function _rellenarObj(target,fuente){
  Object.keys(target).forEach(k=>delete target[k]);
  Object.assign(target,fuente);
}
function _rellenarArr(target,fuente){
  target.length=0;
  fuente.forEach(x=>target.push(x));
}
async function cargarCatalogos(){
  // Planes: arma {clave:{l,p,cat}} desde planes_gym (solo activos)
  try{
    const d=await sbFetch("planes_gym?activa=eq.true&order=orden.asc,id.asc");
    if(d&&d.length){
      const obj={};d.forEach(r=>{obj[r.k]={l:r.l,p:+r.p,cat:r.cat||"presencial"};});
      _rellenarObj(PLANES,obj);
    }
  }catch(e){console.error("Error cargando planes_gym:",e.message);}
  // Packs: arma {clave:{l,ses,gym,p,costo}} desde packs_clinica_catalogo (solo activos)
  try{
    const d=await sbFetch("packs_clinica_catalogo?activa=eq.true&order=orden.asc,id.asc");
    if(d&&d.length){
      const obj={};d.forEach(r=>{obj[r.k]={l:r.l,ses:+r.ses,gym:!!r.gym,p:+r.p,costo:+r.costo};});
      _rellenarObj(PACKS,obj);
    }
  }catch(e){console.error("Error cargando packs_clinica_catalogo:",e.message);}
  // Categorias: reparte por lista en las 4 arrays module-level (solo activas)
  try{
    const d=await sbFetch("categorias?activa=eq.true&order=orden.asc,id.asc");
    if(d&&d.length){
      _rellenarArr(CAT_ING_GYM,d.filter(x=>x.lista==="ingGym").map(x=>x.nombre));
      _rellenarArr(CAT_EGR_GYM,d.filter(x=>x.lista==="egrGym").map(x=>x.nombre));
      _rellenarArr(CAT_ING_CLI,d.filter(x=>x.lista==="ingCli").map(x=>x.nombre));
      _rellenarArr(CAT_EGR_CLI,d.filter(x=>x.lista==="egrCli").map(x=>x.nombre));
    }
  }catch(e){console.error("Error cargando categorias:",e.message);}
}

// ── DATA INICIAL ─────────────────────────────────────────────────────────────
const CLI0=[
  {id:1,n:"Lucas Fernández",sx:"M",alta:"2023-03-15",neg:"gym",plan:"performance",st:"activo",tel:"099 111 222",email:"lucas@mail.com",notas:""},
  {id:2,n:"Valentina Pérez",sx:"F",alta:"2022-08-20",neg:"gym",plan:"pro",st:"activo",tel:"099 333 444",email:"valen@mail.com",notas:""},
  {id:3,n:"Martín García",sx:"M",alta:"2024-01-10",neg:"ambos",plan:"performance",st:"activo",tel:"099 555 666",email:"martin@mail.com",notas:"Derivado clínica por rodilla"},
  {id:4,n:"Sofía Rodríguez",sx:"F",alta:"2024-06-05",neg:"clinica",plan:null,st:"activo",tel:"099 777 888",email:"sofia@mail.com",notas:"Lumbalgia crónica"},
  {id:5,n:"Diego Martínez",sx:"M",alta:"2025-02-14",neg:"gym",plan:"start",st:"activo",tel:"099 999 000",email:"diego@mail.com",notas:"Candidato PRO"},
  {id:6,n:"Camila López",sx:"F",alta:"2025-09-01",neg:"gym",plan:"performance",st:"activo",tel:"099 111 333",email:"cami@mail.com",notas:""},
  {id:7,n:"Andrés Suárez",sx:"M",alta:"2025-11-20",neg:"ambos",plan:"performance",st:"activo",tel:"099 444 555",email:"andres@mail.com",notas:""},
  {id:8,n:"Paula González",sx:"F",alta:"2026-01-15",neg:"clinica",plan:null,st:"activo",tel:"099 666 777",email:"paula@mail.com",notas:"Pack Prevención activo"},
  {id:9,n:"Felipe Torres",sx:"M",alta:"2026-02-28",neg:"gym",plan:"performance",st:"activo",tel:"099 888 999",email:"felipe@mail.com",notas:""},
  {id:10,n:"Natalia Castro",sx:"F",alta:"2026-03-10",neg:"gym",plan:"performance",st:"activo",tel:"099 222 333",email:"nata@mail.com",notas:""},
  {id:11,n:"Bruno Silva",sx:"M",alta:"2026-04-01",neg:"gym",plan:"performance",st:"activo",tel:"099 334 445",email:"bruno@mail.com",notas:""},
  {id:12,n:"Isabella Núñez",sx:"F",alta:"2026-04-15",neg:"ambos",plan:"performance",st:"activo",tel:"099 556 667",email:"isa@mail.com",notas:""},
  {id:13,n:"Ramiro Pérez",sx:"M",alta:"2024-09-10",neg:"gym",plan:"performance",st:"inactivo",tel:"099 667 778",email:"rami@mail.com",notas:"Baja temporaria"},
  {id:14,n:"Florencia Díaz",sx:"F",alta:"2023-12-01",neg:"gym",plan:"start",st:"activo",tel:"099 778 889",email:"flor@mail.com",notas:""},
];

const TRX0=[
  {id:1,f:"2026-05-23",c:"Mensualidad Performance · Lucas F.",m:1600,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Transferencia BROU",b:"B-0892",cl:1},
  {id:2,f:"2026-05-22",c:"Pack Rehab Completa · Martín G.",m:15950,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"MercadoPago",b:"B-0891",cl:3},
  {id:3,f:"2026-05-22",c:"Mensualidad PRO · Valentina P.",m:2200,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Débito/Crédito",b:"B-0890",cl:2},
  {id:4,f:"2026-05-21",c:"Servicio eléctrico BIS",m:4200,t:"egreso",ng:"Compartido",cat:"Servicios",mp:"Transferencia BROU",b:null,cl:null},
  {id:5,f:"2026-05-20",c:"Sesión Individual · Sofía R.",m:1000,t:"ingreso",ng:"Clínica",cat:"Sesión Clínica",mp:"Efectivo",b:"B-0889",cl:4},
  {id:6,f:"2026-05-20",c:"Mensualidades Gym · Lote Performance ×9",m:12800,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"L-05-01",cl:null},
  {id:7,f:"2026-05-20",c:"Venta bebidas ×5",m:600,t:"ingreso",ng:"Gym",cat:"Venta Mercadería",mp:"Efectivo",b:null,cl:null},
  {id:8,f:"2026-05-19",c:"Artículos de limpieza",m:890,t:"egreso",ng:"Compartido",cat:"Limpieza",mp:"Efectivo",b:null,cl:null},
  {id:9,f:"2026-05-18",c:"Plan Nutricional · Diego M.",m:1500,t:"ingreso",ng:"Gym",cat:"Plan Nutricional",mp:"MercadoPago",b:"B-0887",cl:5},
  {id:10,f:"2026-05-18",c:"Pack Prevención · Paula G.",m:5400,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"Transferencia BBVA",b:"B-0886",cl:8},
  {id:11,f:"2026-05-16",c:"Lote mensualidades Gym ×9",m:13700,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"L-05-02",cl:null},
  {id:12,f:"2026-05-15",c:"Salario empleado · Mayo",m:28000,t:"egreso",ng:"Compartido",cat:"Salario",mp:"Transferencia BROU",b:null,cl:null},
  {id:13,f:"2026-05-15",c:"Sesiones Clínica ×3",m:2850,t:"ingreso",ng:"Clínica",cat:"Sesión Clínica",mp:"Efectivo",b:"B-0884",cl:null},
  {id:14,f:"2026-05-13",c:"Lote mensualidades Gym PRO+Perf",m:16800,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"L-05-03",cl:null},
  {id:15,f:"2026-05-12",c:"Insumos fisioterapia",m:3200,t:"egreso",ng:"Clínica",cat:"Insumos Clínica",mp:"Débito/Crédito",b:null,cl:null},
  {id:16,f:"2026-05-10",c:"Pack Fase Aguda · nuevo paciente",m:6300,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"Efectivo",b:"B-0881",cl:null},
  {id:17,f:"2026-05-10",c:"Alquiler local · Mayo",m:35000,t:"egreso",ng:"Compartido",cat:"Alquiler",mp:"Transferencia BROU",b:null,cl:null},
  {id:18,f:"2026-05-09",c:"Lote mensualidades Gym ×9",m:13000,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"L-05-04",cl:null},
  {id:19,f:"2026-05-08",c:"Publicidad Instagram · Mayo",m:3500,t:"egreso",ng:"Compartido",cat:"Marketing",mp:"Débito/Crédito",b:null,cl:null},
  {id:20,f:"2026-05-07",c:"Compra bebidas e isotónicas",m:2400,t:"egreso",ng:"Gym",cat:"Venta Mercadería",mp:"Efectivo",b:null,cl:null},
  {id:21,f:"2026-05-06",c:"Lote mensualidades Gym PRO+Perf",m:11400,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"L-05-05",cl:null},
  {id:22,f:"2026-05-05",c:"Mensualidad Base · Diego M.",m:900,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"B-0878",cl:5},
  {id:23,f:"2026-05-05",c:"Pack Mantenimiento · clínica",m:3500,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"MercadoPago",b:"B-0877",cl:null},
  {id:24,f:"2026-05-03",c:"Lote mensualidades Gym ×6",m:10800,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"L-05-06",cl:null},
  {id:25,f:"2026-05-02",c:"Plan Nutricional · nueva consulta",m:1500,t:"ingreso",ng:"Gym",cat:"Plan Nutricional",mp:"Efectivo",b:"B-0875",cl:null},
  {id:50,f:"2026-04-30",c:"Cierre Abril · Mensualidades Gym",m:105700,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"CIE-ABR-GYM",cl:null},
  {id:51,f:"2026-04-30",c:"Cierre Abril · Ingresos Clínica",m:28400,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"Efectivo",b:"CIE-ABR-CLI",cl:null},
  {id:52,f:"2026-04-30",c:"Cierre Abril · Gastos Fijos+Variables",m:89500,t:"egreso",ng:"Compartido",cat:"Alquiler",mp:"Efectivo",b:null,cl:null},
  {id:53,f:"2026-03-31",c:"Cierre Marzo · Mensualidades Gym",m:105000,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"CIE-MAR-GYM",cl:null},
  {id:54,f:"2026-03-31",c:"Cierre Marzo · Ingresos Clínica",m:22000,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"Efectivo",b:"CIE-MAR-CLI",cl:null},
  {id:55,f:"2026-03-31",c:"Cierre Marzo · Gastos",m:94000,t:"egreso",ng:"Compartido",cat:"Alquiler",mp:"Efectivo",b:null,cl:null},
  {id:56,f:"2026-02-28",c:"Cierre Febrero · Gym",m:102000,t:"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"CIE-FEB-GYM",cl:null},
  {id:57,f:"2026-02-28",c:"Cierre Febrero · Clínica",m:15000,t:"ingreso",ng:"Clínica",cat:"Pack Clínica",mp:"Efectivo",b:"CIE-FEB-CLI",cl:null},
  {id:58,f:"2026-02-28",c:"Cierre Febrero · Gastos",m:92000,t:"egreso",ng:"Compartido",cat:"Alquiler",mp:"Efectivo",b:null,cl:null},
];

// ── DATOS HISTÓRICOS REALES (Drive) ──────────────────────────────────────────
const HIST_ANUAL=[
  {ano:"2020",bal:100680,rent:34.63,cli_avg:26},
  {ano:"2021",bal:90170, rent:10.21,cli_avg:72},
  {ano:"2022",bal:220112,rent:16.01,cli_avg:105},
  {ano:"2023",bal:45086, rent:2.24, cli_avg:123},
  {ano:"2024",bal:-12171,rent:-0.62,cli_avg:124},
  {ano:"2025",bal:28025, rent:1.29, cli_avg:95},
];
const CLI_HIST={
  y22:[66,74,88,93,89,73,109,133,154,141,137,108],
  y23:[86,102,117,119,125,116,123,146,143,152,141,107],
  y24:[110,104,103,124,125,136,129,141,150,134,136,99],
  y25:[101,98,89,91,96,101,98,100,103,94,89,82],
  y26:[52,50,63,null,null,null,null,null,null,null,null,null],
};
const MESES_L=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── PRODUCTOS REALES (Precios Articulos 2026) ─────────────────────────────────
const PRODUCTOS=[
  {id:1,cat:"Comida",  nom:"Crema de mani",      p:280},
  {id:2,cat:"Comida",  nom:"Crema de avellanas",  p:450},
  {id:3,cat:"Comida",  nom:"Crema de almendras",  p:400},
  {id:4,cat:"Comida",  nom:"Barritas",            p:60},
  {id:5,cat:"Comida",  nom:"Mix frutos secos",    p:900},
  {id:6,cat:"Bebidas", nom:"Agua sin gas",        p:60},
  {id:7,cat:"Bebidas", nom:"Agua con gas",        p:60},
  {id:8,cat:"Bebidas", nom:"Powerade",            p:60},
  {id:9,cat:"Ropa",    nom:"Remera ACTIVA",       p:800},
];

// ── TRANSACCIONES REALES ENERO 2026 ──────────────────────────────────────────
// Fuente: Libro Diario Gym Enero 2026 + Balance Anual Clinica Enero 2026
const TRX_ENE=[
  {f:"2026-01-05",c:"Credito BBVA maquinas cuota 2/48",          m:12298,t:"egreso", ng:"Gym",       cat:"Creditos",              mp:"Transferencia BBVA"},
  {f:"2026-01-06",c:"Planes Gym x4 clientes",                    m:6000, t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-06",c:"Venta Bebidas x2",                          m:120,  t:"ingreso",ng:"Gym",       cat:"Venta Bebidas",         mp:"Efectivo"},
  {f:"2026-01-07",c:"Planes Gym x2 clientes",                    m:2800, t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-07",c:"Salario Santiago Enero",                    m:5000, t:"egreso", ng:"Gym",       cat:"Salario Santiago",      mp:"Transferencia BROU"},
  {f:"2026-01-08",c:"Salario Manu cuota",                        m:4000, t:"egreso", ng:"Gym",       cat:"Salario Manu",          mp:"Efectivo"},
  {f:"2026-01-08",c:"Planes Gym x5 clientes",                    m:8000, t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-09",c:"Planes Gym x14 clientes",                   m:20400,t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-10",c:"Alquiler Brunelli Enero",                   m:19749,t:"egreso", ng:"Compartido",cat:"Alquiler",              mp:"Transferencia BROU"},
  {f:"2026-01-10",c:"Salario Manu cuota",                        m:10000,t:"egreso", ng:"Gym",       cat:"Salario Manu",          mp:"Efectivo"},
  {f:"2026-01-12",c:"Planes Gym x7 clientes",                    m:10800,t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-13",c:"Planes Gym x5 clientes",                    m:7200, t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-13",c:"Spotify",                                   m:300,  t:"egreso", ng:"Gym",       cat:"Spotify",               mp:"Debito/Credito"},
  {f:"2026-01-13",c:"Papeleria Office 2000",                     m:414,  t:"egreso", ng:"Gym",       cat:"Papeleria",             mp:"Efectivo"},
  {f:"2026-01-14",c:"Planes Gym x9 clientes",                    m:12800,t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-14",c:"Venta Comida Cremani x2",                   m:120,  t:"ingreso",ng:"Gym",       cat:"Venta Comida Cremani",  mp:"Efectivo"},
  {f:"2026-01-14",c:"Compra Bebidas Belater SA",                 m:2612, t:"egreso", ng:"Gym",       cat:"Compra Bebidas",        mp:"Efectivo"},
  {f:"2026-01-16",c:"Seguros Porto Seguro",                      m:1351, t:"egreso", ng:"Gym",       cat:"Seguros",               mp:"Debito/Credito"},
  {f:"2026-01-16",c:"Salario Manu cuota",                        m:10000,t:"egreso", ng:"Gym",       cat:"Salario Manu",          mp:"Efectivo"},
  {f:"2026-01-16",c:"Credito BBVA clinica cuota 1/12",           m:1285, t:"egreso", ng:"Clinica",   cat:"Creditos",              mp:"Transferencia BBVA"},
  {f:"2026-01-20",c:"Planes Gym x1 cliente",                     m:1600, t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-21",c:"ANTEL Enero",                               m:1275, t:"egreso", ng:"Compartido",cat:"ANTEL",                 mp:"Debito/Credito"},
  {f:"2026-01-21",c:"BPS Enero",                                 m:9038, t:"egreso", ng:"Compartido",cat:"BPS",                   mp:"Transferencia BROU"},
  {f:"2026-01-21",c:"OSE Enero",                                 m:3532, t:"egreso", ng:"Compartido",cat:"OSE",                   mp:"Debito/Credito"},
  {f:"2026-01-21",c:"UTE Enero",                                 m:3667, t:"egreso", ng:"Compartido",cat:"UTE",                   mp:"Debito/Credito"},
  {f:"2026-01-22",c:"Sesion Fisio Individual",                   m:1000, t:"ingreso",ng:"Clinica",   cat:"Sesion Fisio Individual",mp:"Efectivo"},
  {f:"2026-01-23",c:"Planes Gym x3 clientes",                    m:4000, t:"ingreso",ng:"Gym",       cat:"Planes Gym",            mp:"Efectivo"},
  {f:"2026-01-23",c:"Otros Ingresos aportes contribuidor",       m:10000,t:"ingreso",ng:"Gym",       cat:"Otros Ingresos",        mp:"Transferencia BROU"},
  {f:"2026-01-23",c:"Otros Gastos DAC fletes maquinas",          m:3005, t:"egreso", ng:"Gym",       cat:"Otros Gastos",          mp:"Efectivo"},
  {f:"2026-01-26",c:"Otros Gastos DAC fletes maquinas",          m:4776, t:"egreso", ng:"Gym",       cat:"Otros Gastos",          mp:"Efectivo"},
  {f:"2026-01-26",c:"Venta Comida Cremani",                      m:280,  t:"ingreso",ng:"Gym",       cat:"Venta Comida Cremani",  mp:"Efectivo"},
  {f:"2026-01-27",c:"Sesion Fisio Promo lanzamiento",            m:1200, t:"ingreso",ng:"Clinica",   cat:"Promo Lanzamiento",     mp:"Efectivo"},
  {f:"2026-01-28",c:"Sesion Fisio Promo lanzamiento",            m:1200, t:"ingreso",ng:"Clinica",   cat:"Promo Lanzamiento",     mp:"Efectivo"},
  {f:"2026-01-29",c:"Otros Gastos DAC fletes maquinas",          m:4402, t:"egreso", ng:"Gym",       cat:"Otros Gastos",          mp:"Efectivo"},
  {f:"2026-01-29",c:"Sesion Fisio Promo lanzamiento",            m:1200, t:"ingreso",ng:"Clinica",   cat:"Promo Lanzamiento",     mp:"Efectivo"},
  {f:"2026-01-30",c:"Salario Manu cuota",                        m:4000, t:"egreso", ng:"Gym",       cat:"Salario Manu",          mp:"Efectivo"},
  {f:"2026-01-30",c:"Sesion Fisio Promo lanzamiento x3",         m:3600, t:"ingreso",ng:"Clinica",   cat:"Promo Lanzamiento",     mp:"Efectivo"},
  {f:"2026-01-30",c:"Salario Manu clinica Enero",                m:1000, t:"egreso", ng:"Clinica",   cat:"Salario Manu",          mp:"Efectivo"},
  {f:"2026-01-31",c:"Fisio Activa Enero",                        m:7000, t:"ingreso",ng:"Gym",       cat:"Fisio Activa",          mp:"Efectivo"},
  {f:"2026-01-31",c:"Sesion Fisio Promo lanzamiento",            m:1200, t:"ingreso",ng:"Clinica",   cat:"Promo Lanzamiento",     mp:"Efectivo"},
].map((t,i)=>({...t,id:300+i,b:null,cl:null}));


const MEM0=[
  {id:1,cl:1,plan:"performance",m:1600,pago:"2026-05-23",venc:"2026-06-23",mp:"Transferencia BROU",b:"B-0892"},
  {id:2,cl:2,plan:"pro",m:2200,pago:"2026-05-20",venc:"2026-06-20",mp:"Débito/Crédito",b:"B-0890"},
  {id:3,cl:5,plan:"start",m:900,pago:"2026-05-05",venc:"2026-06-05",mp:"Efectivo",b:"B-0878"},
  {id:4,cl:6,plan:"performance",m:1600,pago:"2026-04-25",venc:"2026-05-25",mp:"Efectivo",b:"B-0871"},
  {id:5,cl:7,plan:"performance",m:1600,pago:"2026-04-28",venc:"2026-05-28",mp:"MercadoPago",b:"B-0874"},
  {id:6,cl:9,plan:"performance",m:1600,pago:"2026-05-15",venc:"2026-06-15",mp:"Transferencia BROU",b:"B-0885"},
  {id:7,cl:10,plan:"performance",m:1600,pago:"2026-05-18",venc:"2026-06-18",mp:"Transferencia BBVA",b:"B-0887"},
  {id:8,cl:11,plan:"performance",m:1600,pago:"2026-05-01",venc:"2026-06-01",mp:"Efectivo",b:"B-0877"},
  {id:9,cl:12,plan:"performance",m:1600,pago:"2026-05-10",venc:"2026-06-10",mp:"Transferencia BROU",b:"B-0883"},
  {id:10,cl:3,plan:"performance",m:1600,pago:"2026-04-20",venc:"2026-05-20",mp:"MercadoPago",b:"B-0866"},
  {id:11,cl:14,plan:"start",m:900,pago:"2026-05-02",venc:"2026-06-02",mp:"Efectivo",b:"B-0876"},
];

const PACKS_ACT0=[
  {id:1,cl:4,pack:"rehab_completa",ses_tot:15,ses_uso:5,inicio:"2026-04-10",venc:"2026-07-10",pago:"2026-04-10",mp:"MercadoPago",b:"B-0855"},
  {id:2,cl:8,pack:"prevencion",ses_tot:4,ses_uso:2,inicio:"2026-05-01",venc:"2026-05-31",pago:"2026-05-01",mp:"Transferencia BBVA",b:"B-0876"},
  {id:3,cl:3,pack:"mantenimiento",ses_tot:2,ses_uso:1,inicio:"2026-05-01",venc:"2026-05-31",pago:"2026-05-01",mp:"MercadoPago",b:"B-0875"},
  {id:4,cl:12,pack:"fase_aguda",ses_tot:7,ses_uso:3,inicio:"2026-05-15",venc:"2026-06-15",pago:"2026-05-15",mp:"Efectivo",b:"B-0884"},
];

const TAREAS0=[
  // ── CONVERSION ──────────────────────────────────────────────────────────
  {id:1, titulo:"Conversaciones Plan PRO con candidatos identificados",         frente:"Conversion",  pri:"alta",  st:"pendiente",  vence:"2026-05-31"},
  {id:2, titulo:"Activar Plan PRO en al menos 3 socios Performance este mes",   frente:"Conversion",  pri:"alta",  st:"pendiente",  vence:"2026-06-15"},
  {id:3, titulo:"Revisar candidatos Pack Prevencion desde base gym activa",     frente:"Conversion",  pri:"media", st:"pendiente",  vence:"2026-06-30"},
  {id:4, titulo:"Seguimiento packs clinica activos - control sesiones",         frente:"Conversion",  pri:"media", st:"pendiente",  vence:"2026-06-07"},
  // ── MARKETING ───────────────────────────────────────────────────────────
  {id:5, titulo:"Publicar 2 posts @fisioactivacolonia esta semana",             frente:"Marketing",   pri:"alta",  st:"pendiente",  vence:"2026-05-30"},
  {id:6, titulo:"Definir calendario contenido Instagram Junio",                 frente:"Marketing",   pri:"media", st:"pendiente",  vence:"2026-05-28"},
  {id:7, titulo:"Confirmar sesion de fotos FisioActiva completada",             frente:"Marketing",   pri:"media", st:"completado", vence:"2026-04-20"},
  {id:8, titulo:"Publicar caso clinico real en Instagram (con permiso paciente)",frente:"Marketing",  pri:"media", st:"pendiente",  vence:"2026-06-15"},
  {id:9, titulo:"Activar Google Business - solicitar resenas a pacientes",      frente:"Marketing",   pri:"baja",  st:"pendiente",  vence:"2026-06-30"},
  // ── INTEGRACION ─────────────────────────────────────────────────────────
  {id:10,titulo:"Protocolo Activa Integra - derivaciones gym-clinica",          frente:"Integracion", pri:"media", st:"pendiente",  vence:"2026-06-15"},
  {id:11,titulo:"Identificar 5 socios gym candidatos a evaluacion clinica",     frente:"Integracion", pri:"alta",  st:"pendiente",  vence:"2026-06-01"},
  {id:12,titulo:"Presentar Pack Prevencion a socios con historial de lesion",   frente:"Integracion", pri:"media", st:"pendiente",  vence:"2026-06-30"},
  {id:13,titulo:"Revisar bundle gimnasio+clinica para nuevos clientes",         frente:"Integracion", pri:"baja",  st:"pendiente",  vence:"2026-07-01"},
  // ── PRICING ─────────────────────────────────────────────────────────────
  {id:14,titulo:"Etapa 2 precios clinica (90 dias apertura)",                   frente:"Pricing",     pri:"alta",  st:"pendiente",  vence:"2026-06-01"},
  {id:15,titulo:"Revisar margen packs clinica vs costo real por sesion",        frente:"Pricing",     pri:"media", st:"pendiente",  vence:"2026-06-15"},
  {id:16,titulo:"Evaluar precio Plan PRO vs valor percibido por socios",        frente:"Pricing",     pri:"baja",  st:"pendiente",  vence:"2026-07-01"},
  // ── FINANZAS ────────────────────────────────────────────────────────────
  {id:17,titulo:"Calcular distribucion Q1 clinica socio 75/25",                 frente:"Finanzas",    pri:"alta",  st:"pendiente",  vence:"2026-06-01"},
  {id:18,titulo:"Revisar costo credito BBVA clinica - cuotas restantes",        frente:"Finanzas",    pri:"media", st:"pendiente",  vence:"2026-06-01"},
  {id:19,titulo:"Proyectar break-even 100 socios gym - timeline realista",      frente:"Finanzas",    pri:"media", st:"pendiente",  vence:"2026-06-30"},
  {id:20,titulo:"Fondos estrategicos - verificar saldos acumulados Q1",         frente:"Finanzas",    pri:"media", st:"pendiente",  vence:"2026-06-15"},
  // ── OPERACIONES ─────────────────────────────────────────────────────────
  {id:21,titulo:"Revisar sistema de comisiones empleado Q2",                    frente:"Operaciones", pri:"media", st:"pendiente",  vence:"2026-06-10"},
  {id:22,titulo:"Definir protocolo cobranza membresias vencidas",               frente:"Operaciones", pri:"alta",  st:"pendiente",  vence:"2026-06-01"},
  {id:23,titulo:"Cargar transacciones Abril y Mayo en libro diario",            frente:"Operaciones", pri:"alta",  st:"pendiente",  vence:"2026-05-31"},
  {id:24,titulo:"Inventario fisico equipamiento gym - actualizacion",           frente:"Operaciones", pri:"baja",  st:"pendiente",  vence:"2026-07-01"},
];

const CHART_DATA=[
  {mes:"Ene",gym:93580, clinica:9400,  gastos:101704},
  {mes:"Feb",gym:101000,clinica:23863, gastos:113642},
  {mes:"Mar",gym:87200, clinica:15450, gastos:76438},
  {mes:"Abr",gym:0,     clinica:5000,  gastos:0},
  {mes:"May",gym:0,     clinica:0,     gastos:0},
];
const CHART0=CHART_DATA;

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
const GF=`@keyframes spin{to{transform:rotate(360deg)}}@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Bebas+Neue&display=swap');
*{box-sizing:border-box}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#111}
::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1)}
input[type=number]::-webkit-inner-spin-button{display:none}
`;

const Card=({children,style={}})=>(
  <div style={{background:SURF,border:`1px solid ${BORD}`,borderRadius:12,padding:20,...style}}>{children}</div>
);
const Badge=({label,color=GRLT,sm=false})=>(
  <span style={{background:color+"22",color,fontSize:sm?10:11,fontWeight:700,padding:sm?"2px 6px":"2px 8px",borderRadius:4,letterSpacing:.4,whiteSpace:"nowrap"}}>{label}</span>
);
const Dot=({color})=>(<div style={{width:8,height:8,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}`,flexShrink:0}}/>);
const SemBar=({pct,label})=>{
  const c=sc(pct);
  return(<div style={{marginTop:8}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:GRLT,marginBottom:4}}>
      <span>{label}</span><span style={{color:c,fontWeight:700}}>{pct}%</span>
    </div>
    <div style={{height:4,background:SURF3,borderRadius:2}}>
      <div style={{height:4,width:`${Math.min(pct,100)}%`,background:c,borderRadius:2,transition:"width .5s"}}/>
    </div>
  </div>);
};
const Modal=({title,onClose,children,wide=false})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:16,width:"100%",maxWidth:wide?660:500,maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{padding:"18px 24px",borderBottom:`1px solid ${BORD}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:SURF2,zIndex:1}}>
        <div style={{fontWeight:700,fontSize:15}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,padding:4,lineHeight:0}}><X size={17}/></button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>
);
const Inp=({label,...props})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:10,color:GRLT,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>{label}</label>}
    <input style={{width:"100%",background:SURF3,border:`1px solid ${BORD}`,borderRadius:8,padding:"10px 12px",color:WH,fontSize:13,outline:"none",...(props.style||{})}} {...props} style={undefined}/>
  </div>
);
const Sel=({label,children,...props})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:10,color:GRLT,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>{label}</label>}
    <select style={{width:"100%",background:SURF3,border:`1px solid ${BORD}`,borderRadius:8,padding:"10px 12px",color:WH,fontSize:13,outline:"none"}} {...props}>{children}</select>
  </div>
);
const Txta=({label,...props})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:10,color:GRLT,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>{label}</label>}
    <textarea rows={3} style={{width:"100%",background:SURF3,border:`1px solid ${BORD}`,borderRadius:8,padding:"10px 12px",color:WH,fontSize:13,outline:"none",resize:"vertical"}} {...props}/>
  </div>
);
const Btn=({children,onClick,variant="primary",style={},small=false,disabled=false})=>(
  <button onClick={onClick} disabled={disabled} style={{
    background:variant==="primary"?RED:variant==="success"?GRN:variant==="info"?BLU:"transparent",
    border:variant==="ghost"?`1px solid ${BORD}`:"none",
    color:WH,padding:small?"7px 14px":"10px 18px",borderRadius:8,
    cursor:disabled?"not-allowed":"pointer",fontSize:small?12:13,fontWeight:600,
    display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?.5:1,...style
  }}>{children}</button>
);

// ── ADD TRANSACTION MODAL ─────────────────────────────────────────────────────
function AddTransModal({onClose,onSave,clientes,cajeroMode=false}){
  const[form,setForm]=useState({f:"2026-05-23",c:"",m:"",t:cajeroMode?"ingreso":"ingreso",ng:"Gym",cat:"Mensualidad Gym",mp:"Efectivo",b:"",cl:""});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const cats=(()=>{
    const ing=form.t==="ingreso";
    if(form.ng==="Clínica")return ing?CAT_ING_CLI:CAT_EGR_CLI;
    if(form.ng==="Compartido")return [...new Set([...(ing?CAT_ING_GYM:CAT_EGR_GYM),...(ing?CAT_ING_CLI:CAT_EGR_CLI)])];
    return ing?CAT_ING_GYM:CAT_EGR_GYM;
  })();
  const ok=form.c&&form.m&&form.mp;
  return(
    <Modal title="Nueva Transacción" onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Inp label="Fecha" type="date" value={form.f} onChange={e=>set("f",e.target.value)}/>
        <Sel label="Tipo" value={form.t} onChange={e=>{set("t",e.target.value);set("cat",e.target.value==="ingreso"?"Mensualidad Gym":"Alquiler");}}>
          <option value="ingreso">Ingreso</option>
          {!cajeroMode&&<option value="egreso">Egreso</option>}
        </Sel>
      </div>
      <Inp label="Concepto" value={form.c} onChange={e=>set("c",e.target.value)} placeholder="Descripción del movimiento"/>
    <Inp label="Detalle (opcional)" value={form.det||""} onChange={e=>set("det",e.target.value)} placeholder="Info adicional: cliente, num cuota, etc."/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Inp label="Monto ($UY)" type="number" value={form.m} onChange={e=>set("m",+e.target.value)} placeholder="0"/>
        <Sel label="Negocio" value={form.ng} onChange={e=>set("ng",e.target.value)}>
          {NEGOCIOS.map(n=><option key={n}>{n}</option>)}
        </Sel>
      </div>
      <Sel label="Categoría" value={form.cat} onChange={e=>set("cat",e.target.value)}>
        {cats.map(c=><option key={c}>{c}</option>)}
      </Sel>
      <Sel label="Método de pago" value={form.mp} onChange={e=>set("mp",e.target.value)}>
        {METODOS.map(m=><option key={m}>{m}</option>)}
      </Sel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Inp label="Nº Boleta Memory" value={form.b} onChange={e=>set("b",e.target.value)} placeholder="B-0000 (opcional)"/>
        <Sel label="Cliente (opcional)" value={form.cl} onChange={e=>set("cl",e.target.value)}>
          <option value="">— Sin vincular —</option>
          {clientes.map(c=><option key={c.id} value={c.id}>{c.n}</option>)}
        </Sel>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>ok&&onSave(form)} disabled={!ok}><Plus size={14}/> Guardar</Btn>
      </div>
    </Modal>
  );
}
// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");
  const ROLES={"manuvallejo1787@gmail.com":"admin","activafitnessclubadm@gmail.com":"cajero"};
  const handleLogin=async()=>{
    if(!email||!pass){setErr("Complete email y contrasena");return;}
    setLoading(true);setErr("");
    try{
      const data=await sbSignIn(email,pass);
      const rol=ROLES[email.toLowerCase()]||"cajero";
      onLogin(rol,data.access_token,email);
    }catch(e){setErr("Email o contrasena incorrectos");}
    finally{setLoading(false);}
  };
  return(<div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",color:WH}}>
    <style>{GF}</style>
    <div style={{width:360,textAlign:"center"}}>
      <div style={{marginBottom:40}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:48,height:48,background:RED,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900}}>A</div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,lineHeight:1}}>GESTION</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,color:RED,lineHeight:1}}>ACTIVA</div>
          </div>
        </div>
        <p style={{fontSize:13,color:GRLT,margin:0}}>Sistema integrado · ACTIVA Fitness Club + FisioActiva Colonia</p>
      </div>
      <div style={{background:SURF,border:`1px solid ${BORD}`,borderRadius:16,padding:32}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:20,color:GRLTT}}>Ingresa con tu cuenta</div>
        <div style={{marginBottom:14,textAlign:"left"}}>
          <label style={{display:"block",fontSize:10,color:GRLT,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="tu@email.com" style={{width:"100%",background:SURF3,border:`1px solid ${BORD}`,borderRadius:8,padding:"10px 12px",color:WH,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:20,textAlign:"left"}}>
          <label style={{display:"block",fontSize:10,color:GRLT,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>Contrasena</label>
          <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{width:"100%",background:SURF3,border:`1px solid ${BORD}`,borderRadius:8,padding:"10px 12px",color:WH,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        {err&&<div style={{fontSize:12,color:RED,marginBottom:14,background:RED+"18",padding:"8px 12px",borderRadius:6}}>{err}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:RED,border:"none",color:WH,padding:"14px 0",borderRadius:10,cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:700,letterSpacing:.5,opacity:loading?.7:1}}>
          {loading?"Ingresando...":"Ingresar"}
        </button>
      </div>
    </div>
  </div>);
}


// ── CAJERO VIEW ───────────────────────────────────────────────────────────────
function CajeroView({transacciones,setTransacciones,clientes,onLogout}){
  const[showAdd,setShowAdd]=useState(false);
  const hoy=transacciones.filter(t=>t.f==="2026-05-23");
  const ingHoy=hoy.filter(t=>t.t==="ingreso").reduce((s,t)=>s+t.m,0);
  const egrHoy=hoy.filter(t=>t.t==="egreso").reduce((s,t)=>s+t.m,0);
  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'DM Sans',system-ui,sans-serif",color:WH}}>
      <style>{GF}</style>
      <header style={{background:SURF,borderBottom:`1px solid ${BORD}`,padding:"0 24px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:RED,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16}}>A</div>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1}}>GESTIÓN ACTIVA</span>
          <Badge label="CAJERO" color={YLW}/>
        </div>
        <button onClick={onLogout} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,display:"flex",alignItems:"center",gap:5,fontSize:12,padding:"4px 8px"}}><LogOut size={14}/> Salir</button>
      </header>
      <main style={{padding:24,maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24}}>
          {[["Ingresos hoy",ingHoy,GRN],["Egresos hoy",egrHoy,RED]].map(([l,v,c])=>(
            <Card key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:12,color:GRLT,marginBottom:8}}>{l}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:c,letterSpacing:1}}>{f$(v)}</div>
            </Card>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700}}>Movimientos de hoy</div>
          <Btn onClick={()=>setShowAdd(true)} small><Plus size={13}/> Nueva Transacción</Btn>
        </div>
        <Card style={{padding:0}}>
          {hoy.length===0?<div style={{padding:32,textAlign:"center",color:GRLT}}>Sin movimientos registrados hoy</div>:
          hoy.map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:i<hoy.length-1?`1px solid ${BORD}`:"none"}}>
              <div style={{width:36,height:36,background:t.t==="ingreso"?GRN+"20":RED+"20",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {t.t==="ingreso"?<ArrowUpRight size={16} style={{color:GRN}}/>:<ArrowDownRight size={16} style={{color:RED}}/>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500}}>{t.c}</div>
                <div style={{fontSize:11,color:GRLT}}>{t.ng} · {t.mp}</div>
              </div>
              <div style={{fontWeight:700,color:t.t==="ingreso"?GRN:RED,fontSize:14}}>{t.t==="ingreso"?"+":"-"}{f$(t.m)}</div>
            </div>
          ))}
        </Card>
      </main>
      {showAdd&&<AddTransModal cajeroMode clientes={clientes} onClose={()=>setShowAdd(false)} onSave={tr=>{setTransacciones(p=>[{...tr,id:Date.now()},...p]);setShowAdd(false);}}/>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({transacciones,membresias,clientes,tareas,onAddTrans}){
  const mayTrx=useMemo(()=>transacciones.filter(t=>t.f.startsWith("2026-05")),[transacciones]);
  const ingMay=useMemo(()=>mayTrx.filter(t=>t.t==="ingreso").reduce((s,t)=>s+t.m,0),[mayTrx]);
  const egrMay=useMemo(()=>mayTrx.filter(t=>t.t==="egreso").reduce((s,t)=>s+t.m,0),[mayTrx]);
  const balMay=ingMay-egrMay;
  const proyeccion=Math.round(ingMay*(31/23));
  const META_MENSUAL=140000;
  const pctIng=Math.round((proyeccion/META_MENSUAL)*100);
  const venciendo7=membresias.filter(m=>{const d=dTo(m.venc);return d>=0&&d<=7;});
  const vencidas=membresias.filter(m=>dTo(m.venc)<0);
  const alertasTotal=venciendo7.length+vencidas.length;
  const cliActivos=65;
  const META_CLI=100;
  const pctCli=Math.round((cliActivos/META_CLI)*100);
  const SESIONES_SEMANA=7;
  const META_SESIONES=12;
  const pctSes=Math.round((SESIONES_SEMANA/META_SESIONES)*100);
  const tareasUrgentes=tareas.filter(t=>t.activa!==false&&t.st==="pendiente"&&t.vence<="2026-05-28").slice(0,4);
  const recentTrx=transacciones.slice(0,9);
  const metPago=useMemo(()=>{
    const mp={};
    mayTrx.filter(t=>t.t==="ingreso").forEach(t=>{mp[t.mp]=(mp[t.mp]||0)+t.m;});
    return Object.entries(mp).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  },[mayTrx]);
  const PIE_C=[RED,BLU,GRN,YLW,PURP];

  return(
    <div>
      <style>{GF}</style>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:2,lineHeight:1}}>DASHBOARD</div>
          <div style={{fontSize:12,color:GRLT,marginTop:3}}>Viernes 23 de mayo 2026 · Semana 21</div>
        </div>
        <Btn onClick={onAddTrans}><Plus size={14}/> Nueva Transacción</Btn>
      </div>

      {/* KPI ROW */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Ingresos Mayo</span><Dot color={sc(pctIng)}/></div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,color:sc(pctIng)}}>{f$(ingMay)}</div>
          <div style={{fontSize:11,color:GRLT,marginTop:2}}>Proyección fin de mes: <span style={{color:sc(pctIng),fontWeight:700}}>{f$(proyeccion)}</span></div>
          <SemBar pct={pctIng} label={`vs meta ${f$(META_MENSUAL)}`}/>
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Balance Mayo</span><Dot color={balMay>=0?GRN:RED}/></div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,color:balMay>=0?GRN:RED}}>{balMay>=0?"+":""}{f$(balMay)}</div>
          <div style={{fontSize:11,color:GRLT,marginTop:2}}>Egresos: <span style={{color:RED,fontWeight:600}}>{f$(egrMay)}</span></div>
          <SemBar pct={Math.round((egrMay/ingMay)*100)} label="% gastos sobre ingresos"/>
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Socios Activos Gym</span><Dot color={sc(pctCli)}/></div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,color:sc(pctCli)}}>{cliActivos}</div>
          <div style={{fontSize:11,color:GRLT,marginTop:2}}>Meta: <span style={{fontWeight:700}}>100 socios</span></div>
          <SemBar pct={pctCli} label="ocupación objetivo"/>
        </Card>
        <Card style={{borderLeft:alertasTotal>0?`3px solid ${alertasTotal>=3?RED:YLW}`:undefined}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Membresías · Alertas</span><Dot color={alertasTotal===0?GRN:alertasTotal<=2?YLW:RED}/></div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,color:alertasTotal>0?RED:GRN}}>{alertasTotal}</div>
          <div style={{fontSize:11,color:GRLT,marginTop:2}}>
            {vencidas.length>0&&<span style={{color:RED}}>{vencidas.length} vencida{vencidas.length>1?"s":""} · </span>}
            {venciendo7.length>0&&<span style={{color:YLW}}>{venciendo7.length} vence en 7 días</span>}
            {alertasTotal===0&&<span style={{color:GRN}}>Todo en orden ✓</span>}
          </div>
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Sesiones Clínica / Semana</span><Dot color={sc(pctSes)}/></div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,color:sc(pctSes)}}>{SESIONES_SEMANA}</div>
          <div style={{fontSize:11,color:GRLT,marginTop:2}}>Meta semanal: <span style={{fontWeight:700}}>12 sesiones</span></div>
          <SemBar pct={pctSes} label="ocupación semanal"/>
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Fondos Estratégicos</span><Dot color={BLU}/></div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,color:BLU}}>{f$(42800)}</div>
          <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
            {[["Emerg. 15%",GRN],["Reinv. 10%",BLU],["Expans. 5%",PURP]].map(([l,c])=>(
              <span key={l} style={{fontSize:10,background:c+"20",color:c,padding:"2px 8px",borderRadius:4}}>{l}</span>
            ))}
          </div>
        </Card>
      </div>

      {/* ALERTS + URGENT TASKS */}
      {(alertasTotal>0||tareasUrgentes.length>0)&&(
        <div style={{display:"grid",gridTemplateColumns:alertasTotal>0&&tareasUrgentes.length>0?"1fr 1fr":"1fr",gap:14,marginBottom:16}}>
          {alertasTotal>0&&(
            <Card style={{borderLeft:`3px solid ${RED}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <AlertTriangle size={15} style={{color:RED}}/><span style={{fontWeight:700,fontSize:13}}>Membresías que requieren acción</span>
              </div>
              {[...vencidas.map(m=>({...m,expired:true})),...venciendo7].slice(0,5).map(m=>{
                const cli=CLI0.find(c=>c.id===m.cl);
                const d=dTo(m.venc);
                return(
                  <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${BORD}`}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500}}>{cli?.n||"Cliente"}</div>
                      <div style={{fontSize:11,color:GRLT}}>{PLANES[m.plan]?.l} · {f$(m.m)}</div>
                    </div>
                    <Badge label={d<0?"VENCIDA":`${d}d`} color={d<0?RED:d<=3?RED:YLW}/>
                  </div>
                );
              })}
            </Card>
          )}
          {tareasUrgentes.length>0&&(
            <Card style={{borderLeft:`3px solid ${YLW}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <Zap size={15} style={{color:YLW}}/><span style={{fontWeight:700,fontSize:13}}>Tareas urgentes esta semana</span>
              </div>
              {tareasUrgentes.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 0",borderBottom:`1px solid ${BORD}`}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:priC(t.pri),marginTop:5,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:500}}>{t.titulo}</div>
                    <div style={{fontSize:10,color:GRLT}}>{t.frente} · vence {fD(t.vence)}</div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* CHART + RECENT + PIE */}
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <div style={{fontWeight:700,fontSize:13,marginBottom:16}}>Ingresos vs Gastos · últimos 7 meses</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={CHART_DATA} margin={{top:0,right:0,left:-20,bottom:0}}>
              <defs>
                {[[BLU,"gGym"],[GRN,"gCli"],[RED,"gGas"]].map(([c,id])=>(
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={.35}/>
                    <stop offset="95%" stopColor={c} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BORD}/>
              <XAxis dataKey="mes" tick={{fill:GRLT,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:GRLT,fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,fontSize:12}} formatter={(v,n)=>[f$(v),n]}/>
              <Area type="monotone" dataKey="gym" name="Gym" stroke={BLU} fill="url(#gGym)" strokeWidth={2} dot={false}/>
              <Area type="monotone" dataKey="clinica" name="Clínica" stroke={GRN} fill="url(#gCli)" strokeWidth={2} dot={false}/>
              <Area type="monotone" dataKey="gastos" name="Gastos" stroke={RED} fill="url(#gGas)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:16,marginTop:8}}>
            {[["Gym",BLU],["Clínica",GRN],["Gastos",RED]].map(([l,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:GRLT}}>
                <div style={{width:12,height:3,background:c,borderRadius:2}}/>{l}
              </div>
            ))}
          </div>
        </Card>
        <Card style={{padding:0}}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${BORD}`,fontWeight:700,fontSize:13}}>Últimos movimientos</div>
          {recentTrx.map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 18px",borderBottom:i<recentTrx.length-1?`1px solid ${BORD}`:"none"}}>
              <div style={{width:28,height:28,background:t.t==="ingreso"?GRN+"20":RED+"20",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {t.t==="ingreso"?<ArrowUpRight size={12} style={{color:GRN}}/>:<ArrowDownRight size={12} style={{color:RED}}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.c}</div>
                <div style={{fontSize:10,color:GRLT}}>{fD(t.f)} · <span style={{color:ngColor(t.ng)}}>{t.ng}</span></div>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:t.t==="ingreso"?GRN:RED,flexShrink:0}}>{t.t==="ingreso"?"+":"-"}{f$(t.m)}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* PIE METODOS PAGO */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <Card>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Métodos de pago · Mayo</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={metPago} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                {metPago.map((_, i)=><Cell key={i} fill={PIE_C[i%PIE_C.length]}/>)}
              </Pie>
              <Tooltip contentStyle={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,fontSize:11}} formatter={v=>f$(v)}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {metPago.map((m,i)=>(
              <div key={m.name} style={{display:"flex",alignItems:"center",gap:7,fontSize:11}}>
                <div style={{width:8,height:8,borderRadius:2,background:PIE_C[i%PIE_C.length],flexShrink:0}}/>
                <span style={{flex:1,color:GRLT}}>{m.name}</span>
                <span style={{fontWeight:700}}>{f$(m.value)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Distribución por plan · Gym</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["PRO",9,PURP],["Performance",73,RED],["Base",18,BLU]].map(([l,p,c])=>(
              <div key={l}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span>{l}</span><span style={{color:c,fontWeight:700}}>{p}%</span>
                </div>
                <div style={{height:6,background:SURF3,borderRadius:3}}>
                  <div style={{height:6,width:`${p}%`,background:c,borderRadius:3}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${BORD}`,display:"flex",justifyContent:"space-between",fontSize:12}}>
            <span style={{color:GRLT}}>Ticket promedio gym</span>
            <span style={{fontWeight:700,color:YLW}}>{f$(1560)}</span>
          </div>
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Resumen Mayo · Fondos</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              ["Neto distribuible",f$(Math.max(0,balMay*0.7)),GRN],
              ["Fondo emergencia (15%)",f$(Math.round(balMay*0.15)),GRN],
              ["Reinversión (10%)",f$(Math.round(balMay*0.10)),BLU],
              ["Expansión (5%)",f$(Math.round(balMay*0.05)),PURP],
              ["Distribución Manu (75%)",f$(Math.round(balMay*0.525)),YLW],
              ["Distribución Socio (25%)",f$(Math.round(balMay*0.175)),GRLT],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:11,paddingBottom:8,borderBottom:`1px solid ${BORD}`}}>
                <span style={{color:GRLT}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── LIBRO DIARIO ──────────────────────────────────────────────────────────────
function LibroDiario({transacciones,clientes,onAdd}){
  const MESES_OPT=["Todos","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"];
  const MESES_NOM={"2026-01":"Enero 2026","2026-02":"Febrero 2026","2026-03":"Marzo 2026","2026-04":"Abril 2026","2026-05":"Mayo 2026","2026-06":"Junio 2026","2026-07":"Julio 2026","2026-08":"Agosto 2026","2026-09":"Septiembre 2026","2026-10":"Octubre 2026","2026-11":"Noviembre 2026","2026-12":"Diciembre 2026"};

  // Default al mes actual basado en los datos cargados
  const mesActual=useMemo(()=>{
    if(!transacciones.length)return"Todos";
    const fechas=transacciones.map(t=>t.f?.slice(0,7)).filter(Boolean).sort();
    return fechas[fechas.length-1]||"Todos";
  },[transacciones]);

  const[mesF,setMesF]=useState("Todos");
  const[ngF,setNgF]=useState("todo");
  const[tipoF,setTipoF]=useState("todo");
  const[search,setSearch]=useState("");

  // Set default month on first load
  useEffect(()=>{if(mesActual!=="Todos")setMesF(mesActual);},[mesActual]);

  const filtered=useMemo(()=>transacciones.filter(t=>{
    const mM=mesF==="Todos"||t.f?.startsWith(mesF);
    const mN=ngF==="todo"||t.ng?.toLowerCase()===ngF;
    const mT=tipoF==="todo"||t.t===tipoF;
    const mQ=!search||t.c?.toLowerCase().includes(search.toLowerCase())||(t.b&&t.b.toLowerCase().includes(search.toLowerCase()));
    return mM&&mN&&mT&&mQ;
  }),[transacciones,mesF,ngF,tipoF,search]);

  const ingT=filtered.filter(t=>t.t==="ingreso").reduce((s,t)=>s+Number(t.m),0);
  const egrT=filtered.filter(t=>t.t==="egreso").reduce((s,t)=>s+Number(t.m),0);

  // Monthly summary for all months
  const resMeses=useMemo(()=>{
    const map={};
    transacciones.forEach(t=>{
      const m=t.f?.slice(0,7);if(!m)return;
      if(!map[m])map[m]={mes:m,ing:0,egr:0};
      if(t.t==="ingreso")map[m].ing+=Number(t.m);
      else map[m].egr+=Number(t.m);
    });
    return Object.values(map).sort((a,b)=>a.mes.localeCompare(b.mes));
  },[transacciones]);

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>LIBRO DIARIO</div>
      <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={()=>{
        const rows=filtered.map(t=>`<tr><td>${fD(t.f)}</td><td>${t.c}</td><td>${t.ng}</td><td>${t.cat}</td><td>${t.mp}</td><td class="${t.t==='ingreso'?'ing':'egr'}">${t.t==='ingreso'?'+':'-'}${f$(Number(t.m))}</td></tr>`).join("");
        const titulo=mesF==="Todos"?"Libro Diario - Todos los meses":`Libro Diario - ${MESES_NOM[mesF]||mesF}`;
        exportarPDF(titulo,`<div class="tot ing">Ingresos: ${f$(ingT)}</div><div class="tot egr">Gastos: ${f$(egrT)}</div><div class="tot">Balance: ${f$(ingT-egrT)}</div><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Negocio</th><th>Categoria</th><th>Metodo</th><th>Monto</th></tr></thead><tbody>${rows}</tbody></table>`);
      }}><Download size={13}/> Exportar PDF</Btn><Btn onClick={onAdd} small><Plus size={13}/> Nueva Entrada</Btn></div>
    </div>

    {/* Resumen mensual */}
    <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
      {resMeses.map(r=>{
        const bal=r.ing-r.egr;
        const isSelected=mesF===r.mes;
        return(<button key={r.mes} onClick={()=>setMesF(isSelected?"Todos":r.mes)}
          style={{flexShrink:0,padding:"10px 14px",borderRadius:8,cursor:"pointer",textAlign:"center",
            border:`2px solid ${isSelected?RED:BORD}`,background:isSelected?RED+"20":SURF2,
            minWidth:110}}>
          <div style={{fontSize:11,color:GRLT,marginBottom:2}}>{MESES_NOM[r.mes]||r.mes}</div>
          <div style={{fontSize:13,fontWeight:700,color:bal>=0?GRN:RED}}>{bal>=0?"+":""}{f$(bal)}</div>
          <div style={{fontSize:10,color:GRLT,marginTop:2}}>{f$(r.ing)} ing</div>
        </button>);
      })}
      <button onClick={()=>setMesF("Todos")}
        style={{flexShrink:0,padding:"10px 14px",borderRadius:8,cursor:"pointer",textAlign:"center",
          border:`2px solid ${mesF==="Todos"?BLU:BORD}`,background:mesF==="Todos"?BLU+"20":SURF2,minWidth:80}}>
        <div style={{fontSize:11,color:GRLT,marginBottom:4}}>Todo</div>
        <div style={{fontSize:12,fontWeight:700,color:BLU}}>Ver todo</div>
      </button>
    </div>

    {/* Totales del filtro actual */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
      {[["Ingresos",ingT,GRN],["Gastos",egrT,RED],["Balance",ingT-egrT,(ingT-egrT)>=0?GRN:RED]].map(([l,v,c])=>(
        <Card key={l} style={{textAlign:"center",padding:14}}>
          <div style={{fontSize:11,color:GRLT,marginBottom:4}}>{l}{mesF!=="Todos"?` · ${MESES_NOM[mesF]||mesF}`:""}</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:c,letterSpacing:1}}>{v<0?"-":""}{f$(Math.abs(v))}</div>
        </Card>
      ))}
    </div>

    {/* Filtros */}
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4}}>
        {[["todo","Todos"],["Gym","Gym"],["Clinica","Clinica"],["Compartido","Shared"]].map(([v,l])=>(
          <button key={v} onClick={()=>setNgF(v)} style={{padding:"5px 11px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:ngF===v?RED:"transparent",color:ngF===v?WH:GRLT}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4}}>
        {[["todo","Todos"],["ingreso","Ingresos"],["egreso","Egresos"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTipoF(v)} style={{padding:"5px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tipoF===v?(v==="ingreso"?GRN:v==="egreso"?RED:SURF3):"transparent",color:WH}}>{l}</button>
        ))}
      </div>
      <div style={{flex:1,position:"relative",minWidth:180}}>
        <Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:GRLT}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar concepto o boleta..." style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,padding:"7px 12px 7px 30px",color:WH,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
      </div>
    </div>

    {/* Tabla */}
    <Card style={{padding:0,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:SURF3}}>{["Fecha","Concepto","Negocio","Categoria","Metodo","Boleta","Monto"].map(h=>(
            <th key={h} style={{padding:"9px 12px",textAlign:"left",color:GRLT,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.7,whiteSpace:"nowrap"}}>{h}</th>
          ))}</tr></thead>
          <tbody>{filtered.slice(0,100).map((t,i)=>(
            <tr key={t.id} style={{borderTop:`1px solid ${BORD}`,background:i%2===0?"transparent":SURF+"40"}}>
              <td style={{padding:"9px 12px",color:GRLT,whiteSpace:"nowrap"}}>{fD(t.f)}</td>
              <td style={{padding:"9px 12px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.c}</td>
              <td style={{padding:"9px 12px"}}><Badge label={t.ng} color={ngColor(t.ng)} sm/></td>
              <td style={{padding:"9px 12px",color:GRLTT,fontSize:11,whiteSpace:"nowrap"}}>{t.cat}</td>
              <td style={{padding:"9px 12px",color:GRLT,fontSize:11,whiteSpace:"nowrap"}}>{t.mp}</td>
              <td style={{padding:"9px 12px",color:GRLT,fontFamily:"monospace",fontSize:11}}>{t.b||"-"}</td>
              <td style={{padding:"9px 12px",fontWeight:700,color:t.t==="ingreso"?GRN:RED,whiteSpace:"nowrap"}}>{t.t==="ingreso"?"+":"-"}{f$(Number(t.m))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:GRLT}}>Sin registros para los filtros aplicados</div>}
      {filtered.length>100&&<div style={{padding:10,textAlign:"center",fontSize:11,color:GRLT}}>Mostrando 100 de {filtered.length} registros</div>}
    </Card>
  </div>);
}

function Membresias({membresias,setMembresias,clientes,setTransacciones}){
  const[showAdd,setShowAdd]=useState(false);
  const[search,setSearch]=useState("");
  const[tab,setTab]=useState("todas");
  const[form,setForm]=useState({cl:"",plan:"performance",pago:"2026-05-23",mp:"Efectivo",b:""});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const rows=useMemo(()=>membresias.map(m=>{
    const cli=clientes.find(c=>c.id===m.cl);
    const d=dTo(m.venc);
    return{...m,cliName:cli?.n||"—",dias:d};
  }).filter(r=>{
    const mQ=!search||r.cliName.toLowerCase().includes(search.toLowerCase());
    const mT=tab==="todas"||(tab==="activas"&&r.dias>=0)||(tab==="vencidas"&&r.dias<0)||(tab==="alerta"&&r.dias>=0&&r.dias<=7);
    return mQ&&mT;
  }).sort((a,b)=>a.dias-b.dias),[membresias,clientes,search,tab]);

  const vLabel=d=>d<0?"Vencida":d===0?"Hoy":`${d}d`;
  const vColor=d=>d<0?RED:d<=3?RED:d<=7?YLW:GRN;

  const precio=PLANES[form.plan]?.p||0;
  const venc=(()=>{const d=new Date(form.pago+"T12:00:00");d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10);})();
  const okForm=form.cl&&form.plan&&form.mp;

  const registrar=async()=>{
    if(!okForm)return;
    const mem={cl:+form.cl,plan:form.plan,m:precio,pago:form.pago,venc,mp:form.mp,b:form.b||null};
    const cli=clientes.find(c=>c.id===+form.cl);
    try{
      const[sm,st]=await Promise.all([
        sbInsert("membresias",[mem]),
        sbInsert("transacciones",[{f:form.pago,c:`${PLANES[form.plan].l} - ${cli?.n||""}`,m:precio,t:"ingreso",ng:"Gym",cat:"Planes Gym",mp:form.mp,b:form.b||null,cl:+form.cl}]),
      ]);
      setMembresias(p=>[...(sm||[{...mem,id:Date.now()}]),...p]);
      setTransacciones(p=>[...(st||[]),...p]);
    }catch(e){console.error(e);}
    setShowAdd(false);setForm({cl:"",plan:"performance",pago:"2026-05-23",mp:"Efectivo",b:""});
  };

  const totAct=membresias.filter(m=>dTo(m.venc)>=0).length;
  const totVenc=membresias.filter(m=>dTo(m.venc)<0).length;
  const totAlerta=membresias.filter(m=>{const d=dTo(m.venc);return d>=0&&d<=7;}).length;

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>MEMBRESIAS GYM</div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="ghost" small onClick={()=>{
          const memRows=rows.map(r=>`<tr><td>${r.cliName}</td><td>${PLANES[r.plan]?.l||r.plan}</td><td>${fD(r.pago)}</td><td>${fD(r.venc)}</td><td>${r.dias<0?'Vencida':r.dias+'d'}</td></tr>`).join("");
          exportarPDF("Membresias Gym",`<table><thead><tr><th>Socio</th><th>Plan</th><th>Pago</th><th>Vence</th><th>Estado</th></tr></thead><tbody>${memRows}</tbody></table>`);
        }}><Download size={13}/> Exportar</Btn>
        <Btn onClick={()=>setShowAdd(true)} small><Plus size={13}/> Registrar Membresia</Btn>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
      {[["Activas",totAct,GRN],["Por vencer (7d)",totAlerta,YLW],["Vencidas",totVenc,RED]].map(([l,v,c])=>(<Card key={l} style={{textAlign:"center",padding:16}}><div style={{fontSize:11,color:GRLT,marginBottom:4}}>{l}</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:c,letterSpacing:1}}>{v}</div></Card>))}
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4}}>{[["todas","Todas"],["activas","Activas"],["alerta","Alerta"],["vencidas","Vencidas"]].map(([v,l])=>(<button key={v} onClick={()=>setTab(v)} style={{padding:"6px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab===v?RED:"transparent",color:tab===v?WH:GRLT}}>{l}</button>))}</div>
      <div style={{flex:1,position:"relative",maxWidth:280}}><Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:GRLT}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar socio..." style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,padding:"8px 12px 8px 32px",color:WH,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
    </div>
    <Card style={{padding:0,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:SURF3}}>{["Socio","Plan","Pago","Vencimiento","Estado","Metodo"].map(h=>(<th key={h} style={{padding:"10px 14px",textAlign:"left",color:GRLT,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.7,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
        <tbody>{rows.map((r,i)=>(<tr key={r.id} style={{borderTop:`1px solid ${BORD}`,background:r.dias<0?RED+"08":i%2===0?"transparent":SURF+"40"}}>
          <td style={{padding:"10px 14px",fontWeight:600}}>{r.cliName}</td>
          <td style={{padding:"10px 14px"}}><Badge label={PLANES[r.plan]?.l||r.plan} color={r.plan==="pro"?PURP:r.plan==="performance"?RED:r.plan==="movete"?YLW:BLU} sm/></td>
          <td style={{padding:"10px 14px",color:GRLT}}>{fD(r.pago)}</td>
          <td style={{padding:"10px 14px",color:GRLT}}>{fD(r.venc)}</td>
          <td style={{padding:"10px 14px"}}><Badge label={vLabel(r.dias)} color={vColor(r.dias)} sm/></td>
          <td style={{padding:"10px 14px",color:GRLT,fontSize:11}}>{r.mp}</td>
        </tr>))}</tbody>
      </table>
      {rows.length===0&&<div style={{padding:40,textAlign:"center",color:GRLT}}>Sin membresias para los filtros aplicados</div>}
    </Card>
    {showAdd&&(<Modal title="Registrar Membresia" onClose={()=>setShowAdd(false)}>
      <Sel label="Socio" value={form.cl} onChange={e=>setF("cl",e.target.value)}><option value="">Seleccionar socio...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.n}</option>)}</Sel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Sel label="Plan" value={form.plan} onChange={e=>setF("plan",e.target.value)}>{PLANES_MEM.map(k=><option key={k} value={k}>{PLANES[k].l} - {f$(PLANES[k].p)}</option>)}</Sel>
        <Inp label="Fecha de pago" type="date" value={form.pago} onChange={e=>setF("pago",e.target.value)}/>
      </div>
      <div style={{background:SURF3,border:`1px solid ${BORD}`,borderRadius:8,padding:"12px 16px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span style={{color:GRLT}}>Monto:</span><span style={{fontWeight:700,color:GRN}}>{f$(precio)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:GRLT}}>Vencimiento:</span><span style={{fontWeight:700}}>{fD(venc)}</span></div>
      </div>
      <Sel label="Metodo de pago" value={form.mp} onChange={e=>setF("mp",e.target.value)}>{METODOS.map(m=><option key={m}>{m}</option>)}</Sel>
      <Inp label="N Boleta Memory" value={form.b} onChange={e=>setF("b",e.target.value)} placeholder="B-0000"/>
      <div style={{fontSize:11,color:GRLT,background:BLU+"15",padding:"8px 12px",borderRadius:6,marginBottom:16}}>Genera automaticamente la transaccion en el libro diario</div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn><Btn onClick={registrar} disabled={!okForm}><Plus size={14}/> Registrar</Btn></div>
    </Modal>)}
  </div>);
}


function PacksClinica({packs,setPacks,clientes,setTransacciones}){
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({cl:"",pack:"individual",pago:"2026-05-23",mp:"Efectivo",b:"",enCuotas:false,nCuotas:2,montoCuota:""});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const pkDef=PACKS[form.pack];
  const venc=(()=>{const d=new Date(form.pago+"T12:00:00");d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10);})();
  const okForm=form.cl&&form.pack&&form.mp;
  const margen=pkDef?pkDef.p-(pkDef.costo||0):0;
  const registrar=async()=>{
    if(!okForm)return;
    const cli=clientes.find(c=>c.id===+form.cl);
    const montoPrimera=form.enCuotas?(+form.montoCuota||Math.round(pkDef.p/form.nCuotas)):pkDef.p;
    const saldoPendiente=form.enCuotas?(pkDef.p-montoPrimera):0;
    const proxCuota=(()=>{const d=new Date(form.pago+"T12:00:00");d.setDate(d.getDate()+30);return d.toISOString().slice(0,10);})();
    const pk={cl:+form.cl,pack:form.pack,ses_tot:pkDef.ses,ses_uso:0,inicio:form.pago,venc,pago:form.pago,mp:form.mp,b:form.b||null,
      saldo:saldoPendiente,cuotas_total:form.enCuotas?form.nCuotas:1,cuotas_pagas:1,prox_cuota:form.enCuotas?proxCuota:null};
    const concepto=form.enCuotas?`${pkDef.l} - ${cli?.n||""} (cuota 1/${form.nCuotas})`:`${pkDef.l} - ${cli?.n||""}`;
    try{
      const[sp,st]=await Promise.all([
        sbInsert("packs_clinica",[pk]),
        sbInsert("transacciones",[{f:form.pago,c:concepto,m:montoPrimera,t:"ingreso",ng:"Clinica",cat:"Pack Fisio",mp:form.mp,b:form.b||null,cl:+form.cl}]),
      ]);
      setPacks(p=>[...(sp||[{...pk,id:Date.now()}]),...p]);
      setTransacciones(p=>[...(st||[]),...p]);
    }catch(e){console.error(e);}
    setShowAdd(false);setForm({cl:"",pack:"individual",pago:"2026-05-23",mp:"Efectivo",b:"",enCuotas:false,nCuotas:2,montoCuota:""});
  };
  const usarSesion=async id=>{
    const pk=packs.find(p=>p.id===id);
    if(!pk||pk.ses_uso>=pk.ses_tot)return;
    const nu=pk.ses_uso+1;
    setPacks(p=>p.map(x=>x.id===id?{...x,ses_uso:nu}:x));
    try{await sbUpdate("packs_clinica",id,{ses_uso:nu});}catch(e){console.error(e);}
  };
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>PACKS CLINICA</div>
      <Btn onClick={()=>setShowAdd(true)} small><Plus size={13}/> Nuevo Pack</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
      {packs.map(pk=>{
        const cli=clientes.find(c=>c.id===pk.cl);
        const pDef=PACKS[pk.pack];
        const pct=Math.round((pk.ses_uso/pk.ses_tot)*100);
        const restantes=pk.ses_tot-pk.ses_uso;
        const dV=dTo(pk.venc);
        const margenPk=pDef?(pDef.p-pDef.costo):0;
        return(<Card key={pk.id} style={{borderLeft:`3px solid ${restantes<=2?RED:restantes<=pk.ses_tot*0.4?YLW:GRN}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{cli?.n||"Paciente"}</div><div style={{fontSize:12,color:GRLT,marginTop:2}}>{pDef?.l}</div></div>
            <div style={{textAlign:"right"}}><Badge label={dV<0?"VENCIDO":dV<=7?`${dV}d`:"Vigente"} color={dV<0?RED:dV<=7?YLW:GRN}/><div style={{fontSize:11,color:GRLT,marginTop:4}}>{fD(pk.inicio)} - {fD(pk.venc)}</div></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span style={{color:GRLT}}>Sesiones</span><span style={{fontWeight:700}}>{pk.ses_uso}/{pk.ses_tot}</span></div>
          <div style={{height:6,background:SURF3,borderRadius:3,marginBottom:8}}><div style={{height:6,width:`${pct}%`,background:restantes<=2?RED:BLU,borderRadius:3}}/></div>
          {restantes<=2&&<div style={{fontSize:11,color:RED,marginBottom:8}}>Quedan {restantes} sesion{restantes===1?"":"es"}</div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:GRLT}}>{pk.mp} - {f$(pDef?.p||0)}</div>
            <Btn variant="info" small onClick={()=>usarSesion(pk.id)} disabled={pk.ses_uso>=pk.ses_tot}><CheckCircle2 size={12}/> Sesion</Btn>
          </div>
          <div style={{fontSize:11,background:GRN+"15",padding:"5px 10px",borderRadius:6,color:GRN,marginBottom:pk.saldo>0?6:0}}>Margen: {f$(margenPk)} ({Math.round((margenPk/(pDef?.p||1))*100)}%)</div>
          {pk.saldo>0&&(<div style={{fontSize:11,background:YLW+"18",padding:"6px 10px",borderRadius:6,color:YLW}}>
            Saldo pendiente: <b>{f$(pk.saldo)}</b> · Cuota {pk.cuotas_pagas}/{pk.cuotas_total}{pk.prox_cuota?` · Proxima: ${fD(pk.prox_cuota)}${dTo(pk.prox_cuota)<=7?` (${dTo(pk.prox_cuota)}d!)`:""}`:""}
          </div>)}
        </Card>);
      })}
    </div>
    {packs.length===0&&<div style={{padding:60,textAlign:"center",color:GRLT}}>Sin packs activos</div>}
    {showAdd&&(<Modal title="Nuevo Pack Clinica" onClose={()=>setShowAdd(false)}>
      <Sel label="Paciente" value={form.cl} onChange={e=>setF("cl",e.target.value)}><option value="">Seleccionar paciente...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.n}</option>)}</Sel>
      <Sel label="Pack" value={form.pack} onChange={e=>setF("pack",e.target.value)}>{Object.entries(PACKS).map(([k,v])=><option key={k} value={k}>{v.l} - {f$(v.p)}</option>)}</Sel>
      <Inp label="Fecha inicio / pago" type="date" value={form.pago} onChange={e=>setF("pago",e.target.value)}/>
      {pkDef&&<div style={{background:SURF3,borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:12}}>{[["Sesiones",pkDef.ses],["Incluye gym?",pkDef.gym?"Si":"No"],["Precio",f$(pkDef.p)],["Costo",f$(pkDef.costo)],["Margen",`${f$(pkDef.p-pkDef.costo)} (${Math.round(((pkDef.p-pkDef.costo)/pkDef.p)*100)}%)`],["Vencimiento",fD(venc)]].map(([l,v])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}><span style={{color:GRLT}}>{l}:</span><span style={{fontWeight:700}}>{v}</span></div>))}</div>}
      <Sel label="Metodo de pago" value={form.mp} onChange={e=>setF("mp",e.target.value)}>{METODOS.map(m=><option key={m}>{m}</option>)}</Sel>
      <Inp label="N Boleta Memory" value={form.b} onChange={e=>setF("b",e.target.value)} placeholder="B-0000"/>
      <div style={{background:SURF3,borderRadius:8,padding:"12px 14px",marginBottom:14}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:form.enCuotas?12:0}}>
          <input type="checkbox" checked={form.enCuotas} onChange={e=>setF("enCuotas",e.target.checked)} style={{width:16,height:16,accentColor:RED}}/>
          <span style={{fontSize:13,fontWeight:600}}>Pago en cuotas</span>
        </label>
        {form.enCuotas&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><div style={{fontSize:10,color:GRLT,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>N de cuotas</div><input type="number" min="2" value={form.nCuotas} onChange={e=>setF("nCuotas",+e.target.value)} style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"8px 10px",color:WH,fontSize:13,outline:"none"}}/></div>
          <div><div style={{fontSize:10,color:GRLT,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>Monto 1ra cuota</div><input type="number" value={form.montoCuota} onChange={e=>setF("montoCuota",e.target.value)} placeholder={pkDef?Math.round(pkDef.p/form.nCuotas):0} style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"8px 10px",color:WH,fontSize:13,outline:"none"}}/></div>
          {pkDef&&<div style={{gridColumn:"1/-1",fontSize:11,color:GRLT,background:BLU+"15",padding:"7px 10px",borderRadius:6}}>
            Se cobra ahora {f$(form.montoCuota||Math.round(pkDef.p/form.nCuotas))}. Saldo: {f$(pkDef.p-(form.montoCuota||Math.round(pkDef.p/form.nCuotas)))} en {form.nCuotas-1} cuota(s). Alerta de proxima cuota en 30 dias.
          </div>}
        </div>)}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn><Btn onClick={registrar} disabled={!okForm}><Plus size={14}/> Registrar</Btn></div>
    </Modal>)}
  </div>);
}


function Clientes({clientes,setClientes,transacciones,membresias,packs}){
  const[search,setSearch]=useState("");const[negF,setNegF]=useState("todos");const[selCli,setSelCli]=useState(null);const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({n:"",sx:"M",alta:"2026-05-23",nac:"",neg:"gym",plan:"performance",tel:"",email:"",notas:"",st:"activo"});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const filtered=useMemo(()=>clientes.filter(c=>{
    const mQ=!search||c.n.toLowerCase().includes(search.toLowerCase())||c.tel?.includes(search);
    const mN=negF==="todos"||c.neg===negF;
    return mQ&&mN;
  }),[clientes,search,negF]);
  const cliTrx=selCli?transacciones.filter(t=>t.cl===selCli.id):[];
  const cliMems=selCli?membresias.filter(m=>m.cl===selCli.id):[];
  const cliPacks=selCli?packs.filter(p=>p.cl===selCli.id):[];
  const agregarCliente=async()=>{
    if(!form.n)return;
    try{
      const s=await sbInsert("clientes",[{n:form.n,sx:form.sx,alta:form.alta,nac:form.nac||null,neg:form.neg,plan:form.plan||null,st:form.st,tel:form.tel,email:form.email,notas:form.notas}]);
      setClientes(p=>[...p,...(s||[{...form,id:Date.now()}])]);
    }catch(e){console.error(e);}
    setShowAdd(false);setForm({n:"",sx:"M",alta:"2026-05-23",nac:"",neg:"gym",plan:"performance",tel:"",email:"",notas:"",st:"activo"});
  };
  const negLabel=n=>n==="gym"?"Solo Gym":n==="clinica"?"Solo Clinica":n==="ambos"?"Gym + Clinica":"-";
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>CLIENTES</div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="ghost" small onClick={()=>{
          const rows=filtered.map(c=>`<tr><td>${c.n}</td><td>${c.sx==='M'?'M':'F'}</td><td>${negLabel(c.neg)}</td><td>${c.plan?(PLANES[c.plan]?.l||c.plan):'-'}</td><td>${c.tel||'-'}</td><td>${c.st}</td></tr>`).join("");
          exportarPDF("Cartera de Clientes",`<div class="tot">Total: ${filtered.length} clientes</div><table><thead><tr><th>Nombre</th><th>Sexo</th><th>Servicio</th><th>Plan</th><th>Telefono</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`);
        }}><Download size={13}/> Exportar</Btn>
        <Btn onClick={()=>setShowAdd(true)} small><UserPlus size={13}/> Nuevo Cliente</Btn>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1.6fr",gap:16}}>
      <div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{flex:1,position:"relative",minWidth:160}}><Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:GRLT}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,padding:"8px 12px 8px 32px",color:WH,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
          <select value={negF} onChange={e=>setNegF(e.target.value)} style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,padding:"8px 12px",color:WH,fontSize:12,outline:"none"}}><option value="todos">Todos</option><option value="gym">Gym</option><option value="clinica">Clinica</option><option value="ambos">Ambos</option></select>
        </div>
        <Card style={{padding:0,overflow:"hidden"}}>
          {filtered.map((c,i)=>(<div key={c.id} onClick={()=>setSelCli(c)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<filtered.length-1?`1px solid ${BORD}`:"none",cursor:"pointer",background:selCli?.id===c.id?RED+"15":"transparent"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:c.sx==="M"?BLU+"30":PURP+"30",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:c.sx==="M"?BLU:PURP,flexShrink:0}}>{c.n.charAt(0)}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.n}</div><div style={{fontSize:11,color:GRLT}}>{negLabel(c.neg)}{c.plan?` - ${PLANES[c.plan]?.l}`:""}</div></div>
            <Badge label={c.st==="activo"?"Activo":"Inactivo"} color={c.st==="activo"?GRN:GRLT} sm/>
          </div>))}
          {filtered.length===0&&<div style={{padding:30,textAlign:"center",color:GRLT}}>Sin resultados</div>}
        </Card>
      </div>
      {selCli?(<div>
        <Card style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <div style={{width:48,height:48,borderRadius:"50%",background:selCli.sx==="M"?BLU+"30":PURP+"30",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20,color:selCli.sx==="M"?BLU:PURP}}>{selCli.n.charAt(0)}</div>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:16}}>{selCli.n}</div><div style={{fontSize:12,color:GRLT}}>{negLabel(selCli.neg)} - Alta: {fD(selCli.alta)}</div></div>
            <Btn variant="ghost" small onClick={()=>{
              const memRows=cliMems.map(m=>`<tr><td>${PLANES[m.plan]?.l||m.plan}</td><td>${fD(m.pago)}</td><td>${fD(m.venc)}</td><td>${f$(m.m)}</td></tr>`).join("");
              const pkRows=cliPacks.map(p=>`<tr><td>${PACKS[p.pack]?.l||p.pack}</td><td>${p.ses_uso}/${p.ses_tot}</td><td>${fD(p.venc)}</td></tr>`).join("");
              const trxRows=cliTrx.map(t=>`<tr><td>${fD(t.f)}</td><td>${t.c}</td><td class="ing">+${f$(Number(t.m))}</td></tr>`).join("");
              exportarPDF(`Ficha - ${selCli.n}`,`
                <div class="card"><div class="label">Datos</div>
                  <p>Servicio: ${negLabel(selCli.neg)}<br>Telefono: ${selCli.tel||'-'}<br>Email: ${selCli.email||'-'}<br>Plan: ${selCli.plan?(PLANES[selCli.plan]?.l):'-'}<br>Estado: ${selCli.st}${selCli.notas?'<br>Notas: '+selCli.notas:''}</p>
                </div>
                ${memRows?`<h3>Membresias</h3><table><thead><tr><th>Plan</th><th>Pago</th><th>Vence</th><th>Monto</th></tr></thead><tbody>${memRows}</tbody></table>`:''}
                ${pkRows?`<h3>Packs Clinica</h3><table><thead><tr><th>Pack</th><th>Sesiones</th><th>Vence</th></tr></thead><tbody>${pkRows}</tbody></table>`:''}
                ${trxRows?`<h3>Historial de pagos</h3><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th></tr></thead><tbody>${trxRows}</tbody></table>`:''}
              `);
            }}><Download size={12}/> PDF</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
            {[["Telefono",selCli.tel||"-"],["Email",selCli.email||"-"],["Sexo",selCli.sx==="M"?"Masculino":"Femenino"],["Plan",selCli.plan?PLANES[selCli.plan]?.l:"-"],["Estado",selCli.st]].map(([l,v])=>(<div key={l} style={{padding:"8px 12px",background:SURF3,borderRadius:8}}><div style={{fontSize:10,color:GRLT,marginBottom:2}}>{l}</div><div style={{fontWeight:500,textTransform:"capitalize"}}>{v}</div></div>))}
          </div>
          {selCli.notas&&<div style={{marginTop:12,padding:"8px 12px",background:YLW+"15",borderRadius:8,fontSize:12,color:GRLTT}}>{selCli.notas}</div>}
        </Card>
        {cliMems.length>0&&(<Card style={{marginBottom:14}}><div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Membresias</div>{cliMems.map(m=>(<div key={m.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:`1px solid ${BORD}`}}><span>{PLANES[m.plan]?.l} - {fD(m.pago)}</span><Badge label={dTo(m.venc)<0?"Vencida":`Vence ${fD(m.venc)}`} color={dTo(m.venc)<0?RED:GRN} sm/></div>))}</Card>)}
        {cliPacks.length>0&&(<Card style={{marginBottom:14}}><div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Packs Clinica</div>{cliPacks.map(pk=>(<div key={pk.id} style={{fontSize:12,padding:"6px 0",borderBottom:`1px solid ${BORD}`}}><div style={{display:"flex",justifyContent:"space-between"}}><span>{PACKS[pk.pack]?.l}</span><span>{pk.ses_uso}/{pk.ses_tot} ses.</span></div></div>))}</Card>)}
        {cliTrx.length>0&&(<Card><div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Historial de pagos</div>{cliTrx.map(t=>(<div key={t.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:`1px solid ${BORD}`}}><span style={{color:GRLT}}>{fD(t.f)} - {t.c?.substring(0,30)}</span><span style={{fontWeight:700,color:GRN}}>+{f$(t.m)}</span></div>))}</Card>)}
      </div>):(<Card style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}><div style={{textAlign:"center",color:GRLT}}><Users size={40} style={{opacity:.3,marginBottom:12}}/><div>Selecciona un cliente</div></div></Card>)}
    </div>
    {showAdd&&(<Modal title="Nuevo Cliente" onClose={()=>setShowAdd(false)}>
      <Inp label="Nombre completo" value={form.n} onChange={e=>setF("n",e.target.value)} placeholder="Nombre Apellido"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}><Sel label="Sexo" value={form.sx} onChange={e=>setF("sx",e.target.value)}><option value="M">Masculino</option><option value="F">Femenino</option></Sel><Inp label="Fecha alta" type="date" value={form.alta} onChange={e=>setF("alta",e.target.value)}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}><Inp label="Fecha de nacimiento" type="date" value={form.nac} onChange={e=>setF("nac",e.target.value)}/><div style={{marginBottom:14}}><label style={{display:"block",fontSize:10,color:GRLT,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>Edad</label><div style={{padding:"10px 12px",background:SURF2,borderRadius:8,fontSize:13,color:form.nac?WH:GRLT}}>{form.nac?`${Math.floor((new Date()-new Date(form.nac))/(365.25*86400000))} años`:"—"}</div></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}><Sel label="Servicio" value={form.neg} onChange={e=>setF("neg",e.target.value)}><option value="gym">Solo Gym</option><option value="clinica">Solo Clinica</option><option value="ambos">Gym + Clinica</option></Sel>{form.neg!=="clinica"&&<Sel label="Plan Gym" value={form.plan} onChange={e=>setF("plan",e.target.value)}>{PLANES_MEM.map(k=><option key={k} value={k}>{PLANES[k].l}</option>)}</Sel>}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}><Inp label="Telefono" value={form.tel} onChange={e=>setF("tel",e.target.value)} placeholder="099 000 000"/><Inp label="Email" type="email" value={form.email} onChange={e=>setF("email",e.target.value)} placeholder="email@mail.com"/></div>
      <Txta label="Notas" value={form.notas} onChange={e=>setF("notas",e.target.value)} placeholder="Lesiones, derivaciones, observaciones..."/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn><Btn onClick={agregarCliente} disabled={!form.n}><Plus size={14}/> Agregar</Btn></div>
    </Modal>)}
  </div>);
}

// ── ESTADÍSTICAS ───────────────────────────────────────────────────────────────
function Estadisticas({transacciones,clientes,membresias}){
  const[tab,setTab]=useState("financiero");
  const TT={contentStyle:{background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,fontSize:12}};
  const PIE_C=[RED,BLU,GRN,YLW,PURP,"#E74C3C","#27AE60"];
  const cliEvolData=MESES_L.map((m,i)=>({m,y22:CLI_HIST.y22[i],y23:CLI_HIST.y23[i],y24:CLI_HIST.y24[i],y25:CLI_HIST.y25[i],y26:CLI_HIST.y26[i]}));
  const catMay=useMemo(()=>{const cat={};transacciones.filter(t=>t.t==="ingreso").forEach(t=>{cat[t.cat]=(cat[t.cat]||0)+t.m;});return Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,value])=>({name,value}));  },[transacciones]);
  const sexDist=[{name:"Masculino",value:clientes.filter(c=>c.sx==="M").length},{name:"Femenino",value:clientes.filter(c=>c.sx==="F").length}];
  return(<div>
    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,marginBottom:20}}>ESTADISTICAS</div>
    <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4,marginBottom:20,width:"fit-content",flexWrap:"wrap"}}>
      {[["financiero","Financiero"],["historico","Historico"],["clientes","Clientes"],["clinica","Clinica"]].map(([v,l])=>(<button key={v} onClick={()=>setTab(v)} style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab===v?RED:"transparent",color:tab===v?WH:GRLT}}>{l}</button>))}
    </div>
    {tab==="financiero"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Ingresos vs Gastos 2026</div><ResponsiveContainer width="100%" height={200}><BarChart data={CHART0} margin={{left:-20}}><CartesianGrid strokeDasharray="3 3" stroke={BORD}/><XAxis dataKey="mes" tick={{fill:GRLT,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:GRLT,fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false}/><Tooltip {...TT} formatter={(v,n)=>[f$(v),n]}/><Bar dataKey="gym" name="Gym" fill={BLU} radius={[3,3,0,0]}/><Bar dataKey="clinica" name="Clinica" fill={GRN} radius={[3,3,0,0]}/><Bar dataKey="gastos" name="Gastos" fill={RED} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Ingresos por categoria</div><ResponsiveContainer width="100%" height={160}><PieChart><Pie data={catMay} cx="40%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>{catMay.map((_,i)=><Cell key={i} fill={PIE_C[i%PIE_C.length]}/>)}</Pie><Tooltip contentStyle={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:8,fontSize:11}} formatter={v=>f$(v)}/></PieChart></ResponsiveContainer><div style={{display:"flex",flexDirection:"column",gap:4}}>{catMay.map((c,i)=>(<div key={c.name} style={{display:"flex",alignItems:"center",gap:8,fontSize:11}}><div style={{width:8,height:8,borderRadius:2,background:PIE_C[i%PIE_C.length],flexShrink:0}}/><span style={{flex:1,color:GRLT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span><span style={{fontWeight:700}}>{f$(c.value)}</span></div>))}</div></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Enero 2026 - Balance real</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{[["Ingresos Gym",86580,GRN],["Ingresos Clinica",9400,GRN],["Total ingresos",95980,GRN],["Gastos Gym",99419,RED],["Gastos Clinica",2285,RED],["BALANCE",-5724,RED]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid ${BORD}`}}><span style={{color:GRLT}}>{l}</span><span style={{fontWeight:700,color:c}}>{v>=0?f$(v):"-"+f$(Math.abs(v))}</span></div>))}</div><div style={{marginTop:10,fontSize:11,color:GRLT,background:YLW+"15",padding:"8px 12px",borderRadius:6}}>Ene negativo por credito maquinas + DAC fletes + arranque clinica</div></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Estructura costos clinica</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{[["Hora trabajo Manu","$500",YLW],["Amortizacion credito BBVA/ses","$50",BLU],["Costo total/sesion","$550",RED],["Sesion individual ($1.000)","45% margen",GRN],["Fase Aguda 7 ses ($5.200)","26% margen",YLW],["Rehab Completa ($15.950)","48% margen",GRN]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid ${BORD}`}}><span style={{color:GRLT}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span></div>))}</div></Card>
    </div>)}
    {tab==="historico"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Balance neto anual 2020-2025</div><ResponsiveContainer width="100%" height={200}><BarChart data={HIST_ANUAL} margin={{left:-20}}><CartesianGrid strokeDasharray="3 3" stroke={BORD}/><XAxis dataKey="ano" tick={{fill:GRLT,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:GRLT,fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false}/><Tooltip {...TT} formatter={(v,n)=>[f$(v),n]}/><Bar dataKey="bal" name="Balance" radius={[3,3,0,0]}>{HIST_ANUAL.map((d,i)=><Cell key={i} fill={d.bal>=0?GRN:RED}/>)}</Bar></BarChart></ResponsiveContainer></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Evolucion clientes mensual 2022-2026</div><ResponsiveContainer width="100%" height={200}><LineChart data={cliEvolData} margin={{left:-20}}><CartesianGrid strokeDasharray="3 3" stroke={BORD}/><XAxis dataKey="m" tick={{fill:GRLT,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:GRLT,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip {...TT}/><Line type="monotone" dataKey="y22" name="2022" stroke={PURP} dot={false} strokeWidth={1.5}/><Line type="monotone" dataKey="y23" name="2023" stroke={BLU} dot={false} strokeWidth={1.5}/><Line type="monotone" dataKey="y24" name="2024" stroke={YLW} dot={false} strokeWidth={1.5}/><Line type="monotone" dataKey="y25" name="2025" stroke={GRLT} dot={false} strokeWidth={1.5}/><Line type="monotone" dataKey="y26" name="2026" stroke={GRN} dot={true} strokeWidth={2}/></LineChart></ResponsiveContainer><div style={{marginTop:8,display:"flex",gap:10,flexWrap:"wrap"}}>{[["2022",PURP],["2023",BLU],["2024",YLW],["2025",GRLT],["2026",GRN]].map(([l,c])=>(<div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:GRLT}}><div style={{width:10,height:2,background:c}}/>{l}</div>))}</div></Card>
      <Card style={{gridColumn:"1/-1"}}><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Resumen historico</div><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:SURF3}}>{["Ano","Balance","Rentab.","Cli.Prom."].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:GRLT,fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{HIST_ANUAL.map((r,i)=>(<tr key={r.ano} style={{borderTop:`1px solid ${BORD}`,background:i%2===0?"transparent":SURF+"40"}}><td style={{padding:"8px 10px",fontWeight:700}}>{r.ano}</td><td style={{padding:"8px 10px",fontWeight:700,color:r.bal>=0?GRN:RED}}>{r.bal>=0?f$(r.bal):"-"+f$(Math.abs(r.bal))}</td><td style={{padding:"8px 10px",color:r.rent>=0?GRN:RED,fontWeight:700}}>{r.rent}%</td><td style={{padding:"8px 10px",color:GRLT}}>{r.cli_avg}</td></tr>))}</tbody></table></Card>
    </div>)}
    {tab==="clientes"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card>
        <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Distribucion por sexo</div>
        <ResponsiveContainer width="100%" height={140}><PieChart><Pie data={sexDist} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}><Cell fill={BLU}/><Cell fill={PURP}/></Pie></PieChart></ResponsiveContainer>
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:8}}>{sexDist.map((s,i)=>(<div key={s.name} style={{fontSize:12,display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:i===0?BLU:PURP}}/><span style={{color:GRLT}}>{s.name}:</span><span style={{fontWeight:700}}>{s.value}</span></div>))}</div>
      </Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Por servicio</div><div style={{display:"flex",flexDirection:"column",gap:12}}>{[["Solo Gym",clientes.filter(c=>c.neg==="gym").length,BLU],["Solo Clinica",clientes.filter(c=>c.neg==="clinica").length,GRN],["Integrado",clientes.filter(c=>c.neg==="ambos").length,PURP]].map(([l,v,c])=>(<div key={l}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span></div><div style={{height:5,background:SURF3,borderRadius:3}}><div style={{height:5,width:`${clientes.length?Math.round((v/clientes.length)*100):0}%`,background:c,borderRadius:3}}/></div></div>))}</div></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Hitos historicos</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{[["Pico (Sep 2022)","154",PURP],["Antes competencia (Ene 2024)","110",YLW],["Post competencia (Dic 2025)","82",RED],["Actual (Mar 2026)","63",GRN],["Meta","100",WH]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:`1px solid ${BORD}`}}><span style={{color:GRLT}}>{l}</span><span style={{fontWeight:700,color:c}}>{v} socios</span></div>))}</div></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Planes activos</div><div style={{display:"flex",flexDirection:"column",gap:12}}>{[["PRO",8,PURP],["Performance",68,RED],["Movete",14,YLW],["Start",10,BLU]].map(([l,p,c])=>(<div key={l}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span>{l}</span><span style={{fontWeight:700,color:c}}>{p}%</span></div><div style={{height:5,background:SURF3,borderRadius:3}}><div style={{height:5,width:`${p}%`,background:c,borderRadius:3}}/></div></div>))}</div></Card>
    </div>)}
    {tab==="clinica"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Sesiones por mes 2026</div><ResponsiveContainer width="100%" height={180}><BarChart data={[{m:"Ene",s:8},{m:"Feb",s:14},{m:"Mar",s:22},{m:"Abr",s:28},{m:"May*",s:23}]} margin={{left:-20}}><CartesianGrid strokeDasharray="3 3" stroke={BORD}/><XAxis dataKey="m" tick={{fill:GRLT,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:GRLT,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="s" name="Sesiones" fill={GRN} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>
      <Card><div style={{fontWeight:700,fontSize:13,marginBottom:14}}>KPIs clinica</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{[["Costo/sesion","$550 ($500+$50)",YLW],["Ticket prom. sesion","$1.050",GRN],["Margen promedio","48%",GRN],["Tasa conv. gym->clinica","15%",PURP],["Apertura","Enero 2026",GRLT]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"7px 0",borderBottom:`1px solid ${BORD}`}}><span style={{color:GRLT}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span></div>))}</div></Card>
    </div>)}
  </div>);
}

// ── PLANIFICACIÓN ──────────────────────────────────────────────────────────────
function Tareas({tareas,setTareas}){
  const[showAdd,setShowAdd]=useState(false);const[filtro,setFiltro]=useState("pendiente");
  const[form,setForm]=useState({titulo:"",frente:FRENTES[0],pri:"media",vence:"2026-05-31",st:"pendiente"});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggle=async id=>{
    const tarea=tareas.find(t=>t.id===id);if(!tarea)return;
    const newSt=tarea.st==="completado"?"pendiente":"completado";
    setTareas(p=>p.map(t=>t.id===id?{...t,st:newSt}:t));
    try{await sbUpdate("tareas",id,{st:newSt});}catch(e){console.error(e);}
  };
  const agregar=async()=>{
    if(!form.titulo)return;
    try{
      const s=await sbInsert("tareas",[{titulo:form.titulo,frente:form.frente,pri:form.pri,st:form.st,vence:form.vence,activa:true}]);
      setTareas(p=>[...p,...(s||[{...form,id:Date.now()}])]);
    }catch(e){console.error(e);}
    setShowAdd(false);setForm({titulo:"",frente:FRENTES[0],pri:"media",vence:"2026-05-31",st:"pendiente"});
  };
  // ── Editar ──────────────────────────────────────────────────────────
  const[editId,setEditId]=useState(null);
  const[editForm,setEditForm]=useState({titulo:"",frente:FRENTES[0],pri:"media",vence:""});
  const setEF=(k,v)=>setEditForm(p=>({...p,[k]:v}));
  const abrirEdit=t=>{setEditForm({titulo:t.titulo,frente:t.frente,pri:t.pri||"media",vence:t.vence||""});setEditId(t.id);};
  const guardarEdit=async()=>{
    if(!editForm.titulo)return;
    setTareas(p=>p.map(t=>t.id===editId?{...t,...editForm}:t));
    try{await sbUpdate("tareas",editId,{titulo:editForm.titulo,frente:editForm.frente,pri:editForm.pri,vence:editForm.vence});}catch(e){console.error(e);}
    setEditId(null);
  };
  // ── Borrar (borrado logico) ─────────────────────────────────────────
  const borrar=async t=>{
    if(!window.confirm(`Eliminar "${t.titulo}"? No se borra del historial, solo deja de aparecer.`))return;
    setTareas(p=>p.filter(x=>x.id!==t.id));
    try{await sbUpdate("tareas",t.id,{activa:false});}catch(e){console.error(e);}
  };
  const activas=tareas.filter(t=>t.activa!==false);
  const filtered=activas.filter(t=>filtro==="todas"||t.st===filtro).sort((a,b)=>(a.vence||"").localeCompare(b.vence||""));
  const pend=activas.filter(t=>t.st==="pendiente").length;const comp=activas.filter(t=>t.st==="completado").length;const urg=activas.filter(t=>t.st==="pendiente"&&t.pri==="alta").length;
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>PLANIFICACION</div>
      <Btn onClick={()=>setShowAdd(true)} small><Plus size={13}/> Nueva Tarea</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
      {[["Pendientes",pend,YLW],["Urgentes",urg,RED],["Completadas",comp,GRN]].map(([l,v,c])=>(<Card key={l} style={{textAlign:"center",padding:16}}><div style={{fontSize:11,color:GRLT,marginBottom:4}}>{l}</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:c,letterSpacing:1}}>{v}</div></Card>))}
    </div>
    <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4,marginBottom:16,width:"fit-content"}}>
      {[["pendiente","Pendientes"],["completado","Completadas"],["todas","Todas"]].map(([v,l])=>(<button key={v} onClick={()=>setFiltro(v)} style={{padding:"6px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:filtro===v?RED:"transparent",color:filtro===v?WH:GRLT}}>{l}</button>))}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {filtered.map(t=>(<Card key={t.id} style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:12,opacity:t.st==="completado"?.6:1}}>
        <button onClick={()=>toggle(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:t.st==="completado"?GRN:GRLT,padding:0,lineHeight:0,flexShrink:0}}>{t.st==="completado"?<CheckCircle2 size={20}/>:<Circle size={20}/>}</button>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,textDecoration:t.st==="completado"?"line-through":"none"}}>{t.titulo}</div><div style={{fontSize:11,color:GRLT,marginTop:3}}>{t.frente}{t.vence?` - vence ${fD(t.vence)}`:""}</div></div>
        <Badge label={t.pri?.toUpperCase()||"MEDIA"} color={priC(t.pri)} sm/>
        <button onClick={()=>abrirEdit(t)} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,padding:0,lineHeight:0,flexShrink:0}}><Edit2 size={15}/></button>
        <button onClick={()=>borrar(t)} style={{background:"none",border:"none",cursor:"pointer",color:RED,padding:0,lineHeight:0,flexShrink:0}}><Trash2 size={15}/></button>
      </Card>))}
    </div>
    {showAdd&&(<Modal title="Nueva Tarea" onClose={()=>setShowAdd(false)}>
      <Inp label="Titulo" value={form.titulo} onChange={e=>setF("titulo",e.target.value)} placeholder="Que hay que hacer?"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}><Sel label="Frente estrategico" value={form.frente} onChange={e=>setF("frente",e.target.value)}>{FRENTES.map(f=><option key={f}>{f}</option>)}</Sel><Sel label="Prioridad" value={form.pri} onChange={e=>setF("pri",e.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Sel></div>
      <Inp label="Fecha limite" type="date" value={form.vence} onChange={e=>setF("vence",e.target.value)}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn><Btn onClick={agregar} disabled={!form.titulo}><Plus size={14}/> Agregar</Btn></div>
    </Modal>)}
    {editId!==null&&(<Modal title="Editar Tarea" onClose={()=>setEditId(null)}>
      <Inp label="Titulo" value={editForm.titulo} onChange={e=>setEF("titulo",e.target.value)} placeholder="Que hay que hacer?"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}><Sel label="Frente estrategico" value={editForm.frente} onChange={e=>setEF("frente",e.target.value)}>{FRENTES.map(f=><option key={f}>{f}</option>)}</Sel><Sel label="Prioridad" value={editForm.pri} onChange={e=>setEF("pri",e.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Sel></div>
      <Inp label="Fecha limite" type="date" value={editForm.vence} onChange={e=>setEF("vence",e.target.value)}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setEditId(null)}>Cancelar</Btn><Btn onClick={guardarEdit} disabled={!editForm.titulo}><CheckCircle2 size={14}/> Guardar</Btn></div>
    </Modal>)}
  </div>);
}

// ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────
function Configuracion(){
  // ── State: Planes Gym ────────────────────────────────────────────────
  // Arrancan con el respaldo del codigo; el useEffect de abajo los reemplaza
  // con los datos reales de la base (que incluyen el id de cada fila).
  const[planes,setPlanes]=useState(Object.entries(PLANES).map(([k,v])=>({...v,k})));
  const[editPlane,setEditPlane]=useState(null);
  const[newPlane,setNewPlane]=useState({k:"",l:"",p:"",cat:"presencial"});
  const[showAddPlane,setShowAddPlane]=useState(false);

  // ── State: Packs Clínica ─────────────────────────────────────────────
  const[packsConf,setPacksConf]=useState(Object.entries(PACKS).map(([k,v])=>({...v,k})));
  const[editPack,setEditPack]=useState(null);
  const[showAddPack,setShowAddPack]=useState(false);
  const[newPack,setNewPack]=useState({k:"",l:"",ses:1,gym:false,p:"",costo:""});

  // ── State: Productos ─────────────────────────────────────────────────
  const[prods,setProds]=useState([...PRODUCTOS]);
  const[editProd,setEditProd]=useState(null);
  const[showAddProd,setShowAddProd]=useState(false);
  const[newProd,setNewProd]=useState({nom:"",cat:"Bebidas",p:""});

  // ── State: Fondos ────────────────────────────────────────────────────
  const[fondos,setFondos]=useState({emergencia:15,reinversion:10,expansion:5});
  const setFo=(k,v)=>setFondos(p=>({...p,[k]:+v}));

  // ── State: Tabs ──────────────────────────────────────────────────────
  const[tab,setTab]=useState("planes");

  // ── State: Negocio (datos editables) ─────────────────────────────────
  const[datos,setDatos]=useState({gym:"ACTIVA Fitness Club",clinica:"FisioActiva Colonia",dir:"Fosalba 674, Colonia del Sacramento",ig:"@fisioactivacolonia",gb:"Activo - Fosalba 674",fact:"Memory (DGI)"});
  const[editDato,setEditDato]=useState(null);
  const[params,setParams]=useState({costoFijo:115920,ticketProm:1570,splitManu:75,costoSesion:550,metaSocios:100});
  const setP=(k,v)=>setParams(p=>({...p,[k]:+v}));

  // ── State: Categorias editables (objetos {id,nombre} para poder inactivar por id) ──
  const[catIngGym,setCatIngGym]=useState(CAT_ING_GYM.map(n=>({id:null,nombre:n})));
  const[catEgrGym,setCatEgrGym]=useState(CAT_EGR_GYM.map(n=>({id:null,nombre:n})));
  const[catIngCli,setCatIngCli]=useState(CAT_ING_CLI.map(n=>({id:null,nombre:n})));
  const[catEgrCli,setCatEgrCli]=useState(CAT_EGR_CLI.map(n=>({id:null,nombre:n})));
  const[newCat,setNewCat]=useState({lista:"",valor:""});

  // ── Carga desde la base al abrir Configuracion (trae los id reales) ──
  // Si la base responde, reemplaza los respaldos. Si falla, quedan los respaldos.
  useEffect(()=>{
    let vivo=true;
    (async()=>{
      try{const d=await sbFetch("planes_gym?activa=eq.true&order=orden.asc,id.asc");
        if(vivo&&d&&d.length)setPlanes(d.map(r=>({id:r.id,k:r.k,l:r.l,p:+r.p,cat:r.cat||"presencial"})));
      }catch(e){console.error("Config planes:",e.message);}
      try{const d=await sbFetch("packs_clinica_catalogo?activa=eq.true&order=orden.asc,id.asc");
        if(vivo&&d&&d.length)setPacksConf(d.map(r=>({id:r.id,k:r.k,l:r.l,ses:+r.ses,gym:!!r.gym,p:+r.p,costo:+r.costo})));
      }catch(e){console.error("Config packs:",e.message);}
      try{const d=await sbFetch("categorias?activa=eq.true&order=orden.asc,id.asc");
        if(vivo&&d&&d.length){
          const map=l=>d.filter(x=>x.lista===l).map(x=>({id:x.id,nombre:x.nombre}));
          setCatIngGym(map("ingGym"));setCatEgrGym(map("egrGym"));
          setCatIngCli(map("ingCli"));setCatEgrCli(map("egrCli"));
        }
      }catch(e){console.error("Config categorias:",e.message);}
      try{const d=await sbFetch("productos?activa=eq.true&order=orden.asc,id.asc");
        if(vivo&&d&&d.length)setProds(d.map(r=>({id:r.id,nom:r.nom,cat:r.cat,p:+r.p})));
      }catch(e){console.error("Config productos:",e.message);}
      try{const d=await sbFetch("config_app?clave=eq.fondos");
        if(vivo&&d&&d[0]&&d[0].valor)setFondos(d[0].valor);
      }catch(e){console.error("Config fondos:",e.message);}
      try{const d=await sbFetch("config_app?clave=eq.datos_negocio");
        if(vivo&&d&&d[0]&&d[0].valor)setDatos(d[0].valor);
      }catch(e){console.error("Config datos:",e.message);}
      try{const d=await sbFetch("config_app?clave=eq.params_fin");
        if(vivo&&d&&d[0]&&d[0].valor)setParams(d[0].valor);
      }catch(e){console.error("Config params:",e.message);}
    })();
    return()=>{vivo=false;};
  },[]);

  // ── Helpers para mutar los catalogos module-level tras guardar en la base ──
  // (asi el resto de la app ve los cambios sin recargar la pagina)
  const syncPlanesGlobal=arr=>{const o={};arr.forEach(r=>{o[r.k]={l:r.l,p:+r.p,cat:r.cat};});_rellenarObj(PLANES,o);};
  const syncPacksGlobal=arr=>{const o={};arr.forEach(r=>{o[r.k]={l:r.l,ses:+r.ses,gym:!!r.gym,p:+r.p,costo:+r.costo};});_rellenarObj(PACKS,o);};
  const LISTA_MAP={ingGym:CAT_ING_GYM,egrGym:CAT_EGR_GYM,ingCli:CAT_ING_CLI,egrCli:CAT_EGR_CLI};
  const syncCatGlobal=(lista,arr)=>{if(LISTA_MAP[lista])_rellenarArr(LISTA_MAP[lista],arr.map(x=>x.nombre));};

  const cats=["presencial","online","nutri","simple","especial"];
  const catsProd=["Bebidas","Comida","Ropa","Suplementos","Otros"];

  return(<div>
    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,marginBottom:20}}>CONFIGURACION</div>

    {/* Tabs */}
    <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4,marginBottom:20,width:"fit-content",flexWrap:"wrap"}}>
      {[["planes","Planes Gym"],["packs","Packs Clinica"],["productos","Productos"],["categorias","Categorias"],["fondos","Fondos"],["negocio","Negocio"]].map(([v,l])=>(
        <button key={v} onClick={()=>setTab(v)} style={{padding:"7px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab===v?RED:"transparent",color:tab===v?WH:GRLT}}>{l}</button>
      ))}
    </div>

    {/* ── PLANES GYM ─────────────────────────────────────────── */}
    {tab==="planes"&&(<Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Settings size={15} style={{color:RED}}/> Planes Gym</div>
        <Btn small onClick={()=>setShowAddPlane(true)}><Plus size={12}/> Nuevo plan</Btn>
      </div>
      {planes.map(pl=>(
        <div key={pl.k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:SURF3,borderRadius:8,marginBottom:8}}>
          {editPlane===pl.k?(<>
            <input defaultValue={pl.l} id={`pl-l-${pl.k}`} style={{flex:2,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 10px",color:WH,fontSize:13,outline:"none"}}/>
            <input defaultValue={pl.p} id={`pl-p-${pl.k}`} type="number" style={{width:90,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,outline:"none",textAlign:"right"}}/>
            <select defaultValue={pl.cat} id={`pl-c-${pl.k}`} style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:12,outline:"none"}}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
            <Btn small variant="success" onClick={async()=>{
              const l=document.getElementById(`pl-l-${pl.k}`).value;
              const p=+document.getElementById(`pl-p-${pl.k}`).value;
              const cat=document.getElementById(`pl-c-${pl.k}`).value;
              if(pl.id){try{await sbUpdate("planes_gym",pl.id,{l,p,cat});}catch(e){console.error(e);}}
              const next=planes.map(x=>x.k===pl.k?{...x,l,p,cat}:x);
              setPlanes(next);syncPlanesGlobal(next);
              setEditPlane(null);
            }}><CheckCircle2 size={12}/></Btn>
            <Btn small variant="ghost" onClick={()=>setEditPlane(null)}><X size={12}/></Btn>
          </>):(< >
            <div style={{flex:2}}><div style={{fontSize:13,fontWeight:600}}>{pl.l}</div><div style={{fontSize:10,color:GRLT}}>{pl.cat}</div></div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:GRN,letterSpacing:1}}>{f$(pl.p)}</span>
            <Btn small variant="ghost" onClick={()=>setEditPlane(pl.k)}><Edit2 size={12}/></Btn>
            <Btn small variant="ghost" style={{color:RED}} onClick={async()=>{
              if(!window.confirm(`Inactivar "${pl.l}"? No se elimina: las ventas historicas con este plan se conservan, solo deja de aparecer al cargar nuevas.`))return;
              if(pl.id){try{await sbUpdate("planes_gym",pl.id,{activa:false});}catch(e){console.error(e);}}
              const next=planes.filter(x=>x.k!==pl.k);
              setPlanes(next);syncPlanesGlobal(next);
            }}><Trash2 size={12}/></Btn>
          </>)}
        </div>
      ))}
      {showAddPlane&&(<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
        <input value={newPlane.k} onChange={e=>setNewPlane(p=>({...p,k:e.target.value}))} placeholder="ID (ej: pro2)" style={{width:90,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}/>
        <input value={newPlane.l} onChange={e=>setNewPlane(p=>({...p,l:e.target.value}))} placeholder="Nombre del plan" style={{flex:1,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}/>
        <input value={newPlane.p} onChange={e=>setNewPlane(p=>({...p,p:e.target.value}))} type="number" placeholder="Precio" style={{width:90,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none",textAlign:"right"}}/>
        <select value={newPlane.cat} onChange={e=>setNewPlane(p=>({...p,cat:e.target.value}))} style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <Btn small onClick={async()=>{
          if(!newPlane.k||!newPlane.l||!newPlane.p)return;
          if(planes.some(x=>x.k===newPlane.k)){window.alert("Ya existe un plan con ese ID. Usa otro.");return;}
          const fila={k:newPlane.k,l:newPlane.l,p:+newPlane.p,cat:newPlane.cat,activa:true};
          let id=null;
          try{const r=await sbInsert("planes_gym",[fila]);id=r&&r[0]?r[0].id:null;}catch(e){console.error(e);}
          const next=[...planes,{id,k:newPlane.k,l:newPlane.l,p:+newPlane.p,cat:newPlane.cat}];
          setPlanes(next);syncPlanesGlobal(next);
          setShowAddPlane(false);setNewPlane({k:"",l:"",p:"",cat:"presencial"});
        }}><Plus size={12}/> Agregar</Btn>
        <Btn small variant="ghost" onClick={()=>setShowAddPlane(false)}><X size={12}/></Btn>
      </div>)}
    </Card>)}

    {/* ── PACKS CLÍNICA ──────────────────────────────────────── */}
    {tab==="packs"&&(<Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Package size={15} style={{color:GRN}}/> Packs Clinica</div>
        <Btn small onClick={()=>setShowAddPack(true)}><Plus size={12}/> Nuevo pack</Btn>
      </div>
      {packsConf.map(pk=>(
        <div key={pk.k} style={{background:SURF3,borderRadius:8,padding:"12px 14px",marginBottom:10}}>
          {editPack===pk.k?(<div style={{display:"flex",flexDirection:"column",gap:8}}>
            <input defaultValue={pk.l} id={`pk-l-${pk.k}`} placeholder="Nombre del pack" style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:13,outline:"none"}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
              <div><div style={{fontSize:10,color:GRLT,marginBottom:3}}>Sesiones</div><input defaultValue={pk.ses} id={`pk-s-${pk.k}`} type="number" style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,outline:"none"}}/></div>
              <div><div style={{fontSize:10,color:GRLT,marginBottom:3}}>Precio</div><input defaultValue={pk.p} id={`pk-p-${pk.k}`} type="number" style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,outline:"none"}}/></div>
              <div><div style={{fontSize:10,color:GRLT,marginBottom:3}}>Costo</div><input defaultValue={pk.costo} id={`pk-c-${pk.k}`} type="number" style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,outline:"none"}}/></div>
              <div><div style={{fontSize:10,color:GRLT,marginBottom:3}}>Inc. Gym</div><select defaultValue={pk.gym?"si":"no"} id={`pk-g-${pk.k}`} style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,outline:"none"}}><option value="no">No</option><option value="si">Si</option></select></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn small variant="success" onClick={async()=>{
                const l=document.getElementById(`pk-l-${pk.k}`).value;
                const ses=+document.getElementById(`pk-s-${pk.k}`).value;
                const p=+document.getElementById(`pk-p-${pk.k}`).value;
                const costo=+document.getElementById(`pk-c-${pk.k}`).value;
                const gym=document.getElementById(`pk-g-${pk.k}`).value==="si";
                if(pk.id){try{await sbUpdate("packs_clinica_catalogo",pk.id,{l,ses,p,costo,gym});}catch(e){console.error(e);}}
                const next=packsConf.map(x=>x.k===pk.k?{...x,l,ses,p,costo,gym}:x);
                setPacksConf(next);syncPacksGlobal(next);
                setEditPack(null);
              }}><CheckCircle2 size={12}/> Guardar</Btn>
              <Btn small variant="ghost" onClick={()=>setEditPack(null)}>Cancelar</Btn>
            </div>
          </div>):(
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600}}>{pk.l}</div>
                <div style={{fontSize:11,color:GRLT,marginTop:2}}>{pk.ses} ses · {pk.gym?"Incluye gym":"Sin gym"} · Costo {f$(pk.costo)} · Margen {Math.round(((pk.p-pk.costo)/pk.p)*100)}%</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:GRN,letterSpacing:1}}>{f$(pk.p)}</div>
              <Btn small variant="ghost" onClick={()=>setEditPack(pk.k)}><Edit2 size={12}/></Btn>
              <Btn small variant="ghost" style={{color:RED}} onClick={async()=>{
                if(!window.confirm(`Inactivar "${pk.l}"? No se elimina: las ventas historicas con este pack se conservan, solo deja de aparecer al cargar nuevas.`))return;
                if(pk.id){try{await sbUpdate("packs_clinica_catalogo",pk.id,{activa:false});}catch(e){console.error(e);}}
                const next=packsConf.filter(x=>x.k!==pk.k);
                setPacksConf(next);syncPacksGlobal(next);
              }}><Trash2 size={12}/></Btn>
            </div>
          )}
        </div>
      ))}
      {showAddPack&&(<div style={{background:SURF3,borderRadius:8,padding:"14px",marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
        <input value={newPack.k} onChange={e=>setNewPack(p=>({...p,k:e.target.value}))} placeholder="ID clave (ej: pack_nuevo)" style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}/>
        <input value={newPack.l} onChange={e=>setNewPack(p=>({...p,l:e.target.value}))} placeholder="Nombre del pack" style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {[["Sesiones","ses","number"],["Precio","p","number"],["Costo","costo","number"]].map(([l,k,t])=>(<div key={k}><div style={{fontSize:10,color:GRLT,marginBottom:3}}>{l}</div><input value={newPack[k]} onChange={e=>setNewPack(p=>({...p,[k]:e.target.value}))} type={t} style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:12,outline:"none"}}/></div>))}
          <div><div style={{fontSize:10,color:GRLT,marginBottom:3}}>Inc. Gym</div><select value={newPack.gym?"si":"no"} onChange={e=>setNewPack(p=>({...p,gym:e.target.value==="si"}))} style={{width:"100%",background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:12,outline:"none"}}><option value="no">No</option><option value="si">Si</option></select></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn small onClick={async()=>{
            if(!newPack.k||!newPack.l||!newPack.p)return;
            if(packsConf.some(x=>x.k===newPack.k)){window.alert("Ya existe un pack con ese ID. Usa otro.");return;}
            const fila={k:newPack.k,l:newPack.l,ses:+newPack.ses||1,gym:newPack.gym,p:+newPack.p,costo:+newPack.costo||0,activa:true};
            let id=null;
            try{const r=await sbInsert("packs_clinica_catalogo",[fila]);id=r&&r[0]?r[0].id:null;}catch(e){console.error(e);}
            const next=[...packsConf,{id,k:newPack.k,l:newPack.l,ses:+newPack.ses||1,gym:newPack.gym,p:+newPack.p,costo:+newPack.costo||0}];
            setPacksConf(next);syncPacksGlobal(next);
            setShowAddPack(false);setNewPack({k:"",l:"",ses:1,gym:false,p:"",costo:""});
          }}><Plus size={12}/> Agregar</Btn>
          <Btn small variant="ghost" onClick={()=>setShowAddPack(false)}>Cancelar</Btn>
        </div>
      </div>)}
    </Card>)}

    {/* ── PRODUCTOS ──────────────────────────────────────────── */}
    {tab==="productos"&&(<Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Package size={15} style={{color:YLW}}/> Productos en venta</div>
        <Btn small onClick={()=>setShowAddProd(true)}><Plus size={12}/> Nuevo producto</Btn>
      </div>
      {prods.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:SURF3,borderRadius:8,marginBottom:8}}>
          {editProd===p.id?(<>
            <input defaultValue={p.nom} id={`pr-n-${p.id}`} style={{flex:2,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 10px",color:WH,fontSize:13,outline:"none"}}/>
            <select defaultValue={p.cat} id={`pr-c-${p.id}`} style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:12,outline:"none"}}>
              {catsProd.map(c=><option key={c}>{c}</option>)}
            </select>
            <input defaultValue={p.p} id={`pr-p-${p.id}`} type="number" style={{width:90,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,outline:"none",textAlign:"right"}}/>
            <Btn small variant="success" onClick={async()=>{
              const nom=document.getElementById(`pr-n-${p.id}`).value;
              const cat=document.getElementById(`pr-c-${p.id}`).value;
              const pr=+document.getElementById(`pr-p-${p.id}`).value;
              try{await sbUpdate("productos",p.id,{nom,cat,p:pr});}catch(e){console.error(e);}
              setProds(prev=>prev.map(x=>x.id===p.id?{...x,nom,cat,p:pr}:x));
              setEditProd(null);
            }}><CheckCircle2 size={12}/></Btn>
            <Btn small variant="ghost" onClick={()=>setEditProd(null)}><X size={12}/></Btn>
          </>):(<>
            <div style={{flex:1}}><span style={{fontSize:10,background:BLU+"22",color:BLU,padding:"1px 6px",borderRadius:4,marginRight:8}}>{p.cat}</span><span style={{fontSize:13}}>{p.nom}</span></div>
            <span style={{fontWeight:700,color:GRN,fontSize:14}}>{f$(p.p)}</span>
            <Btn small variant="ghost" onClick={()=>setEditProd(p.id)}><Edit2 size={12}/></Btn>
            <Btn small variant="ghost" style={{color:RED}} onClick={async()=>{
              if(!window.confirm(`Inactivar "${p.nom}"? No se elimina del historial, solo deja de aparecer en la lista.`))return;
              try{await sbUpdate("productos",p.id,{activa:false});}catch(e){console.error(e);}
              setProds(prev=>prev.filter(x=>x.id!==p.id));
            }}><Trash2 size={12}/></Btn>
          </>)}
        </div>
      ))}
      {showAddProd&&(<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
        <input value={newProd.nom} onChange={e=>setNewProd(p=>({...p,nom:e.target.value}))} placeholder="Nombre del producto" style={{flex:2,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}/>
        <select value={newProd.cat} onChange={e=>setNewProd(p=>({...p,cat:e.target.value}))} style={{background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}>
          {catsProd.map(c=><option key={c}>{c}</option>)}
        </select>
        <input value={newProd.p} onChange={e=>setNewProd(p=>({...p,p:e.target.value}))} type="number" placeholder="Precio" style={{width:90,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none",textAlign:"right"}}/>
        <Btn small onClick={async()=>{
          if(!newProd.nom||!newProd.p)return;
          const fila={nom:newProd.nom,cat:newProd.cat,p:+newProd.p,orden:prods.length+1,activa:true};
          let id=Date.now();
          try{const r=await sbInsert("productos",[fila]);if(r&&r[0])id=r[0].id;}catch(e){console.error(e);}
          setProds(prev=>[...prev,{id,nom:newProd.nom,cat:newProd.cat,p:+newProd.p}]);
          setShowAddProd(false);setNewProd({nom:"",cat:"Bebidas",p:""});
        }}><Plus size={12}/> Agregar</Btn>
        <Btn small variant="ghost" onClick={()=>setShowAddProd(false)}><X size={12}/></Btn>
      </div>)}
    </Card>)}

    {/* ── CATEGORIAS ─────────────────────────────────────────── */}
    {tab==="categorias"&&(()=>{
      const listas=[
        ["Ingresos Gym",catIngGym,setCatIngGym,GRN,"ingGym"],
        ["Egresos Gym",catEgrGym,setCatEgrGym,RED,"egrGym"],
        ["Ingresos Clinica",catIngCli,setCatIngCli,GRN,"ingCli"],
        ["Egresos Clinica",catEgrCli,setCatEgrCli,RED,"egrCli"],
      ];
      return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {listas.map(([titulo,lista,setter,color,key])=>(
          <Card key={key}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:color}}/> {titulo}</div>
            {lista.map((c,i)=>(
              <div key={c.id!=null?`id${c.id}`:`x${i}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",background:SURF3,borderRadius:6,marginBottom:6}}>
                <span style={{fontSize:12}}>{c.nombre}</span>
                <button onClick={async()=>{
                  if(c.id!=null){try{await sbUpdate("categorias",c.id,{activa:false});}catch(e){console.error(e);}}
                  const next=lista.filter((_,idx)=>idx!==i);
                  setter(next);syncCatGlobal(key,next);
                }} style={{background:"none",border:"none",cursor:"pointer",color:RED,padding:0}}><Trash2 size={12}/></button>
              </div>
            ))}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <input value={newCat.lista===key?newCat.valor:""} onChange={e=>setNewCat({lista:key,valor:e.target.value})} placeholder="Nueva categoria" style={{flex:1,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 10px",color:WH,fontSize:12,outline:"none"}}/>
              <Btn small onClick={async()=>{
                if(newCat.lista!==key||!newCat.valor)return;
                if(lista.some(x=>x.nombre.toLowerCase()===newCat.valor.toLowerCase())){window.alert("Esa categoria ya existe en esta lista.");return;}
                const fila={lista:key,nombre:newCat.valor,orden:lista.length+1,activa:true};
                let id=null;
                try{const r=await sbInsert("categorias",[fila]);id=r&&r[0]?r[0].id:null;}catch(e){console.error(e);}
                const next=[...lista,{id,nombre:newCat.valor}];
                setter(next);syncCatGlobal(key,next);
                setNewCat({lista:"",valor:""});
              }}><Plus size={12}/></Btn>
            </div>
          </Card>
        ))}
        <Card style={{gridColumn:"1/-1"}}>
          <div style={{fontSize:11,color:GRLT,background:BLU+"15",padding:"10px 14px",borderRadius:6}}>
            Las categorias editadas aca se usan al registrar nuevas transacciones y se guardan en la base de datos: persisten entre dispositivos y sesiones. Al quitar una categoria no se borra del historial (borrado logico), solo deja de aparecer al cargar nuevos movimientos.
          </div>
        </Card>
      </div>);
    })()}

    {/* ── FONDOS ─────────────────────────────────────────────── */}
    {tab==="fondos"&&(<Card style={{maxWidth:480}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Wallet size={15} style={{color:BLU}}/> Fondos Estrategicos</div>
      {[["emergencia","Emergencia",GRN],["reinversion","Reinversion",BLU],["expansion","Expansion",PURP]].map(([k,l,c])=>(
        <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontSize:13,fontWeight:600}}>{l}</div><div style={{fontSize:11,color:GRLT}}>Del balance mensual distribuible</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="number" value={fondos[k]} onChange={e=>setFo(k,e.target.value)} style={{width:64,background:SURF3,border:`1px solid ${c}40`,borderRadius:6,padding:"7px 10px",color:c,fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
            <span style={{fontSize:13,color:GRLT}}>%</span>
          </div>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${BORD}`,paddingTop:14,marginTop:4}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8}}>
          <span style={{color:GRLT}}>Total fondos estrategicos</span>
          <span style={{fontWeight:700,color:(fondos.emergencia+fondos.reinversion+fondos.expansion)===30?GRN:YLW}}>{fondos.emergencia+fondos.reinversion+fondos.expansion}%</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
          <span style={{color:GRLT}}>Distribuible a socios</span>
          <span style={{fontWeight:700,color:WH}}>{100-(fondos.emergencia+fondos.reinversion+fondos.expansion)}%</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
          <span style={{color:GRLT}}>→ Manu 75%</span>
          <span style={{color:YLW}}>{((100-(fondos.emergencia+fondos.reinversion+fondos.expansion))*0.75).toFixed(1)}% del balance</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
          <span style={{color:GRLT}}>→ Socio 25%</span>
          <span style={{color:GRLT}}>{((100-(fondos.emergencia+fondos.reinversion+fondos.expansion))*0.25).toFixed(1)}% del balance</span>
        </div>
      </div>
      <div style={{marginTop:14}}><Btn variant="success" small onClick={async()=>{
        try{await sbUpsert("config_app",[{clave:"fondos",valor:fondos}]);window.alert("Fondos guardados.");}
        catch(e){console.error(e);window.alert("No se pudo guardar. Revisa la conexion.");}
      }}><CheckCircle2 size={12}/> Guardar cambios</Btn></div>
    </Card>)}

    {/* ── NEGOCIO ────────────────────────────────────────────── */}
    {tab==="negocio"&&(()=>{
      const breakEven=params.ticketProm>0?Math.ceil(params.costoFijo/params.ticketProm):0;
      const ingresoMeta=params.metaSocios*params.ticketProm;
      const margenMeta=ingresoMeta-params.costoFijo;
      const datosLabels={gym:"Nombre Gym",clinica:"Nombre Clinica",dir:"Direccion",ig:"Instagram",gb:"Google Business",fact:"Facturacion"};
      return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card>
        <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Activity size={15} style={{color:PURP}}/> Datos del negocio</div>
        {Object.entries(datos).map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,padding:"7px 0",borderBottom:`1px solid ${BORD}`,gap:8}}>
            <span style={{color:GRLT,flexShrink:0}}>{datosLabels[k]}</span>
            {editDato===k?(
              <div style={{display:"flex",gap:4,flex:1,justifyContent:"flex-end"}}>
                <input defaultValue={v} id={`dato-${k}`} style={{flex:1,maxWidth:180,background:SURF2,border:`1px solid ${BORD}`,borderRadius:5,padding:"4px 8px",color:WH,fontSize:12,outline:"none"}}/>
                <button onClick={async()=>{const nv=document.getElementById(`dato-${k}`).value;const nuevo={...datos,[k]:nv};setDatos(nuevo);setEditDato(null);try{await sbUpsert("config_app",[{clave:"datos_negocio",valor:nuevo}]);}catch(e){console.error(e);}}} style={{background:"none",border:"none",cursor:"pointer",color:GRN}}><CheckCircle2 size={14}/></button>
              </div>
            ):(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontWeight:500,textAlign:"right"}}>{v}</span>
                <button onClick={()=>setEditDato(k)} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,padding:0}}><Edit2 size={11}/></button>
              </div>
            )}
          </div>
        ))}
      </Card>
      <Card>
        <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><DollarSign size={15} style={{color:YLW}}/> Parametros financieros</div>
        <div style={{fontSize:10,color:GRLT,marginBottom:10,textTransform:"uppercase",letterSpacing:.6}}>Editables (ingresá tus valores)</div>
        {[["costoFijo","Costo fijo mensual gym","$"],["ticketProm","Ticket promedio socio","$"],["costoSesion","Costo por sesion clinica","$"],["metaSocios","Meta de socios","socios"]].map(([k,l,u])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:12,color:GRLT}}>{l}</span>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              {u==="$"&&<span style={{fontSize:11,color:GRLT}}>$</span>}
              <input type="number" value={params[k]} onChange={e=>setP(k,e.target.value)} style={{width:90,background:SURF3,border:`1px solid ${BORD}`,borderRadius:6,padding:"6px 8px",color:WH,fontSize:13,fontWeight:600,outline:"none",textAlign:"right"}}/>
              {u!=="$"&&<span style={{fontSize:11,color:GRLT}}>{u}</span>}
            </div>
          </div>
        ))}
        <div style={{marginTop:6,marginBottom:4}}><Btn variant="success" small onClick={async()=>{
          try{await sbUpsert("config_app",[{clave:"params_fin",valor:params}]);window.alert("Parametros guardados.");}
          catch(e){console.error(e);window.alert("No se pudo guardar. Revisa la conexion.");}
        }}><CheckCircle2 size={12}/> Guardar parametros</Btn></div>
        <div style={{fontSize:10,color:GRLT,margin:"14px 0 10px",textTransform:"uppercase",letterSpacing:.6}}>Auto-calculados</div>
        {[
          ["Break-even (socios)",`${breakEven} socios`,GRN,`${f$(params.costoFijo)} / ${f$(params.ticketProm)}`],
          ["Ingreso a meta",f$(ingresoMeta),BLU,`${params.metaSocios} socios x ${f$(params.ticketProm)}`],
          ["Margen a meta",f$(margenMeta),margenMeta>=0?GRN:RED,"ingreso - costo fijo"],
        ].map(([l,v,c,formula])=>(
          <div key={l} style={{padding:"9px 12px",background:SURF3,borderRadius:8,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:GRLT}}>{l}</span>
              <span style={{fontSize:15,fontWeight:700,color:c}}>{v}</span>
            </div>
            <div style={{fontSize:10,color:GRLT,marginTop:3,fontStyle:"italic"}}>{formula}</div>
          </div>
        ))}
      </Card>
    </div>);
    })()}
  </div>);
}



// ── DISTRIBUCIÓN CLÍNICA ──────────────────────────────────────────────────────
function DistribucionClinica({transacciones}){
  const[mes,setMes]=useState("todo");
  // Deducciones editables antes del split
  const[deducciones,setDeducciones]=useState([
    {id:1,nombre:"Credito BBVA implementos",monto:1299},
  ]);
  const[splitManu,setSplitManu]=useState(75);
  const[showAddDed,setShowAddDed]=useState(false);
  const[newDed,setNewDed]=useState({nombre:"",monto:""});
  const[editDed,setEditDed]=useState(null);

  const mesesCli=useMemo(()=>{
    const map={};
    transacciones.filter(t=>t.ng==="Clinica").forEach(t=>{
      const m=t.f?.slice(0,7);if(!m)return;
      if(!map[m])map[m]={mes:m,ing:0,egr:0};
      if(t.t==="ingreso")map[m].ing+=Number(t.m);
      else map[m].egr+=Number(t.m);
    });
    return Object.values(map).sort((a,b)=>a.mes.localeCompare(b.mes));
  },[transacciones]);

  const MESES_NOM={"2026-01":"Ene","2026-02":"Feb","2026-03":"Mar","2026-04":"Abr","2026-05":"May","2026-06":"Jun"};
  const totalDed=deducciones.reduce((s,d)=>s+Number(d.monto),0);

  const calcular=(ing,egr)=>{
    const balBruto=ing-egr;
    const balNeto=balBruto-totalDed;
    const manu=Math.round(Math.max(0,balNeto)*(splitManu/100));
    const jorge=Math.round(Math.max(0,balNeto)*((100-splitManu)/100));
    return{balBruto,balNeto,manu,jorge};
  };

  const datosMes=mes==="todo"?
    mesesCli.reduce((acc,m)=>({ing:acc.ing+m.ing,egr:acc.egr+m.egr}),{ing:0,egr:0}):
    mesesCli.find(m=>m.mes===mes)||{ing:0,egr:0};

  const{balBruto,balNeto,manu,jorge}=calcular(datosMes.ing,datosMes.egr);

  const addDed=()=>{
    if(!newDed.nombre||!newDed.monto)return;
    setDeducciones(p=>[...p,{id:Date.now(),nombre:newDed.nombre,monto:+newDed.monto}]);
    setNewDed({nombre:"",monto:""});setShowAddDed(false);
  };

  return(<div>
    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,marginBottom:20}}>DISTRIBUCION CLINICA</div>

    <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
      <button onClick={()=>setMes("todo")} style={{padding:"7px 14px",borderRadius:8,border:`2px solid ${mes==="todo"?BLU:BORD}`,background:mes==="todo"?BLU+"20":SURF2,cursor:"pointer",fontSize:12,fontWeight:600,color:mes==="todo"?WH:GRLT}}>Acumulado</button>
      {mesesCli.map(m=>(
        <button key={m.mes} onClick={()=>setMes(mes===m.mes?"todo":m.mes)} style={{padding:"7px 14px",borderRadius:8,border:`2px solid ${mes===m.mes?RED:BORD}`,background:mes===m.mes?RED+"20":SURF2,cursor:"pointer",fontSize:12,fontWeight:600,color:mes===m.mes?WH:GRLT}}>
          {MESES_NOM[m.mes]||m.mes}
        </button>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {/* Cascada editable */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,marginBottom:18}}>Cascada de distribucion · {mes==="todo"?"Acumulado":MESES_NOM[mes]||mes}</div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:`1px solid ${BORD}`}}><span style={{fontSize:13,color:GRLT}}>Ingresos clinica</span><span style={{fontSize:13,fontWeight:700,color:GRN}}>+{f$(datosMes.ing)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:`1px solid ${BORD}`}}><span style={{fontSize:13,color:GRLT}}>Gastos operativos</span><span style={{fontSize:13,fontWeight:700,color:RED}}>-{f$(datosMes.egr)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",background:SURF3,borderRadius:6,margin:"4px 0"}}><span style={{fontSize:13,fontWeight:700}}>Balance bruto</span><span style={{fontSize:13,fontWeight:700,color:balBruto>=0?GRN:RED}}>{f$(balBruto)}</span></div>

        {/* Deducciones editables */}
        <div style={{marginTop:8,marginBottom:8}}>
          <div style={{fontSize:10,color:GRLT,fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Deducciones antes del split</span>
            <button onClick={()=>setShowAddDed(true)} style={{background:"none",border:"none",cursor:"pointer",color:RED,display:"flex",alignItems:"center",gap:3,fontSize:10}}><Plus size={11}/> Agregar</button>
          </div>
          {deducciones.map(d=>(
            <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderBottom:`1px solid ${BORD}`}}>
              {editDed===d.id?(<>
                <input defaultValue={d.nombre} id={`ded-n-${d.id}`} style={{flex:1,background:SURF2,border:`1px solid ${BORD}`,borderRadius:5,padding:"4px 8px",color:WH,fontSize:12,outline:"none",marginRight:6}}/>
                <input defaultValue={d.monto} id={`ded-m-${d.id}`} type="number" style={{width:80,background:SURF2,border:`1px solid ${BORD}`,borderRadius:5,padding:"4px 8px",color:WH,fontSize:12,outline:"none",textAlign:"right"}}/>
                <button onClick={()=>{const n=document.getElementById(`ded-n-${d.id}`).value;const m=+document.getElementById(`ded-m-${d.id}`).value;setDeducciones(p=>p.map(x=>x.id===d.id?{...x,nombre:n,monto:m}:x));setEditDed(null);}} style={{background:"none",border:"none",cursor:"pointer",color:GRN,marginLeft:4}}><CheckCircle2 size={14}/></button>
              </>):(<>
                <span style={{fontSize:12,color:YLW}}>(-) {d.nombre}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:YLW}}>-{f$(d.monto)}</span>
                  <button onClick={()=>setEditDed(d.id)} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,padding:0}}><Edit2 size={11}/></button>
                  <button onClick={()=>setDeducciones(p=>p.filter(x=>x.id!==d.id))} style={{background:"none",border:"none",cursor:"pointer",color:RED,padding:0}}><Trash2 size={11}/></button>
                </div>
              </>)}
            </div>
          ))}
          {showAddDed&&(<div style={{display:"flex",gap:6,marginTop:8}}>
            <input value={newDed.nombre} onChange={e=>setNewDed(p=>({...p,nombre:e.target.value}))} placeholder="Concepto" style={{flex:1,background:SURF2,border:`1px solid ${BORD}`,borderRadius:5,padding:"6px 8px",color:WH,fontSize:12,outline:"none"}}/>
            <input value={newDed.monto} onChange={e=>setNewDed(p=>({...p,monto:e.target.value}))} type="number" placeholder="$" style={{width:80,background:SURF2,border:`1px solid ${BORD}`,borderRadius:5,padding:"6px 8px",color:WH,fontSize:12,outline:"none",textAlign:"right"}}/>
            <Btn small onClick={addDed}><Plus size={11}/></Btn>
            <Btn small variant="ghost" onClick={()=>setShowAddDed(false)}><X size={11}/></Btn>
          </div>)}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",background:SURF3,borderRadius:6,margin:"4px 0"}}><span style={{fontSize:13,fontWeight:700}}>Balance neto distribuible</span><span style={{fontSize:13,fontWeight:700,color:balNeto>=0?GRN:RED}}>{f$(balNeto)}</span></div>

        {/* Split editable */}
        <div style={{marginTop:10,padding:"10px 14px",background:SURF2,borderRadius:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:GRLT}}>Split Manu / Jorge</span>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <input type="number" value={splitManu} onChange={e=>setSplitManu(Math.min(100,Math.max(0,+e.target.value)))} style={{width:52,background:SURF3,border:`1px solid ${BORD}`,borderRadius:5,padding:"4px 6px",color:YLW,fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
              <span style={{fontSize:12,color:GRLT}}>/ {100-splitManu}</span>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:13,color:YLW}}>Manu {splitManu}%</span><span style={{fontSize:14,fontWeight:700,color:YLW}}>{f$(manu)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:13,color:BLU}}>Jorge {100-splitManu}%</span><span style={{fontSize:14,fontWeight:700,color:BLU}}>{f$(jorge)}</span></div>
        </div>
      </Card>

      {/* Resumen mensual */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>Resumen mensual clinica</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:SURF3}}>{["Mes","Ing.","Gas.","Neto","Manu","Jorge"].map(h=>(
            <th key={h} style={{padding:"7px 8px",textAlign:"right",color:GRLT,fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{h}</th>
          ))}</tr></thead>
          <tbody>
            {mesesCli.map(m=>{const c=calcular(m.ing,m.egr);return(
              <tr key={m.mes} onClick={()=>setMes(mes===m.mes?"todo":m.mes)} style={{borderTop:`1px solid ${BORD}`,cursor:"pointer",background:mes===m.mes?RED+"15":"transparent"}}>
                <td style={{padding:"7px 8px",fontWeight:600,textAlign:"right"}}>{MESES_NOM[m.mes]||m.mes}</td>
                <td style={{padding:"7px 8px",color:GRN,textAlign:"right",fontSize:11}}>{f$(m.ing)}</td>
                <td style={{padding:"7px 8px",color:RED,textAlign:"right",fontSize:11}}>{f$(m.egr)}</td>
                <td style={{padding:"7px 8px",fontWeight:700,color:c.balNeto>=0?GRN:RED,textAlign:"right"}}>{f$(c.balNeto)}</td>
                <td style={{padding:"7px 8px",color:YLW,textAlign:"right",fontSize:11}}>{f$(c.manu)}</td>
                <td style={{padding:"7px 8px",color:BLU,textAlign:"right",fontSize:11}}>{f$(c.jorge)}</td>
              </tr>);
            })}
          </tbody>
        </table>
        <div style={{marginTop:14,fontSize:11,color:GRLT,background:BLU+"15",padding:"8px 12px",borderRadius:6}}>
          El split aplica solo al balance neto de clinica, descontadas las deducciones configurables. Total deducciones: {f$(totalDed)}/periodo.
        </div>
      </Card>
    </div>
  </div>);
}

// ── ESTRUCTURA DE COSTOS ───────────────────────────────────────────────────────
function EstructuraCostos(){
  const[tab,setTab]=useState("gym");
  const[items,setItems]=useState({});
  const[showAdd,setShowAdd]=useState(null);
  const[newItem,setNewItem]=useState({rubro:"",cant:1,importe:""});

  const getItems=k=>items[k]||[];
  const addItem=k=>{
    if(!newItem.rubro||!newItem.importe)return;
    setItems(p=>({...p,[k]:[...getItems(k),{id:Date.now(),rubro:newItem.rubro,cant:+newItem.cant,importe:+newItem.importe}]}));
    setNewItem({rubro:"",cant:1,importe:""});
    setShowAdd(null);
  };
  const removeItem=(k,id)=>setItems(p=>({...p,[k]:getItems(k).filter(x=>x.id!==id)}));

  const CostoBuilder=({k,nombre,precio})=>{
    const its=getItems(k);
    const totalCosto=its.reduce((s,i)=>s+(i.cant*i.importe),0);
    const margen=precio-totalCosto;
    const pct=precio>0?Math.round((margen/precio)*100):0;
    return(<Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><div style={{fontWeight:700,fontSize:14}}>{nombre}</div><div style={{fontSize:12,color:GRLT}}>Precio de venta: <span style={{color:GRN,fontWeight:700}}>{f$(precio)}</span></div></div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:pct>=40?GRN:pct>=20?YLW:RED,letterSpacing:1}}>{pct}%</div>
          <div style={{fontSize:10,color:GRLT}}>margen</div>
        </div>
      </div>
      {its.length>0&&(<table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:10}}>
        <thead><tr style={{background:SURF3}}>{["Rubro","Cant.","Importe unit.","Subtotal",""].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:GRLT,fontWeight:700,fontSize:10}}>{h}</th>)}</tr></thead>
        <tbody>{its.map(it=>(
          <tr key={it.id} style={{borderTop:`1px solid ${BORD}`}}>
            <td style={{padding:"7px 10px"}}>{it.rubro}</td>
            <td style={{padding:"7px 10px",color:GRLT}}>{it.cant}</td>
            <td style={{padding:"7px 10px",color:GRLT}}>{f$(it.importe)}</td>
            <td style={{padding:"7px 10px",fontWeight:600}}>{f$(it.cant*it.importe)}</td>
            <td style={{padding:"7px 10px"}}><button onClick={()=>removeItem(k,it.id)} style={{background:"none",border:"none",cursor:"pointer",color:RED,padding:0}}><Trash2 size={13}/></button></td>
          </tr>
        ))}</tbody>
      </table>)}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 10px",background:SURF3,borderRadius:8,marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:700}}>Total costo</span>
        <span style={{fontSize:14,fontWeight:700,color:RED}}>{f$(totalCosto)}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[[`Margen neto`,f$(margen),margen>=0?GRN:RED],[`Sobre precio`,`${pct}%`,pct>=40?GRN:pct>=20?YLW:RED],[`Costo/precio`,`${precio>0?Math.round((totalCosto/precio)*100):0}%`,GRLT]].map(([l,v,c])=>(
          <div key={l} style={{background:SURF2,borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:10,color:GRLT,marginBottom:3}}>{l}</div>
            <div style={{fontWeight:700,color:c,fontSize:13}}>{v}</div>
          </div>
        ))}
      </div>
      {showAdd===k?(<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <input value={newItem.rubro} onChange={e=>setNewItem(p=>({...p,rubro:e.target.value}))} placeholder="Rubro (ej: Hora Manu)" style={{flex:2,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 10px",color:WH,fontSize:12,outline:"none"}}/>
        <input value={newItem.cant} onChange={e=>setNewItem(p=>({...p,cant:e.target.value}))} type="number" placeholder="Cant." style={{width:60,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 8px",color:WH,fontSize:12,outline:"none",textAlign:"center"}}/>
        <input value={newItem.importe} onChange={e=>setNewItem(p=>({...p,importe:e.target.value}))} type="number" placeholder="$ unit." style={{width:100,background:SURF2,border:`1px solid ${BORD}`,borderRadius:6,padding:"7px 8px",color:WH,fontSize:12,outline:"none",textAlign:"right"}}/>
        <Btn small onClick={()=>addItem(k)}><Plus size={12}/> Agregar</Btn>
        <Btn small variant="ghost" onClick={()=>setShowAdd(null)}><X size={12}/></Btn>
      </div>):(
        <Btn small variant="ghost" onClick={()=>{setShowAdd(k);setNewItem({rubro:"",cant:1,importe:""})}}>
          <Plus size={12}/> Agregar rubro de costo
        </Btn>
      )}
    </Card>);
  };

  const itemsGym=[
    {k:"pro",         nombre:"Plan PRO",            precio:PLANES.pro?.p||2300},
    {k:"performance", nombre:"Plan Performance",    precio:PLANES.performance?.p||1600},
    {k:"movete",      nombre:"Plan Movete",         precio:PLANES.movete?.p||1400},
    {k:"start",       nombre:"Plan Start",          precio:PLANES.start?.p||1200},
  ];
  const itemsCli=Object.entries(PACKS).map(([k,v])=>({k,nombre:v.l,precio:v.p}));

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>ESTRUCTURA DE COSTOS</div>
      <Btn variant="ghost" small onClick={()=>{
        const lista=tab==="gym"?itemsGym:itemsCli;
        const secciones=lista.map(i=>{
          const its=getItems(i.k);
          const totalCosto=its.reduce((s,x)=>s+(x.cant*x.importe),0);
          const margen=i.precio-totalCosto;
          const pct=i.precio>0?Math.round((margen/i.precio)*100):0;
          const filas=its.map(x=>`<tr><td>${x.rubro}</td><td>${x.cant}</td><td>${f$(x.importe)}</td><td>${f$(x.cant*x.importe)}</td></tr>`).join("");
          return `<div class="card"><div class="val">${i.nombre} — Precio ${f$(i.precio)}</div>${filas?`<table><thead><tr><th>Rubro</th><th>Cant</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>${filas}</tbody></table>`:'<p style="color:#888">Sin rubros cargados</p>'}<div class="tot">Costo total: ${f$(totalCosto)} · Margen: ${f$(margen)} (${pct}%)</div></div>`;
        }).join("");
        exportarPDF(`Estructura de Costos - ${tab==="gym"?"Planes Gym":"Packs Clinica"}`,secciones);
      }}><Download size={13}/> Exportar PDF</Btn>
    </div>
    <div style={{fontSize:13,color:GRLT,marginBottom:20}}>Construi la estructura de costos de cada plan y pack. Los cambios son locales — para hacerlos permanentes, guardalos en Configuracion.</div>
    <div style={{display:"flex",gap:4,background:SURF2,borderRadius:8,padding:4,marginBottom:20,width:"fit-content"}}>
      <button onClick={()=>setTab("gym")} style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab==="gym"?RED:"transparent",color:tab==="gym"?WH:GRLT}}>Planes Gym</button>
      <button onClick={()=>setTab("clinica")} style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab==="clinica"?GRN:"transparent",color:tab==="clinica"?WH:GRLT}}>Packs Clinica</button>
    </div>
    {tab==="gym"&&itemsGym.map(i=><CostoBuilder key={i.k} {...i}/>)}
    {tab==="clinica"&&itemsCli.map(i=><CostoBuilder key={i.k} {...i}/>)}
  </div>);
}


export default function App(){
  const[role,setRole]=useState(null);
  const[token,setToken]=useState(null);
  const[page,setPage]=useState("dashboard");
  const[mobileMenu,setMobileMenu]=useState(false);
  const[showAddTrans,setShowAddTrans]=useState(false);
  const[transacciones,setTransacciones]=useState([]);
  const[membresias,setMembresias]=useState([]);
  const[packs,setPacks]=useState([]);
  const[clientes,setClientes]=useState([]);
  const[tareas,setTareas]=useState([]);
  const[dbLoading,setDbLoading]=useState(false);

  const cargarDatos=async()=>{
    setDbLoading(true);
    // Cada query es independiente: si una falla, las demas igual cargan
    const safeF=async(q,setter,nombre)=>{
      try{const d=await sbFetch(q);setter(d||[]);}
      catch(e){console.error(`Error cargando ${nombre}:`,e.message);setter([]);}
    };
    await Promise.all([
      cargarCatalogos(),
      safeF("transacciones?order=f.desc&limit=1000",setTransacciones,"transacciones"),
      safeF("membresias?order=created_at.desc",setMembresias,"membresias"),
      safeF("packs_clinica?order=created_at.desc",setPacks,"packs"),
      safeF("clientes?order=n.asc",setClientes,"clientes"),
      safeF("tareas?order=vence.asc",setTareas,"tareas"),
    ]);
    setDbLoading(false);
  };

  if(!role) return <LoginScreen onLogin={(r,tk)=>{setRole(r);setToken(tk);setTimeout(cargarDatos,100);}}/>;
  if(dbLoading) return(<div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",color:WH}}><style>{GF}</style><div style={{textAlign:"center"}}><div style={{width:40,height:40,border:`3px solid ${BORD}`,borderTop:`3px solid ${RED}`,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/><div style={{fontSize:14,color:GRLT}}>Cargando datos...</div></div></div>);;
  if(role==="cajero") return <CajeroView transacciones={transacciones} setTransacciones={setTransacciones} clientes={clientes} onLogout={()=>setRole(null)}/>;

  const NAV=[
    {id:"dashboard",   icon:<LayoutDashboard size={17}/>, label:"Dashboard"},
    {id:"libro",       icon:<BookOpen size={17}/>,        label:"Libro Diario"},
    {id:"membresias",  icon:<CreditCard size={17}/>,      label:"Membresias"},
    {id:"packs",       icon:<Package size={17}/>,         label:"Packs Clinica"},
    {id:"clientes",    icon:<Users size={17}/>,            label:"Clientes"},
    {id:"estadisticas",icon:<BarChart3 size={17}/>,       label:"Estadisticas"},
    {id:"distribucion",icon:<Wallet size={17}/>,          label:"Distribucion"},
    {id:"costos",      icon:<DollarSign size={17}/>,      label:"Costos"},
    {id:"tareas",      icon:<CheckSquare size={17}/>,     label:"Planificacion"},
    {id:"config",      icon:<Settings size={17}/>,        label:"Configuracion"},
  ];

  const alertas=membresias.filter(m=>dTo(m.venc)>=0&&dTo(m.venc)<=7).length+membresias.filter(m=>dTo(m.venc)<0).length;

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'DM Sans',system-ui,sans-serif",color:WH,display:"flex",flexDirection:"column"}}>
      <style>{GF}</style>

      {/* TOP BAR */}
      <header style={{background:SURF,borderBottom:`1px solid ${BORD}`,padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setMobileMenu(m=>!m)} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,padding:4,lineHeight:0,display:"none"}} className="mob-menu"><Menu size={20}/></button>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,background:RED,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16}}>A</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,lineHeight:1}}>GESTIÓN</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:RED,lineHeight:1}}>ACTIVA</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {alertas>0&&(
            <div style={{display:"flex",alignItems:"center",gap:6,background:RED+"20",border:`1px solid ${RED}40`,borderRadius:8,padding:"5px 10px",fontSize:12,color:RED,cursor:"pointer"}} onClick={()=>setPage("membresias")}>
              <Bell size={13}/>{alertas} {alertas===1?"alerta":"alertas"}
            </div>
          )}
          <Badge label="ADMIN" color={GRN}/>
          <button onClick={async()=>{if(token)await sbSignOut(token);setRole(null);setToken(null);setTransacciones([]);setMembresias([]);setPacks([]);setClientes([]);setTareas([]);}} style={{background:"none",border:"none",cursor:"pointer",color:GRLT,display:"flex",alignItems:"center",gap:5,fontSize:12,padding:"6px 10px"}}><LogOut size={14}/> Salir</button>
        </div>
      </header>

      <div style={{display:"flex",flex:1}}>
        {/* SIDEBAR */}
        <nav style={{width:200,background:SURF,borderRight:`1px solid ${BORD}`,padding:"16px 0",flexShrink:0,position:"sticky",top:56,height:"calc(100vh - 56px)",overflowY:"auto"}}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)} style={{
              width:"100%",padding:"11px 20px",background:"none",border:"none",cursor:"pointer",
              display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:600,
              color:page===item.id?WH:GRLT,
              background:page===item.id?RED+"20":"none",
              borderLeft:page===item.id?`3px solid ${RED}`:"3px solid transparent",
              transition:"all .15s"
            }}>
              <span style={{color:page===item.id?RED:GRLT}}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* MAIN */}
        <main style={{flex:1,padding:24,minWidth:0,overflowX:"hidden"}}>
          {page==="dashboard"&&<Dashboard transacciones={transacciones} membresias={membresias} clientes={clientes} tareas={tareas} onAddTrans={()=>setShowAddTrans(true)}/>}
          {page==="libro"&&<LibroDiario transacciones={transacciones} clientes={clientes} onAdd={()=>setShowAddTrans(true)}/>}
          {page==="membresias"&&<Membresias membresias={membresias} setMembresias={setMembresias} clientes={clientes} setTransacciones={setTransacciones}/>}
          {page==="packs"&&<PacksClinica packs={packs} setPacks={setPacks} clientes={clientes} setTransacciones={setTransacciones}/>}
          {page==="clientes"&&<Clientes clientes={clientes} setClientes={setClientes} transacciones={transacciones} membresias={membresias} packs={packs}/>}
          {page==="estadisticas"&&<Estadisticas transacciones={transacciones} clientes={clientes} membresias={membresias}/>}
          {page==="distribucion"&&<DistribucionClinica transacciones={transacciones}/>}
          {page==="costos"&&<EstructuraCostos/>}
          {page==="tareas"&&<Tareas tareas={tareas} setTareas={setTareas}/>}
          {page==="config"&&<Configuracion/>}
        </main>
      </div>

      {showAddTrans&&<AddTransModal clientes={clientes} onClose={()=>setShowAddTrans(false)} onSave={async tr=>{try{const concepto=tr.det?`${tr.c} - ${tr.det}`:tr.c;const s=await sbInsert("transacciones",[{f:tr.f,c:concepto,m:+tr.m,t:tr.t,ng:tr.ng,cat:tr.cat,mp:tr.mp,b:tr.b||null,cl:tr.cl?+tr.cl:null}]);setTransacciones(p=>[...(s||[{...tr,id:Date.now(),m:+tr.m}]),...p]);}catch(e){console.error(e);}setShowAddTrans(false);}}/>}
    </div>
  );
}
