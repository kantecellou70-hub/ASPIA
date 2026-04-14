import { supabase } from '@/lib/supabase'
import type { InitiatePaymentParams, Payment } from '@/types/payment.types'

/**
 * Le paiement Kkiapay est orchestré côté serveur via Supabase Edge Functions
 * pour ne pas exposer la clé secrète dans l'application mobile.
 */
export const paymentService = {
  async initiate(params: InitiatePaymentParams): Promise<{ payment_id: string; transaction_id: string }> {
    const { data, error } = await supabase.functions.invoke('initiate-payment', {
      body: params,
    })

    if (error) throw error
    return data as { payment_id: string; transaction_id: string }
  },

  async verifyTransaction(transactionId: string): Promise<Payment> {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { transaction_id: transactionId },
    })

    if (error) throw error
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
