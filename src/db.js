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
    const ch = supabase.channel('gym_clients_rt_'+Math.random().toString(36).slice(2,6))
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
    const ch1 = supabase.channel('fisio_pac_rt_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fisio_pacientes' },
        () => fetchPacientes()).subscribe()
    const ch2 = supabase.channel('fisio_eval_rt_'+Math.random().toString(36).slice(2,6))
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
    periodizacion: r.periodizacion||'',
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
    periodizacion: c.periodizacion||'',
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

// ─── HOOK: Ejercicios (base de datos de ejercicios) ──────────────────────
export function useEjercicios(initialExercises=[]) {
  const [exs, setExs]     = useState(initialExercises)
  const [loading, setLoading] = useState(true)
  const [dbMode, setDbMode]   = useState(isSupabaseReady)
  const initialized           = useState(false)

  const fetchEjercicios = useCallback(async () => {
    if (!isSupabaseReady) {
      setExs(initialExercises)
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('ejercicios')
        .select('*')
        .order('bloque', { ascending: true })
      if (error) throw error

      if (data && data.length > 0) {
        // DB has exercises — use them
        setExs(data.map(mapEjFromDB))
        setDbMode(true)
      } else {
        // DB empty — seed with initial exercises
        const rows = initialExercises.map(mapEjToDB)
        const { error: insertError } = await supabase
          .from('ejercicios')
          .upsert(rows, { onConflict: 'id' })
        if (insertError) throw insertError
        setExs(initialExercises)
        setDbMode(true)
        console.log('✅ Ejercicios iniciales cargados en Supabase:', rows.length)
      }
    } catch (e) {
      console.error('DB ejercicios error:', e.message)
      setExs(initialExercises)
      setDbMode(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEjercicios()
    if (!isSupabaseReady) return
    const ch = supabase.channel('ejercicios_rt_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ejercicios' },
        payload => {
          if (payload.eventType === 'INSERT')
            setExs(p => [...p, mapEjFromDB(payload.new)])
          if (payload.eventType === 'UPDATE')
            setExs(p => p.map(e => e.id === payload.new.id ? mapEjFromDB(payload.new) : e))
          if (payload.eventType === 'DELETE')
            setExs(p => p.filter(e => e.id !== payload.old.id))
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchEjercicios])

  const saveEjercicio = useCallback(async (ex) => {
    if (dbMode && isSupabaseReady) {
      const { error } = await supabase
        .from('ejercicios')
        .upsert(mapEjToDB(ex), { onConflict: 'id' })
      if (error) throw error
    } else {
      setExs(p => p.find(e => e.id === ex.id)
        ? p.map(e => e.id === ex.id ? ex : e)
        : [...p, ex])
    }
  }, [dbMode])

  const deleteEjercicio = useCallback(async (id) => {
    if (dbMode && isSupabaseReady) {
      const { error } = await supabase.from('ejercicios').delete().eq('id', id)
      if (error) throw error
    } else {
      setExs(p => p.filter(e => e.id !== id))
    }
  }, [dbMode])

  return { exs, loading, dbMode, saveEjercicio, deleteEjercicio, setExs }
}

function mapEjFromDB(r) {
  return {
    id: r.id, nombre: r.nombre||'', bloque: r.bloque||'movilidad',
    musculos: r.musculos||'', contraccion: r.contraccion||'',
    patron: r.patron||'', nivel: r.nivel||'Principiante',
    equipo: r.equipo||'', regresion: r.regresion||'', progresion: r.progresion||'',
    mediaUrl: r.media_url||'', mediaTipo: r.media_tipo||'imagen',
    mediaDesc: r.media_desc||'', custom: r.custom||false,
  }
}
function mapEjToDB(e) {
  return {
    id: e.id, nombre: e.nombre, bloque: e.bloque,
    musculos: e.musculos||'', contraccion: e.contraccion||'',
    patron: e.patron||'', nivel: e.nivel||'Principiante',
    equipo: e.equipo||'', regresion: e.regresion||'', progresion: e.progresion||'',
    media_url: e.mediaUrl||'', media_tipo: e.mediaTipo||'imagen',
    media_desc: e.mediaDesc||'', custom: e.custom||false,
  }
}

// ─── HOOK: Tests de Fuerza Máxima ─────────────────────────────────────────
export function useFuerzaTests(clientId) {
  const [tests,setTests]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!clientId){setLoading(false);return}
    try{
      const{data,error}=await supabase.from('fuerza_tests').select('*').eq('gym_client_id',clientId).order('fecha',{ascending:false})
      if(error)throw error
      setTests(data||[])
    }catch(e){console.error('fuerza_tests:',e.message)}
    finally{setLoading(false)}
  },[clientId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!clientId)return
    const ch=supabase.channel('ft_'+clientId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'fuerza_tests',filter:`gym_client_id=eq.${clientId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,clientId])
  const saveTest=useCallback(async(t)=>{
    if(!clientId) throw new Error('No hay cliente seleccionado')
    const toSave={...t, gym_client_id:clientId}
    if(isSupabaseReady){
      const{error}=await supabase.from('fuerza_tests').upsert(toSave,{onConflict:'id'})
      if(error) throw error
      await fetch() // refetch to update UI immediately
    } else {
      setTests(p=>p.find(x=>x.id===t.id)?p.map(x=>x.id===t.id?toSave:x):[toSave,...p])
    }
  },[clientId, fetch])
  const deleteTest=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('fuerza_tests').delete().eq('id',id)
    else setTests(p=>p.filter(x=>x.id!==id))
  },[])
  return{tests,loading,saveTest,deleteTest,refetch:fetch}
}

// ─── HOOK: Planes de Periodización ────────────────────────────────────────
export function usePlanesCliente(clientId) {
  const [planes,setPlanes]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!clientId){setLoading(false);return}
    try{
      const{data,error}=await supabase.from('planes_periodizacion').select('*').eq('gym_client_id',clientId).order('created_at',{ascending:false})
      if(error)throw error
      setPlanes(data||[])
    }catch(e){console.error('planes:',e.message)}
    finally{setLoading(false)}
  },[clientId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!clientId)return
    const ch=supabase.channel('planes_'+clientId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'planes_periodizacion',filter:`gym_client_id=eq.${clientId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,clientId])
  const savePlan=useCallback(async(p)=>{
    if(isSupabaseReady){const{error}=await supabase.from('planes_periodizacion').upsert({...p,gym_client_id:clientId},{onConflict:'id'});if(error)throw error}
    else setPlanes(p2=>p2.find(x=>x.id===p.id)?p2.map(x=>x.id===p.id?p:x):[p,...p2])
  },[clientId])
  const deletePlan=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('planes_periodizacion').delete().eq('id',id)
    else setPlanes(p=>p.filter(x=>x.id!==id))
  },[])
  return{planes,loading,savePlan,deletePlan,refetch:fetch}
}

