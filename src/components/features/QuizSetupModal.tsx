import React, { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Button } from '@/components/ui/Button'
import { aiService } from '@/services/ai.service'
import { useUiStore } from '@/store/uiStore'
import type { QuizDifficulty, QuizGenerationOptions } from '@/types/quiz.types'

interface QuizSetupModalProps {
  visible: boolean
  circuitId: string
  circuitTitle: string
  /** Si fourni, génère un quiz de révision ciblé sur ces questions échouées */
  weakQuestionIds?: string[]
  onClose: () => void
}

const DIFFICULTIES: { value: QuizDifficulty; label: string; desc: string; color: string }[] = [
  {
    value: 'easy',
    label: 'Facile',
    desc: 'Compréhension & mémorisation',
    color: colors.accent.success,
  },
  {
    value: 'medium',
    label: 'Moyen',
    desc: 'Application & mise en contexte',
    color: colors.accent.primary,
  },
  {
    value: 'hard',
    label: 'Difficile',
    desc: 'Analyse & synthèse avancée',
    color: colors.accent.error,
  },
]

const QUESTION_COUNTS = [5, 10, 20] as const

export function QuizSetupModal({
  visible,
  circuitId,
  circuitTitle,
  weakQuestionIds,
  onClose,
}: QuizSetupModalProps) {
  const { showToast } = useUiStore()
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium')
  const [questionCount, setQuestionCount] = useState<5 | 10 | 20>(10)
  const [isGenerating, setIsGenerating] = useState(false)

  const isRetry = !!weakQuestionIds && weakQuestionIds.length > 0

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const options: QuizGenerationOptions = {
        difficulty,
        questionCount,
        ...(isRetry && { weakQuestionIds }),
      }
      const quiz = await aiService.generateQuiz(circuitId, options)
      onClose()
      router.push(`/quiz/${quiz.id}`)
    } catch {
      showToast({ type: 'error', message: 'Impossible de générer le quiz' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>
                  {isRetry ? 'Révision ciblée' : 'Configurer le quiz'}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {circuitTitle}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            {isRetry && (
              <View style={styles.retryBanner}>
                <Ionicons name="analytics-outline" size={14} color={colors.accent.warning} />
                <Text style={styles.retryText}>
                  {weakQuestionIds!.length} lacune{weakQuestionIds!.length > 1 ? 's' : ''} détectée{weakQuestionIds!.length > 1 ? 's' : ''} — le quiz se concentrera sur ces notions
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Sélection de la difficulté */}
            <Text style={styles.sectionLabel}>Niveau de difficulté</Text>
            <View style={styles.difficultyRow}>
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.value
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => setDifficulty(d.value)}
                    style={[
                      styles.difficultyCard,
                      selected && {
                        borderColor: d.color,
                        backgroundColor: `${d.color}18`,
                      },
                    ]}
                  >
                    <Text style={[styles.difficultyLabel, selected && { color: d.color }]}>
                      {d.label}
                    </Text>
                    <Text style={styles.difficultyDesc}>{d.desc}</Text>
                    {selected && (
                      <View style={[styles.selectedDot, { backgroundColor: d.color }]} />
                    )}
                  </Pressable>
                )
              })}
            </View>

            {/* Sélection du nombre de questions */}
            <Text style={styles.sectionLabel}>Nombre de questions</Text>
            <View style={styles.countRow}>
              {QUESTION_COUNTS.map((count) => {
                const selected = questionCount === count
                return (
                  <Pressable
                    key={count}
                    onPress={() => setQuestionCount(count)}
                    style={[styles.countChip, selected && styles.countChipSelected]}
                  >
                    <Text style={[styles.countLabel, selected && styles.countLabelSelected]}>
                      {count}
                    </Text>
                    <Text style={[styles.countSub, selected && styles.countSubSelected]}>
                      questions
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Estimation de durée */}
            <View style={styles.estimate}>
              <Ionicons name="time-outline" size={14} color={colors.text.muted} />
              <Text style={styles.estimateText}>
                Durée estimée :{' '}
                {Math.ceil(questionCount * (difficulty === 'hard' ? 2.5 : difficulty === 'medium' ? 2 : 1.5))} min
              </Text>
            </View>
          </ScrollView>

          {/* CTA */}
          <View style={styles.footer}>
            {isGenerating ? (
              <View style={styles.generatingRow}>
                <ActivityIndicator color={colors.accent.primary} size="small" />
                <Text style={styles.generatingText}>Génération par Claude en cours...</Text>
              </View>
            ) : (
              <Button
                label={isRetry ? 'Générer la révision ciblée' : 'Générer le quiz'}
                onPress={handleGenerate}
                fullWidth
                size="lg"
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 26, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: colors.border.default,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  retryText: {
    ...textStyles.caption,
    color: colors.accent.warning,
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  sectionLabel: {
    ...textStyles.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  difficultyCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  difficultyLabel: {
    ...textStyles.label,
    color: colors.text.primary,
    textAlign: 'center',
  },
  difficultyDesc: {
    fontSize: 9,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 12,
  },
  selectedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    gap: 2,
  },
  countChipSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  countLabel: {
    ...textStyles.h3,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  countLabelSelected: {
    color: colors.accent.primary,
  },
  countSub: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  countSubSelected: {
    color: colors.accent.primary,
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  estimateText: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
  },
  generatingText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
})
