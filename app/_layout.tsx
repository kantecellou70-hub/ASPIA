import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'
import { ToastContainer } from '@/components/ui/Toast'
import { useNetwork } from '@/hooks/useNetwork'
import { useOfflineSync } from '@/hooks/useOfflineSync'

export default function RootLayout() {
  const { setSession, setUser, setLoading } = useAuthStore()
  const { setSessionStats } = useSessionStore()
  const { setOnline, showToast, isOnline } = useUiStore()
  const { isOnline: networkIsOnline } = useNetwork()
  const prevOnlineRef = useRef<boolean>(true)

  // Propagation de l'état réseau dans le store global
  useEffect(() => {
    setOnline(networkIsOnline)

    if (prevOnlineRef.current && !networkIsOnline) {
      showToast({ type: 'warning', message: 'Mode hors-ligne activé' })
    } else if (!prevOnlineRef.current && networkIsOnline) {
      showToast({ type: 'success', message: 'Connexion rétablie' })
    }

    prevOnlineRef.current = networkIsOnline
  }, [networkIsOnline, setOnline, showToast])

  // Synchronisation des données en attente dès la reconnexion
  useOfflineSync()

  useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange(
      async (_event, session) => {
        setSession(session)

        if (session?.user) {
          try {
            const profile = await authService.getProfile(session.user.id)
            setUser(profile)
            setSessionStats(profile.sessions_used, profile.sessions_limit)
          } catch {
            // Profil absent ou table manquante — on garde la session active
            setUser(null)
          }
        } else {
          setUser(null)
          setLoading(false)
        }

        setLoading(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [setSession, setUser, setLoading, setSessionStats])

  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ToastContainer />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="circuit/[id]" />
          <Stack.Screen name="quiz/[id]" />
          <Stack.Screen name="quiz/results/[id]" />
          <Stack.Screen name="payment/plans" />
          <Stack.Screen name="payment/checkout" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="admin-users" />
          <Stack.Screen name="admin-user/[id]" />
          <Stack.Screen name="admin-payments" />
          <Stack.Screen name="admin-payment/[id]" />
        </Stack>
      </SafeAreaProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
