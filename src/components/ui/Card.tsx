import React from 'react'
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native'
import { colors, borderRadius, spacing, shadows } from '@/constants/theme'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
  elevated?: boolean
}

export function Card({ children, onPress, style, elevated = false }: CardProps) {
  const containerStyle = [
    styles.card,
    elevated && styles.elevated,
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...containerStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    )
  }

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  elevated: {
    backgroundColor: colors.background.elevated,
    ...shadows.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
})
