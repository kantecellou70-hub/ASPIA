/**
 * initiate-payment
 *
 * Crée un enregistrement de paiement en base, puis appelle
 * l'API Kkiapay pour initier un paiement mobile money.
 * Retourne { payment_id, transaction_id }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const KKIAPAY_BASE_URL = 'https://api.kkiapay.me'

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
    const { plan_id, amount, phone } = await req.json() as {
      plan_id: string
      amount: number
      phone: string
    }

    if (!plan_id || !amount || !phone) {
      return new Response(
        JSON.stringify({ error: 'plan_id, amount et phone requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Crée l'enregistrement payment en état pending
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        plan_id,
        amount,
        currency: 'XOF',
        status: 'pending',
        phone,
      })
      .select()
      .single()

    if (paymentError || !payment) {
      throw new Error(`Erreur création paiement : ${paymentError?.message}`)
    }

    // Appel API Kkiapay
    const kkiapayKey = Deno.env.get('KKIAPAY_PRIVATE_KEY')!
    const isSandbox = Deno.env.get('KKIAPAY_SANDBOX') === 'true'

    const kkiapayRes = await fetch(`${KKIAPAY_BASE_URL}/api/v1/transactions/xpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-private-key': kkiapayKey,
      },
      body: JSON.stringify({
        amount,
        reason: `APSIA — Plan ${plan_id}`,
        api_key: Deno.env.get('KKIAPAY_PUBLIC_KEY')!,
        phone,
        sandbox: isSandbox,
        payment_id: payment.id,
      }),
    })

    if (!kkiapayRes.ok) {
      const errBody = await kkiapayRes.text()
      // Marque le paiement en failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)

      throw new Error(`Kkiapay erreur ${kkiapayRes.status} : ${errBody}`)
    }

    const kkiapayData = await kkiapayRes.json() as {
      transactionId: string
      status?: string
    }

    // Lie le transaction_id Kkiapay au paiement
    const { error: updateError } = await supabase
      .from('payments')
      .update({ kkiapay_transaction_id: kkiapayData.transactionId })
      .eq('id', payment.id)

    if (updateError) {
      console.error('Erreur liaison transaction_id :', updateError.message)
    }

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        transaction_id: kkiapayData.transactionId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('initiate-payment error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
