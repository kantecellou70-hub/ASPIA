import { supabase } from '@/lib/supabase'
import { invokeWithAuth, throwFromInvoke } from '@/lib/invoke'
import type { InitiatePaymentParams, Payment } from '@/types/payment.types'

/**
 * Le paiement Kkiapay est orchestré côté serveur via Supabase Edge Functions
 * pour ne pas exposer la clé secrète dans l'application mobile.
 */
export const paymentService = {
  async initiate(params: InitiatePaymentParams): Promise<{ payment_id: string; transaction_id: string }> {
    const { data, error, response } = await invokeWithAuth('initiate-payment', params as unknown as Record<string, unknown>)
    if (error || (data && 'error' in (data as object))) await throwFromInvoke(error, data, response)
    return data as { payment_id: string; transaction_id: string }
  },

  async verifyTransaction(transactionId: string): Promise<Payment> {
    const { data, error, response } = await invokeWithAuth('verify-payment', { transaction_id: transactionId })
    if (error || (data && 'error' in (data as object))) await throwFromInvoke(error, data, response)
    return data as Payment
  },

  async getUserPayments(userId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as Payment[]
  },
}
