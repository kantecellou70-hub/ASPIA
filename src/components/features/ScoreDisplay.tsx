import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { QuizResult } from '@/types/quiz.types'
import { formatDuration } from '@/utils/formatters'

interface ScoreDisplayProps {
  result: QuizResult
}

export function ScoreDisplay({ result }: ScoreDisplayProps) {
  const passed = result.passed
  const color = passed ? colors.accent.success : colors.accent.error
  const emoji = passed ? '🎉' : '📚'

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>

      <View style={[styles.scoreCircle, { borderColor: color }]}>
        <AnimatedCounter
          value={result.score}
          suffix="%"
          style={[styles.scoreText, { color } as const]}
        />
        <Text style={styles.scoreLabel}>{passed ? 'Réussi !' : 'À réviser'}</Text>
      </View>

      <View style={styles.stats}>
        <StatItem
          label="Bonnes réponses"
          value={`${result.correct_answers}/${result.total_questions}`}
          color={colors.accent.success}
        />
        <StatItem
          label="Temps"
          value={formatDuration(result.time_taken_seconds)}
          color={colors.accent.info}
        />
        <StatItem
          label="Score"
          value={`${result.score}%`}
          color={color}
        />
      </View>
    </View>
  )
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  emoji: {
    fontSize: 56,
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    gap: spacing.xs,
  },
  scoreText: {
    ...textStyles.display,
    fontWeight: '800',
  },
  scoreLabel: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...textStyles.h3,
    fontWeight: '700',
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
