// db.js — Capa de datos con fallback a estado local si Supabase no está disponible
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from './supabase.js'

export const genId = (prefix = 'id') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`

// ─── HOOK: Clientes del Gym ───────────────────────────────────────────────
export function useGymClients() {
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [dbMode, setDbMode]     = useState(isSupabaseReady)

  const fetchClients = useCallback(async () => {
    if (!isSupabaseReady) { setLoading(false); return }
    try {
      const { data, error: e } = await supabase
        .from('gym_clients')
        .select('*')
        .order('created_at', { ascending: false })
      if (e) throw e
      setClients((data || []).map(mapClientFromDB))
      setDbMode(true)
    } catch (e) {
      console.error('DB fetch error:', e.message)
      setError(e.message)
      setDbMode(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
    if (!isSupabaseReady) return
    const ch = supabase.channel('gym_clients_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_clients' },
        payload => {
          if (payload.eventType === 'INSERT')
            setClients(p => [mapClientFromDB(payload.new), ...p])
          if (payload.eventType === 'UPDATE')
            setClients(p => p.map(c => c.id === payload.new.id ? mapClientFromDB(payload.new) : c))
          if (payload.eventType === 'DELETE')
            setClients(p => p.filter(c => c.id !== payload.old.id))
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchClients])

  const saveClient = useCallback(async (client) => {
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase
        .from('gym_clients')
        .upsert(mapClientToDB(client), { onConflict: 'id' })
      if (e) throw e
    } else {
      // Fallback local
      setClients(p => p.find(x => x.id === client.id)
        ? p.map(x => x.id === client.id ? client : x)
        : [client, ...p])
    }
  }, [dbMode])

  const deleteClient = useCallback(async (id) => {
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase.from('gym_clients').delete().eq('id', id)
      if (e) throw e
    } else {
      setClients(p => p.filter(c => c.id !== id))
    }
  }, [dbMode])

  const updateClient = useCallback(async (id, updates) => {
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase
        .from('gym_clients')
        .update(mapClientUpdatesToDB(updates))
        .eq('id', id)
      if (e) throw e
    } else {
      setClients(p => p.map(c => c.id === id ? { ...c, ...updates } : c))
    }
  }, [dbMode])

  return { clients, loading, error, dbMode, saveClient, deleteClient, updateClient, refetch: fetchClients }
}

// ─── HOOK: Pacientes FisioActiva ──────────────────────────────────────────
export function useFisioPacientes() {
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading]    = useState(true)
  const [error, setError]        = useState(null)
  const [dbMode, setDbMode]      = useState(isSupabaseReady)

  const fetchPacientes = useCallback(async () => {
    if (!isSupabaseReady) { setLoading(false); return }
    try {
      const [{ data: pacs, error: e1 }, { data: evals, error: e2 }] = await Promise.all([
        supabase.from('fisio_pacientes').select('*').order('created_at', { ascending: false }),
        supabase.from('fisio_evaluaciones').select('*').order('created_at', { ascending: true }),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const combined = (pacs || []).map(p => ({
        ...mapPacienteFromDB(p),
        evaluaciones: (evals || []).filter(e => e.paciente_id === p.id).map(mapEvalFromDB),
      }))
      setPacientes(combined)
      setDbMode(true)
    } catch (e) {
      console.error('DB fetch pacientes:', e.message)
      setError(e.message)
      setDbMode(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPacientes()
    if (!isSupabaseReady) return
    const ch1 = supabase.channel('fisio_pac_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fisio_pacientes' },
        () => fetchPacientes()).subscribe()
    const ch2 = supabase.channel('fisio_eval_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fisio_evaluaciones' },
        () => fetchPacientes()).subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [fetchPacientes])

  const savePaciente = useCallback(async (p) => {
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase
        .from('fisio_pacientes')
        .upsert(mapPacienteToDB(p), { onConflict: 'id' })
      if (e) throw e
    } else {
      setPacientes(prev => prev.find(x => x.id === p.id)
        ? prev.map(x => x.id === p.id ? { ...x, ...p } : x)
        : [{ ...p, evaluaciones: [] }, ...prev])
    }
  }, [dbMode])

  const deletePaciente = useCallback(async (id) => {
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase.from('fisio_pacientes').delete().eq('id', id)
      if (e) throw e
    } else {
      setPacientes(p => p.filter(x => x.id !== id))
    }
  }, [dbMode])

  const saveEvaluacion = useCallback(async (pacienteId, eval_) => {
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase
        .from('fisio_evaluaciones')
        .upsert(mapEvalToDB(pacienteId, eval_), { onConflict: 'id' })
      if (e) throw e
    } else {
      setPacientes(prev => prev.map(p => {
        if (p.id !== pacienteId) return p
        const exists = p.evaluaciones.find(e => e.id === eval_.id)
        return {
          ...p,
          evaluaciones: exists
            ? p.evaluaciones.map(e => e.id === eval_.id ? eval_ : e)
            : [...p.evaluaciones, eval_]
        }
      }))
    }
  }, [dbMode])

  return { pacientes, loading, error, dbMode, savePaciente, deletePaciente, saveEvaluacion, refetch: fetchPacientes }
}

// ─── MAPPERS: DB → App ────────────────────────────────────────────────────
function mapClientFromDB(r) {
  return {
    id: r.id, nombre: r.nombre||'', apellido: r.apellido||'',
    documento: r.documento||'', celular: r.celular||'',
    nivel: r.nivel||'activa', semaforo: r.semaforo||'pendiente',
    restricciones: r.restricciones||'',
    restricciones_flags: r.restricciones_flags||{impacto:false,overhead:false,cargaAxial:false},
    objetivo: r.objetivo||'', criterios_personalizados: r.criterios_personalizados||[],
    fechaIngreso: r.fecha_ingreso||'', fechaEval: r.fecha_eval||'',
    notasInternas: r.notas_internas||'', screeningCompleto: r.screening_completo||false,
    screening: r.screening||{}, fisio_pacienteId: r.fisio_paciente_id||null,
  }
}
function mapClientToDB(c) {
  return {
    id: c.id, nombre: c.nombre, apellido: c.apellido,
    documento: c.documento||null, celular: c.celular||null,
    nivel: c.nivel||'activa', semaforo: c.semaforo||'pendiente',
    restricciones: c.restricciones||'',
    restricciones_flags: c.restricciones_flags||{impacto:false,overhead:false,cargaAxial:false},
    objetivo: c.objetivo||'', criterios_personalizados: c.criterios_personalizados||[],
    fecha_ingreso: c.fechaIngreso||null, fecha_eval: c.fechaEval||null,
    notas_internas: c.notasInternas||'', screening_completo: c.screeningCompleto||false,
    screening: c.screening||{}, fisio_paciente_id: c.fisio_pacienteId||null,
  }
}
function mapClientUpdatesToDB(u) {
  const m={}
  if(u.nivel!==undefined)              m.nivel=u.nivel
  if(u.semaforo!==undefined)           m.semaforo=u.semaforo
  if(u.restricciones!==undefined)      m.restricciones=u.restricciones
  if(u.restricciones_flags!==undefined)m.restricciones_flags=u.restricciones_flags
  if(u.fechaEval!==undefined)          m.fecha_eval=u.fechaEval
  if(u.screeningCompleto!==undefined)  m.screening_completo=u.screeningCompleto
  if(u.notasInternas!==undefined)      m.notas_internas=u.notasInternas
  if(u.objetivo!==undefined)           m.objetivo=u.objetivo
  return m
}
function mapPacienteFromDB(r) {
  return {
    id:r.id, nombre:r.nombre||'', apellido:r.apellido||'',
    documento:r.documento||'', celular:r.celular||'', email:r.email||'',
    fechaNac:r.fecha_nac||'', genero:r.genero||'',
    region:r.region||'lumbar', derivadoPor:r.derivado_por||'',
    gym_clienteId:r.gym_cliente_id||null, notas:r.notas||'',
    activo:r.activo!==false, evaluaciones:[],
  }
}
function mapPacienteToDB(p) {
  return {
    id:p.id, nombre:p.nombre, apellido:p.apellido,
    documento:p.documento||null, celular:p.celular||null, email:p.email||null,
    fecha_nac:p.fechaNac||null, genero:p.genero||null,
    region:p.region||'lumbar', derivado_por:p.derivadoPor||null,
    gym_cliente_id:p.gym_clienteId||null, notas:p.notas||'', activo:p.activo!==false,
  }
}
function mapEvalFromDB(r) {
  return { id:r.id, fecha:r.fecha||'', tipo:r.tipo||'inicial',
    region:r.region||'lumbar', evaluador:r.evaluador||'', fase:r.fase||'restaura',
    objetivo:r.objetivo||'', eva_reposo:r.eva_reposo||'',
    diagnosticoPT:r.diagnostico_pt||'', plan:r.plan||'',
    criterios_personalizados:r.criterios_personalizados||[],
    ...(r.data||{}),
  }
}
function mapEvalToDB(pacienteId, ev) {
  const { id,fecha,tipo,region,evaluador,fase,objetivo,eva_reposo,
          diagnosticoPT,plan,criterios_personalizados,...rest } = ev
  return {
    id: id||genId('eval'), paciente_id:pacienteId,
    fecha:fecha||new Date().toISOString().split('T')[0],
    tipo:tipo||'inicial', region:region||'lumbar',
    evaluador:evaluador||null, fase:fase||'restaura',
    objetivo:objetivo||null, eva_reposo:eva_reposo||null,
    diagnostico_pt:diagnosticoPT||null, plan:plan||null,
    criterios_personalizados:criterios_personalizados||[],
    data:{...rest,eva_reposo,objetivo,diagnosticoPT,plan},
  }
}
