// alimentos.js — Base de alimentos Uruguay/región
// Macros por 100g: proteinas, carbohidratos, grasas, fibra, calorias
// Micronutrientes seleccionados: 2 principales por categoría
// Fuentes: USDA, tablas INTA, tablas de composición alimentaria Uruguay

export const CATEGORIAS_ALIMENTOS = {
  proteina_animal: { label: 'Proteína animal',   color: '#CC0000', emoji: '🥩' },
  proteina_vegetal:{ label: 'Proteína vegetal',   color: '#16A34A', emoji: '🌱' },
  lacteos:         { label: 'Lácteos',             color: '#0284C7', emoji: '🥛' },
  huevos:          { label: 'Huevos',              color: '#F59E0B', emoji: '🥚' },
  carbohidratos:   { label: 'Carbohidratos',       color: '#7C3AED', emoji: '🍚' },
  frutas:          { label: 'Frutas',              color: '#EA580C', emoji: '🍎' },
  verduras:        { label: 'Verduras',            color: '#059669', emoji: '🥦' },
  grasas:          { label: 'Grasas saludables',  color: '#D97706', emoji: '🥑' },
  bebidas:         { label: 'Bebidas',             color: '#2563EB', emoji: '💧' },
  snacks:          { label: 'Snacks / Colaciones', color: '#9333EA', emoji: '🥜' },
  fiambres:        { label: 'Fiambres / Embutidos', color: '#B91C1C', emoji: '🥓' },
  panificados:     { label: 'Panificados / Harinas',color: '#D97706', emoji: '🍞' },
  condimentos:     { label: 'Condimentos / Extras',  color: '#6B7280', emoji: '🧂' },
  platos_calientes:{ label: 'Platos calientes / Olla', color: '#DC2626', emoji: '🍲' },
  ensaladas:       { label: 'Ensaladas',               color: '#16A34A', emoji: '🥗' },
};

