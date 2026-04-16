/**
 * admin-payments — Gestion des paiements & réconciliation
 *
 * Accès réservé aux utilisateurs avec role = 'admin'.
 *
 * Actions :
 *   list           — liste paginée des transactions avec filtres
 *   detail         — détail d'une transaction
 *   refund         — remboursement manuel (Kkiapay + mise à jour DB)
 *   monthly_report — rapport mensuel (revenus, commissions, by operator/plan)
 *   failure_stats  — taux d'échec par opérateur (30 derniers jours)
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'

const KKIAPAY_BASE_URL = 'https://api.kkiapay.me'
/** Taux de commission Kkiapay estimé (varie 1.5 %–3 % selon opérateur) */
const KKIAPAY_COMMISSION_RATE = 0.025

const VALID_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Détection de l'opérateur depuis le numéro de téléphone (Afrique de l'Ouest) */
function detectOperator(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  // Guinée (+224 — 9 chiffres locaux)
  if (digits.startsWith('224') || digits.length === 9) {
    const local = digits.length === 12 ? digits.slice(3) : digits
    if (local.startsWith('62')) return 'Orange'
    if (local.startsWith('66') || local.startsWith('65')) return 'MTN'
    if (local.startsWith('60') || local.startsWith('61')) return 'Cellcom'
  }
  // Bénin (+229 — 8 chiffres locaux)
  if (digits.startsWith('229') || digits.length === 8) {
    const local = digits.length === 11 ? digits.slice(3) : digits
    if (local.startsWith('96') || local.startsWith('97') || local.startsWith('66') || local.startsWith('67')) return 'MTN'
    if (local.startsWith('94') || local.startsWith('95') || local.startsWith('64') || local.startsWith('65')) return 'Moov'
  }
  // Sénégal (+221)
  if (digits.startsWith('221')) {
    const local = digits.slice(3)
    if (local.startsWith('78') || local.startsWith('76')) return 'Wave'
    if (local.startsWith('77')) return 'Orange'
    if (local.startsWith('70') || local.startsWith('75')) return 'Free'
  }
  // Côte d'Ivoire (+225)
  if (digits.startsWith('225')) {
    const local = digits.slice(3)
    if (local.startsWith('05') || local.startsWith('07')) return 'MTN'
    if (local.startsWith('08') || local.startsWith('09')) return 'Orange'
    if (local.startsWith('01')) return 'Moov'
  }
  return 'Mobile Money'
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const { ipAddress, userAgent } = extractRequestMeta(req)

  try {
    const body = await req.json().catch(() => ({}))
    const {
      action,
      // list
      page = 1, page_size = 25,
      filter_status, filter_operator, date_from, date_to, search,
      // detail / refund
      payment_id, refund_reason,
      // monthly_report
      year, month,
    } = body as {
      action: string
      page?: number; page_size?: number
      filter_status?: string; filter_operator?: string
      date_from?: string; date_to?: string; search?: string
      payment_id?: string; refund_reason?: string
      year?: number; month?: number
    }

    // ── Auth & vérification admin ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non authentifié' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token)
    if (userError || !user) return json({ error: 'Non authentifié' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return json({ error: 'Accès réservé aux administrateurs' }, 403)
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const from = (page - 1) * page_size
      const to = from + page_size - 1

      let query = supabase
        .from('payments')
        .select(
          'id, user_id, plan_id, amount, currency, status, kkiapay_transaction_id, phone, operator, refund_reason, refunded_at, created_at, updated_at',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filter_status && VALID_STATUSES.includes(filter_status as typeof VALID_STATUSES[number])) {
        query = query.eq('status', filter_status)
      }
      if (filter_operator) {
        query = query.ilike('operator', `%${filter_operator}%`)
      }
      if (date_from) query = query.gte('created_at', date_from)
      if (date_to)   query = query.lte('created_at', date_to)

      const { data: payments, count, error: listErr } = await query
      if (listErr) throw listErr

      // Joindre les noms d'utilisateurs
      const userIds = [...new Set((payments ?? []).map((p: { user_id: string }) => p.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      const profileMap: Record<string, string> = {}
      profiles?.forEach((p: { id: string; full_name: string }) => { profileMap[p.id] = p.full_name })

      // Remplir l'opérateur si manquant
      const enriched = (payments ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        user_name: profileMap[p.user_id as string] ?? 'Inconnu',
        operator: p.operator ?? detectOperator(p.phone as string | null),
      }))

      // Filtre search sur user_name côté Edge Function (après enrichissement)
      const filtered = search
        ? enriched.filter((p: Record<string, unknown>) =>
            (p.user_name as string).toLowerCase().includes(search.toLowerCase()) ||
            (p.phone as string ?? '').includes(search)
          )
        : enriched

      return json({
        payments: filtered,
        total: count ?? 0,
        page,
        page_size,
        total_pages: Math.ceil((count ?? 0) / page_size),
      })
    }

    // ── DETAIL ────────────────────────────────────────────────────────────────
    if (action === 'detail') {
      if (!payment_id) return json({ error: 'payment_id requis' }, 400)

      const { data: payment, error: detailErr } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment_id)
        .single()

      if (detailErr || !payment) return json({ error: 'Paiement introuvable' }, 404)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, plan')
        .eq('id', payment.user_id)
        .single()

      return json({
        ...payment,
        operator: payment.operator ?? detectOperator(payment.phone),
        user_name: profile?.full_name ?? 'Inconnu',
        user_current_plan: profile?.plan ?? 'free',
      })
    }

    // ── REFUND ────────────────────────────────────────────────────────────────
    if (action === 'refund') {
      if (!payment_id) return json({ error: 'payment_id requis' }, 400)

      const { data: payment, error: fetchErr } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment_id)
        .single()

      if (fetchErr || !payment) return json({ error: 'Paiement introuvable' }, 404)
      if (payment.status === 'refunded') return json({ error: 'Paiement déjà remboursé' }, 400)
      if (payment.status !== 'completed') return json({ error: 'Seuls les paiements réussis peuvent être remboursés' }, 400)

      // Tentative de remboursement via Kkiapay (si transaction_id disponible)
      let kkiapayRefundOk = false
      if (payment.kkiapay_transaction_id) {
        try {
          const kkiapayKey = Deno.env.get('KKIAPAY_PRIVATE_KEY')!
          const refundRes = await fetch(
            `${KKIAPAY_BASE_URL}/api/v1/transactions/${payment.kkiapay_transaction_id}/refund`,
            {
              method: 'POST',
              headers: {
                'x-private-key': kkiapayKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ reason: refund_reason ?? 'Remboursement administrateur' }),
            },
          )
          kkiapayRefundOk = refundRes.ok
          if (!refundRes.ok) {
            const errText = await refundRes.text()
            console.warn(`Kkiapay refund HTTP ${refundRes.status}: ${errText}`)
          }
        } catch (e) {
          console.warn('Kkiapay refund API indisponible, remboursement marqué manuellement:', e)
        }
      }

      // Mise à jour du statut en base dans tous les cas
      const { data: updated, error: updateErr } = await supabase
        .from('payments')
        .update({
          status: 'refunded',
          refund_reason: refund_reason ?? 'Remboursement administrateur',
          refunded_at: new Date().toISOString(),
        })
        .eq('id', payment_id)
        .select()
        .single()

      if (updateErr) throw updateErr

      // Rétrograder le plan utilisateur vers free
      await supabase
        .from('profiles')
        .update({ plan: 'free', sessions_limit: 3 })
        .eq('id', payment.user_id)

      writeAuditLog(supabase, {
        userId: user.id, action: 'admin.refund', resourceType: 'payment', resourceId: payment_id,
        metadata: {
          amount: payment.amount,
          currency: payment.currency,
          user_id: payment.user_id,
          kkiapay_transaction_id: payment.kkiapay_transaction_id,
          kkiapay_refund_ok: kkiapayRefundOk,
          reason: refund_reason ?? 'Remboursement administrateur',
        },
        ipAddress, userAgent,
      }).catch((e) => console.warn('audit failed:', e))

      return json({
        success: true,
        kkiapay_refund_processed: kkiapayRefundOk,
        payment: updated,
      })
    }

    // ── MONTHLY REPORT ────────────────────────────────────────────────────────
    if (action === 'monthly_report') {
      const now = new Date()
      const y = year ?? now.getFullYear()
      const m = month ?? (now.getMonth() + 1)

      const startDate = new Date(y, m - 1, 1).toISOString()
      const endDate   = new Date(y, m, 0, 23, 59, 59).toISOString()  // dernier jour du mois

      const [completedRes, failedRes, refundedRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, plan_id, operator, phone, created_at')
          .eq('status', 'completed')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabase
          .from('payments')
          .select('id, operator, phone, created_at')
          .eq('status', 'failed')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabase
          .from('payments')
          .select('id, amount, created_at')
          .eq('status', 'refunded')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
      ])

      const completed = (completedRes.data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        operator: p.operator ?? detectOperator(p.phone as string | null),
      }))
      const failed = (failedRes.data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        operator: p.operator ?? detectOperator(p.phone as string | null),
      }))
      const refunded = refundedRes.data ?? []

      const totalRevenue = completed.reduce((s: number, p: Record<string, unknown>) => s + (p.amount as number), 0)
      const totalRefunded = (refunded as Record<string, unknown>[]).reduce((s: number, p: Record<string, unknown>) => s + (p.amount as number), 0)
      const netRevenue = totalRevenue - totalRefunded
      const estimatedCommission = Math.round(totalRevenue * KKIAPAY_COMMISSION_RATE)
      const netAfterCommission = netRevenue - estimatedCommission

      // Par opérateur
      const byOperator: Record<string, { count: number; revenue: number; failed_count: number }> = {}
      for (const p of completed as Record<string, unknown>[]) {
        const op = (p.operator as string) ?? 'Inconnu'
        if (!byOperator[op]) byOperator[op] = { count: 0, revenue: 0, failed_count: 0 }
        byOperator[op].count++
        byOperator[op].revenue += p.amount as number
      }
      for (const p of failed as Record<string, unknown>[]) {
        const op = (p.operator as string) ?? 'Inconnu'
        if (!byOperator[op]) byOperator[op] = { count: 0, revenue: 0, failed_count: 0 }
        byOperator[op].failed_count++
      }

      // Par plan
      const byPlan: Record<string, { count: number; revenue: number }> = {}
      for (const p of completed as Record<string, unknown>[]) {
        const plan = p.plan_id as string
        if (!byPlan[plan]) byPlan[plan] = { count: 0, revenue: 0 }
        byPlan[plan].count++
        byPlan[plan].revenue += p.amount as number
      }

      // Courbe journalière
      const daysInMonth = new Date(y, m, 0).getDate()
      const dailyMap: Record<string, number> = {}
      for (const p of completed as Record<string, unknown>[]) {
        const day = (p.created_at as string).slice(0, 10)
        dailyMap[day] = (dailyMap[day] ?? 0) + (p.amount as number)
      }
      const daily: { date: string; amount_xof: number }[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        daily.push({ date: key, amount_xof: dailyMap[key] ?? 0 })
      }

      return json({
        period: { year: y, month: m, label: `${getMonthName(m)} ${y}` },
        summary: {
          transactions_completed: completed.length,
          transactions_failed: failed.length,
          transactions_refunded: refunded.length,
          total_revenue_xof: totalRevenue,
          total_refunded_xof: totalRefunded,
          net_revenue_xof: netRevenue,
          estimated_commission_xof: estimatedCommission,
          net_after_commission_xof: netAfterCommission,
          success_rate_pct: completed.length + failed.length > 0
            ? Math.round((completed.length / (completed.length + failed.length)) * 1000) / 10
            : 0,
        },
        by_operator: byOperator,
        by_plan: byPlan,
        daily,
      })
    }

    // ── FAILURE STATS ─────────────────────────────────────────────────────────
    if (action === 'failure_stats') {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [allRes, failedRes] = await Promise.all([
        supabase
          .from('payments')
          .select('operator, phone, status')
          .gte('created_at', since),
        supabase
          .from('payments')
          .select('operator, phone, created_at')
          .eq('status', 'failed')
          .gte('created_at', since),
      ])

      const allPayments = (allRes.data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        operator: p.operator ?? detectOperator(p.phone as string | null),
      }))
      const failedPayments = (failedRes.data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        operator: p.operator ?? detectOperator(p.phone as string | null),
      }))

      const statsMap: Record<string, { total: number; failed: number }> = {}
      for (const p of allPayments as Record<string, unknown>[]) {
        const op = (p.operator as string) ?? 'Inconnu'
        if (!statsMap[op]) statsMap[op] = { total: 0, failed: 0 }
        statsMap[op].total++
      }
      for (const p of failedPayments as Record<string, unknown>[]) {
        const op = (p.operator as string) ?? 'Inconnu'
        if (!statsMap[op]) statsMap[op] = { total: 0, failed: 0 }
        statsMap[op].failed++
      }

      const stats = Object.entries(statsMap).map(([operator, { total, failed }]) => ({
        operator,
        total,
        failed,
        failure_rate_pct: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0,
      })).sort((a, b) => b.failure_rate_pct - a.failure_rate_pct)

      const totalAll = allPayments.length
      const totalFailed = failedPayments.length
      const globalFailureRate = totalAll > 0 ? Math.round((totalFailed / totalAll) * 1000) / 10 : 0

      return json({
        since,
        global: { total: totalAll, failed: totalFailed, failure_rate_pct: globalFailureRate },
        by_operator: stats,
      })
    }

    return json({ error: `Action inconnue : ${action}` }, 400)

  } catch (err) {
    console.error('admin-payments error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function getMonthName(m: number): string {
  const names = ['Janvier','Février','Mars','Avril','Mai','Juin',
                 'Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  return names[m - 1] ?? String(m)
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
