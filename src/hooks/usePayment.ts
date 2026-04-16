import { useState } from 'react'
import { router } from 'expo-router'
import { paymentService } from '@/services/payment.service'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { EdgeFunctionError } from '@/lib/invoke'
import type { InitiatePaymentParams, Payment } from '@/types/payment.types'

export function usePayment() {
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const [isLoading, setIsLoading] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])

  function handlePaymentError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : fallback
    if (err instanceof EdgeFunctionError && err.sessionExpired) {
      showToast({ type: 'warning', message })
      router.replace('/(auth)/welcome')
      return
    }
    showToast({ type: 'error', message })
  }

  async function initiatePayment(params: InitiatePaymentParams): Promise<string | null> {
    if (!user) return null
    setIsLoading(true)
    try {
      const { transaction_id } = await paymentService.initiate(params)
      showToast({ type: 'info', message: 'Paiement initié, vérification en cours...' })
      return transaction_id
    } catch (err) {
      handlePaymentError(err, 'Impossible d\'initier le paiement')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  async function verifyPayment(transactionId: string): Promise<Payment | null> {
    setIsLoading(true)
    try {
      const payment = await paymentService.verifyTransaction(transactionId)
      if (payment.status === 'completed') {
        showToast({ type: 'success', message: 'Paiement validé ! Votre plan a été mis à jour.' })
      }
      return payment
    } catch (err) {
      handlePaymentError(err, 'Impossible de vérifier le paiement')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchPayments() {
    if (!user) return
    try {
      const data = await paymentService.getUserPayments(user.id)
      setPayments(data)
    } catch {
      // silently fail
    }
  }

  return {
    isLoading,
    payments,
    initiatePayment,
    verifyPayment,
    fetchPayments,
  }
}
