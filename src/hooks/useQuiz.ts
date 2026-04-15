import { useState, useEffect, useRef } from 'react'
import { quizService } from '@/services/quiz.service'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { useOfflineStore } from '@/store/offlineStore'
import { cacheQuiz, getCachedQuiz } from '@/lib/offlineCache'
import type { Quiz, QuizAttempt, QuizResult } from '@/types/quiz.types'

export function useQuiz(quizId?: string) {
  const { user } = useAuthStore()
  const { showToast, isOnline } = useUiStore()
  const { enqueuePendingAttempt } = useOfflineStore()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)
  const [isPendingSync, setIsPendingSync] = useState(false)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!quizId) return
    setIsLoading(true)

    if (!isOnline) {
      // Charger depuis le cache hors-ligne
      getCachedQuiz(quizId)
        .then((cached) => {
          if (cached) {
            setQuiz(cached)
            setIsFromCache(true)
          } else {
            showToast({ type: 'error', message: 'Quiz non disponible hors-ligne' })
          }
        })
        .finally(() => setIsLoading(false))
      return
    }

    quizService
      .getQuiz(quizId)
      .then((q) => {
        setQuiz(q)
        setIsFromCache(false)
        // Mise en cache pour mode hors-ligne
        if (q) cacheQuiz(q).catch(() => null)
      })
      .catch(async () => {
        // Fallback cache si la requête échoue
        const cached = await getCachedQuiz(quizId)
        if (cached) {
          setQuiz(cached)
          setIsFromCache(true)
          showToast({ type: 'info', message: 'Affichage depuis le cache local' })
        } else {
          showToast({ type: 'error', message: 'Impossible de charger le quiz' })
        }
      })
      .finally(() => setIsLoading(false))
  }, [quizId, showToast, isOnline])

  async function startQuiz() {
    if (!quiz || !user) return

    if (!isOnline) {
      // Créer un attempt local sans ID serveur — il sera soumis à la reconnexion
      const localAttempt: QuizAttempt = {
        id: `local-${Date.now()}`,
        quiz_id: quiz.id,
        user_id: user.id,
        score: 0,
        answers: {},
        started_at: new Date().toISOString(),
        status: 'in_progress',
      }
      setAttempt(localAttempt)
      startTimeRef.current = Date.now()
      return
    }

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
    if (!attempt || !quiz) return
    setIsLoading(true)

    try {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)

      if (!isOnline || attempt.id.startsWith('local-')) {
        // Soumission différée : mise en file d'attente
        enqueuePendingAttempt({ quizId: quiz.id, answers, timeTaken })
        setIsPendingSync(true)

        // Résultat provisoire calculé localement (sans correction IA)
        const total = quiz.questions?.length ?? quiz.total_questions
        const answered = Object.keys(answers).length
        setResult({
          attempt_id: attempt.id,
          score: 0,
          total_questions: total,
          correct_answers: 0,
          passed: false,
          time_taken_seconds: timeTaken,
          question_results: [],
          // Le vrai score sera calculé côté serveur à la synchronisation
        } as QuizResult)

        showToast({
          type: 'info',
          message: `Quiz enregistré (${answered}/${total} réponses) — résultat définitif à la reconnexion`,
        })
      } else {
        const quizResult = await quizService.submitAttempt(attempt.id, answers, timeTaken)
        setResult(quizResult)
        setIsPendingSync(false)
      }
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
    isFromCache,
    isPendingSync,
    startQuiz,
    answerQuestion,
    goNext,
    goPrev,
    submitQuiz,
  }
}
