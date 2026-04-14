import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { APP_CONFIG } from '@/constants/config'
import { supabaseStorage } from './storage'

const supabaseUrl = APP_CONFIG.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = APP_CONFIG.SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: supabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export const isSupabaseConfigured =
  APP_CONFIG.SUPABASE_URL !== '' &&
  APP_CONFIG.SUPABASE_URL !== 'https://placeholder.supabase.co'
