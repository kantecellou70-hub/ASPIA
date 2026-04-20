/**
 * verify-payment
 *
 * Vérifie le statut d'une transaction Kkiapay.
 * Si SUCCESS : met à jour payments.status = 'completed' et
 * upgrape le plan utilisateur (profiles.plan + sessions_limit).
 * Retourne l'objet Payment mis à jour.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'

const isSandboxMode = Deno.env.get('KKIAPAY_SANDBOX') === 'true'
const KKIAPAY_BASE_URL = isSandboxMode
  ? 'https://api-sandbox.kkiapay.me'
  : 'https://api.kkiapay.me'

const SESSIONS_BY_PLAN: Record<string, number> = {
  free: 3,
  starter: 20,
  pro: 100,
  enterprise: 999999,
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { transaction_id } = await req.json() as { transaction_id: string }

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: 'transaction_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { userId, error: authError } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (!userId) {
      return new Response(JSON.stringify({ error: authError ?? 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Récupère le paiement lié à cette transaction
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('kkiapay_transaction_id', transaction_id)
      .eq('user_id', userId)
      .single()

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Paiement introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérifie auprès de Kkiapay
    const kkiapayKey = Deno.env.get('KKIAPAY_PRIVATE_KEY')!
    const verifyRes = await fetch(
      `${KKIAPAY_BASE_URL}/api/v1/transactions/${transaction_id}/status`,
      {
        headers: {
          'x-private-key': kkiapayKey,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!verifyRes.ok) {
      if (verifyRes.status === 404) {
        throw new Error('Transaction introuvable chez Kkiapay. Vérifiez le transaction_id.')
      }
      if (verifyRes.status === 401 || verifyRes.status === 403) {
        throw new Error('Clé API Kkiapay invalide. Contactez le support APSIA.')
      }
      throw new Error(`Impossible de vérifier le paiement (Kkiapay ${verifyRes.status}). Réessayez dans quelques minutes.`)
    }

    const kkiapayData = await verifyRes.json() as {
      status: 'SUCCESS' | 'FAILED' | 'PENDING'
      transactionId: string
    }

    const newStatus =
      kkiapayData.status === 'SUCCESS'
        ? 'completed'
        : kkiapayData.status === 'FAILED'
        ? 'failed'
        : 'pending'

    // Met à jour le statut du paiement
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({ status: newStatus })
      .eq('id', payment.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur mise à jour paiement : ${updateError.message}`)
    }

    // Si paiement réussi, upgrade le plan utilisateur
    if (newStatus === 'completed') {
      const sessionsLimit = SESSIONS_BY_PLAN[payment.plan_id] ?? 3

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          plan: payment.plan_id,
          sessions_limit: sessionsLimit,
          sessions_used: 0,   // remet le compteur à zéro
        })
        .eq('id', userId)

      if (profileError) {
        // Non bloquant — on log mais on retourne quand même le paiement
        console.error('Erreur upgrade profil :', profileError.message)
      }
    }

    return new Response(
      JSON.stringify(updatedPayment),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('verify-payment error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
