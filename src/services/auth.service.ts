import { supabase } from '@/lib/supabase'
import type { LoginCredentials, OAuthProvider, RegisterCredentials, User } from '@/types/auth.types'

export const authService = {
  async signIn(credentials: LoginCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword(credentials)
    if (error) throw error
    return data
  },

  async signUp({ email, password, full_name }: RegisterCredentials) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    })
    if (error) throw error
    return data
  },

  async signInWithOAuth(provider: OAuthProvider) {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  async getProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as User
  },

  onAuthStateChange(
    callback: Parameters<typeof supabase.auth.onAuthStateChange>[0],
  ) {
    return supabase.auth.onAuthStateChange(callback)
  },
}
