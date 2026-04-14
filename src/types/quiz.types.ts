export type QuestionType = 'multiple_choice' | 'true_false'
export type QuizStatus = 'not_started' | 'in_progress' | 'completed'

export interface QuizOption {
  id: string
  text: string
  is_correct: boolean
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  order: number
  type: QuestionType
  question: string
  options: QuizOption[]
  explanation?: string
}

export interface Quiz {
  id: string
  circuit_id: string
  user_id: string
  title: string
  total_questions: number
  time_limit_minutes?: number
  created_at: string
  questions?: QuizQuestion[]
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  score: number // 0–100
  answers: Record<string, string> // question_id → option_id
  started_at: string
  completed_at?: string
  status: QuizStatus
}

export interface QuestionResult {
  question_id: string
  is_correct: boolean
  selected_option_id: string
  correct_option_id: string
}

export interface QuizResult {
  attempt_id: string
  score: number
  total_questions: number
  correct_answers: number
  passed: boolean
  time_taken_seconds: number
  question_results: QuestionResult[]
}
