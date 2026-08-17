// db.js — Capa de datos con fallback a estado local si Supabase no está disponible
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseReady } from './supabase.js'

export const genId = (prefix = 'id') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`

// ─── HOOK: Clientes del Gym ───────────────────────────────────────────────
export function useGymClients() {
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [dbMode, setDbMode]     = useState(isSupabaseReady)
  const clientsRef = useRef([])
  useEffect(() => { clientsRef.current = clients }, [clients])

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

  // IMPORTANTE — fix de sincronización multi-dispositivo (2 devices, ej.
  // clínica + gym al mismo tiempo): antes esto hacía upsert() de un objeto
  // completo que el componente había armado con `{...cliente}` capturado
  // en el momento en que se abrió el formulario/wizard. Si ese formulario
  // quedaba abierto un rato y OTRO dispositivo modificaba ese mismo cliente
  // mientras tanto, al guardar acá se pisaba silenciosamente ese cambio
  // ajeno con la copia vieja. Ahora se mergea sobre el estado local más
  // fresco (que la suscripción realtime mantiene al día en segundos) antes
  // de persistir, así solo se sobreescriben los campos que este dispositivo
  // realmente tocó. Esto reduce la ventana de conflicto de "lo que duró el
  // formulario abierto" a "la latencia de la suscripción realtime" (~1seg).
  // No es un CRDT: si dos dispositivos tocan el MISMO campo en el mismo
  // segundo, gana el último — pero el escenario reportado (se borra info
  // cargada por el otro dispositivo) era mucho más amplio que eso y con
  // esto queda resuelto.
  const saveClient = useCallback(async (client) => {
    const fresh = clientsRef.current.find(x => x.id === client.id)
    const merged = fresh ? { ...fresh, ...client } : client
    setClients(prev => fresh ? prev.map(x => x.id === client.id ? merged : x) : [merged, ...prev])
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase
        .from('gym_clients')
        .upsert(mapClientToDB(merged), { onConflict: 'id' })
      if (e) throw e
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
  const pacientesRef = useRef([])
  useEffect(() => { pacientesRef.current = pacientes }, [pacientes])

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
    const fresh = pacientesRef.current.find(x => x.id === p.id)
    // evaluaciones nunca se tocan acá — las administra saveEvaluacion (upsert por fila).
    // Si p trajera un array de evaluaciones viejo (capturado al abrir el form), no debe pisar el actual.
    const merged = fresh ? { ...fresh, ...p, evaluaciones: fresh.evaluaciones } : { ...p, evaluaciones: p.evaluaciones||[] }
    setPacientes(prev => fresh ? prev.map(x => x.id === p.id ? merged : x) : [merged, ...prev])
    if (dbMode && isSupabaseReady) {
      const { error: e } = await supabase
        .from('fisio_pacientes')
        .upsert(mapPacienteToDB(merged), { onConflict: 'id' })
      if (e) throw e
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
    periodizacionInicio: r.periodizacion_inicio||'',
    periodizacionFin: r.periodizacion_fin||'',
    periodizacionSnapshotInicio: r.periodizacion_snapshot_inicio||null,
    periodizacionesHistorial: r.periodizaciones_historial||[],
    portal_token: r.portal_token||'',
    criterios_avance_estado: r.criterios_avance_estado||{},
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
    periodizacion_inicio: c.periodizacionInicio||null,
    periodizacion_fin: c.periodizacionFin||null,
    periodizacion_snapshot_inicio: c.periodizacionSnapshotInicio||null,
    periodizaciones_historial: c.periodizacionesHistorial||[],
    criterios_avance_estado: c.criterios_avance_estado||{},
    ...(c.portal_token?{portal_token:c.portal_token}:{}),
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
  if(u.portal_token!==undefined)       m.portal_token=u.portal_token
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

// ─── HOOK: Alimentos personalizados (alimentos_custom) ─────────────────────
export function useAlimentosCustom() {
  const [alimentosCustom,setAlimentosCustom]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady){setAlimentosCustom([]);setLoading(false);return}
    try{
      const{data,error}=await supabase.from('alimentos_custom').select('*').order('created_at',{ascending:true})
      if(error)throw error
      setAlimentosCustom((data||[]).map(r=>({
        id:r.id,nombre:r.nombre,categoria:r.categoria,porcion_ref:r.porcion_ref,
        proteinas:r.proteinas,carbos:r.carbos,grasas:r.grasas,fibra:r.fibra,calorias:r.calorias,
        tiene_unidad:r.tiene_unidad||false,nombre_unidad:r.nombre_unidad||'',gramos_por_unidad:r.gramos_por_unidad||null,
        micro1:{nombre:r.micro1_nombre||'',valor:r.micro1_valor||0,unidad:r.micro1_unidad||'mg'},
        micro2:{nombre:r.micro2_nombre||'',valor:r.micro2_valor||0,unidad:r.micro2_unidad||'mg'},
        custom:true,
      })))
    }catch(e){console.error('alimentos_custom:',e.message)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady)return
    const ch=supabase.channel('alimcustom_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'alimentos_custom'},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch])
  const saveAlimento=useCallback(async(al)=>{
    const row={
      id:al.id,nombre:al.nombre,categoria:al.categoria,porcion_ref:al.porcion_ref,
      proteinas:al.proteinas,carbos:al.carbos,grasas:al.grasas,fibra:al.fibra,calorias:al.calorias,
      tiene_unidad:!!al.tiene_unidad,nombre_unidad:al.nombre_unidad||'',gramos_por_unidad:al.tiene_unidad?(al.gramos_por_unidad||null):null,
      micro1_nombre:al.micro1?.nombre||'',micro1_valor:al.micro1?.valor||0,micro1_unidad:al.micro1?.unidad||'mg',
      micro2_nombre:al.micro2?.nombre||'',micro2_valor:al.micro2?.valor||0,micro2_unidad:al.micro2?.unidad||'mg',
      updated_at:new Date().toISOString(),
    };
    if(isSupabaseReady){
      const{error}=await supabase.from('alimentos_custom').upsert(row,{onConflict:'id'})
      if(error)throw error
      await fetch()
    }else setAlimentosCustom(p=>[...p,al])
  },[fetch])
  const deleteAlimento=useCallback(async(id)=>{
    if(isSupabaseReady)await supabase.from('alimentos_custom').delete().eq('id',id)
    else setAlimentosCustom(p=>p.filter(a=>a.id!==id))
  },[])
  return{alimentosCustom,loading,saveAlimento,deleteAlimento,refetch:fetch}
}

// ─── HOOK: Ejercicios personalizados de fuerza (fuerza_tests_custom) ──────
export function useCustomTests(clientId) {
  const [customRows,setCustomRows]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!clientId){setCustomRows([]);setLoading(false);return}
    try{
      const{data,error}=await supabase.from('fuerza_tests_custom').select('*').eq('gym_client_id',clientId).order('slot',{ascending:true})
      if(error)throw error
      setCustomRows(data||[])
    }catch(e){console.error('fuerza_tests_custom:',e.message)}
    finally{setLoading(false)}
  },[clientId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!clientId)return
    const ch=supabase.channel('fcustom_'+clientId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'fuerza_tests_custom',filter:`gym_client_id=eq.${clientId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,clientId])
  // items: array de hasta 3 {nombre,patron,protocolo}. Se asignan a slots ct1/ct2/ct3.
  const saveCustom=useCallback(async(items)=>{
    if(!clientId)return
    const slots=['ct1','ct2','ct3']
    if(isSupabaseReady){
      for(let i=0;i<slots.length;i++){
        const slot=slots[i];const it=items[i]
        const rid=`${clientId}__${slot}`
        if(it&&it.nombre&&it.nombre.trim()){
          await supabase.from('fuerza_tests_custom').upsert({id:rid,gym_client_id:clientId,slot,nombre:it.nombre.trim(),patron:it.patron||'',protocolo:it.protocolo||'',updated_at:new Date().toISOString()},{onConflict:'id'})
        }else{
          await supabase.from('fuerza_tests_custom').delete().eq('id',rid)
        }
      }
      await fetch()
    }else{
      setCustomRows(items.filter(t=>t&&t.nombre).map((t,i)=>({id:`${clientId}__ct${i+1}`,gym_client_id:clientId,slot:'ct'+(i+1),nombre:t.nombre,patron:t.patron||'',protocolo:t.protocolo||''})))
    }
  },[clientId,fetch])
  return{customRows,loading,saveCustom,refetch:fetch}
}

