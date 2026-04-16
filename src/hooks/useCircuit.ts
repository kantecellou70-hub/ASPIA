import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { useOfflineStore } from '@/store/offlineStore'
import {
  cacheCircuit,
  getCachedCircuit,
  cacheUserCircuits,
  getCachedUserCircuits,
  patchCachedCircuitStep,
} from '@/lib/offlineCache'
import type { Circuit } from '@/types/circuit.types'

export function useCircuit(circuitId?: string) {
  const { user } = useAuthStore()
  const { showToast, isOnline } = useUiStore()
  const { enqueuePendingStep } = useOfflineStore()
  const [circuit, setCircuit] = useState<Circuit | null>(null)
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)

  const fetchCircuit = useCallback(async (id: string) => {
    setIsLoading(true)

    // Mode hors-ligne : charger depuis le cache
    if (!isOnline) {
      const cached = await getCachedCircuit(id)
      if (cached) {
        setCircuit(cached)
        setIsFromCache(true)
      } else {
        showToast({ type: 'error', message: 'Circuit non disponible hors-ligne' })
      }
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('circuits')
        .select('*, steps:circuit_steps(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      const c = data as Circuit
      setCircuit(c)
      setIsFromCache(false)
      // Mise en cache pour consultation hors-ligne ultérieure
      cacheCircuit(c).catch(() => null)
    } catch {
      // Tenter le cache en fallback si la requête échoue
      const cached = await getCachedCircuit(id)
      if (cached) {
        setCircuit(cached)
        setIsFromCache(true)
        showToast({ type: 'info', message: 'Affichage depuis le cache local' })
      } else {
        showToast({ type: 'error', message: 'Impossible de charger le circuit' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [showToast, isOnline])

  const fetchUserCircuits = useCallback(async () => {
    if (!user) return
    setIsLoading(true)

    // Mode hors-ligne : charger depuis le cache
    if (!isOnline) {
      const cached = await getCachedUserCircuits(user.id)
      if (cached) {
        setCircuits(cached)
        setIsFromCache(true)
      } else {
        showToast({ type: 'info', message: 'Aucun circuit disponible hors-ligne' })
      }
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('circuits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      const list = (data ?? []) as Circuit[]
      setCircuits(list)
      setIsFromCache(false)
      cacheUserCircuits(user.id, list).catch(() => null)
    } catch {
      const cached = await getCachedUserCircuits(user.id)
      if (cached) {
        setCircuits(cached)
        setIsFromCache(true)
        showToast({ type: 'info', message: 'Affichage depuis le cache local' })
      } else {
        showToast({ type: 'error', message: 'Impossible de charger les circuits' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [user, showToast, isOnline])

  const markStepCompleted = useCallback(async (stepId: string) => {
    // Mise à jour optimiste de l'état local (online ou offline)
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

    // Calcule les nouveaux compteurs depuis l'état courant
    const updatedSteps = (circuit?.steps ?? []).map((s) =>
      s.id === stepId ? { ...s, is_completed: true } : s,
    )
    const newCompletedCount = updatedSteps.filter((s) => s.is_completed).length
    const newStatus = newCompletedCount === (circuit?.total_steps ?? 0) ? 'completed' : 'in_progress'

    if (!isOnline) {
      // Mise en file d'attente pour sync ultérieure
      if (circuit?.id) {
        enqueuePendingStep({ stepId, circuitId: circuit.id })
        if (circuit?.id) patchCachedCircuitStep(circuit.id, stepId).catch(() => null)
      }
      showToast({ type: 'info', message: 'Progression enregistrée — synchronisation à la reconnexion' })
      return
    }

    const { error } = await supabase
      .from('circuit_steps')
      .update({ is_completed: true })
      .eq('id', stepId)

    if (error) {
      showToast({ type: 'error', message: 'Erreur lors de la mise à jour' })
      // Rollback
      setCircuit((prev) => {
        if (!prev?.steps) return prev
        const steps = prev.steps.map((s) =>
          s.id === stepId ? { ...s, is_completed: false } : s,
        )
        return { ...prev, steps }
      })
      return
    }

    // Persiste le statut et le compteur du circuit en DB
    if (circuit?.id) {
      await supabase
        .from('circuits')
        .update({ completed_steps: newCompletedCount, status: newStatus })
        .eq('id', circuit.id)

      patchCachedCircuitStep(circuit.id, stepId).catch(() => null)
    }
  }, [showToast, isOnline, circuit, enqueuePendingStep])

  useEffect(() => {
    if (circuitId) fetchCircuit(circuitId)
  }, [circuitId, fetchCircuit])

  return {
    circuit,
    circuits,
    isLoading,
    isFromCache,
    fetchCircuit,
    fetchUserCircuits,
    markStepCompleted,
  }
}
