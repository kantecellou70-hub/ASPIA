import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import type { CircuitStep } from '@/types/circuit.types'

interface StepItemProps {
  step: CircuitStep
  onMarkCompleted: (stepId: string) => void
  isLocked?: boolean
}

export function StepItem({ step, onMarkCompleted, isLocked = false }: StepItemProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <View style={[styles.container, step.is_completed && styles.completed]}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.stepBadge, step.is_completed && styles.stepBadgeDone, isLocked && styles.stepBadgeLocked]}>
          {isLocked ? (
            <Ionicons name="lock-closed" size={14} color={colors.text.muted} />
          ) : step.is_completed ? (
            <Ionicons name="checkmark" size={14} color="#fff" />
          ) : (
            <Text style={styles.stepNumber}>{step.order}</Text>
          )}
        </View>

        <Text style={[styles.title, isLocked && styles.lockedText]} numberOfLines={2}>
          {step.title}
        </Text>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.text.muted}
        />
      </Pressable>

      {expanded && !isLocked && (
        <View style={styles.body}>
          <Text style={styles.content}>{step.content}</Text>

          {step.key_concepts.length > 0 && (
            <View style={styles.concepts}>
              <Text style={styles.conceptsLabel}>Concepts clés</Text>
              <View style={styles.conceptsRow}>
                {step.key_concepts.map((concept, i) => (
                  <View key={i} style={styles.conceptChip}>
                    <Text style={styles.conceptText}>{concept}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!step.is_completed && (
            <Pressable
              onPress={() => onMarkCompleted(step.id)}
              style={styles.completeButton}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.accent.success} />
              <Text style={styles.completeButtonText}>Marquer comme terminé</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  completed: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
    backgroundColor: 'rgba(34, 197, 94, 0.03)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.surface,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeDone: {
    backgroundColor: colors.accent.success,
    borderColor: colors.accent.success,
  },
  stepBadgeLocked: {
    backgroundColor: colors.background.elevated,
  },
  stepNumber: {
    ...textStyles.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  title: {
    ...textStyles.body,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '600',
  },
  lockedText: {
    color: colors.text.muted,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  content: {
    ...textStyles.body,
    color: colors.text.secondary,
    lineHeight: 22,
    paddingTop: spacing.md,
  },
  concepts: {
    gap: spacing.sm,
  },
  conceptsLabel: {
    ...textStyles.label,
    color: colors.text.muted,
  },
  conceptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  conceptChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  conceptText: {
    ...textStyles.caption,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  completeButtonText: {
    ...textStyles.label,
    color: colors.accent.success,
  },
})
