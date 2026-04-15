import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadService } from '@/services/upload.service'
import { aiService } from '@/services/ai.service'
import { quizService } from '@/services/quiz.service'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { useOfflineStore } from '@/store/offlineStore'
import { useSession } from './useSession'

/**
 * Synchronise les données en file d'attente dès que le réseau est rétabli.
 * À appeler une seule fois dans _layout.tsx.
 */
export function useOfflineSync() {
  const { user } = useAuthStore()
  const { isOnline, showToast } = useUiStore()
  const { uploadQueue, pendingAttempts, pendingStepCompletions, dequeueUpload, dequeuePendingAttempt, dequeuePendingStep } =
    useOfflineStore()
  const { consumeSession } = useSession()
  const wasOfflineRef = useRef<boolean>(!isOnline)

  useEffect(() => {
    const justReconnected = wasOfflineRef.current && isOnline
    wasOfflineRef.current = !isOnline

    if (!justReconnected || !user) return

    const total = uploadQueue.length + pendingAttempts.length + pendingStepCompletions.length
    if (total === 0) return

    showToast({
      type: 'info',
      message: `Réseau rétabli — synchronisation de ${total} action(s)...`,
    })

    // ── 1. Synchroniser les étapes de circuit ──────────────────────────────────
    pendingStepCompletions.forEach(async ({ id, stepId }) => {
      try {
        await supabase
          .from('circuit_steps')
          .update({ is_completed: true })
          .eq('id', stepId)
        dequeuePendingStep(id)
      } catch {
        // Sera retentée à la prochaine reconnexion
      }
    })

    // ── 2. Synchroniser les tentatives de quiz ─────────────────────────────────
    pendingAttempts.forEach(async ({ id, quizId, answers, timeTaken }) => {
      try {
        const attempt = await quizService.startAttempt(quizId, user.id)
        await quizService.submitAttempt(attempt.id, answers, timeTaken)
        dequeuePendingAttempt(id)
      } catch {
        // Sera retentée à la prochaine reconnexion
      }
    })

    // ── 3. Traiter la file d'upload ────────────────────────────────────────────
    if (uploadQueue.length > 0) {
      processUploadQueue()
    }

    async function processUploadQueue() {
      let processed = 0

      for (const queued of uploadQueue) {
        if (queued.userId !== user!.id) continue

        try {
          const sessionGranted = await consumeSession()
          if (!sessionGranted) break // quota épuisé

          const document = await uploadService.uploadDocument(queued.file, user!.id, () => null)
          await aiService.analyzeDocument(document.id)
          await aiService.generateCircuit(document.id)
          dequeueUpload(queued.id)
          processed++
        } catch {
          // On laisse dans la queue, sera retentée à la prochaine reconnexion
        }
      }

      if (processed > 0) {
        showToast({
          type: 'success',
          message: `${processed} document(s) traité(s) — retrouvez-les dans votre bibliothèque`,
        })
      }
    }
  }, [
    isOnline,
    user,
    uploadQueue,
    pendingAttempts,
    pendingStepCompletions,
    showToast,
    dequeueUpload,
    dequeuePendingAttempt,
    dequeuePendingStep,
    consumeSession,
  ])
}
