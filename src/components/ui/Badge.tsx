import React from 'react'
import { StyleSheet, Text, View, ViewStyle } from 'react-native'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  size?: BadgeSize
  style?: ViewStyle
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: 'rgba(59, 130, 246, 0.15)', text: colors.accent.primary },
  success: { bg: 'rgba(34, 197, 94, 0.15)', text: colors.accent.success },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', text: colors.accent.warning },
  error: { bg: 'rgba(239, 68, 68, 0.15)', text: colors.accent.error },
  info: { bg: 'rgba(6, 182, 212, 0.15)', text: colors.accent.info },
  muted: { bg: colors.background.surface, text: colors.text.muted },
}

export function Badge({ label, variant = 'primary', size = 'md', style }: BadgeProps) {
  const { bg, text } = variantColors[variant]

  return (
    <View style={[styles.base, styles[size], { backgroundColor: bg }, style]}>
      <Text style={[styles.label, styles[`label_${size}`], { color: text }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
  sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  md: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
  },
  label: {
    fontWeight: '600',
  },
  label_sm: {
    ...textStyles.caption,
    fontWeight: '600',
  },
  label_md: {
    ...textStyles.bodySmall,
    fontWeight: '600',
  },
})
