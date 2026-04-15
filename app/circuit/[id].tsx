import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StepItem } from '@/components/features/StepItem'
import { QuizSetupModal } from '@/components/features/QuizSetupModal'
import { CourseSummaryModal } from '@/components/features/CourseSummaryModal'
import { useCircuit } from '@/hooks/useCircuit'
import { aiService } from '@/services/ai.service'
import { useUiStore } from '@/store/uiStore'
import { getCachedSummary, cacheSummary } from '@/lib/offlineCache'
import type { CourseSummary } from '@/types/quiz.types'

export default function CircuitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { circuit, isLoading, isFromCache, fetchCircuit, markStepCompleted } = useCircuit(id)
  const { showToast } = useUiStore()

  // Modals
  const [showQuizSetup, setShowQuizSetup] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  // Résumé IA
  const [summary, setSummary] = useState<CourseSummary | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  const completionPct = circuit
    ? Math.round((circuit.completed_steps / circuit.total_steps) * 100)
    : 0

  async function openSummary() {
    setShowSummary(true)
    if (summary) return // Déjà chargé

    // Essayer le cache d'abord
    if (id) {
      const cached = await getCachedSummary(id)
      if (cached) {
        setSummary(cached)
        return
      }
    }

    // Générer via IA
    setIsLoadingSummary(true)
    try {
      const result = await aiService.generateSummary(id!)
      setSummary(result)
      cacheSummary(result).catch(() => null)
    } catch {
      showToast({ type: 'error', message: 'Impossible de générer le résumé' })
      setShowSummary(false)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
      </View>
    )
  }

  if (!circuit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Circuit introuvable</Text>
      </View>
    )
  }

  const sortedSteps = [...(circuit.steps ?? [])].sort((a, b) => a.order - b.order)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header title={circuit.title} showBack />

      <FlatList
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.badgeRow}>
              <Badge
                label={circuit.status === 'completed' ? 'Terminé' : circuit.status === 'in_progress' ? 'En cours' : 'Non démarré'}
                variant={circuit.status === 'completed' ? 'success' : circuit.status === 'in_progress' ? 'primary' : 'muted'}
              />
              {isFromCache && (
                <Badge label="Cache local" variant="muted" />
              )}
            </View>

            <Text style={styles.description}>{circuit.description}</Text>

            <ProgressBar
              progress={completionPct}
              label={`${circuit.completed_steps}/${circuit.total_steps} étapes`}
              showValue
              height={10}
            />

            {/* Bouton Résumé IA — disponible dès qu'il y a des étapes */}
            {(circuit.steps?.length ?? 0) > 0 && (
              <Button
                label="Résumé IA"
                onPress={openSummary}
                variant="secondary"
                fullWidth
                size="md"
              />
            )}

            {circuit.status === 'completed' && (
              <Button
                label="Passer le quiz"
                onPress={() => setShowQuizSetup(true)}
                fullWidth
                size="lg"
              />
            )}

            <Text style={styles.stepsTitle}>Étapes du circuit</Text>
          </View>
        }
        data={sortedSteps}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const previousStep = sortedSteps[index - 1]
          const isLocked = index > 0 && previousStep && !previousStep.is_completed

          return (
            <StepItem
              step={item}
              onMarkCompleted={markStepCompleted}
              isLocked={isLocked}
            />
          )
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal configuration du quiz */}
      <QuizSetupModal
        visible={showQuizSetup}
        circuitId={circuit.id}
        circuitTitle={circuit.title}
        onClose={() => setShowQuizSetup(false)}
      />

      {/* Modal résumé IA */}
      <CourseSummaryModal
        visible={showSummary}
        summary={summary}
        isLoading={isLoadingSummary}
        onClose={() => setShowSummary(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  hero: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  description: {
    ...textStyles.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  stepsTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
})