// Estructura: { id, nombre, categoria, porcion_ref (g), proteinas, carbos, grasas, fibra, calorias, micro1:{nombre,valor,unidad}, micro2:{nombre,valor,unidad}, notas }
export const DB_ALIMENTOS = [
  // ── PROTEÍNA ANIMAL ──────────────────────────────────────────────────────
  { id:'pa01', nombre:'Pechuga de pollo (sin piel)',    categoria:'proteina_animal', porcion_ref:100, proteinas:31,  carbos:0,   grasas:3.6, fibra:0, calorias:165, micro1:{nombre:'Niacina (B3)',valor:13.4,unidad:'mg'}, micro2:{nombre:'Fósforo',valor:220,unidad:'mg'} },
  { id:'pa02', nombre:'Muslo de pollo (sin piel)',      categoria:'proteina_animal', porcion_ref:100, proteinas:25,  carbos:0,   grasas:8,   fibra:0, calorias:177, micro1:{nombre:'Zinc',valor:2.4,unidad:'mg'},          micro2:{nombre:'Hierro',valor:1.2,unidad:'mg'} },
  { id:'pa03', nombre:'Carne vacuna magra (lomo)',      categoria:'proteina_animal', porcion_ref:100, proteinas:29,  carbos:0,   grasas:5,   fibra:0, calorias:163, micro1:{nombre:'Hierro hemínico',valor:3.0,unidad:'mg'},micro2:{nombre:'Zinc',valor:4.8,unidad:'mg'} },
  { id:'pa04', nombre:'Carne vacuna picada (90% magra)',categoria:'proteina_animal', porcion_ref:100, proteinas:26,  carbos:0,   grasas:10,  fibra:0, calorias:196, micro1:{nombre:'Hierro',valor:2.7,unidad:'mg'},        micro2:{nombre:'Zinc',valor:4.1,unidad:'mg'} },
  { id:'pa05', nombre:'Asado / costilla vacuna',        categoria:'proteina_animal', porcion_ref:100, proteinas:23,  carbos:0,   grasas:18,  fibra:0, calorias:254, micro1:{nombre:'Hierro',valor:2.5,unidad:'mg'},        micro2:{nombre:'Selenio',valor:18,unidad:'µg'} },
  { id:'pa06', nombre:'Salmón (filete)',                categoria:'proteina_animal', porcion_ref:100, proteinas:25,  carbos:0,   grasas:13,  fibra:0, calorias:208, micro1:{nombre:'Omega-3',valor:2.3,unidad:'g'},        micro2:{nombre:'Vitamina D',valor:14,unidad:'µg'} },
  { id:'pa07', nombre:'Merluza',                        categoria:'proteina_animal', porcion_ref:100, proteinas:18,  carbos:0,   grasas:1.5, fibra:0, calorias:86,  micro1:{nombre:'Vitamina B12',valor:1.5,unidad:'µg'}, micro2:{nombre:'Fósforo',valor:200,unidad:'mg'} },
  { id:'pa08', nombre:'Atún al natural (lata)',         categoria:'proteina_animal', porcion_ref:100, proteinas:27,  carbos:0,   grasas:1,   fibra:0, calorias:116, micro1:{nombre:'Selenio',valor:90,unidad:'µg'},        micro2:{nombre:'Vitamina B12',valor:2.5,unidad:'µg'} },
  { id:'pa09', nombre:'Cerdo (lomo)',                   categoria:'proteina_animal', porcion_ref:100, proteinas:27,  carbos:0,   grasas:5,   fibra:0, calorias:153, micro1:{nombre:'Tiamina (B1)',valor:1.0,unidad:'mg'},  micro2:{nombre:'Zinc',valor:2.9,unidad:'mg'} },
  { id:'pa10', nombre:'Pavo (pechuga)',                 categoria:'proteina_animal', porcion_ref:100, proteinas:29,  carbos:0,   grasas:2,   fibra:0, calorias:135, micro1:{nombre:'Triptófano',valor:0.4,unidad:'g'},    micro2:{nombre:'Selenio',valor:32,unidad:'µg'} },
  { id:'pa11', nombre:'Camarones',                      categoria:'proteina_animal', porcion_ref:100, proteinas:24,  carbos:0.2, grasas:1.7, fibra:0, calorias:99,  micro1:{nombre:'Yodo',valor:35,unidad:'µg'},           micro2:{nombre:'Selenio',valor:39,unidad:'µg'} },
  { id:'pa12', nombre:'Jamón crudo serrano',            categoria:'proteina_animal', porcion_ref:30,  proteinas:7.5, carbos:0.2, grasas:4,   fibra:0, calorias:68,  micro1:{nombre:'Vitamina B1',valor:0.5,unidad:'mg'},  micro2:{nombre:'Zinc',valor:1.5,unidad:'mg'} },

  // ── PROTEÍNA VEGETAL ─────────────────────────────────────────────────────
  { id:'pv01', nombre:'Lentejas (cocidas)',             categoria:'proteina_vegetal', porcion_ref:100, proteinas:9,   carbos:20,  grasas:0.4, fibra:8,  calorias:116, micro1:{nombre:'Hierro no-heme',valor:3.3,unidad:'mg'},micro2:{nombre:'Folato',valor:181,unidad:'µg'} },
  { id:'pv02', nombre:'Porotos negros (cocidos)',       categoria:'proteina_vegetal', porcion_ref:100, proteinas:8.9, carbos:23,  grasas:0.5, fibra:8.7,calorias:132, micro1:{nombre:'Hierro',valor:2.1,unidad:'mg'},       micro2:{nombre:'Potasio',valor:355,unidad:'mg'} },
  { id:'pv03', nombre:'Garbanzos (cocidos)',            categoria:'proteina_vegetal', porcion_ref:100, proteinas:9,   carbos:27,  grasas:2.6, fibra:7.6,calorias:164, micro1:{nombre:'Folato',valor:172,unidad:'µg'},       micro2:{nombre:'Manganeso',valor:1.0,unidad:'mg'} },
  { id:'pv04', nombre:'Tofu firme',                    categoria:'proteina_vegetal', porcion_ref:100, proteinas:8,   carbos:2,   grasas:4,   fibra:0.3,calorias:76,  micro1:{nombre:'Calcio',valor:350,unidad:'mg'},       micro2:{nombre:'Hierro',valor:5.4,unidad:'mg'} },
  { id:'pv05', nombre:'Edamame (soja verde)',           categoria:'proteina_vegetal', porcion_ref:100, proteinas:11,  carbos:10,  grasas:5,   fibra:5,  calorias:121, micro1:{nombre:'Vitamina K',valor:26,unidad:'µg'},    micro2:{nombre:'Folato',valor:311,unidad:'µg'} },
  { id:'pv06', nombre:'Soja texturizada (seca)',        categoria:'proteina_vegetal', porcion_ref:100, proteinas:52,  carbos:30,  grasas:1,   fibra:17, calorias:329, micro1:{nombre:'Hierro',valor:9,unidad:'mg'},         micro2:{nombre:'Zinc',valor:2.5,unidad:'mg'} },
  { id:'pv07', nombre:'Proteína de suero (whey)',       categoria:'proteina_vegetal', porcion_ref:30,  proteinas:24,  carbos:3,   grasas:1.5, fibra:0,  calorias:121, micro1:{nombre:'BCAA',valor:6,unidad:'g'},            micro2:{nombre:'Calcio',valor:130,unidad:'mg'} },

  // ── LÁCTEOS ──────────────────────────────────────────────────────────────
  { id:'lc01', nombre:'Yogur natural entero',           categoria:'lacteos', porcion_ref:200, proteinas:8,   carbos:12,  grasas:6,   fibra:0, calorias:134, micro1:{nombre:'Calcio',valor:240,unidad:'mg'},       micro2:{nombre:'Probióticos',valor:1,unidad:'(sí)'} },
  { id:'lc02', nombre:'Yogur griego natural',           categoria:'lacteos', porcion_ref:150, proteinas:15,  carbos:9,   grasas:5,   fibra:0, calorias:141, micro1:{nombre:'Calcio',valor:200,unidad:'mg'},       micro2:{nombre:'Vitamina B12',valor:0.75,unidad:'µg'} },
  { id:'lc03', nombre:'Leche entera',                   categoria:'lacteos', porcion_ref:250, tiene_unidad:true, nombre_unidad:'taza/vaso', gramos_por_unidad:250, proteinas:8,   carbos:12,  grasas:8,   fibra:0, calorias:150, micro1:{nombre:'Calcio',valor:300,unidad:'mg'},       micro2:{nombre:'Vitamina D',valor:2.5,unidad:'µg'} },
  { id:'lc04', nombre:'Leche descremada',               categoria:'lacteos', porcion_ref:250, proteinas:8.5, carbos:12,  grasas:0.5, fibra:0, calorias:86,  micro1:{nombre:'Calcio',valor:300,unidad:'mg'},       micro2:{nombre:'Vitamina B12',valor:1.0,unidad:'µg'} },
  { id:'lc05', nombre:'Queso cottage light',            categoria:'lacteos', porcion_ref:100, proteinas:13,  carbos:3.4, grasas:1.4, fibra:0, calorias:79,  micro1:{nombre:'Calcio',valor:111,unidad:'mg'},       micro2:{nombre:'Sodio',valor:372,unidad:'mg'} },
  { id:'lc06', nombre:'Queso muzarella',                categoria:'lacteos', porcion_ref:40,  proteinas:10,  carbos:1,   grasas:9,   fibra:0, calorias:122, micro1:{nombre:'Calcio',valor:290,unidad:'mg'},       micro2:{nombre:'Vitamina A',valor:68,unidad:'µg'} },
  { id:'lc07', nombre:'Queso magro (port salut light)', categoria:'lacteos', porcion_ref:40,  proteinas:9,   carbos:1,   grasas:5,   fibra:0, calorias:85,  micro1:{nombre:'Calcio',valor:320,unidad:'mg'},       micro2:{nombre:'Fósforo',valor:240,unidad:'mg'} },
  { id:'lc08', nombre:'Queso fresco',                   categoria:'lacteos', porcion_ref:50,  proteinas:6,   carbos:0.5, grasas:7,   fibra:0, calorias:90,  micro1:{nombre:'Calcio',valor:200,unidad:'mg'},       micro2:{nombre:'Riboflavina',valor:0.2,unidad:'mg'} },

  // ── HUEVOS ───────────────────────────────────────────────────────────────
  { id:'hv01', nombre:'Huevo entero',                   categoria:'huevos', porcion_ref:60, tiene_unidad:true, nombre_unidad:'huevo mediano', gramos_por_unidad:60,  proteinas:7.5, carbos:0.4, grasas:5.5, fibra:0, calorias:83,  micro1:{nombre:'Colina',valor:147,unidad:'mg'},       micro2:{nombre:'Vitamina D',valor:2.0,unidad:'µg'} },
  { id:'hv02', nombre:'Clara de huevo',                 categoria:'huevos', porcion_ref:30, tiene_unidad:true, nombre_unidad:'clara', gramos_por_unidad:30,  proteinas:7,   carbos:0.5, grasas:0,   fibra:0, calorias:30,  micro1:{nombre:'Riboflavina',valor:0.2,unidad:'mg'},  micro2:{nombre:'Selenio',valor:7.5,unidad:'µg'} },

  // ── CARBOHIDRATOS ────────────────────────────────────────────────────────
  { id:'ch01', nombre:'Arroz blanco (cocido)',          categoria:'carbohidratos', porcion_ref:150, proteinas:3,   carbos:40,  grasas:0.3, fibra:0.4,calorias:174, micro1:{nombre:'Manganeso',valor:0.6,unidad:'mg'},    micro2:{nombre:'Niacina',valor:1.6,unidad:'mg'} },
  { id:'ch02', nombre:'Arroz integral (cocido)',        categoria:'carbohidratos', porcion_ref:150, proteinas:3.5, carbos:38,  grasas:0.9, fibra:1.8,calorias:173, micro1:{nombre:'Magnesio',valor:42,unidad:'mg'},      micro2:{nombre:'Manganeso',valor:1.1,unidad:'mg'} },
  { id:'ch03', nombre:'Avena en copos',                 categoria:'carbohidratos', porcion_ref:50,  proteinas:5,   carbos:27,  grasas:3,   fibra:4,  calorias:155, micro1:{nombre:'Beta-glucano',valor:2,unidad:'g'},    micro2:{nombre:'Magnesio',valor:29,unidad:'mg'} },
  { id:'ch04', nombre:'Papa (cocida con cáscara)',      categoria:'carbohidratos', porcion_ref:150, proteinas:3,   carbos:26,  grasas:0.2, fibra:2.5,calorias:117, micro1:{nombre:'Vitamina C',valor:21,unidad:'mg'},    micro2:{nombre:'Potasio',valor:897,unidad:'mg'} },
  { id:'ch05', nombre:'Batata / boniato (cocida)',      categoria:'carbohidratos', porcion_ref:150, proteinas:2,   carbos:27,  grasas:0.1, fibra:3.8,calorias:116, micro1:{nombre:'Vitamina A',valor:961,unidad:'µg'},   micro2:{nombre:'Potasio',valor:475,unidad:'mg'} },
  { id:'ch06', nombre:'Pan integral',                   categoria:'carbohidratos', porcion_ref:50,  proteinas:4.5, carbos:23,  grasas:1.5, fibra:3,  calorias:122, micro1:{nombre:'Hierro',valor:1.5,unidad:'mg'},       micro2:{nombre:'Zinc',valor:0.8,unidad:'mg'} },
  { id:'ch07', nombre:'Pan blanco',                     categoria:'carbohidratos', porcion_ref:50,  proteinas:4,   carbos:25,  grasas:1,   fibra:1,  calorias:124, micro1:{nombre:'Hierro',valor:1.0,unidad:'mg'},       micro2:{nombre:'Tiamina',valor:0.2,unidad:'mg'} },
  { id:'ch08', nombre:'Pasta (fideos cocidos)',         categoria:'carbohidratos', porcion_ref:150, proteinas:5,   carbos:37,  grasas:1,   fibra:1.8,calorias:177, micro1:{nombre:'Selenio',valor:26,unidad:'µg'},       micro2:{nombre:'Manganeso',valor:0.4,unidad:'mg'} },
  { id:'ch09', nombre:'Pasta integral (cocida)',        categoria:'carbohidratos', porcion_ref:150, proteinas:6,   carbos:35,  grasas:1,   fibra:4,  calorias:172, micro1:{nombre:'Magnesio',valor:42,unidad:'mg'},      micro2:{nombre:'Hierro',valor:1.5,unidad:'mg'} },
  { id:'ch10', nombre:'Quinoa (cocida)',                categoria:'carbohidratos', porcion_ref:150, proteinas:6,   carbos:32,  grasas:3,   fibra:3.5,calorias:178, micro1:{nombre:'Magnesio',valor:60,unidad:'mg'},      micro2:{nombre:'Hierro',valor:2,unidad:'mg'} },
  { id:'ch11', nombre:'Polenta (cocida)',               categoria:'carbohidratos', porcion_ref:150, proteinas:2,   carbos:21,  grasas:0.5, fibra:1,  calorias:96,  micro1:{nombre:'Vitamina A',valor:57,unidad:'µg'},    micro2:{nombre:'Hierro',valor:0.5,unidad:'mg'} },
  { id:'ch12', nombre:'Choclo (maíz) desgranado',      categoria:'carbohidratos', porcion_ref:80,  proteinas:3,   carbos:19,  grasas:1.5, fibra:2.7,calorias:100, micro1:{nombre:'Vitamina B1',valor:0.2,unidad:'mg'},  micro2:{nombre:'Magnesio',valor:26,unidad:'mg'} },
  { id:'ch13', nombre:'Galletas de arroz inflado',      categoria:'carbohidratos', porcion_ref:30,  proteinas:2,   carbos:23,  grasas:0.5, fibra:0.4,calorias:107, micro1:{nombre:'Manganeso',valor:0.5,unidad:'mg'},    micro2:{nombre:'Selenio',valor:5,unidad:'µg'} },
  { id:'ch14', nombre:'Tostadas de centeno',            categoria:'carbohidratos', porcion_ref:30,  proteinas:3.5, carbos:20,  grasas:1,   fibra:4,  calorias:103, micro1:{nombre:'Hierro',valor:1.5,unidad:'mg'},       micro2:{nombre:'Folato',valor:20,unidad:'µg'} },

  // ── FRUTAS ───────────────────────────────────────────────────────────────
  { id:'fr01', nombre:'Banana / Plátano',               categoria:'frutas', porcion_ref:120, tiene_unidad:true, nombre_unidad:'banana mediana', gramos_por_unidad:120, proteinas:1.3, carbos:27,  grasas:0.3, fibra:3.1,calorias:107, micro1:{nombre:'Potasio',valor:422,unidad:'mg'},      micro2:{nombre:'Vitamina B6',valor:0.4,unidad:'mg'} },
  { id:'fr02', nombre:'Manzana',                        categoria:'frutas', porcion_ref:150, tiene_unidad:true, nombre_unidad:'manzana mediana', gramos_por_unidad:150, proteinas:0.4, carbos:20,  grasas:0.2, fibra:3.6,calorias:78,  micro1:{nombre:'Quercetina',valor:4.4,unidad:'mg'},   micro2:{nombre:'Vitamina C',valor:8,unidad:'mg'} },
  { id:'fr03', nombre:'Naranja',                        categoria:'frutas', porcion_ref:150, tiene_unidad:true, nombre_unidad:'naranja mediana', gramos_por_unidad:150, proteinas:1.5, carbos:18,  grasas:0.2, fibra:3.6,calorias:71,  micro1:{nombre:'Vitamina C',valor:82,unidad:'mg'},    micro2:{nombre:'Folato',valor:40,unidad:'µg'} },
  { id:'fr04', nombre:'Frutillas / Fresas',             categoria:'frutas', porcion_ref:150, proteinas:1,   carbos:12,  grasas:0.4, fibra:3,  calorias:48,  micro1:{nombre:'Vitamina C',valor:89,unidad:'mg'},    micro2:{nombre:'Manganeso',valor:0.4,unidad:'mg'} },
  { id:'fr05', nombre:'Uvas',                           categoria:'frutas', porcion_ref:100, proteinas:0.7, carbos:18,  grasas:0.2, fibra:0.9,calorias:69,  micro1:{nombre:'Resveratrol',valor:0.07,unidad:'mg'}, micro2:{nombre:'Vitamina K',valor:14.6,unidad:'µg'} },
  { id:'fr06', nombre:'Durazno / Melocotón',            categoria:'frutas', porcion_ref:150, proteinas:1.4, carbos:15,  grasas:0.3, fibra:2.4,calorias:58,  micro1:{nombre:'Vitamina C',valor:10,unidad:'mg'},    micro2:{nombre:'Potasio',valor:285,unidad:'mg'} },
  { id:'fr07', nombre:'Pera',                           categoria:'frutas', porcion_ref:150, proteinas:0.4, carbos:20,  grasas:0.1, fibra:5.5,calorias:80,  micro1:{nombre:'Vitamina C',valor:7,unidad:'mg'},     micro2:{nombre:'Cobre',valor:0.1,unidad:'mg'} },
  { id:'fr08', nombre:'Mandarina',                      categoria:'frutas', porcion_ref:100, proteinas:0.8, carbos:13,  grasas:0.3, fibra:1.8,calorias:53,  micro1:{nombre:'Vitamina C',valor:27,unidad:'mg'},    micro2:{nombre:'Betacaroteno',valor:155,unidad:'µg'} },
  { id:'fr09', nombre:'Kiwi',                           categoria:'frutas', porcion_ref:100, proteinas:1,   carbos:14,  grasas:0.5, fibra:3,  calorias:61,  micro1:{nombre:'Vitamina C',valor:93,unidad:'mg'},    micro2:{nombre:'Vitamina K',valor:40,unidad:'µg'} },
  { id:'fr10', nombre:'Ananá / Piña',                   categoria:'frutas', porcion_ref:150, proteinas:0.9, carbos:19,  grasas:0.2, fibra:2.3,calorias:75,  micro1:{nombre:'Vitamina C',valor:47,unidad:'mg'},    micro2:{nombre:'Manganeso',valor:1.1,unidad:'mg'} },
  { id:'fr11', nombre:'Arándanos',                      categoria:'frutas', porcion_ref:100, proteinas:0.7, carbos:14,  grasas:0.3, fibra:2.4,calorias:57,  micro1:{nombre:'Antocianinas',valor:165,unidad:'mg'}, micro2:{nombre:'Vitamina C',valor:9.7,unidad:'mg'} },
  { id:'fr12', nombre:'Mango',                          categoria:'frutas', porcion_ref:150, proteinas:1.4, carbos:28,  grasas:0.6, fibra:3,  calorias:99,  micro1:{nombre:'Vitamina C',valor:57,unidad:'mg'},    micro2:{nombre:'Vitamina A',valor:54,unidad:'µg'} },

  // ── VERDURAS ─────────────────────────────────────────────────────────────
  { id:'ve01', nombre:'Espinaca (cruda)',               categoria:'verduras', porcion_ref:80,  proteinas:2.3, carbos:1,   grasas:0.4, fibra:2.2,calorias:18,  micro1:{nombre:'Vitamina K',valor:402,unidad:'µg'},   micro2:{nombre:'Hierro',valor:2.2,unidad:'mg'} },
  { id:'ve02', nombre:'Brócoli (cocido)',               categoria:'verduras', porcion_ref:100, proteinas:2.8, carbos:7,   grasas:0.4, fibra:3.3,calorias:35,  micro1:{nombre:'Vitamina C',valor:65,unidad:'mg'},    micro2:{nombre:'Vitamina K',valor:92,unidad:'µg'} },
  { id:'ve03', nombre:'Zanahoria',                      categoria:'verduras', porcion_ref:80,  proteinas:0.9, carbos:7,   grasas:0.2, fibra:2.3,calorias:33,  micro1:{nombre:'Vitamina A',valor:834,unidad:'µg'},   micro2:{nombre:'Betacaroteno',valor:5003,unidad:'µg'} },
  { id:'ve04', nombre:'Tomate',                         categoria:'verduras', porcion_ref:100, proteinas:0.9, carbos:3.9, grasas:0.2, fibra:1.2,calorias:18,  micro1:{nombre:'Licopeno',valor:2573,unidad:'µg'},    micro2:{nombre:'Vitamina C',valor:14,unidad:'mg'} },
  { id:'ve05', nombre:'Pimiento / Morrón rojo',         categoria:'verduras', porcion_ref:80,  proteinas:1,   carbos:6,   grasas:0.3, fibra:2.1,calorias:25,  micro1:{nombre:'Vitamina C',valor:171,unidad:'mg'},   micro2:{nombre:'Vitamina A',valor:157,unidad:'µg'} },
  { id:'ve06', nombre:'Lechuga romana',                 categoria:'verduras', porcion_ref:60,  proteinas:0.9, carbos:1.9, grasas:0.2, fibra:1.3,calorias:8,   micro1:{nombre:'Vitamina K',valor:48,unidad:'µg'},    micro2:{nombre:'Folato',valor:64,unidad:'µg'} },
  { id:'ve07', nombre:'Cebolla',                        categoria:'verduras', porcion_ref:80,  proteinas:0.9, carbos:8,   grasas:0.1, fibra:1.5,calorias:36,  micro1:{nombre:'Quercetina',valor:19,unidad:'mg'},    micro2:{nombre:'Vitamina C',valor:7,unidad:'mg'} },
  { id:'ve08', nombre:'Zapallo (cocido)',               categoria:'verduras', porcion_ref:100, proteinas:0.7, carbos:6,   grasas:0.1, fibra:0.5,calorias:26,  micro1:{nombre:'Vitamina A',valor:426,unidad:'µg'},   micro2:{nombre:'Potasio',valor:230,unidad:'mg'} },
  { id:'ve09', nombre:'Zucchini / Zapallito',          categoria:'verduras', porcion_ref:100, proteinas:1.2, carbos:3.1, grasas:0.3, fibra:1,  calorias:17,  micro1:{nombre:'Vitamina C',valor:18,unidad:'mg'},    micro2:{nombre:'Potasio',valor:262,unidad:'mg'} },
  { id:'ve10', nombre:'Apio',                           categoria:'verduras', porcion_ref:80,  proteinas:0.7, carbos:2.4, grasas:0.2, fibra:1.6,calorias:13,  micro1:{nombre:'Vitamina K',valor:29,unidad:'µg'},    micro2:{nombre:'Potasio',valor:208,unidad:'mg'} },
  { id:'ve11', nombre:'Pepino',                         categoria:'verduras', porcion_ref:100, proteinas:0.7, carbos:3.6, grasas:0.1, fibra:0.5,calorias:16,  micro1:{nombre:'Vitamina K',valor:16,unidad:'µg'},    micro2:{nombre:'Vitamina C',valor:2.8,unidad:'mg'} },
  { id:'ve12', nombre:'Remolacha (cocida)',             categoria:'verduras', porcion_ref:80,  proteinas:1.7, carbos:10,  grasas:0.2, fibra:2,  calorias:44,  micro1:{nombre:'Folato',valor:80,unidad:'µg'},        micro2:{nombre:'Potasio',valor:305,unidad:'mg'} },
  { id:'ve13', nombre:'Coliflor',                       categoria:'verduras', porcion_ref:100, proteinas:1.9, carbos:5,   grasas:0.3, fibra:2,  calorias:25,  micro1:{nombre:'Vitamina C',valor:48,unidad:'mg'},    micro2:{nombre:'Vitamina K',valor:16,unidad:'µg'} },
  { id:'ve14', nombre:'Chauchas / Judías verdes',       categoria:'verduras', porcion_ref:100, proteinas:1.8, carbos:7,   grasas:0.1, fibra:3.4,calorias:31,  micro1:{nombre:'Vitamina K',valor:14,unidad:'µg'},    micro2:{nombre:'Vitamina C',valor:12,unidad:'mg'} },

  // ── GRASAS SALUDABLES ────────────────────────────────────────────────────
  { id:'gs01', nombre:'Palta / Aguacate',               categoria:'grasas', porcion_ref:80,  proteinas:1.6, carbos:3,   grasas:11,  fibra:5.3,calorias:117, micro1:{nombre:'Vitamina E',valor:2.1,unidad:'mg'},   micro2:{nombre:'Potasio',valor:485,unidad:'mg'} },
  { id:'gs02', nombre:'Aceite de oliva extra virgen',   categoria:'grasas', porcion_ref:10,  proteinas:0,   carbos:0,   grasas:10,  fibra:0,  calorias:90,  micro1:{nombre:'Vitamina E',valor:1.9,unidad:'mg'},   micro2:{nombre:'Polifenoles',valor:36,unidad:'mg'} },
  { id:'gs03', nombre:'Aceite de girasol',              categoria:'grasas', porcion_ref:10,  proteinas:0,   carbos:0,   grasas:10,  fibra:0,  calorias:90,  micro1:{nombre:'Vitamina E',valor:5.6,unidad:'mg'},   micro2:{nombre:'Omega-6',valor:6.5,unidad:'g'} },
  { id:'gs04', nombre:'Nueces',                         categoria:'grasas', porcion_ref:30,  proteinas:4.5, carbos:3.9, grasas:18,  fibra:1.9,calorias:196, micro1:{nombre:'Omega-3 (ALA)',valor:2.5,unidad:'g'},  micro2:{nombre:'Vitamina E',valor:0.7,unidad:'mg'} },
  { id:'gs05', nombre:'Almendras',                      categoria:'grasas', porcion_ref:30,  proteinas:6,   carbos:6.1, grasas:14,  fibra:3.5,calorias:174, micro1:{nombre:'Vitamina E',valor:7.7,unidad:'mg'},   micro2:{nombre:'Magnesio',valor:77,unidad:'mg'} },
  { id:'gs06', nombre:'Maní / Cacahuetes',              categoria:'grasas', porcion_ref:30,  proteinas:7,   carbos:5,   grasas:14,  fibra:2.3,calorias:171, micro1:{nombre:'Niacina',valor:4,unidad:'mg'},         micro2:{nombre:'Vitamina E',valor:2.9,unidad:'mg'} },
  { id:'gs07', nombre:'Semillas de chía',               categoria:'grasas', porcion_ref:20,  proteinas:3.4, carbos:8.5, grasas:5.9, fibra:7.7,calorias:97,  micro1:{nombre:'Omega-3 (ALA)',valor:3.6,unidad:'g'},  micro2:{nombre:'Calcio',valor:126,unidad:'mg'} },
  { id:'gs08', nombre:'Semillas de lino',               categoria:'grasas', porcion_ref:15,  proteinas:2.7, carbos:4,   grasas:6,   fibra:3.8,calorias:81,  micro1:{nombre:'Omega-3 (ALA)',valor:3.2,unidad:'g'},  micro2:{nombre:'Manganeso',valor:0.5,unidad:'mg'} },
  { id:'gs09', nombre:'Mantequilla de maní (natural)',  categoria:'grasas', porcion_ref:30,  proteinas:7,   carbos:6,   grasas:16,  fibra:1.5,calorias:188, micro1:{nombre:'Vitamina E',valor:3,unidad:'mg'},     micro2:{nombre:'Magnesio',valor:50,unidad:'mg'} },
  { id:'gs10', nombre:'Coco rallado (sin azúcar)',      categoria:'grasas', porcion_ref:30,  proteinas:1.8, carbos:4.5, grasas:9.4, fibra:4.6,calorias:99,  micro1:{nombre:'Manganeso',valor:0.6,unidad:'mg'},    micro2:{nombre:'Cobre',valor:0.1,unidad:'mg'} },

  // ── BEBIDAS ──────────────────────────────────────────────────────────────
  { id:'be01', nombre:'Agua',                           categoria:'bebidas', porcion_ref:250, proteinas:0, carbos:0,  grasas:0, fibra:0, calorias:0,  micro1:{nombre:'—',valor:0,unidad:''}, micro2:{nombre:'—',valor:0,unidad:''} },
  { id:'be02', nombre:'Leche vegetal de avena',         categoria:'bebidas', porcion_ref:250, proteinas:2, carbos:18, grasas:3, fibra:1, calorias:106, micro1:{nombre:'Calcio (fort.)',valor:240,unidad:'mg'}, micro2:{nombre:'Vitamina D (fort.)',valor:2.5,unidad:'µg'} },
  { id:'be03', nombre:'Jugo de naranja natural',        categoria:'bebidas', porcion_ref:200, proteinas:1.5,carbos:21, grasas:0.2,fibra:0.5,calorias:88, micro1:{nombre:'Vitamina C',valor:93,unidad:'mg'},    micro2:{nombre:'Folato',valor:50,unidad:'µg'} },
  { id:'be04', nombre:'Mate cocido (infusión)',         categoria:'bebidas', porcion_ref:200, proteinas:0, carbos:0,  grasas:0, fibra:0, calorias:0,  micro1:{nombre:'Antioxidantes',valor:1,unidad:'(alto)'},micro2:{nombre:'Xantinas',valor:30,unidad:'mg'} },
  { id:'be05', nombre:'Té verde',                       categoria:'bebidas', porcion_ref:200, proteinas:0, carbos:0,  grasas:0, fibra:0, calorias:0,  micro1:{nombre:'EGCG',valor:50,unidad:'mg'},          micro2:{nombre:'Cafeína',valor:30,unidad:'mg'} },

  // ── SNACKS / COLACIONES ──────────────────────────────────────────────────
  { id:'sn01', nombre:'Granola sin azúcar',             categoria:'snacks', porcion_ref:40,  proteinas:5,   carbos:25,  grasas:7,   fibra:3.5,calorias:181, micro1:{nombre:'Hierro',valor:2,unidad:'mg'},         micro2:{nombre:'Magnesio',valor:45,unidad:'mg'} },
  { id:'sn02', nombre:'Barrita de proteína (promedio)', categoria:'snacks', porcion_ref:55,  proteinas:20,  carbos:20,  grasas:5,   fibra:2,  calorias:209, micro1:{nombre:'Calcio',valor:150,unidad:'mg'},       micro2:{nombre:'BCAA',valor:4,unidad:'g'} },
  { id:'sn03', nombre:'Arroz inflado',                  categoria:'snacks', porcion_ref:30,  proteinas:2,   carbos:24,  grasas:0.3, fibra:0.3,calorias:108, micro1:{nombre:'Tiamina',valor:0.1,unidad:'mg'},      micro2:{nombre:'Hierro',valor:0.5,unidad:'mg'} },
  { id:'sn04', nombre:'Hummus',                         categoria:'snacks', porcion_ref:50,  proteinas:3.7, carbos:8,   grasas:5.5, fibra:2,  calorias:95,  micro1:{nombre:'Hierro',valor:1.5,unidad:'mg'},       micro2:{nombre:'Folato',valor:57,unidad:'µg'} },
  { id:'sn05', nombre:'Cacao en polvo sin azúcar',      categoria:'snacks', porcion_ref:10,  proteinas:2,   carbos:3.5, grasas:1.5, fibra:2.7,calorias:24,  micro1:{nombre:'Magnesio',valor:53,unidad:'mg'},      micro2:{nombre:'Hierro',valor:1.7,unidad:'mg'} },
  { id:'sn06', nombre:'Chocolate negro 70%',            categoria:'snacks', porcion_ref:20,  proteinas:2,   carbos:10,  grasas:8,   fibra:2,  calorias:112, micro1:{nombre:'Magnesio',valor:50,unidad:'mg'},      micro2:{nombre:'Hierro',valor:2.3,unidad:'mg'} },
  { id:'sn07', nombre:'Tortitas de maíz',               categoria:'snacks', porcion_ref:30,  proteinas:1.5, carbos:24,  grasas:0.5, fibra:0.5,calorias:107, micro1:{nombre:'Hierro',valor:0.3,unidad:'mg'},       micro2:{nombre:'Sodio',valor:95,unidad:'mg'} },
  // ── CAFÉ ─────────────────────────────────────────────────────────────────
  { id:'be06', nombre:'Café espresso / negro',        categoria:'bebidas', porcion_ref:60,  proteinas:0.3, carbos:0.5, grasas:0.1, fibra:0, calorias:6,   micro1:{nombre:'Cafeína',valor:60,unidad:'mg'},        micro2:{nombre:'Antioxidantes',valor:1,unidad:'(alto)'} },
  { id:'be07', nombre:'Café con leche (50/50)',        categoria:'bebidas', porcion_ref:200, proteinas:4,   carbos:7,   grasas:4,   fibra:0, calorias:78,  micro1:{nombre:'Calcio',valor:140,unidad:'mg'},        micro2:{nombre:'Cafeína',valor:40,unidad:'mg'} },
  { id:'be08', nombre:'Café instantáneo (solo)',       categoria:'bebidas', porcion_ref:200, proteinas:0.4, carbos:0.8, grasas:0,   fibra:0, calorias:8,   micro1:{nombre:'Cafeína',valor:55,unidad:'mg'},        micro2:{nombre:'Magnesio',valor:6,unidad:'mg'} },

  // ── MILANESAS ────────────────────────────────────────────────────────────
  { id:'pa13', nombre:'Milanesa de carne (peceto)',    categoria:'proteina_animal', porcion_ref:130, tiene_unidad:true, nombre_unidad:'milanesa mediana', gramos_por_unidad:130, proteinas:27, carbos:12, grasas:12, fibra:0.5,calorias:264, micro1:{nombre:'Hierro',valor:3,unidad:'mg'},         micro2:{nombre:'Zinc',valor:4,unidad:'mg'} },
  { id:'pa14', nombre:'Milanesa de pollo (pechuga)',   categoria:'proteina_animal', porcion_ref:130, tiene_unidad:true, nombre_unidad:'milanesa mediana', gramos_por_unidad:130, proteinas:28, carbos:11, grasas:8,  fibra:0.5,calorias:232, micro1:{nombre:'Niacina',valor:10,unidad:'mg'},        micro2:{nombre:'Selenio',valor:22,unidad:'µg'} },
  { id:'pa15', nombre:'Milanesa de cerdo',             categoria:'proteina_animal', porcion_ref:130, tiene_unidad:true, nombre_unidad:'milanesa mediana', gramos_por_unidad:130, proteinas:26, carbos:11, grasas:14, fibra:0.5,calorias:274, micro1:{nombre:'Tiamina (B1)',valor:0.6,unidad:'mg'},  micro2:{nombre:'Zinc',valor:3,unidad:'mg'} },
  { id:'pa16', nombre:'Milanesa de soja',              categoria:'proteina_vegetal', porcion_ref:100, proteinas:14, carbos:20, grasas:5,  fibra:4,  calorias:181, micro1:{nombre:'Hierro',valor:4,unidad:'mg'},         micro2:{nombre:'Calcio',valor:120,unidad:'mg'} },

  // ── QUESOS URUGUAYOS ─────────────────────────────────────────────────────
  { id:'lc09', nombre:'Queso Dambo',                   categoria:'lacteos', porcion_ref:40,  proteinas:10,  carbos:0.5, grasas:11,  fibra:0, calorias:141, micro1:{nombre:'Calcio',valor:310,unidad:'mg'},       micro2:{nombre:'Vitamina A',valor:90,unidad:'µg'} },
  { id:'lc10', nombre:'Queso Colonia',                 categoria:'lacteos', porcion_ref:40,  proteinas:9,   carbos:0.5, grasas:12,  fibra:0, calorias:144, micro1:{nombre:'Calcio',valor:290,unidad:'mg'},       micro2:{nombre:'Vitamina B12',valor:0.6,unidad:'µg'} },
  { id:'lc11', nombre:'Queso Cheddar',                 categoria:'lacteos', porcion_ref:30,  proteinas:7.5, carbos:0.4, grasas:10,  fibra:0, calorias:120, micro1:{nombre:'Calcio',valor:200,unidad:'mg'},       micro2:{nombre:'Vitamina A',valor:87,unidad:'µg'} },
  { id:'lc12', nombre:'Queso Parmesano rallado',       categoria:'lacteos', porcion_ref:20,  proteinas:7,   carbos:0.3, grasas:5.5, fibra:0, calorias:79,  micro1:{nombre:'Calcio',valor:220,unidad:'mg'},       micro2:{nombre:'Fósforo',valor:170,unidad:'mg'} },
  { id:'lc13', nombre:'Ricota',                        categoria:'lacteos', porcion_ref:100, proteinas:11,  carbos:3,   grasas:8,   fibra:0, calorias:130, micro1:{nombre:'Calcio',valor:207,unidad:'mg'},       micro2:{nombre:'Vitamina A',valor:60,unidad:'µg'} },

  // ── MERMELADAS / DULCES ──────────────────────────────────────────────────
  { id:'sn08', nombre:'Mermelada común (frutilla)',    categoria:'snacks', porcion_ref:20,  proteinas:0.1, carbos:14,  grasas:0,   fibra:0.3,calorias:56,  micro1:{nombre:'Vitamina C',valor:3,unidad:'mg'},     micro2:{nombre:'Azúcar añadida',valor:13,unidad:'g'} },
  { id:'sn09', nombre:'Mermelada diet (stevia)',       categoria:'snacks', porcion_ref:20,  proteinas:0.1, carbos:4,   grasas:0,   fibra:0.5,calorias:16,  micro1:{nombre:'Vitamina C',valor:2,unidad:'mg'},     micro2:{nombre:'Fibra pectina',valor:0.5,unidad:'g'} },
  { id:'sn10', nombre:'Dulce de leche (clásico)',      categoria:'snacks', porcion_ref:25,  proteinas:2,   carbos:18,  grasas:2.5, fibra:0, calorias:101, micro1:{nombre:'Calcio',valor:75,unidad:'mg'},        micro2:{nombre:'Vitamina B2',valor:0.1,unidad:'mg'} },
  { id:'sn11', nombre:'Dulce de leche light',          categoria:'snacks', porcion_ref:25,  proteinas:2.5, carbos:12,  grasas:1,   fibra:0, calorias:66,  micro1:{nombre:'Calcio',valor:85,unidad:'mg'},        micro2:{nombre:'Proteína',valor:2.5,unidad:'g'} },
  { id:'sn12', nombre:'Miel',                          categoria:'snacks', porcion_ref:20,  proteinas:0.1, carbos:17,  grasas:0,   fibra:0, calorias:64,  micro1:{nombre:'Antioxidantes',valor:1,unidad:'(sí)'},micro2:{nombre:'Potasio',valor:11,unidad:'mg'} },

  // ── GELATINA ─────────────────────────────────────────────────────────────
  { id:'sn13', nombre:'Gelatina diet (preparada)',     categoria:'snacks', porcion_ref:120, proteinas:2,   carbos:0.4, grasas:0,   fibra:0, calorias:10,  micro1:{nombre:'Colágeno hidrolizado',valor:2,unidad:'g'},micro2:{nombre:'Sodio',valor:50,unidad:'mg'} },
  { id:'sn14', nombre:'Gelatina común (preparada)',    categoria:'snacks', porcion_ref:120, proteinas:2,   carbos:16,  grasas:0,   fibra:0, calorias:72,  micro1:{nombre:'Colágeno hidrolizado',valor:2,unidad:'g'},micro2:{nombre:'Azúcar',valor:16,unidad:'g'} },

  // ── BARRAS Y CHOCOLATES ──────────────────────────────────────────────────
  { id:'sn15', nombre:'Barra de chocolate con leche',  categoria:'snacks', porcion_ref:40,  proteinas:3,   carbos:24,  grasas:12,  fibra:0.7,calorias:214, micro1:{nombre:'Calcio',valor:80,unidad:'mg'},        micro2:{nombre:'Magnesio',valor:18,unidad:'mg'} },
  { id:'sn16', nombre:'Barra de cereal (avena y miel)',categoria:'snacks', porcion_ref:30,  proteinas:2.5, carbos:20,  grasas:3,   fibra:1.5,calorias:115, micro1:{nombre:'Hierro',valor:1,unidad:'mg'},         micro2:{nombre:'Vitamina B1',valor:0.1,unidad:'mg'} },
  { id:'sn17', nombre:'Oblea de chocolate',            categoria:'snacks', porcion_ref:25,  proteinas:1.5, carbos:16,  grasas:7,   fibra:0.4,calorias:132, micro1:{nombre:'Calcio',valor:30,unidad:'mg'},        micro2:{nombre:'Magnesio',valor:8,unidad:'mg'} },

  // ── FIAMBRES / EMBUTIDOS ─────────────────────────────────────────────────
  { id:'fi01', nombre:'Jamón cocido',                  categoria:'fiambres', porcion_ref:50,  proteinas:9,  carbos:0.5, grasas:4,   fibra:0, calorias:74,  micro1:{nombre:'Vitamina B1',valor:0.3,unidad:'mg'},  micro2:{nombre:'Sodio',valor:560,unidad:'mg'} },
  { id:'fi02', nombre:'Salame',                        categoria:'fiambres', porcion_ref:30,  proteinas:7,  carbos:0.5, grasas:11,  fibra:0, calorias:126, micro1:{nombre:'Hierro',valor:0.9,unidad:'mg'},       micro2:{nombre:'Sodio',valor:480,unidad:'mg'} },
  { id:'fi03', nombre:'Mortadela',                     categoria:'fiambres', porcion_ref:40,  proteinas:6,  carbos:2,   grasas:10,  fibra:0, calorias:121, micro1:{nombre:'Hierro',valor:0.7,unidad:'mg'},       micro2:{nombre:'Sodio',valor:520,unidad:'mg'} },
  { id:'fi04', nombre:'Paleta cocida',                 categoria:'fiambres', porcion_ref:50,  proteinas:9,  carbos:1,   grasas:6,   fibra:0, calorias:93,  micro1:{nombre:'Vitamina B12',valor:0.4,unidad:'µg'}, micro2:{nombre:'Zinc',valor:1.2,unidad:'mg'} },
  { id:'fi05', nombre:'Salchicha tipo Viena',          categoria:'fiambres', porcion_ref:40, tiene_unidad:true, nombre_unidad:'salchicha', gramos_por_unidad:40,  proteinas:5,  carbos:2,   grasas:9,   fibra:0, calorias:109, micro1:{nombre:'Sodio',valor:480,unidad:'mg'},        micro2:{nombre:'Hierro',valor:0.6,unidad:'mg'} },
  { id:'fi06', nombre:'Panceta ahumada',               categoria:'fiambres', porcion_ref:30,  proteinas:5,  carbos:0,   grasas:14,  fibra:0, calorias:143, micro1:{nombre:'Vitamina B1',valor:0.2,unidad:'mg'},  micro2:{nombre:'Sodio',valor:400,unidad:'mg'} },

  // ── PANIFICADOS / HARINAS ────────────────────────────────────────────────
  { id:'pan01', nombre:'Harina de avena',              categoria:'panificados', porcion_ref:40,  proteinas:5,  carbos:26,  grasas:2.5, fibra:3.5,calorias:147, micro1:{nombre:'Magnesio',valor:35,unidad:'mg'},      micro2:{nombre:'Hierro',valor:2,unidad:'mg'} },
  { id:'pan02', nombre:'Harina integral de trigo',     categoria:'panificados', porcion_ref:40,  proteinas:5.5,carbos:27,  grasas:1,   fibra:4,  calorias:139, micro1:{nombre:'Hierro',valor:2.5,unidad:'mg'},       micro2:{nombre:'Zinc',valor:1.4,unidad:'mg'} },
  { id:'pan03', nombre:'Medialunas (2 unidades)',       categoria:'panificados', porcion_ref:80,  proteinas:5,  carbos:38,  grasas:12,  fibra:1,  calorias:280, micro1:{nombre:'Hierro',valor:1.5,unidad:'mg'},       micro2:{nombre:'Calcio',valor:35,unidad:'mg'} },
  { id:'pan04', nombre:'Facturas / Bizcocho',          categoria:'panificados', porcion_ref:70,  proteinas:4,  carbos:33,  grasas:10,  fibra:0.8,calorias:238, micro1:{nombre:'Hierro',valor:1.2,unidad:'mg'},       micro2:{nombre:'Calcio',valor:28,unidad:'mg'} },
  { id:'pan05', nombre:'Pan de molde blanco (1 rebanada)',categoria:'panificados', porcion_ref:25, proteinas:2, carbos:12,  grasas:0.6, fibra:0.5,calorias:62,  micro1:{nombre:'Hierro',valor:0.7,unidad:'mg'},       micro2:{nombre:'Calcio',valor:18,unidad:'mg'} },
  { id:'pan06', nombre:'Bizcochos salados (4 unidades)',categoria:'panificados', porcion_ref:40,  proteinas:3,  carbos:20,  grasas:7,   fibra:0.5,calorias:155, micro1:{nombre:'Sodio',valor:280,unidad:'mg'},        micro2:{nombre:'Hierro',valor:0.8,unidad:'mg'} },

  // ── CONDIMENTOS / EXTRAS ─────────────────────────────────────────────────
  { id:'co01', nombre:'Azúcar blanca',                 categoria:'condimentos', porcion_ref:10, proteinas:0, carbos:10, grasas:0, fibra:0, calorias:40,  micro1:{nombre:'—',valor:0,unidad:''}, micro2:{nombre:'—',valor:0,unidad:''} },
  { id:'co02', nombre:'Edulcorante (stevia)',           categoria:'condimentos', porcion_ref:2,  proteinas:0, carbos:0,  grasas:0, fibra:0, calorias:0,   micro1:{nombre:'Esteviósidos',valor:1,unidad:'g'},  micro2:{nombre:'—',valor:0,unidad:''} },
  { id:'co03', nombre:'Sal común',                     categoria:'condimentos', porcion_ref:5,  proteinas:0, carbos:0,  grasas:0, fibra:0, calorias:0,   micro1:{nombre:'Sodio',valor:2000,unidad:'mg'},     micro2:{nombre:'Cloro',valor:3000,unidad:'mg'} },
  { id:'co04', nombre:'Mayonesa',                      categoria:'condimentos', porcion_ref:20, proteinas:0.3,carbos:0.5,grasas:15,fibra:0, calorias:134, micro1:{nombre:'Vitamina E',valor:1.5,unidad:'mg'}, micro2:{nombre:'Vitamina K',valor:17,unidad:'µg'} },
  { id:'co05', nombre:'Ketchup',                       categoria:'condimentos', porcion_ref:20, proteinas:0.4,carbos:5, grasas:0.1,fibra:0.2,calorias:22, micro1:{nombre:'Licopeno',valor:4700,unidad:'µg'},  micro2:{nombre:'Vitamina A',valor:21,unidad:'µg'} },
  { id:'co06', nombre:'Mostaza',                       categoria:'condimentos', porcion_ref:15, proteinas:0.9,carbos:1.5,grasas:1.8,fibra:0.4,calorias:26, micro1:{nombre:'Selenio',valor:1.3,unidad:'µg'},   micro2:{nombre:'Sodio',valor:190,unidad:'mg'} },

  // ── MÁS FRUTAS Y VERDURAS ────────────────────────────────────────────────
  { id:'fr13', nombre:'Sandía',                        categoria:'frutas', porcion_ref:200, proteinas:1.2, carbos:15,  grasas:0.2, fibra:0.6,calorias:60,  micro1:{nombre:'Licopeno',valor:9200,unidad:'µg'},    micro2:{nombre:'Vitamina C',valor:18,unidad:'mg'} },
  { id:'fr14', nombre:'Melón',                         categoria:'frutas', porcion_ref:200, proteinas:1.4, carbos:16,  grasas:0.2, fibra:0.8,calorias:68,  micro1:{nombre:'Vitamina A',valor:169,unidad:'µg'},   micro2:{nombre:'Vitamina C',valor:36,unidad:'mg'} },
  { id:'fr15', nombre:'Ciruela',                       categoria:'frutas', porcion_ref:80,  proteinas:0.5, carbos:9,   grasas:0.1, fibra:1.4,calorias:38,  micro1:{nombre:'Vitamina K',valor:4.2,unidad:'µg'},   micro2:{nombre:'Sorbitol',valor:1.7,unidad:'g'} },
  { id:'ve15', nombre:'Espárrago',                     categoria:'verduras', porcion_ref:100, proteinas:2.2, carbos:3.9, grasas:0.1, fibra:2.1,calorias:20,  micro1:{nombre:'Folato',valor:52,unidad:'µg'},        micro2:{nombre:'Vitamina K',valor:42,unidad:'µg'} },
  { id:'ve16', nombre:'Berenjena',                     categoria:'verduras', porcion_ref:100, proteinas:1,   carbos:6,   grasas:0.2, fibra:3,  calorias:25,  micro1:{nombre:'Nasunina',valor:750,unidad:'µg'},     micro2:{nombre:'Manganeso',valor:0.2,unidad:'mg'} },
  { id:'ve17', nombre:'Acelga',                        categoria:'verduras', porcion_ref:100, proteinas:1.8, carbos:3.7, grasas:0.2, fibra:1.6,calorias:19,  micro1:{nombre:'Vitamina K',valor:830,unidad:'µg'},   micro2:{nombre:'Vitamina A',valor:306,unidad:'µg'} },
  { id:'ve18', nombre:'Choclo (chipa / humita)',       categoria:'verduras', porcion_ref:100, proteinas:3,   carbos:19,  grasas:1.5, fibra:2.7,calorias:96,  micro1:{nombre:'Luteína',valor:820,unidad:'µg'},      micro2:{nombre:'Vitamina B1',valor:0.2,unidad:'mg'} },
  { id:'ve19', nombre:'Arvejas (cocidas)',              categoria:'verduras', porcion_ref:100, proteinas:5,   carbos:14,  grasas:0.4, fibra:5.1,calorias:81,  micro1:{nombre:'Vitamina K',valor:24,unidad:'µg'},    micro2:{nombre:'Manganeso',valor:0.4,unidad:'mg'} },
  { id:'ve20', nombre:'Puerro',                        categoria:'verduras', porcion_ref:80,  proteinas:1.1, carbos:7.5, grasas:0.2, fibra:1.5,calorias:35,  micro1:{nombre:'Vitamina K',valor:38,unidad:'µg'},    micro2:{nombre:'Folato',valor:30,unidad:'µg'} },

  // ── MÁS PROTEÍNAS ────────────────────────────────────────────────────────
  { id:'pa17', nombre:'Asado de tira',                 categoria:'proteina_animal', porcion_ref:150, proteinas:30, carbos:0,  grasas:22, fibra:0, calorias:322, micro1:{nombre:'Hierro',valor:2.8,unidad:'mg'},       micro2:{nombre:'Zinc',valor:5,unidad:'mg'} },
  { id:'pa18', nombre:'Bife de chorizo',               categoria:'proteina_animal', porcion_ref:180, proteinas:36, carbos:0,  grasas:18, fibra:0, calorias:308, micro1:{nombre:'Hierro',valor:3.2,unidad:'mg'},       micro2:{nombre:'Zinc',valor:5.5,unidad:'mg'} },
  { id:'pa19', nombre:'Molleja vacuna',                categoria:'proteina_animal', porcion_ref:100, proteinas:17, carbos:0,  grasas:22, fibra:0, calorias:270, micro1:{nombre:'Vitamina B12',valor:1.5,unidad:'µg'}, micro2:{nombre:'Zinc',valor:2,unidad:'mg'} },
  { id:'pa20', nombre:'Chorizo parrillero',            categoria:'proteina_animal', porcion_ref:90,  proteinas:15, carbos:2,  grasas:22, fibra:0, calorias:269, micro1:{nombre:'Hierro',valor:1.5,unidad:'mg'},       micro2:{nombre:'Sodio',valor:650,unidad:'mg'} },
  { id:'pv08', nombre:'Tempeh',                        categoria:'proteina_vegetal', porcion_ref:100, proteinas:19, carbos:9,  grasas:11, fibra:4, calorias:193, micro1:{nombre:'Calcio',valor:111,unidad:'mg'},       micro2:{nombre:'Manganeso',valor:1.3,unidad:'mg'} },

  // ── MÁS CARBOHIDRATOS ────────────────────────────────────────────────────
  { id:'ch15', nombre:'Ñoquis (cocidos)',               categoria:'carbohidratos', porcion_ref:200, proteinas:6,  carbos:40,  grasas:3,   fibra:2,  calorias:211, micro1:{nombre:'Vitamina B6',valor:0.3,unidad:'mg'},  micro2:{nombre:'Potasio',valor:350,unidad:'mg'} },
  { id:'ch16', nombre:'Risotto / Arroz con leche',     categoria:'carbohidratos', porcion_ref:200, proteinas:5,  carbos:34,  grasas:3,   fibra:0.5,calorias:183, micro1:{nombre:'Calcio',valor:90,unidad:'mg'},        micro2:{nombre:'Vitamina B2',valor:0.2,unidad:'mg'} },
  { id:'ch17', nombre:'Burrito / Tortilla de trigo',   categoria:'carbohidratos', porcion_ref:50,  proteinas:3.5,carbos:24,  grasas:3,   fibra:1.5,calorias:135, micro1:{nombre:'Hierro',valor:1.5,unidad:'mg'},       micro2:{nombre:'Calcio',valor:65,unidad:'mg'} },
  { id:'ch18', nombre:'Cous cous (cocido)',             categoria:'carbohidratos', porcion_ref:150, proteinas:5,  carbos:30,  grasas:0.3, fibra:1.8,calorias:143, micro1:{nombre:'Selenio',valor:20,unidad:'µg'},       micro2:{nombre:'Manganeso',valor:0.5,unidad:'mg'} },

  // ── HUEVOS — FORMAS DE COCCIÓN ────────────────────────────────────────────
  { id:'hv03', nombre:'Huevo duro (cocido)',            categoria:'huevos', porcion_ref:60,  proteinas:7.5, carbos:0.6, grasas:5.3, fibra:0, calorias:78,  tiene_unidad:true, nombre_unidad:'huevo', gramos_por_unidad:60,  micro1:{nombre:'Colina',valor:147,unidad:'mg'},       micro2:{nombre:'Vitamina D',valor:2.0,unidad:'µg'} },
  { id:'hv04', nombre:'Huevo revuelto (sin aceite)',    categoria:'huevos', porcion_ref:60,  proteinas:7.3, carbos:0.7, grasas:5.5, fibra:0, calorias:80,  tiene_unidad:true, nombre_unidad:'huevo', gramos_por_unidad:60,  micro1:{nombre:'Colina',valor:140,unidad:'mg'},       micro2:{nombre:'Selenio',valor:15,unidad:'µg'} },
  { id:'hv05', nombre:'Huevo revuelto (con leche y manteca)', categoria:'huevos', porcion_ref:80, proteinas:8, carbos:1.5, grasas:9, fibra:0, calorias:119, tiene_unidad:true, nombre_unidad:'huevo preparado', gramos_por_unidad:80, micro1:{nombre:'Colina',valor:150,unidad:'mg'}, micro2:{nombre:'Calcio',valor:50,unidad:'mg'} },
  { id:'hv06', nombre:'Huevo frito (aceite de oliva)',  categoria:'huevos', porcion_ref:70,  proteinas:7,   carbos:0.5, grasas:11,  fibra:0, calorias:128, tiene_unidad:true, nombre_unidad:'huevo frito', gramos_por_unidad:70,  micro1:{nombre:'Vitamina D',valor:2,unidad:'µg'},     micro2:{nombre:'Vitamina E',valor:2,unidad:'mg'} },
  { id:'hv07', nombre:'Huevo pochado / escalfado',     categoria:'huevos', porcion_ref:60,  proteinas:7.5, carbos:0.5, grasas:5.2, fibra:0, calorias:76,  tiene_unidad:true, nombre_unidad:'huevo', gramos_por_unidad:60,  micro1:{nombre:'Colina',valor:147,unidad:'mg'},       micro2:{nombre:'Vitamina B12',valor:0.5,unidad:'µg'} },
  { id:'hv08', nombre:'Omelette (2 huevos, sin relleno)',categoria:'huevos', porcion_ref:120, proteinas:14, carbos:1,   grasas:11,  fibra:0, calorias:159, tiene_unidad:true, nombre_unidad:'omelette', gramos_por_unidad:120, micro1:{nombre:'Colina',valor:290,unidad:'mg'},      micro2:{nombre:'Vitamina A',valor:150,unidad:'µg'} },
  { id:'hv09', nombre:'Huevo a la copa (pasado por agua)',categoria:'huevos', porcion_ref:60, proteinas:7, carbos:0.5, grasas:5,   fibra:0, calorias:74,  tiene_unidad:true, nombre_unidad:'huevo', gramos_por_unidad:60,  micro1:{nombre:'Colina',valor:130,unidad:'mg'},       micro2:{nombre:'Vitamina D',valor:1.5,unidad:'µg'} },

  // ── PLATOS CALIENTES / DE OLLA ────────────────────────────────────────────
  { id:'pc01', nombre:'Empanada de carne (al horno)',   categoria:'platos_calientes', porcion_ref:90,  proteinas:10, carbos:22, grasas:12, fibra:1.5,calorias:236, tiene_unidad:true, nombre_unidad:'empanada', gramos_por_unidad:90,  micro1:{nombre:'Hierro',valor:2,unidad:'mg'},         micro2:{nombre:'Zinc',valor:2,unidad:'mg'} },
  { id:'pc02', nombre:'Empanada de jamón y queso',     categoria:'platos_calientes', porcion_ref:80,  proteinas:9,  carbos:22, grasas:11, fibra:1,  calorias:222, tiene_unidad:true, nombre_unidad:'empanada', gramos_por_unidad:80,  micro1:{nombre:'Calcio',valor:90,unidad:'mg'},        micro2:{nombre:'Sodio',valor:380,unidad:'mg'} },
  { id:'pc03', nombre:'Empanada de verdura y queso',   categoria:'platos_calientes', porcion_ref:80,  proteinas:7,  carbos:24, grasas:9,  fibra:2,  calorias:201, tiene_unidad:true, nombre_unidad:'empanada', gramos_por_unidad:80,  micro1:{nombre:'Vitamina A',valor:120,unidad:'µg'},   micro2:{nombre:'Calcio',valor:110,unidad:'mg'} },
  { id:'pc04', nombre:'Empanada de pollo',             categoria:'platos_calientes', porcion_ref:85,  proteinas:11, carbos:22, grasas:10, fibra:1.5,calorias:222, tiene_unidad:true, nombre_unidad:'empanada', gramos_por_unidad:85,  micro1:{nombre:'Niacina',valor:4,unidad:'mg'},        micro2:{nombre:'Hierro',valor:1.5,unidad:'mg'} },
  { id:'pc05', nombre:'Estofado de carne con papas',   categoria:'platos_calientes', porcion_ref:300, proteinas:22, carbos:24, grasas:10, fibra:3,  calorias:274, tiene_unidad:true, nombre_unidad:'porción plato', gramos_por_unidad:300, micro1:{nombre:'Hierro',valor:3,unidad:'mg'},       micro2:{nombre:'Vitamina C',valor:18,unidad:'mg'} },
  { id:'pc06', nombre:'Guiso de lentejas',             categoria:'platos_calientes', porcion_ref:300, proteinas:14, carbos:38, grasas:5,  fibra:10, calorias:253, tiene_unidad:true, nombre_unidad:'plato hondo', gramos_por_unidad:300, micro1:{nombre:'Hierro',valor:4.5,unidad:'mg'},     micro2:{nombre:'Folato',valor:200,unidad:'µg'} },
  { id:'pc07', nombre:'Guiso de porotos',              categoria:'platos_calientes', porcion_ref:300, proteinas:13, carbos:40, grasas:4,  fibra:12, calorias:248, tiene_unidad:true, nombre_unidad:'plato hondo', gramos_por_unidad:300, micro1:{nombre:'Hierro',valor:3.5,unidad:'mg'},     micro2:{nombre:'Potasio',valor:600,unidad:'mg'} },
  { id:'pc08', nombre:'Cazuela de pollo con verduras', categoria:'platos_calientes', porcion_ref:350, proteinas:28, carbos:20, grasas:8,  fibra:3.5,calorias:264, tiene_unidad:true, nombre_unidad:'porción cazuela', gramos_por_unidad:350, micro1:{nombre:'Vitamina A',valor:280,unidad:'µg'}, micro2:{nombre:'Zinc',valor:3,unidad:'mg'} },
  { id:'pc09', nombre:'Sopa de verduras con fideos',   categoria:'platos_calientes', porcion_ref:350, proteinas:7,  carbos:28, grasas:3,  fibra:4,  calorias:167, tiene_unidad:true, nombre_unidad:'plato hondo', gramos_por_unidad:350, micro1:{nombre:'Vitamina A',valor:180,unidad:'µg'}, micro2:{nombre:'Vitamina C',valor:14,unidad:'mg'} },
  { id:'pc10', nombre:'Locro criollo',                 categoria:'platos_calientes', porcion_ref:400, proteinas:20, carbos:42, grasas:12, fibra:8,  calorias:356, tiene_unidad:true, nombre_unidad:'plato hondo', gramos_por_unidad:400, micro1:{nombre:'Hierro',valor:3,unidad:'mg'},       micro2:{nombre:'Zinc',valor:2.5,unidad:'mg'} },
  { id:'pc11', nombre:'Puchero de carne y verduras',   categoria:'platos_calientes', porcion_ref:400, proteinas:28, carbos:26, grasas:10, fibra:5,  calorias:306, tiene_unidad:true, nombre_unidad:'plato hondo', gramos_por_unidad:400, micro1:{nombre:'Hierro',valor:3.5,unidad:'mg'},     micro2:{nombre:'Vitamina C',valor:20,unidad:'mg'} },
  { id:'pc12', nombre:'Fideos con salsa bolognesa',    categoria:'platos_calientes', porcion_ref:320, proteinas:20, carbos:46, grasas:12, fibra:3,  calorias:372, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:320,        micro1:{nombre:'Hierro',valor:2.5,unidad:'mg'},     micro2:{nombre:'Licopeno',valor:4000,unidad:'µg'} },
  { id:'pc13', nombre:'Arroz con pollo',               categoria:'platos_calientes', porcion_ref:320, proteinas:22, carbos:38, grasas:7,  fibra:1.5,calorias:307, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:320,        micro1:{nombre:'Niacina',valor:8,unidad:'mg'},       micro2:{nombre:'Zinc',valor:2.5,unidad:'mg'} },
  { id:'pc14', nombre:'Tarta de verduras (porción)',   categoria:'platos_calientes', porcion_ref:150, proteinas:8,  carbos:24, grasas:12, fibra:2,  calorias:232, tiene_unidad:true, nombre_unidad:'porción', gramos_por_unidad:150,        micro1:{nombre:'Vitamina A',valor:200,unidad:'µg'},  micro2:{nombre:'Calcio',valor:100,unidad:'mg'} },
  { id:'pc15', nombre:'Churrasco a la plancha',        categoria:'platos_calientes', porcion_ref:150, proteinas:32, carbos:0,  grasas:10, fibra:0,  calorias:218, tiene_unidad:true, nombre_unidad:'churrasco', gramos_por_unidad:150,      micro1:{nombre:'Hierro',valor:3,unidad:'mg'},       micro2:{nombre:'Zinc',valor:5,unidad:'mg'} },
  { id:'pc16', nombre:'Polenta con queso y tuco',      categoria:'platos_calientes', porcion_ref:250, proteinas:10, carbos:32, grasas:8,  fibra:1.5,calorias:240, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:250,        micro1:{nombre:'Calcio',valor:140,unidad:'mg'},     micro2:{nombre:'Vitamina A',valor:120,unidad:'µg'} },

  // ── ENSALADAS ─────────────────────────────────────────────────────────────
  { id:'es01', nombre:'Ensalada mixta (lechuga, tomate, cebolla)', categoria:'ensaladas', porcion_ref:200, proteinas:2, carbos:8, grasas:4, fibra:3, calorias:72,  tiene_unidad:true, nombre_unidad:'bowl/ensaladera', gramos_por_unidad:200, micro1:{nombre:'Vitamina C',valor:22,unidad:'mg'}, micro2:{nombre:'Vitamina K',valor:60,unidad:'µg'} },
  { id:'es02', nombre:'Ensalada César (sin pollo)',                categoria:'ensaladas', porcion_ref:200, proteinas:5, carbos:10,grasas:12,fibra:2, calorias:164, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:200,             micro1:{nombre:'Vitamina K',valor:90,unidad:'µg'}, micro2:{nombre:'Calcio',valor:100,unidad:'mg'} },
  { id:'es03', nombre:'Ensalada César con pollo',                  categoria:'ensaladas', porcion_ref:300, proteinas:28,carbos:12,grasas:14,fibra:2, calorias:284, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:300,             micro1:{nombre:'Vitamina K',valor:90,unidad:'µg'}, micro2:{nombre:'Niacina',valor:9,unidad:'mg'} },
  { id:'es04', nombre:'Ensalada de papa',                          categoria:'ensaladas', porcion_ref:200, proteinas:3, carbos:28,grasas:6, fibra:2.5,calorias:175, tiene_unidad:true, nombre_unidad:'porción', gramos_por_unidad:200,           micro1:{nombre:'Vitamina C',valor:16,unidad:'mg'}, micro2:{nombre:'Potasio',valor:500,unidad:'mg'} },
  { id:'es05', nombre:'Ensalada de zanahoria rallada',             categoria:'ensaladas', porcion_ref:150, proteinas:1, carbos:10,grasas:4, fibra:3.5,calorias:76,  tiene_unidad:true, nombre_unidad:'bol', gramos_por_unidad:150,               micro1:{nombre:'Vitamina A',valor:1000,unidad:'µg'},micro2:{nombre:'Vitamina E',valor:2,unidad:'mg'} },
  { id:'es06', nombre:'Ensalada caprese (mozarella + tomate)',     categoria:'ensaladas', porcion_ref:200, proteinas:14,carbos:6, grasas:14,fibra:1.2,calorias:206, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:200,             micro1:{nombre:'Calcio',valor:380,unidad:'mg'},    micro2:{nombre:'Licopeno',valor:3000,unidad:'µg'} },
  { id:'es07', nombre:'Ensalada de quinoa con vegetales',          categoria:'ensaladas', porcion_ref:250, proteinas:8, carbos:32,grasas:5, fibra:5,  calorias:205, tiene_unidad:true, nombre_unidad:'bol', gramos_por_unidad:250,               micro1:{nombre:'Hierro',valor:2.5,unidad:'mg'},    micro2:{nombre:'Magnesio',valor:55,unidad:'mg'} },
  { id:'es08', nombre:'Ensalada rusa',                             categoria:'ensaladas', porcion_ref:200, proteinas:4, carbos:22,grasas:8, fibra:3,  calorias:172, tiene_unidad:true, nombre_unidad:'porción', gramos_por_unidad:200,           micro1:{nombre:'Vitamina C',valor:18,unidad:'mg'}, micro2:{nombre:'Vitamina A',valor:180,unidad:'µg'} },
  { id:'es09', nombre:'Ensalada de remolachas cocidas',            categoria:'ensaladas', porcion_ref:150, proteinas:2, carbos:16,grasas:1, fibra:3.5,calorias:80,  tiene_unidad:true, nombre_unidad:'porción', gramos_por_unidad:150,           micro1:{nombre:'Folato',valor:100,unidad:'µg'},    micro2:{nombre:'Potasio',valor:380,unidad:'mg'} },
  { id:'es10', nombre:'Taboulé (bulgur, perejil, tomate)',         categoria:'ensaladas', porcion_ref:200, proteinas:5, carbos:30,grasas:4, fibra:5,  calorias:176, tiene_unidad:true, nombre_unidad:'bol', gramos_por_unidad:200,               micro1:{nombre:'Vitamina C',valor:15,unidad:'mg'}, micro2:{nombre:'Hierro',valor:2,unidad:'mg'} },
  { id:'es11', nombre:'Ensalada de atún con choclo y arvejas',    categoria:'ensaladas', porcion_ref:250, proteinas:20,carbos:18,grasas:4, fibra:4,  calorias:188, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:250,             micro1:{nombre:'Selenio',valor:60,unidad:'µg'},    micro2:{nombre:'Vitamina B12',valor:1.5,unidad:'µg'} },
  { id:'es12', nombre:'Ensalada tibia de pollo y vegetales asados',categoria:'ensaladas', porcion_ref:300, proteinas:25,carbos:16,grasas:8, fibra:4,  calorias:236, tiene_unidad:true, nombre_unidad:'plato', gramos_por_unidad:300,             micro1:{nombre:'Vitamina C',valor:25,unidad:'mg'}, micro2:{nombre:'Vitamina A',valor:250,unidad:'µg'} },

];

