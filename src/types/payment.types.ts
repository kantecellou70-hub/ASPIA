import type { PlanTier } from './auth.types'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface Plan {
  id: PlanTier
  name: string
  description: string
  price: number
  currency: string
  sessions: number
  features: readonly string[]
  is_popular?: boolean
}

export interface Payment {
  id: string
  user_id: string
  plan_id: PlanTier
  amount: number
  currency: string
  status: PaymentStatus
  kkiapay_transaction_id?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface KkiapayPaymentPayload {
  amount: number
  reason: string
  api_key: string
  phone: string
  sandbox?: boolean
}

export interface KkiapayPaymentResponse {
  transactionId: string
  status: 'SUCCESS' | 'FAILED' | 'PENDING'
  message?: string
}

export interface InitiatePaymentParams {
  plan_id: PlanTier
  amount: number
  phone: string
}
