import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { User } from '@/types/auth.types'

interface AuthStore {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean

  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (isLoading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  setSession: (session) =>
    set({ session, isAuthenticated: session !== null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () =>
    set({ user: null, session: null, isAuthenticated: false, isLoading: false }),
}))
