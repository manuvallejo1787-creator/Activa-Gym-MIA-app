// DateInput.jsx — Input de fecha en formato dd/mm/aaaa.
//
// POR QUÉ EXISTE: <input type="date"> nativo del navegador muestra el
// formato según el idioma/región configurado en el sistema operativo del
// dispositivo, no algo que la página pueda fijar — un Windows en inglés
// muestra mm/dd/aaaa, uno en español muestra dd/mm/aaaa. Si Manu y
// Santiago tienen configuraciones regionales distintas en sus equipos,
// cada uno ve un formato diferente sin que el código tenga forma de
// evitarlo. Este componente reemplaza eso por un campo de texto propio
// que SIEMPRE se ve y se tipea dd/mm/aaaa, sin importar el dispositivo.
//
// Puertas adentro sigue guardando y devolviendo fecha en formato ISO
// (aaaa-mm-dd) — así no hace falta tocar nada del resto del código que ya
// hace comparaciones/cálculos de fechas asumiendo ese formato.

import { useState, useEffect } from "react";

const isoToDisplay = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
};

const displayToIso = (disp) => {
  const m = disp.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = parseInt(d, 10), mm = parseInt(mo, 10), yyyy = parseInt(y, 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return null;
  // Validar que la fecha exista de verdad (ej: 31/02 no es válido)
  const date = new Date(yyyy, mm - 1, dd);
  if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return `${y}-${mo}-${d}`;
};

export default function DateInput({ value, onChange, style, placeholder = 'dd/mm/aaaa', disabled }) {
  const [texto, setTexto] = useState(() => isoToDisplay(value));

  // Si el valor cambia desde afuera (carga de datos, otro campo que lo setea, etc.)
  useEffect(() => { setTexto(isoToDisplay(value)); }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 4) formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    else if (raw.length > 2) formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    setTexto(formatted);
    if (formatted === '') { onChange(''); return; }
    const iso = displayToIso(formatted);
    if (iso) onChange(iso); // solo propaga cuando la fecha está completa y es válida
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={texto}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={10}
      disabled={disabled}
      style={style}
    />
  );
}
