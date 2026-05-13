// supabase.js — Cliente de Supabase
// Las variables de entorno se configuran en Vercel (Settings → Environment Variables)
// Para desarrollo local: crear archivo .env.local con estas variables

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️ Faltan las variables de entorno de Supabase. Verificar .env.local o Vercel Environment Variables.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export default supabase
