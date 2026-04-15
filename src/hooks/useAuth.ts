import { useState } from 'react'
import { router } from 'expo-router'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import type { LoginCredentials, OAuthProvider, RegisterCredentials } from '@/types/auth.types'

export function useAuth() {
  const { user, session, isLoading, isAuthenticated } = useAuthStore()
  const { setUser, setSession, reset } = useAuthStore()
  const { showToast } = useUiStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function signIn(credentials: LoginCredentials) {
    setIsSubmitting(true)
    try {
      const data = await authService.signIn(credentials)
      if (data.user) {
        setSession(data.session)
        try {
          const profile = await authService.getProfile(data.user.id)
          setUser(profile)
        } catch {
          // Profil absent (migration non appliquée) — on navigue quand même
        }
        router.replace('/(tabs)/home')
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.includes('Email not confirmed')
          ? 'Veuillez confirmer votre email avant de vous connecter'
          : 'Email ou mot de passe incorrect'
      showToast({ type: 'error', message })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signUp(credentials: RegisterCredentials) {
    setIsSubmitting(true)
    try {
      await authService.signUp(credentials)
      showToast({
        type: 'success',
        message: 'Compte créé ! Vérifiez votre email.',
      })
      router.replace('/(auth)/login')
    } catch (err) {
      showToast({ type: 'error', message: 'Impossible de créer le compte' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signInWithOAuth(provider: OAuthProvider) {
    setIsSubmitting(true)
    try {
      await authService.signInWithOAuth(provider)
    } catch (err) {
      showToast({ type: 'error', message: 'Connexion OAuth échouée' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signOut() {
    try {
      await authService.signOut()
      reset()
      router.replace('/(auth)/welcome')
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur lors de la déconnexion' })
    }
  }

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    isSubmitting,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
  }
}
