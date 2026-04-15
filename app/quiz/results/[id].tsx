import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { ScoreDisplay } from '@/components/features/ScoreDisplay'
import { QuizSetupModal } from '@/components/features/QuizSetupModal'
import { quizService } from '@/services/quiz.service'
import { supabase } from '@/lib/supabase'
import type { QuizResult } from '@/types/quiz.types'

export default function QuizResultsScreen() {
  const { id: attemptId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [circuitId, setCircuitId] = useState<string | null>(null)
  const [circuitTitle, setCircuitTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showRetryModal, setShowRetryModal] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [quizResult, attemptContext] = await Promise.all([
          quizService.getAttemptResult(attemptId),
          // Récupère le circuit_id depuis l'attempt → quiz → circuit
          supabase
            .from('quiz_attempts')
            .select('quiz:quizzes(circuit_id, circuits:circuits(title))')
            .eq('id', attemptId)
            .single(),
        ])

        setResult(quizResult)

        if (attemptContext.data) {
          const quiz = attemptContext.data.quiz as unknown as {
            circuit_id: string
            circuits: { title: string }
          } | null
          if (quiz) {
            setCircuitId(quiz.circuit_id)
            setCircuitTitle(quiz.circuits?.title ?? '')
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [attemptId])

  // IDs des questions échouées pour le retry ciblé
  const weakQuestionIds = result?.question_results
    .filter((r) => !r.is_correct)
    .map((r) => r.question_id) ?? []

  const hasWeakAreas = weakQuestionIds.length > 0 && circuitId !== null

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + spacing.md }]}>
      <Header title="Résultats" showBack onBack={() => router.replace('/(tabs)/home')} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {result && <ScoreDisplay result={result} />}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Retour à l'accueil"
          onPress={() => router.replace('/(tabs)/home')}
          variant="secondary"
          fullWidth
        />

        {hasWeakAreas ? (
          <Button
            label={`Réviser mes lacunes (${weakQuestionIds.length})`}
            onPress={() => setShowRetryModal(true)}
            fullWidth
          />
        ) : (
          <Button
            label="Nouveau quiz"
            onPress={() => circuitId && setShowRetryModal(true)}
            fullWidth
            disabled={!circuitId}
          />
        )}
      </View>

      {/* Modal pour configurer le quiz de retry (avec ou sans focus lacunes) */}
      {circuitId && (
        <QuizSetupModal
          visible={showRetryModal}
          circuitId={circuitId}
          circuitTitle={circuitTitle}
          weakQuestionIds={hasWeakAreas ? weakQuestionIds : undefined}
          onClose={() => setShowRetryModal(false)}
        />
      )}
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
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
})