// ─── HELPERS ──────────────────────────────────────────────────────────────
export const getAlimentoById = (id) => DB_ALIMENTOS.find(a => a.id === id) || null;

// Calcular macros para una cantidad dada de un alimento
export const calcularMacros = (alimento, gramos) => {
  const factor = gramos / 100;
  return {
    proteinas: Math.round(alimento.proteinas * factor * 10) / 10,
    carbos:    Math.round(alimento.carbos    * factor * 10) / 10,
    grasas:    Math.round(alimento.grasas    * factor * 10) / 10,
    fibra:     Math.round(alimento.fibra     * factor * 10) / 10,
    calorias:  Math.round(alimento.calorias  * factor),
  };
};

// Sumar macros de un array de {alimentoId, gramos}
export const sumarMacrosDia = (items) => {
  return items.reduce((acc, item) => {
    const al = getAlimentoById(item.alimentoId);
    if (!al) return acc;
    const m = calcularMacros(al, item.gramos || 100);
    return {
      proteinas: Math.round((acc.proteinas + m.proteinas) * 10) / 10,
      carbos:    Math.round((acc.carbos    + m.carbos)    * 10) / 10,
      grasas:    Math.round((acc.grasas    + m.grasas)    * 10) / 10,
      fibra:     Math.round((acc.fibra     + m.fibra)     * 10) / 10,
      calorias:  acc.calorias + m.calorias,
    };
  }, { proteinas:0, carbos:0, grasas:0, fibra:0, calorias:0 });
};

