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

  async getAttemptResult(attemptId: string): Promise<QuizResult> {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('attempt_id', attemptId)
      .single()

    if (error) throw error
    return data as QuizResult
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
