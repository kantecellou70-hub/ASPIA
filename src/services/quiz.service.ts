import { supabase } from '@/lib/supabase'
import type { Quiz, QuizAttempt, QuizResult } from '@/types/quiz.types'

export const quizService = {
  async getQuiz(quizId: string): Promise<Quiz> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions:quiz_questions(*, options:quiz_options(*))')
      .eq('id', quizId)
      .single()

    if (error) throw error
    return data as Quiz
  },

  async getQuizByCircuit(circuitId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions:quiz_questions(*, options:quiz_options(*))')
      .eq('circuit_id', circuitId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data as Quiz | null
  },

  async startAttempt(quizId: string, userId: string): Promise<QuizAttempt> {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        user_id: userId,
        answers: {},
        score: 0,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data as QuizAttempt
  },

  async submitAttempt(
    attemptId: string,
    answers: Record<string, string>,
    timeTakenSeconds: number,
  ): Promise<QuizResult> {
    const { data, error } = await supabase.functions.invoke('submit-quiz', {
      body: {
        attempt_id: attemptId,
        answers,
        time_taken_seconds: timeTakenSeconds,
      },
    })

    if (error) throw error
    return data as QuizResult
  },

  /**
   * Reconstruit le QuizResult depuis quiz_attempts + questions/options.
   * La table quiz_results n'existe pas — on recalcule depuis les données stockées.
   */
  async getAttemptResult(attemptId: string): Promise<QuizResult> {
    // Récupère l'attempt avec les questions et leurs options correctes
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select(`
        id, score, answers, status, started_at, completed_at,
        quiz:quizzes(
          id, total_questions,
          questions:quiz_questions(
            id,
            options:quiz_options(id, is_correct)
          )
        )
      `)
      .eq('id', attemptId)
      .single()

    if (attemptError || !attempt) throw attemptError ?? new Error('Tentative introuvable')

    interface Option { id: string; is_correct: boolean }
    interface QuestionWithOptions { id: string; options: Option[] }
    interface QuizWithQuestions { id: string; total_questions: number; questions: QuestionWithOptions[] }

    const quiz = attempt.quiz as unknown as QuizWithQuestions
    const storedAnswers = attempt.answers as Record<string, string>

    const questionResults = (quiz.questions ?? []).map((q: QuestionWithOptions) => {
      const selectedOptionId = storedAnswers[q.id] ?? ''
      const correctOption = q.options.find((o: Option) => o.is_correct)
      return {
        question_id: q.id,
        is_correct: !!correctOption && selectedOptionId === correctOption.id,
        selected_option_id: selectedOptionId,
        correct_option_id: correctOption?.id ?? '',
      }
    })

    const correctAnswers = questionResults.filter((r) => r.is_correct).length
    const totalQuestions = quiz.total_questions || questionResults.length
    const score = attempt.score

    // Calcul de la durée depuis started_at / completed_at
    const timeTakenSeconds = attempt.completed_at && attempt.started_at
      ? Math.round(
          (new Date(attempt.completed_at).getTime() - new Date(attempt.started_at).getTime()) / 1000,
        )
      : 0

    return {
      attempt_id: attemptId,
      score,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      passed: score >= 70,
      time_taken_seconds: timeTakenSeconds,
      question_results: questionResults,
    }
  },

  async getUserAttempts(userId: string): Promise<QuizAttempt[]> {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as QuizAttempt[]
  },
}