// ─── HOOK: Registros de ejecución real (ejecucion_registros) ──────────────
export function useEjecucion(planId) {
  const [registros,setRegistros]=useState([])
  const [loading,setLoading]=useState(true)
  const fetch=useCallback(async()=>{
    if(!isSupabaseReady||!planId){setRegistros([]);setLoading(false);return}
    try{
      const{data,error}=await supabase.from('ejecucion_registros').select('*').eq('plan_id',planId).order('semana',{ascending:true})
      if(error)throw error
      setRegistros(data||[])
    }catch(e){console.error('ejecucion_registros:',e.message)}
    finally{setLoading(false)}
  },[planId])
  useEffect(()=>{
    fetch()
    if(!isSupabaseReady||!planId)return
    const ch=supabase.channel('ejec_'+planId+'_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'ejecucion_registros',filter:`plan_id=eq.${planId}`},()=>fetch())
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetch,planId])
  return{registros,loading,refetch:fetch}
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

// ─── HOOK: Configuración del Centro (marca, logo, color) ──────────────────
// Antes esto era un useState local respaldado en localStorage — cambios
// hechos en un dispositivo nunca se veían en otro. Ahora es una fila única
// en Supabase con realtime, igual patrón que gym_clients. Si Supabase no
// está disponible, cae a localStorage como antes (mismo fallback general
// del resto de la app) para no romper el modo local.
const DEFAULT_CONFIG={gymName:'ACTIVA',gymSub:'FITNESS CLUB',logoImg:null,colorPrimary:'#CC0000',colorBg:'#1a1a1a'}
function mapConfigFromDB(r){
  return{gymName:r.gym_name||DEFAULT_CONFIG.gymName,gymSub:r.gym_sub||DEFAULT_CONFIG.gymSub,logoImg:r.logo_img||null,colorPrimary:r.color_primary||DEFAULT_CONFIG.colorPrimary,colorBg:r.color_bg||DEFAULT_CONFIG.colorBg}
}
function mapConfigToDB(c){
  return{id:'default',gym_name:c.gymName,gym_sub:c.gymSub,logo_img:c.logoImg||null,color_primary:c.colorPrimary,color_bg:c.colorBg,updated_at:new Date().toISOString()}
}
function readLocalConfig(){
  try{const saved=localStorage.getItem('activa_brand');return saved?JSON.parse(saved):DEFAULT_CONFIG}
  catch{return DEFAULT_CONFIG}
}
export function useCentroConfig(){
  const [config,setConfig]=useState(readLocalConfig)
  const [dbMode,setDbMode]=useState(isSupabaseReady)

  const fetchConfig=useCallback(async()=>{
    if(!isSupabaseReady)return
    try{
      const{data,error}=await supabase.from('centro_config').select('*').eq('id','default').maybeSingle()
      if(error)throw error
      if(data){setConfig(mapConfigFromDB(data));setDbMode(true)}
      else{
        // no existe la fila todavía (deploy nuevo sin correr la migración de seed) — la creamos con lo que había local
        await supabase.from('centro_config').upsert(mapConfigToDB(readLocalConfig()),{onConflict:'id'})
        setDbMode(true)
      }
    }catch(e){console.error('centro_config fetch:',e.message);setDbMode(false)}
  },[])

  useEffect(()=>{
    fetchConfig()
    if(!isSupabaseReady)return
    const ch=supabase.channel('centro_config_rt_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'centro_config'},
        payload=>{ if(payload.new)setConfig(mapConfigFromDB(payload.new)) })
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetchConfig])

  // Espejo en localStorage: lectura instantánea al abrir la app (sin esperar
  // el fetch a Supabase) y fallback si Supabase no está disponible.
  useEffect(()=>{ try{localStorage.setItem('activa_brand',JSON.stringify(config))}catch{} },[config])

  const saveConfig=useCallback(async(newConfig)=>{
    setConfig(newConfig)
    if(dbMode&&isSupabaseReady){
      const{error}=await supabase.from('centro_config').upsert(mapConfigToDB(newConfig),{onConflict:'id'})
      if(error)throw error
    }
  },[dbMode])

  return{config,saveConfig,dbMode}
}

// ─── HOOK: Plantilla editable de criterios de avance por fase ─────────────
// Antes: FASES_METODO.criterios_avance era texto fijo en el código, y
// checkCriteriosAvance() existía pero nunca se llamaba — no trababa nada.
// Ahora: plantilla editable en Supabase (una fila por fase), sincronizada
// entre dispositivos igual que el resto.
const SEED_CRITERIOS={
  restaura:[{id:'r1',texto:'EVA ≤ 3/10 en movimiento'},{id:'r2',texto:'ROM > 70% del normal'},{id:'r3',texto:'Fuerza ≥ 3/5 MRC'},{id:'r4',texto:'Control motor básico presente'},{id:'r5',texto:'Sin signos inflamatorios activos'}],
  activa:[{id:'a1',texto:'EVA ≤ 2/10'},{id:'a2',texto:'ROM > 85% del normal'},{id:'a3',texto:'Fuerza ≥ 4/5 MRC'},{id:'a4',texto:'Control motor funcional establecido'},{id:'a5',texto:'Y-Balance: asimetría < 6 cm'}],
  potencia:[{id:'p1',texto:'EVA ≤ 2/10'},{id:'p2',texto:'ROM > 90% del normal'},{id:'p3',texto:'Y-Balance: asimetría < 4 cm'},{id:'p4',texto:'FMS ≥ 14/21'},{id:'p5',texto:'Fuerza bilateral: asimetría < 10%'}],
}
export function useCriteriosAvanceTemplate(){
  const [template,setTemplate]=useState(SEED_CRITERIOS)
  const [loading,setLoading]=useState(true)

  const fetchTemplate=useCallback(async()=>{
    if(!isSupabaseReady){setLoading(false);return}
    try{
      const{data,error}=await supabase.from('criterios_avance_template').select('*')
      if(error)throw error
      if(data&&data.length>0){
        const t={}
        data.forEach(r=>{t[r.fase]=r.criterios||[]})
        setTemplate(prev=>({...prev,...t}))
      }
    }catch(e){console.error('criterios_avance_template fetch:',e.message)}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{
    fetchTemplate()
    if(!isSupabaseReady)return
    const ch=supabase.channel('crit_avance_rt_'+Math.random().toString(36).slice(2,6))
      .on('postgres_changes',{event:'*',schema:'public',table:'criterios_avance_template'},
        payload=>{ if(payload.new)setTemplate(prev=>({...prev,[payload.new.fase]:payload.new.criterios||[]})) })
      .subscribe()
    return()=>supabase.removeChannel(ch)
  },[fetchTemplate])

  const saveFase=useCallback(async(fase,criterios)=>{
    setTemplate(prev=>({...prev,[fase]:criterios}))
    if(isSupabaseReady){
      const{error}=await supabase.from('criterios_avance_template').upsert({fase,criterios,updated_at:new Date().toISOString()},{onConflict:'fase'})
      if(error)throw error
    }
  },[])

  return{template,loading,saveFase}
}
