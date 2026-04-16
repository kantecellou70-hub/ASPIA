/**
 * check-daily-costs — Alerte webhook si le coût journalier dépasse un seuil
 *
 * À appeler par pg_cron (toutes les heures) ou un cron externe.
 * Si le coût du jour dépasse DAILY_COST_ALERT_THRESHOLD_USD et que l'alerte
 * n'a pas encore été envoyée aujourd'hui, POST vers ALERT_WEBHOOK_URL.
 *
 * Formats de webhook supportés :
 *   - Slack  : { text: "..." }
 *   - Discord: { content: "..." }
 *   - Générique: { event, date, cost_usd, threshold_usd, operations, details }
 *
 * Variables d'environnement requises :
 *   DAILY_COST_ALERT_THRESHOLD_USD  (défaut : 10)
 *   ALERT_WEBHOOK_URL               (Slack, Discord, ou URL HTTP quelconque)
 *   ALERT_WEBHOOK_TYPE              'slack' | 'discord' | 'generic'  (défaut : 'generic')
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildPayload(type: string, data: {
  date: string
  costUsd: number
  thresholdUsd: number
  operations: number
  topUsers: { user_id: string; cost_usd: number; ops: number }[]
}): unknown {
  const { date, costUsd, thresholdUsd, operations, topUsers } = data
  const emoji = costUsd >= thresholdUsd * 2 ? '🚨' : '⚠️'
  const overPct = Math.round((costUsd / thresholdUsd - 1) * 100)
  const topUsersText = topUsers.length > 0
    ? `\nTop utilisateurs :\n${topUsers.map((u) => `  • ${u.user_id.slice(0, 8)}... : $${u.cost_usd.toFixed(3)} (${u.ops} ops)`).join('\n')}`
    : ''

  const message = `${emoji} APSIA — Alerte coût API Claude\nDate : ${date}\nCoût du jour : $${costUsd.toFixed(4)} (+${overPct}% au-dessus du seuil $${thresholdUsd})\nOpérations : ${operations}${topUsersText}`

  if (type === 'slack') return { text: message }
  if (type === 'discord') return { content: message }

  return {
    event: 'daily_cost_alert',
    date,
    cost_usd: costUsd,
    threshold_usd: thresholdUsd,
    over_threshold_pct: overPct,
    operations_count: operations,
    top_users: topUsers,
    message,
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Accepte les appels sans auth (vient de pg_cron via service role) ou avec auth admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const thresholdUsd = parseFloat(Deno.env.get('DAILY_COST_ALERT_THRESHOLD_USD') ?? '10')
    const webhookUrl   = Deno.env.get('ALERT_WEBHOOK_URL') ?? ''
    const webhookType  = Deno.env.get('ALERT_WEBHOOK_TYPE') ?? 'generic'
    const today        = todayDate()

    // Récupère les coûts du jour
    const { data: daily, error: dailyErr } = await supabase
      .from('ai_daily_costs')
      .select('cost_usd, operations_count, alert_sent')
      .eq('date', today)
      .single()

    if (dailyErr || !daily) {
      return new Response(JSON.stringify({ status: 'no_data', date: today }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const costUsd = parseFloat(String(daily.cost_usd))
    const operations = daily.operations_count ?? 0

    // Déjà en-dessous du seuil ou alerte déjà envoyée aujourd'hui
    if (costUsd < thresholdUsd) {
      return new Response(JSON.stringify({
        status: 'ok',
        date: today,
        cost_usd: costUsd,
        threshold_usd: thresholdUsd,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (daily.alert_sent) {
      return new Response(JSON.stringify({
        status: 'alert_already_sent',
        date: today,
        cost_usd: costUsd,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Récupère les top utilisateurs du jour (pour enrichir l'alerte)
    const { data: topUsersRaw } = await supabase
      .from('ai_usage')
      .select('user_id, cost_usd, ops_circuit, ops_quiz, ops_summary, ops_analysis')
      .eq('year_month', today.slice(0, 7))
      .order('cost_usd', { ascending: false })
      .limit(5)

    const topUsers = (topUsersRaw ?? []).map((u: Record<string, unknown>) => ({
      user_id: u.user_id as string,
      cost_usd: parseFloat(String(u.cost_usd)),
      ops: ((u.ops_circuit as number) ?? 0) +
           ((u.ops_quiz as number) ?? 0) +
           ((u.ops_summary as number) ?? 0) +
           ((u.ops_analysis as number) ?? 0),
    }))

    // Envoi du webhook si configuré
    let webhookSent = false
    if (webhookUrl) {
      try {
        const payload = buildPayload(webhookType, { date: today, costUsd, thresholdUsd, operations, topUsers })
        const webhookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        webhookSent = webhookRes.ok
        if (!webhookRes.ok) {
          console.error(`Webhook failed: ${webhookRes.status} ${await webhookRes.text()}`)
        }
      } catch (e) {
        console.error('Webhook request error:', e)
      }
    } else {
      console.warn('ALERT_WEBHOOK_URL not configured — alert not sent externally')
      webhookSent = true  // Pas d'URL configurée : on marque quand même pour éviter le spam de logs
    }

    // Marque l'alerte comme envoyée pour ne pas la renvoyer toutes les heures
    if (webhookSent) {
      await supabase
        .from('ai_daily_costs')
        .update({ alert_sent: true })
        .eq('date', today)
    }

    return new Response(JSON.stringify({
      status: 'alert_triggered',
      date: today,
      cost_usd: costUsd,
      threshold_usd: thresholdUsd,
      webhook_sent: webhookSent,
      top_users: topUsers,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('check-daily-costs error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
