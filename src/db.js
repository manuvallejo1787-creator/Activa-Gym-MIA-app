// db.js — Capa de datos: CRUD + tiempo real
// Todas las operaciones de base de datos centralizadas aquí

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'

// ─── HOOK: Clientes del Gym ────────────────────────────────────────────────
export function useGymClients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar datos iniciales
  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('gym_clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); return }
    setClients(mapClientsFromDB(data || []))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchClients()

    // Tiempo real: escuchar cambios en la tabla
    const channel = supabase
      .channel('gym_clients_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gym_clients'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setClients(prev => [mapClientFromDB(payload.new), ...prev])
        }
        if (payload.eventType === 'UPDATE') {
          setClients(prev => prev.map(c =>
            c.id === payload.new.id ? mapClientFromDB(payload.new) : c
          ))
        }
        if (payload.eventType === 'DELETE') {
          setClients(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchClients])

  // Guardar o actualizar cliente
  const saveClient = useCallback(async (client) => {
    const row = mapClientToDB(client)
    const { error } = await supabase
      .from('gym_clients')
      .upsert(row, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }, [])

  // Eliminar cliente
  const deleteClient = useCallback(async (id) => {
    const { error } = await supabase
      .from('gym_clients')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }, [])

  // Actualizar campos específicos (para sincronización con FisioActiva)
  const updateClient = useCallback(async (id, updates) => {
    const { error } = await supabase
      .from('gym_clients')
      .update(mapClientUpdatesToDB(updates))
      .eq('id', id)
    if (error) throw new Error(error.message)
  }, [])

  return { clients, loading, error, saveClient, deleteClient, updateClient, refetch: fetchClients }
}

// ─── HOOK: Pacientes FisioActiva ───────────────────────────────────────────
export function useFisioPacientes() {
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPacientes = useCallback(async () => {
    // Cargar pacientes con sus evaluaciones
    const { data: pacs, error: e1 } = await supabase
      .from('fisio_pacientes')
      .select('*')
      .order('created_at', { ascending: false })
    if (e1) { setError(e1.message); return }

    const { data: evals, error: e2 } = await supabase
      .from('fisio_evaluaciones')
      .select('*')
      .order('created_at', { ascending: true })
    if (e2) { setError(e2.message); return }

    // Combinar pacientes con sus evaluaciones
    const combined = (pacs || []).map(p => ({
      ...mapPacienteFromDB(p),
      evaluaciones: (evals || [])
        .filter(e => e.paciente_id === p.id)
        .map(mapEvalFromDB)
    }))

    setPacientes(combined)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPacientes()

    // Tiempo real: pacientes
    const chanPac = supabase
      .channel('fisio_pacientes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fisio_pacientes' },
        () => fetchPacientes()
      ).subscribe()

    // Tiempo real: evaluaciones
    const chanEval = supabase
      .channel('fisio_evaluaciones_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fisio_evaluaciones' },
        () => fetchPacientes()
      ).subscribe()

    return () => {
      supabase.removeChannel(chanPac)
      supabase.removeChannel(chanEval)
    }
  }, [fetchPacientes])

  // Guardar o actualizar paciente
  const savePaciente = useCallback(async (paciente) => {
    const row = mapPacienteToDB(paciente)
    const { error } = await supabase
      .from('fisio_pacientes')
      .upsert(row, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }, [])

  // Eliminar paciente (cascada elimina evaluaciones)
  const deletePaciente = useCallback(async (id) => {
    const { error } = await supabase
      .from('fisio_pacientes')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }, [])

  // Guardar evaluación
  const saveEvaluacion = useCallback(async (pacienteId, eval_) => {
    const row = mapEvalToDB(pacienteId, eval_)
    const { error } = await supabase
      .from('fisio_evaluaciones')
      .upsert(row, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }, [])

  return { pacientes, loading, error, savePaciente, deletePaciente, saveEvaluacion, refetch: fetchPacientes }
}

// ─── MAPPERS: DB → App ────────────────────────────────────────────────────
// Convierten el formato de la DB al formato que usa la app

function mapClientFromDB(row) {
  return {
    id:                    row.id,
    nombre:                row.nombre || '',
    apellido:              row.apellido || '',
    documento:             row.documento || '',
    celular:               row.celular || '',
    nivel:                 row.nivel || 'activa',
    semaforo:              row.semaforo || 'pendiente',
    restricciones:         row.restricciones || '',
    restricciones_flags:   row.restricciones_flags || { impacto: false, overhead: false, cargaAxial: false },
    objetivo:              row.objetivo || '',
    criterios_personalizados: row.criterios_personalizados || [],
    fechaIngreso:          row.fecha_ingreso || '',
    fechaEval:             row.fecha_eval || '',
    notasInternas:         row.notas_internas || '',
    screeningCompleto:     row.screening_completo || false,
    screening:             row.screening || {},
    fisio_pacienteId:      row.fisio_paciente_id || null,
  }
}

function mapClientsFromDB(rows) {
  return rows.map(mapClientFromDB)
}

function mapClientToDB(client) {
  return {
    id:                    client.id,
    nombre:                client.nombre,
    apellido:              client.apellido,
    documento:             client.documento || null,
    celular:               client.celular || null,
    nivel:                 client.nivel || 'activa',
    semaforo:              client.semaforo || 'pendiente',
    restricciones:         client.restricciones || '',
    restricciones_flags:   client.restricciones_flags || { impacto: false, overhead: false, cargaAxial: false },
    objetivo:              client.objetivo || '',
    criterios_personalizados: client.criterios_personalizados || [],
    fecha_ingreso:         client.fechaIngreso || null,
    fecha_eval:            client.fechaEval || null,
    notas_internas:        client.notasInternas || '',
    screening_completo:    client.screeningCompleto || false,
    screening:             client.screening || {},
    fisio_paciente_id:     client.fisio_pacienteId || null,
  }
}

function mapClientUpdatesToDB(updates) {
  const mapped = {}
  if (updates.nivel !== undefined)                mapped.nivel = updates.nivel
  if (updates.semaforo !== undefined)             mapped.semaforo = updates.semaforo
  if (updates.restricciones !== undefined)        mapped.restricciones = updates.restricciones
  if (updates.restricciones_flags !== undefined)  mapped.restricciones_flags = updates.restricciones_flags
  if (updates.fechaEval !== undefined)            mapped.fecha_eval = updates.fechaEval
  if (updates.screeningCompleto !== undefined)    mapped.screening_completo = updates.screeningCompleto
  if (updates.notasInternas !== undefined)        mapped.notas_internas = updates.notasInternas
  if (updates.objetivo !== undefined)             mapped.objetivo = updates.objetivo
  return mapped
}

function mapPacienteFromDB(row) {
  return {
    id:            row.id,
    nombre:        row.nombre || '',
    apellido:      row.apellido || '',
    documento:     row.documento || '',
    celular:       row.celular || '',
    email:         row.email || '',
    fechaNac:      row.fecha_nac || '',
    genero:        row.genero || '',
    region:        row.region || 'lumbar',
    derivadoPor:   row.derivado_por || '',
    gym_clienteId: row.gym_cliente_id || null,
    notas:         row.notas || '',
    activo:        row.activo !== false,
    evaluaciones:  [],
  }
}

function mapPacienteToDB(p) {
  return {
    id:             p.id,
    nombre:         p.nombre,
    apellido:       p.apellido,
    documento:      p.documento || null,
    celular:        p.celular || null,
    email:          p.email || null,
    fecha_nac:      p.fechaNac || null,
    genero:         p.genero || null,
    region:         p.region || 'lumbar',
    derivado_por:   p.derivadoPor || null,
    gym_cliente_id: p.gym_clienteId || null,
    notas:          p.notas || '',
    activo:         p.activo !== false,
  }
}

function mapEvalFromDB(row) {
  const data = row.data || {}
  return {
    id:                       row.id,
    fecha:                    row.fecha || '',
    tipo:                     row.tipo || 'inicial',
    region:                   row.region || 'lumbar',
    evaluador:                row.evaluador || '',
    fase:                     row.fase || 'restaura',
    objetivo:                 row.objetivo || '',
    eva_reposo:               row.eva_reposo || '',
    eva_movimiento:           data.eva_movimiento || '',
    diagnosticoPT:            row.diagnostico_pt || '',
    plan:                     row.plan || '',
    criterios_personalizados: row.criterios_personalizados || [],
    // Todos los campos del formulario están en data (JSONB)
    ...data,
  }
}

function mapEvalToDB(pacienteId, eval_) {
  // Separar los campos indexados de los datos completos
  const {
    id, fecha, tipo, region, evaluador, fase, objetivo,
    eva_reposo, diagnosticoPT, plan, criterios_personalizados,
    ...rest
  } = eval_

  return {
    id:                       id || 'eval_' + Date.now(),
    paciente_id:              pacienteId,
    fecha:                    fecha || new Date().toISOString().split('T')[0],
    tipo:                     tipo || 'inicial',
    region:                   region || 'lumbar',
    evaluador:                evaluador || null,
    fase:                     fase || 'restaura',
    objetivo:                 objetivo || null,
    eva_reposo:               eva_reposo || null,
    diagnostico_pt:           diagnosticoPT || null,
    plan:                     plan || null,
    criterios_personalizados: criterios_personalizados || [],
    // El objeto completo va en data para no perder ningún campo
    data: { ...rest, eva_reposo, objetivo, diagnosticoPT, plan },
  }
}

// ─── HELPER: generar ID único ─────────────────────────────────────────────
export const genId = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