// ─── HOOK: Registro de Planes del Constructor (gym_planes) ────────────────
export function useGymPlanes(clientId) {
  const [gymPlanes,setGymPlanes]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!clientId){setGymPlanes([]);setLoading(false);return}
    try{
      const{data,error}=await supabase.from('gym_planes').select('*').eq('gym_client_id',clientId).order('created_at',{ascending:false})
      if(error)throw error
      setGymPlanes(data||[])
    }catch(e){console.error('gym_planes:',e.message)}
    finally{setLoading(false)}
  },[clientId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!clientId)return
    const ch=supabase.channel('gymplanes_'+clientId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'gym_planes',filter:`gym_client_id=eq.${clientId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,clientId])
  const savePlan=useCallback(async(p)=>{
    if(!clientId)throw new Error('No hay cliente seleccionado')
    const toSave={...p,gym_client_id:clientId,updated_at:new Date().toISOString()}
    if(isSupabaseReady){
      const{error}=await supabase.from('gym_planes').upsert(toSave,{onConflict:'id'})
      if(error)throw error
      await fetch()
    } else setGymPlanes(a=>a.find(x=>x.id===p.id)?a.map(x=>x.id===p.id?toSave:x):[toSave,...a])
    return toSave
  },[clientId,fetch])
  const deletePlan=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('gym_planes').delete().eq('id',id)
    else setGymPlanes(a=>a.filter(x=>x.id!==id))
  },[])
  return{gymPlanes,loading,savePlan,deletePlan,refetch:fetch}
}

// ─── HOOK: Registro de Planes de Nutrición (gym_planes_nutricion) ─────────
export function useNutricionPlanes(clientId) {
  const [nutriPlanes,setNutriPlanes]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!clientId){setNutriPlanes([]);setLoading(false);return}
    try{
      const{data,error}=await supabase.from('gym_planes_nutricion').select('*').eq('gym_client_id',clientId).order('created_at',{ascending:false})
      if(error)throw error
      setNutriPlanes(data||[])
    }catch(e){console.error('gym_planes_nutricion:',e.message)}
    finally{setLoading(false)}
  },[clientId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!clientId)return
    const ch=supabase.channel('nutriplanes_'+clientId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'gym_planes_nutricion',filter:`gym_client_id=eq.${clientId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,clientId])
  const savePlan=useCallback(async(p)=>{
    if(!clientId)throw new Error('No hay cliente seleccionado')
    const toSave={...p,gym_client_id:clientId,updated_at:new Date().toISOString()}
    if(isSupabaseReady){
      const{error}=await supabase.from('gym_planes_nutricion').upsert(toSave,{onConflict:'id'})
      if(error)throw error
      await fetch()
    } else setNutriPlanes(a=>a.find(x=>x.id===p.id)?a.map(x=>x.id===p.id?toSave:x):[toSave,...a])
    return toSave
  },[clientId,fetch])
  const deletePlan=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('gym_planes_nutricion').delete().eq('id',id)
    else setNutriPlanes(a=>a.filter(x=>x.id!==id))
  },[])
  return{nutriPlanes,loading,savePlan,deletePlan,refetch:fetch}
}

