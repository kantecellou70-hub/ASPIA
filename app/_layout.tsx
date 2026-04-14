import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'

export default function RootLayout() {
  const { setSession, setUser, setLoading } = useAuthStore()
  const { setSessionStats } = useSessionStore()

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
    <View style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="circuit/[id]" />
          <Stack.Screen name="quiz/[id]" />
          <Stack.Screen name="quiz/results/[id]" />
          <Stack.Screen name="payment/plans" />
          <Stack.Screen name="payment/checkout" />
        </Stack>
      </SafeAreaProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
