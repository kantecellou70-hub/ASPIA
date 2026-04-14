import { useState, useEffect, useRef } from 'react'
import { quizService } from '@/services/quiz.service'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import type { Quiz, QuizAttempt, QuizResult } from '@/types/quiz.types'

export function useQuiz(quizId?: string) {
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!quizId) return
    setIsLoading(true)
    quizService
      .getQuiz(quizId)
      .then(setQuiz)
      .catch(() => showToast({ type: 'error', message: 'Impossible de charger le quiz' }))
      .finally(() => setIsLoading(false))
  }, [quizId, showToast])

  async function startQuiz() {
    if (!quiz || !user) return
    const newAttempt = await quizService.startAttempt(quiz.id, user.id)
    setAttempt(newAttempt)
    startTimeRef.current = Date.now()
  }

  function answerQuestion(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  function goNext() {
    if (quiz && currentIndex < quiz.total_questions - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  async function submitQuiz() {
    if (!attempt) return
    setIsLoading(true)
    try {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
      const quizResult = await quizService.submitAttempt(attempt.id, answers, timeTaken)
      setResult(quizResult)
    } catch {
      showToast({ type: 'error', message: 'Erreur lors de la soumission du quiz' })
    } finally {
      setIsLoading(false)
    }
  }

  const currentQuestion = quiz?.questions?.[currentIndex] ?? null
  const isLastQuestion = quiz ? currentIndex === quiz.total_questions - 1 : false
  const answeredCount = Object.keys(answers).length

  return {
    quiz,
    attempt,
    result,
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
  }
}
