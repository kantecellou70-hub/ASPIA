import { supabase } from '@/lib/supabase'
import type { User } from '@/types/auth.types'

export const profileService = {
  async getProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data as User
  },

  async updateProfile(userId: string, updates: Partial<Pick<User, 'full_name' | 'avatar_url'>>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data as User
  },

  async incrementSessionsUsed(userId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_sessions_used', {
      user_id: userId,
    })

    if (error) throw error
  },

  async getSessionsRemaining(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('profiles')
      .select('sessions_used, sessions_limit')
      .eq('id', userId)
      .single()

    if (error) throw error
    const { sessions_used, sessions_limit } = data as Pick<User, 'sessions_used' | 'sessions_limit'>
    return Math.max(0, sessions_limit - sessions_used)
  },
}
