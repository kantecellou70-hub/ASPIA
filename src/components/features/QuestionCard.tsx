import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { OptionButton } from './OptionButton'
import type { QuizQuestion } from '@/types/quiz.types'

interface QuestionCardProps {
  question: QuizQuestion
  index: number
  total: number
  selectedOptionId: string | undefined
  onSelectOption: (optionId: string) => void
  showResult?: boolean
}

export function QuestionCard({
  question,
  index,
  total,
  selectedOptionId,
  onSelectOption,
  showResult = false,
}: QuestionCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.meta}>
        <Text style={styles.counter}>
          Question {index + 1} / {total}
        </Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.question}>{question.question}</Text>

      <View style={styles.options}>
        {question.options.map((option) => (
          <OptionButton
            key={option.id}
            label={option.text}
            selected={selectedOptionId === option.id}
            correct={showResult ? option.is_correct : undefined}
            wrong={showResult && selectedOptionId === option.id && !option.is_correct ? true : undefined}
            onPress={() => !showResult && onSelectOption(option.id)}
          />
        ))}
      </View>

      {showResult && question.explanation && (
        <View style={styles.explanation}>
          <Text style={styles.explanationLabel}>💡 Explication</Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  meta: {
    gap: spacing.sm,
  },
  counter: {
    ...textStyles.label,
    color: colors.text.muted,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.default,
  },
  dotActive: {
    backgroundColor: colors.accent.primary,
    width: 20,
  },
  question: {
    ...textStyles.h3,
    color: colors.text.primary,
    lineHeight: 28,
  },
  options: {
    gap: spacing.sm,
  },
  explanation: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  explanationLabel: {
    ...textStyles.label,
    color: colors.accent.info,
  },
  explanationText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
})
