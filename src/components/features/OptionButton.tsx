import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'

interface OptionButtonProps {
  label: string
  selected?: boolean
  correct?: boolean
  wrong?: boolean
  onPress: () => void
}

export function OptionButton({ label, selected, correct, wrong, onPress }: OptionButtonProps) {
  const textColor = correct
    ? colors.accent.success
    : wrong
    ? colors.accent.error
    : selected
    ? colors.accent.primary
    : colors.text.secondary

  const icon = correct ? (
    <Ionicons name="checkmark-circle" size={20} color={colors.accent.success} />
  ) : wrong ? (
    <Ionicons name="close-circle" size={20} color={colors.accent.error} />
  ) : selected ? (
    <Ionicons name="radio-button-on" size={20} color={colors.accent.primary} />
  ) : (
    <Ionicons name="radio-button-off" size={20} color={colors.text.muted} />
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        correct && styles.correct,
        wrong && styles.wrong,
        selected && !correct && !wrong && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  selected: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  correct: {
    borderColor: colors.accent.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  wrong: {
    borderColor: colors.accent.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  label: {
    ...textStyles.body,
    flex: 1,
  },
})
