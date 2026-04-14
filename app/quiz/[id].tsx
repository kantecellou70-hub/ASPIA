import React, { useEffect } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { QuestionCard } from '@/components/features/QuestionCard'
import { useQuiz } from '@/hooks/useQuiz'

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const {
    quiz,
    attempt,
    answers,
    currentIndex,
    currentQuestion,
    isLastQuestion,
    answeredCount,
    isLoading,
    startQuiz,
    answerQuestion,
    goNext,
    goPrev,
    submitQuiz,
  } = useQuiz(id)

  useEffect(() => {
    if (quiz && !attempt) startQuiz()
  }, [quiz, attempt, startQuiz])

  if (isLoading || !quiz) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
      </View>
    )
  }

  if (!currentQuestion) return null

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + spacing.md }]}>
      <Header title={quiz.title} showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          total={quiz.total_questions}
          selectedOptionId={answers[currentQuestion.id]}
          onSelectOption={(optionId) => answerQuestion(currentQuestion.id, optionId)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Précédent"
          onPress={goPrev}
          variant="secondary"
          disabled={currentIndex === 0}
          style={styles.navButton}
        />

        {isLastQuestion ? (
          <Button
            label={`Terminer (${answeredCount}/${quiz.total_questions})`}
            onPress={async () => {
              await submitQuiz()
              // result screen navigation handled by submitQuiz or result fetch
              if (attempt) router.replace(`/quiz/results/${attempt.id}`)
            }}
            loading={isLoading}
            style={styles.navButton}
          />
        ) : (
          <Button
            label="Suivant"
            onPress={goNext}
            disabled={!answers[currentQuestion.id]}
            style={styles.navButton}
          />
        )}
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
    paddingVertical: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  navButton: {
    flex: 1,
  },
})