// ─── HOOK: Base de conocimiento de la IA (ia_conocimiento) ────────────────
export function useIAConocimiento() {
  const [reglas,setReglas]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady){setLoading(false);return}
    try{
      const{data,error}=await supabase.from('ia_conocimiento').select('*').order('created_at',{ascending:true})
      if(error)throw error
      setReglas(data||[])
    }catch(e){console.error('ia_conocimiento:',e.message)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady)return
    const ch=supabase.channel('iaconoc_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'ia_conocimiento'},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch])
  const saveRegla=useCallback(async(r)=>{
    if(isSupabaseReady){const{error}=await supabase.from('ia_conocimiento').upsert(r,{onConflict:'id'});if(error)throw error;await fetch()}
    else setReglas(a=>a.find(x=>x.id===r.id)?a.map(x=>x.id===r.id?r:x):[...a,r])
  },[fetch])
  const deleteRegla=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('ia_conocimiento').delete().eq('id',id)
    else setReglas(a=>a.filter(x=>x.id!==id))
  },[])
  return{reglas,loading,saveRegla,deleteRegla,refetch:fetch}
}

// ─── HOOK: Sesiones Clínicas ──────────────────────────────────────────────
export function useSesionesClinicas(pacienteId) {
  const [sesiones,setSesiones]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!pacienteId){setLoading(false);return}
    try{
      const{data,error}=await supabase.from('sesiones_clinicas').select('*').eq('paciente_id',pacienteId).order('fecha',{ascending:false})
      if(error)throw error
      setSesiones(data||[])
    }catch(e){console.error('sesiones_clinicas:',e.message);setSesiones([])}
    finally{setLoading(false)}
  },[pacienteId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!pacienteId)return
    const ch=supabase.channel('sc_'+pacienteId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'sesiones_clinicas',filter:`paciente_id=eq.${pacienteId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,pacienteId])
  const saveSesion=useCallback(async(s)=>{
    if(!pacienteId)throw new Error('Sin paciente')
    const toSave={...s,paciente_id:pacienteId}
    if(isSupabaseReady){const{error}=await supabase.from('sesiones_clinicas').upsert(toSave,{onConflict:'id'});if(error)throw error;await fetch()}
    else setSesiones(p=>p.find(x=>x.id===s.id)?p.map(x=>x.id===s.id?toSave:x):[toSave,...p])
  },[pacienteId,fetch])
  const deleteSesion=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('sesiones_clinicas').delete().eq('id',id)
    else setSesiones(p=>p.filter(x=>x.id!==id))
  },[])
  return{sesiones,loading,saveSesion,deleteSesion}
}

// ─── HOOK: Protocolos Rehab Custom ────────────────────────────────────────
export function useRehabProtocolos() {
  const [protocolos,setProtocolos]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady){setLoading(false);return}
    try{
      const{data,error}=await supabase.from('rehab_ejercicios_custom').select('*').order('created_at',{ascending:false})
      if(error)throw error
      setProtocolos(data||[])
    }catch(e){console.error('rehab_custom:',e.message);setProtocolos([])}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady)return
    const ch=supabase.channel('rehab_c_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'rehab_ejercicios_custom'},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch])
  const saveEjercicio=useCallback(async(ej)=>{
    if(isSupabaseReady){const{error}=await supabase.from('rehab_ejercicios_custom').upsert(ej,{onConflict:'id'});if(error)throw error;await fetch()}
    else setProtocolos(p=>p.find(x=>x.id===ej.id)?p.map(x=>x.id===ej.id?ej:x):[ej,...p])
  },[fetch])
  const deleteEjercicio=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('rehab_ejercicios_custom').delete().eq('id',id)
    else setProtocolos(p=>p.filter(x=>x.id!==id))
  },[])
  return{protocolos,loading,saveEjercicio,deleteEjercicio}
}
