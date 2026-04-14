import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import type { Circuit } from '@/types/circuit.types'

export function useCircuit(circuitId?: string) {
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const [circuit, setCircuit] = useState<Circuit | null>(null)
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchCircuit = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('circuits')
        .select('*, steps:circuit_steps(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      setCircuit(data as Circuit)
    } catch {
      showToast({ type: 'error', message: 'Impossible de charger le circuit' })
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  const fetchUserCircuits = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('circuits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCircuits((data ?? []) as Circuit[])
    } catch {
      showToast({ type: 'error', message: 'Impossible de charger les circuits' })
    } finally {
      setIsLoading(false)
    }
  }, [user, showToast])

  const markStepCompleted = useCallback(async (stepId: string) => {
    const { error } = await supabase
      .from('circuit_steps')
      .update({ is_completed: true })
      .eq('id', stepId)

    if (error) {
      showToast({ type: 'error', message: 'Erreur lors de la mise à jour' })
      return
    }

    setCircuit((prev) => {
      if (!prev?.steps) return prev
      const steps = prev.steps.map((s) =>
        s.id === stepId ? { ...s, is_completed: true } : s,
      )
      const completedSteps = steps.filter((s) => s.is_completed).length
      return {
        ...prev,
        steps,
        completed_steps: completedSteps,
        status: completedSteps === prev.total_steps ? 'completed' : 'in_progress',
      }
    })
  }, [showToast])

  useEffect(() => {
    if (circuitId) fetchCircuit(circuitId)
  }, [circuitId, fetchCircuit])

  return {
    circuit,
    circuits,
    isLoading,
    fetchCircuit,
    fetchUserCircuits,
    markStepCompleted,
  }
}
