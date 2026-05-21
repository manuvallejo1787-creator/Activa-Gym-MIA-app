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
  { id:'lc03', nombre:'Leche entera',                   categoria:'lacteos', porcion_ref:250, proteinas:8,   carbos:12,  grasas:8,   fibra:0, calorias:150, micro1:{nombre:'Calcio',valor:300,unidad:'mg'},       micro2:{nombre:'Vitamina D',valor:2.5,unidad:'µg'} },
  { id:'lc04', nombre:'Leche descremada',               categoria:'lacteos', porcion_ref:250, proteinas:8.5, carbos:12,  grasas:0.5, fibra:0, calorias:86,  micro1:{nombre:'Calcio',valor:300,unidad:'mg'},       micro2:{nombre:'Vitamina B12',valor:1.0,unidad:'µg'} },
  { id:'lc05', nombre:'Queso cottage light',            categoria:'lacteos', porcion_ref:100, proteinas:13,  carbos:3.4, grasas:1.4, fibra:0, calorias:79,  micro1:{nombre:'Calcio',valor:111,unidad:'mg'},       micro2:{nombre:'Sodio',valor:372,unidad:'mg'} },
  { id:'lc06', nombre:'Queso muzarella',                categoria:'lacteos', porcion_ref:40,  proteinas:10,  carbos:1,   grasas:9,   fibra:0, calorias:122, micro1:{nombre:'Calcio',valor:290,unidad:'mg'},       micro2:{nombre:'Vitamina A',valor:68,unidad:'µg'} },
  { id:'lc07', nombre:'Queso magro (port salut light)', categoria:'lacteos', porcion_ref:40,  proteinas:9,   carbos:1,   grasas:5,   fibra:0, calorias:85,  micro1:{nombre:'Calcio',valor:320,unidad:'mg'},       micro2:{nombre:'Fósforo',valor:240,unidad:'mg'} },
  { id:'lc08', nombre:'Queso fresco',                   categoria:'lacteos', porcion_ref:50,  proteinas:6,   carbos:0.5, grasas:7,   fibra:0, calorias:90,  micro1:{nombre:'Calcio',valor:200,unidad:'mg'},       micro2:{nombre:'Riboflavina',valor:0.2,unidad:'mg'} },

  // ── HUEVOS ───────────────────────────────────────────────────────────────
  { id:'hv01', nombre:'Huevo entero',                   categoria:'huevos', porcion_ref:60,  proteinas:7.5, carbos:0.4, grasas:5.5, fibra:0, calorias:83,  micro1:{nombre:'Colina',valor:147,unidad:'mg'},       micro2:{nombre:'Vitamina D',valor:2.0,unidad:'µg'} },
  { id:'hv02', nombre:'Clara de huevo',                 categoria:'huevos', porcion_ref:60,  proteinas:7,   carbos:0.5, grasas:0,   fibra:0, calorias:30,  micro1:{nombre:'Riboflavina',valor:0.2,unidad:'mg'},  micro2:{nombre:'Selenio',valor:7.5,unidad:'µg'} },

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
  { id:'fr01', nombre:'Banana / Plátano',               categoria:'frutas', porcion_ref:120, proteinas:1.3, carbos:27,  grasas:0.3, fibra:3.1,calorias:107, micro1:{nombre:'Potasio',valor:422,unidad:'mg'},      micro2:{nombre:'Vitamina B6',valor:0.4,unidad:'mg'} },
  { id:'fr02', nombre:'Manzana',                        categoria:'frutas', porcion_ref:150, proteinas:0.4, carbos:20,  grasas:0.2, fibra:3.6,calorias:78,  micro1:{nombre:'Quercetina',valor:4.4,unidad:'mg'},   micro2:{nombre:'Vitamina C',valor:8,unidad:'mg'} },
  { id:'fr03', nombre:'Naranja',                        categoria:'frutas', porcion_ref:150, proteinas:1.5, carbos:18,  grasas:0.2, fibra:3.6,calorias:71,  micro1:{nombre:'Vitamina C',valor:82,unidad:'mg'},    micro2:{nombre:'Folato',valor:40,unidad:'µg'} },
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
