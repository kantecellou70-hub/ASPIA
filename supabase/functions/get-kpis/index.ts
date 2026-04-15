/**
 * get-kpis — Tableau de bord administrateur en temps réel
 *
 * Accès réservé aux utilisateurs avec role = 'admin'.
 *
 * Retourne :
 *   active_users    — utilisateurs actifs (jour / semaine / mois)
 *   sessions        — sessions IA consommées, opérations Claude, coût estimé USD
 *   revenue         — revenus du mois (XOF) avec détail journalier
 *   conversion      — taux de conversion free → payant
 *   alert           — dépassement de seuil budgétaire si threshold fourni
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// Coûts Claude Opus 4.6 en USD (input $15/MTok, output $75/MTok)
const COST = {
  PER_CIRCUIT: 0.375,   // analyze + generate-circuit (PDF inclus)
  PER_QUIZ: 0.18,        // generate-quiz (10 questions)
  PER_SUMMARY: 0.14,     // generate-summary
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json().catch(() => ({}))
    const { alert_threshold_usd } = body as { alert_threshold_usd?: number }

    // ── Authentification & vérification admin ────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Non authentifié' }, 401)
    }

    // Vérification identité via anon key + global header (pattern officiel Supabase)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non authentifié' }, 401)

    // Client admin (service role) — pour les requêtes DB sans RLS
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

    // ── Fenêtres temporelles ─────────────────────────────────────────────────
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // ── Requêtes parallèles ───────────────────────────────────────────────────
    const [
      attemptsDayRes, attemptsWeekRes, attemptsMonthRes,
      circuitsDayRes, circuitsWeekRes, circuitsMonthRes,
      profilesRes,
      circuitsMonthCountRes, quizzesMonthCountRes,
      paymentsMonthRes,
      allCircuitsCountRes, allQuizzesCountRes,
    ] = await Promise.all([
      // Activité dans les tentatives de quiz
      supabase.from('quiz_attempts').select('user_id').gte('started_at', dayAgo),
      supabase.from('quiz_attempts').select('user_id').gte('started_at', weekAgo),
      supabase.from('quiz_attempts').select('user_id').gte('started_at', monthAgo),
      // Activité dans les circuits créés
      supabase.from('circuits').select('user_id').gte('created_at', dayAgo),
      supabase.from('circuits').select('user_id').gte('created_at', weekAgo),
      supabase.from('circuits').select('user_id').gte('created_at', monthAgo),
      // Tous les profils (plan + sessions)
      supabase.from('profiles').select('plan, sessions_used'),
      // Circuits générés ce mois (opérations IA)
      supabase.from('circuits').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      // Quiz générés ce mois
      supabase.from('quizzes').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      // Paiements du mois en cours
      supabase.from('payments')
        .select('amount, created_at, plan_id')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth)
        .order('created_at', { ascending: true }),
      // Total historique circuits et quiz (pour coût global)
      supabase.from('circuits').select('id', { count: 'exact', head: true }),
      supabase.from('quizzes').select('id', { count: 'exact', head: true }),
    ])

    // ── Utilisateurs actifs ──────────────────────────────────────────────────
    function countDistinct(
      attempts: { user_id: string }[] | null,
      circuits: { user_id: string }[] | null,
    ): number {
      const ids = new Set<string>()
      attempts?.forEach((r) => ids.add(r.user_id))
      circuits?.forEach((r) => ids.add(r.user_id))
      return ids.size
    }

    const activeUsers = {
      day: countDistinct(attemptsDayRes.data, circuitsDayRes.data),
      week: countDistinct(attemptsWeekRes.data, circuitsWeekRes.data),
      month: countDistinct(attemptsMonthRes.data, circuitsMonthRes.data),
    }

    // ── Profils & sessions ───────────────────────────────────────────────────
    const profiles = profilesRes.data ?? []
    const totalUsers = profiles.length
    const paidUsers = profiles.filter((p) => p.plan !== 'free').length
    const totalSessionsConsumed = profiles.reduce((s, p) => s + (p.sessions_used ?? 0), 0)

    const conversionRate = totalUsers > 0
      ? Math.round((paidUsers / totalUsers) * 1000) / 10  // 1 décimale
      : 0

    // Distribution des plans
    const planDistribution: Record<string, number> = {}
    profiles.forEach((p) => {
      planDistribution[p.plan] = (planDistribution[p.plan] ?? 0) + 1
    })

    // ── Opérations IA & coût estimé ──────────────────────────────────────────
    const circuitsMonthCount = circuitsMonthCountRes.count ?? 0
    const quizzesMonthCount = quizzesMonthCountRes.count ?? 0
    const totalCircuits = allCircuitsCountRes.count ?? 0
    const totalQuizzes = allQuizzesCountRes.count ?? 0

    const estimatedCostMonthUsd =
      circuitsMonthCount * COST.PER_CIRCUIT +
      quizzesMonthCount * COST.PER_QUIZ

    const estimatedCostTotalUsd =
      totalCircuits * COST.PER_CIRCUIT +
      totalQuizzes * COST.PER_QUIZ

    const costAlertTriggered = alert_threshold_usd != null
      ? estimatedCostMonthUsd > alert_threshold_usd
      : false

    // ── Revenus ──────────────────────────────────────────────────────────────
    const payments = paymentsMonthRes.data ?? []
    const totalRevenueMonthXof = payments.reduce((s, p) => s + (p.amount ?? 0), 0)

    // Groupement par jour (YYYY-MM-DD)
    const revenueByDayMap: Record<string, number> = {}
    payments.forEach((p) => {
      const day = p.created_at.slice(0, 10)
      revenueByDayMap[day] = (revenueByDayMap[day] ?? 0) + (p.amount ?? 0)
    })

    // Série complète pour les 30 derniers jours (0 si aucune transaction)
    const revenueByDay: { date: string; amount_xof: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      revenueByDay.push({ date: key, amount_xof: revenueByDayMap[key] ?? 0 })
    }

    // Distribution des revenus par plan
    const revenueByPlan: Record<string, number> = {}
    payments.forEach((p) => {
      revenueByPlan[p.plan_id] = (revenueByPlan[p.plan_id] ?? 0) + (p.amount ?? 0)
    })

    // ── Réponse finale ────────────────────────────────────────────────────────
    return json({
      last_updated: now.toISOString(),
      active_users: activeUsers,
      sessions: {
        total_consumed: totalSessionsConsumed,
        circuits_month: circuitsMonthCount,
        quizzes_month: quizzesMonthCount,
        estimated_cost_month_usd: Math.round(estimatedCostMonthUsd * 100) / 100,
        estimated_cost_total_usd: Math.round(estimatedCostTotalUsd * 100) / 100,
        cost_alert_triggered: costAlertTriggered,
      },
      revenue: {
        total_month_xof: totalRevenueMonthXof,
        total_month_gnf: totalRevenueMonthXof * 20,
        by_day: revenueByDay,
        by_plan: revenueByPlan,
        transactions_count: payments.length,
      },
      conversion: {
        total_users: totalUsers,
        paid_users: paidUsers,
        rate_pct: conversionRate,
        plan_distribution: planDistribution,
      },
    })
  } catch (err) {
    console.error('get-kpis error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
