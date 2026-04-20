import type { Session } from '@supabase/supabase-js'

export type UserRole = 'student' | 'teacher' | 'admin'
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise'

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: UserRole
  plan: PlanTier
  sessions_used: number
  sessions_limit: number
  onboarding_completed?: boolean
  learning_style?: string
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  full_name: string
}

export type OAuthProvider = 'google' | 'apple'
