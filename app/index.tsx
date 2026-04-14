import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '@/store/authStore'
import { colors } from '@/constants/theme'

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
      </View>
    )
  }

  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/welcome'} />
}
