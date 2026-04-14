export type CircuitStatus = 'not_started' | 'in_progress' | 'completed'

export interface CircuitStep {
  id: string
  circuit_id: string
  order: number
  title: string
  content: string
  key_concepts: string[]
  is_completed: boolean
}

export interface Circuit {
  id: string
  user_id: string
  document_id: string
  title: string
  description: string
  total_steps: number
  completed_steps: number
  status: CircuitStatus
  created_at: string
  updated_at: string
  steps?: CircuitStep[]
}

export interface CircuitProgress {
  circuit_id: string
  current_step: number
  is_completed: boolean
  completion_percentage: number
}
