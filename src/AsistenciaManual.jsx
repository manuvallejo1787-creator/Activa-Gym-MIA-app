import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";

// ═══════════════════════════════════════════════════════════════════════════
// AsistenciaManual — tarjeta de Sala para los clientes SIN usuario en el portal
//
// A los que tienen usuario no se los marca: su asistencia sale sola de lo que
// cargan en el portal. Esta tarjeta es solo para los que todavía no tienen
// rutina cargada; la lista la arma Gestión (grupo "manual") y llega acá sola
// cada hora. Cuando a alguien se le crea el usuario, desaparece de esta lista.
//
// Un toque = presente hoy, con la hora del momento. Se puede marcar hasta 7
// días atrás (sin hora: la hora de un día pasado sería inventada).
// ═══════════════════════════════════════════════════════════════════════════

const WH = '#fff', BK = '#141414', G2 = '#2a2a2a', G4 = '#8a8a8a', VERDE = '#16A34A', ROJO = '#DC2626';

const isoLocal = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};
const horaLocal = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const sinTildes = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function AsistenciaManual() {
  const [roster, setRoster] = useState([]);
  const [marcas, setMarcas] = useState([]);       // asistencias de los últimos 7 días
  const [fecha, setFecha] = useState(isoLocal());
  const [busca, setBusca] = useState('');
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null);

  const hoy = isoLocal();
  const minFecha = isoLocal(new Date(Date.now() - 7 * 864e5));

  const cargar = async () => {
    if (!supabase) return;
    setError('');
    const [r, m] = await Promise.all([
      supabase.from('asistencia_roster_manual').select('*').order('nombre'),
      supabase.from('asistencias_manual').select('*').gte('fecha', minFecha),
    ]);
    if (r.error || m.error) { setError((r.error || m.error).message); return; }
    setRoster(r.data || []);
    setMarcas(m.data || []);
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const marcadosDia = useMemo(
    () => new Map(marcas.filter(x => x.fecha === fecha).map(x => [Number(x.cliente_gestion_id), x])),
    [marcas, fecha]);

  const q = sinTildes(busca.trim());
  const lista = useMemo(() => roster
    .filter(c => !q || sinTildes(c.nombre).includes(q))
    // Primero los que faltan marcar: son los que se buscan.
    .sort((a, b) => (marcadosDia.has(Number(a.cliente_gestion_id)) - marcadosDia.has(Number(b.cliente_gestion_id)))
      || a.nombre.localeCompare(b.nombre)),
  [roster, q, marcadosDia]);

  const alternar = async (c) => {
    const id = Number(c.cliente_gestion_id);
    setOcupado(id); setError('');
    try {
      const ya = marcadosDia.get(id);
      if (ya) {
        const { error: e } = await supabase.from('asistencias_manual').delete().eq('id', ya.id);
        if (e) throw e;
        setMarcas(ms => ms.filter(x => x.id !== ya.id));
      } else {
        const { data: u } = await supabase.auth.getUser();
        const fila = {
          cliente_gestion_id: id,
          nombre: c.nombre,
          fecha,
          hora: fecha === hoy ? horaLocal() : null,
          registrado_por: u?.user?.email || null,
        };
        const { data, error: e } = await supabase.from('asistencias_manual')
          .upsert(fila, { onConflict: 'cliente_gestion_id,fecha' }).select().single();
        if (e) throw e;
        setMarcas(ms => [...ms.filter(x => !(Number(x.cliente_gestion_id) === id && x.fecha === fecha)), data]);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setOcupado(null);
    }
  };

  if (!supabase) return null;
  const nHoy = marcas.filter(x => x.fecha === hoy).length;

  return (
    <div style={{ background: BK, border: `1px solid ${G2}`, borderRadius: 10, padding: '11px 13px', marginBottom: 12 }}>
      <div onClick={() => setAbierta(a => !a)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: WH }}>✅ Asistencia sin portal</div>
          <div style={{ fontSize: 10, color: G4, marginTop: 2 }}>
            {roster.length} clientes todavía sin usuario · {nHoy} marcados hoy
          </div>
        </div>
        <span style={{ color: G4, fontSize: 12 }}>{abierta ? '▲' : '▼'}</span>
      </div>

      {abierta && (
        <div style={{ marginTop: 9 }}>
          <div style={{ fontSize: 10, color: G4, marginBottom: 8, lineHeight: 1.45 }}>
            Solo para quienes no cargan en el portal. Los que tienen usuario se registran solos.
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…"
              style={{ flex: 1, minWidth: 0, background: '#0e0e0e', border: `1px solid ${G2}`, color: WH, borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
            <input type="date" value={fecha} min={minFecha} max={hoy}
              onChange={e => setFecha(e.target.value && e.target.value <= hoy && e.target.value >= minFecha ? e.target.value : hoy)}
              style={{ background: '#0e0e0e', border: `1px solid ${G2}`, color: WH, borderRadius: 7, padding: '6px 8px', fontSize: 12 }} />
          </div>
          {fecha !== hoy && (
            <div style={{ fontSize: 10, color: '#FBBF24', marginBottom: 6 }}>
              Marcando el {fecha}, no hoy. Se guarda sin hora.
            </div>
          )}
          {error && <div style={{ fontSize: 11, color: ROJO, marginBottom: 6 }}>No se pudo guardar: {error}</div>}
          {roster.length === 0 && !error && (
            <div style={{ fontSize: 11, color: G4 }}>Todos los clientes activos tienen usuario en el portal.</div>
          )}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {lista.map(c => {
              const m = marcadosDia.get(Number(c.cliente_gestion_id));
              return (
                <div key={c.cliente_gestion_id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 9px', borderRadius: 6, background: '#1c1c1c', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: WH }}>
                    {c.nombre}
                    {c.plan && <span style={{ color: G4, fontSize: 10 }}> · {c.plan}</span>}
                  </span>
                  <button disabled={ocupado === Number(c.cliente_gestion_id)} onClick={() => alternar(c)}
                    style={{
                      border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: m ? VERDE : '#2f2f2f', color: WH, minWidth: 92,
                    }}>
                    {m ? `✓ ${m.hora ? String(m.hora).slice(0, 5) : 'presente'}` : 'Presente'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
