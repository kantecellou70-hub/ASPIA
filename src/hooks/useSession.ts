import { useCallback } from 'react'
import { router } from 'expo-router'
import { profileService } from '@/services/profile.service'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

export function useSession() {
  const { user } = useAuthStore()
  const { sessionsUsed, sessionsLimit, sessionsRemaining, incrementUsed } = useSessionStore()
  const { showToast } = useUiStore()

  const hasSessionsLeft = sessionsRemaining > 0

  const consumeSession = useCallback(async (): Promise<boolean> => {
    if (!user) return false

    if (!hasSessionsLeft) {
      showToast({
        type: 'warning',
        message: 'Sessions épuisées. Passez à un plan supérieur.',
      })
      router.push('/payment/plans')
      return false
    }

    // Le décompte réel est géré côté serveur dans les Edge Functions.
    // On fait uniquement une mise à jour optimiste du store pour l'UI.
    incrementUsed()
    return true
  }, [user, hasSessionsLeft, incrementUsed, showToast])

  const refreshStats = useCallback(async () => {
    if (!user) return
    const { setSessionStats } = useSessionStore.getState()
    try {
      const profile = await profileService.getProfile(user.id)
      setSessionStats(profile.sessions_used, profile.sessions_limit)
    } catch {
      // silently fail — non-critical
    }
  }, [user])

  return {
    sessionsUsed,
    sessionsLimit,
    sessionsRemaining,
    hasSessionsLeft,
    consumeSession,
    refreshStats,
  }
}
