import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { invokeWithAuth } from '@/lib/invoke'

export interface LearningProfile {
  id: string
  user_id: string
  niveau?: string
  filiere?: string
  ville?: string
  objectif?: string
  learning_style?: string
  available_time?: string
  subjects?: string[]
  difficulties?: string[]
  strengths?: string[]
  weaknesses?: string[]
  ai_recommendations?: {
    recommendations: { title: string; description: string; priority: string }[]
    study_plan: string
    motivational_message: string
  }
  analyzed_at?: string
}

export interface OnboardingData {
  niveau?: string
  filiere?: string
  ville?: string
  objectif?: string
  learning_style?: string
  available_time?: string
  subjects?: string[]
  difficulties?: string[]
}

export function useLearningProfile() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<LearningProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const { data, error: dbErr } = await supabase
        .from('learning_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (dbErr && dbErr.code !== 'PGRST116') throw dbErr
      setProfile((data as LearningProfile) ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const analyzeProfile = useCallback(async (data: OnboardingData) => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const { data: result, error: fnErr } = await invokeWithAuth('analyze-learning-profile', data as Record<string, unknown>)
      if (fnErr) throw fnErr
      await fetchProfile()
      return result
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setIsAnalyzing(false)
    }
  }, [fetchProfile])

  const updateAfterQuiz = useCallback(async (circuitId: string, score: number, subject?: string) => {
    try {
      await invokeWithAuth('update-learning-profile', {
        circuit_id: circuitId,
        score,
        subject,
      })
      await fetchProfile()
    } catch (e) {
      console.warn('updateAfterQuiz failed:', e)
    }
  }, [fetchProfile])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    isLoading,
    isAnalyzing,
    error,
    fetchProfile,
    analyzeProfile,
    updateAfterQuiz,
  }
}
