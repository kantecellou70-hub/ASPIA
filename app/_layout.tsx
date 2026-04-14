import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'

export default function RootLayout() {
  const { setSession, setUser, setLoading } = useAuthStore()
  const { setSessionStats } = useSessionStore()

  useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        setSession(session)

        if (session?.user) {
          try {
            const profile = await authService.getProfile(session.user.id)
            setUser(profile)
            setSessionStats(profile.sessions_used, profile.sessions_limit)
          } catch {
            setUser(null)
          }
        } else {
          setUser(null)
        }

        setLoading(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [setSession, setUser, setLoading, setSessionStats])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="circuit/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="quiz/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="quiz/results/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="payment/plans"
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="payment/checkout"
            options={{ animation: 'slide_from_bottom' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
