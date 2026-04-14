import React from 'react'
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native'
import { colors, borderRadius, spacing } from '@/constants/theme'

interface GlassCardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
  intensity?: 'light' | 'medium' | 'dark'
}

export function GlassCard({
  children,
  onPress,
  style,
  intensity = 'medium',
}: GlassCardProps) {
  const containerStyle = [styles.glass, styles[intensity], style]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    )
  }

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glass.border,
    overflow: 'hidden',
  },
  light: {
    backgroundColor: 'rgba(22, 40, 64, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  medium: {
    backgroundColor: colors.glass.background,
    borderColor: colors.glass.border,
  },
  dark: {
    backgroundColor: 'rgba(7, 16, 26, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
})
