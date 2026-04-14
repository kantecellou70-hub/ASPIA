import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { useSession } from '@/hooks/useSession'

export function SessionCounter() {
  const { sessionsRemaining, sessionsLimit, hasSessionsLeft } = useSession()
  const isLow = sessionsRemaining <= 1
  const isEmpty = sessionsRemaining === 0
  const isUnlimited = sessionsLimit === Infinity

  const color = isEmpty
    ? colors.accent.error
    : isLow
    ? colors.accent.warning
    : colors.accent.success

  return (
    <Pressable
      onPress={() => router.push('/payment/plans')}
      style={[styles.container, { borderColor: `${color}40`, backgroundColor: `${color}10` }]}
    >
      <Ionicons name="flash" size={14} color={color} />
      <Text style={[styles.text, { color }]}>
        {isUnlimited ? '∞ sessions' : `${sessionsRemaining} session${sessionsRemaining > 1 ? 's' : ''}`}
      </Text>
      {(isLow || isEmpty) && !isUnlimited && (
        <Ionicons name="chevron-forward" size={12} color={color} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  text: {
    ...textStyles.label,
    fontSize: 12,
  },
})
