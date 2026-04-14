import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { ScoreDisplay } from '@/components/features/ScoreDisplay'
import { quizService } from '@/services/quiz.service'
import type { QuizResult } from '@/types/quiz.types'

export default function QuizResultsScreen() {
  const { id: attemptId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    quizService
      .getAttemptResult(attemptId)
      .then(setResult)
      .finally(() => setIsLoading(false))
  }, [attemptId])

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
        <Button
          label="Refaire le quiz"
          onPress={() => router.back()}
          fullWidth
        />
      </View>
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
