import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import type { OAuthProvider } from '@/types/auth.types'

const providers: Record<
  OAuthProvider,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  google: { label: 'Continuer avec Google', icon: 'logo-google', color: '#EA4335' },
  apple: { label: 'Continuer avec Apple', icon: 'logo-apple', color: '#fff' },
}

interface SocialLoginButtonProps {
  provider: OAuthProvider
  onPress: () => void
  loading?: boolean
}

export function SocialLoginButton({ provider, onPress, loading = false }: SocialLoginButtonProps) {
  const { label, icon, color } = providers[provider]

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text.primary} />
      ) : (
        <>
          <Ionicons name={icon} size={20} color={color} />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...textStyles.button,
    color: colors.text.primary,
  },
})