// Mifflin-St Jeor
export const calcularTDEE = (peso, talla, edad, sexo, actividad) => {
  const TMB = sexo === 'M'
    ? 10 * peso + 6.25 * talla - 5 * edad + 5
    : 10 * peso + 6.25 * talla - 5 * edad - 161;
  const factores = { sedentario:1.40, moderado:1.55, activo:1.65, muy_activo:1.75 };
  return Math.round(TMB * (factores[actividad] || 1.55));
};

// Calcular objetivo calórico y macros según objetivo
export const calcularObjetivo = (tdee, objetivo, peso) => {
  const objetivos = {
    mantenimiento:    { kcal: tdee,        label:'Mantenimiento',    color:'#0284C7' },
    hipertrofia:      { kcal: tdee + 300,  label:'Hipertrofia',      color:'#7C3AED' },
    perdida_leve:     { kcal: tdee - 300,  label:'Pérdida leve',     color:'#D97706' },
    perdida_moderada: { kcal: tdee - 500,  label:'Pérdida moderada', color:'#CC0000' },
    recomposicion:    { kcal: tdee - 200,  label:'Recomposición',    color:'#16A34A' },
  };
  const obj = objetivos[objetivo] || objetivos.mantenimiento;
  // Macros según objetivo
  let prot_g, gras_g, carb_g;
  if (objetivo === 'hipertrofia') {
    prot_g = Math.round(peso * 2.2);
    gras_g = Math.round(peso * 0.9);
    carb_g = Math.round((obj.kcal - prot_g*4 - gras_g*9) / 4);
  } else if (objetivo === 'perdida_leve' || objetivo === 'perdida_moderada') {
    prot_g = Math.round(peso * 2.2); // Alto en proteína para preservar músculo
    gras_g = Math.round(peso * 0.8);
    carb_g = Math.round((obj.kcal - prot_g*4 - gras_g*9) / 4);
  } else {
    prot_g = Math.round(peso * 1.8);
    gras_g = Math.round(peso * 0.8);
    carb_g = Math.round((obj.kcal - prot_g*4 - gras_g*9) / 4);
  }
  return { ...obj, prot_g, gras_g: Math.max(gras_g,0), carb_g: Math.max(carb_g,0) };
};

export const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const COMIDAS = [
  { id:'desayuno',    label:'Desayuno',           emoji:'🌅', hora:'07:00–09:00' },
  { id:'colacion_am', label:'Colación mañana',    emoji:'🍎', hora:'10:00–11:00' },
  { id:'almuerzo',    label:'Almuerzo',            emoji:'🍽️', hora:'12:00–14:00' },
  { id:'merienda',   label:'Merienda',            emoji:'☕', hora:'16:00–17:00' },
  { id:'cena',       label:'Cena',                emoji:'🌙', hora:'19:00–21:00' },
];
