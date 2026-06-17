// supabase.js — Cliente robusto, nunca crashea la app
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient = null

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
    console.log('✅ Supabase conectado:', SUPABASE_URL)
  } else {
    console.warn('⚠️ Variables Supabase no encontradas — modo local activo')
  }
} catch (e) {
  console.error('Error inicializando Supabase:', e.message)
  supabaseClient = null
}

export const supabase = supabaseClient
export const isSupabaseReady = supabaseClient !== null
