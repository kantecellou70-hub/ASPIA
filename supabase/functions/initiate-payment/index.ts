/**
 * initiate-payment
 *
 * Crée un enregistrement de paiement en base, puis appelle
 * l'API Kkiapay pour initier un paiement mobile money.
 * Retourne { payment_id, transaction_id }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

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

function detectOperator(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('224') || digits.length === 9) {
    const local = digits.length === 12 ? digits.slice(3) : digits
    if (local.startsWith('62')) return 'Orange'
    if (local.startsWith('66') || local.startsWith('65')) return 'MTN'
  }
  if (digits.startsWith('229') || digits.length === 8) {
    const local = digits.length === 11 ? digits.slice(3) : digits
    if (local.startsWith('96') || local.startsWith('97')) return 'MTN'
    if (local.startsWith('94') || local.startsWith('95')) return 'Moov'
  }
  if (digits.startsWith('221')) {
    const local = digits.slice(3)
    if (local.startsWith('78') || local.startsWith('76')) return 'Wave'
    if (local.startsWith('77')) return 'Orange'
  }
  if (digits.startsWith('225')) {
    const local = digits.slice(3)
    if (local.startsWith('05') || local.startsWith('07')) return 'MTN'
    if (local.startsWith('08') || local.startsWith('09')) return 'Orange'
  }
  return 'Mobile Money'
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
        operator: detectOperator(phone),
      })
      .select()
      .single()

    if (paymentError || !payment) {
      throw new Error(`Erreur création paiement : ${paymentError?.message}`)
    }

    // Appel API Kkiapay
    const kkiapayKey = Deno.env.get('KKIAPAY_PRIVATE_KEY')!

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
