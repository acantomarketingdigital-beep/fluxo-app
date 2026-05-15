import { createClient } from '@supabase/supabase-js'

export const SUPABASE_SCHEMA = 'public'
export const FLUXO_DATA_TABLES = Object.freeze([
  'incomes',
  'expenses',
  'cards',
  'transactions',
])

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: SUPABASE_SCHEMA,
      },
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null

export function fromPublicTable(tableName) {
  if (!supabase) {
    return null
  }

  return supabase.schema(SUPABASE_SCHEMA).from(tableName)
}
