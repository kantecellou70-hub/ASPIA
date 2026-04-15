/**
 * admin-crm — CRM interne APSIA
 *
 * Accès réservé aux utilisateurs avec role = 'admin'.
 *
 * Actions :
 *   list          — liste paginée des utilisateurs avec filtres
 *   detail        — profil complet d'un utilisateur
 *   change_plan   — changer le plan d'un utilisateur
 *   gift_sessions — offrir des sessions supplémentaires
 *   ban           — bannir un utilisateur
 *   unban         — débannir un utilisateur
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const PLANS = ['free', 'starter', 'pro', 'enterprise'] as const
const SESSION_LIMITS: Record<string, number> = {
  free: 3,
  starter: 20,
  pro: 100,
  enterprise: -1,  // illimité
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json().catch(() => ({}))
    const {
      action,
      // list
      page = 1, page_size = 20, filter_plan, filter_city, search,
      // detail / actions
      user_id, new_plan, sessions_to_add,
    } = body as {
      action: string
      page?: number
      page_size?: number
      filter_plan?: string
      filter_city?: string
      search?: string
      user_id?: string
      new_plan?: string
      sessions_to_add?: number
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

    // ── Actions ────────────────────────────────────────────────────────────────

    if (action === 'list') {
      const from = (page - 1) * page_size
      const to = from + page_size - 1

      let query = supabase
        .from('profiles')
        .select(
          'id, full_name, avatar_url, role, plan, sessions_used, sessions_limit, city, is_banned, created_at, updated_at',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filter_plan && PLANS.includes(filter_plan as typeof PLANS[number])) {
        query = query.eq('plan', filter_plan)
      }
      if (filter_city) {
        query = query.ilike('city', `%${filter_city}%`)
      }
      if (search) {
        query = query.ilike('full_name', `%${search}%`)
      }

      const { data: profiles, count, error: listErr } = await query
      if (listErr) throw listErr

      // Récupérer les emails depuis auth.users via admin API
      const ids = (profiles ?? []).map((p: { id: string }) => p.id)
      const emailMap: Record<string, string> = {}
      for (const uid of ids) {
        const { data: authUser } = await supabase.auth.admin.getUserById(uid)
        if (authUser?.user?.email) emailMap[uid] = authUser.user.email
      }

      const users = (profiles ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        email: emailMap[p.id as string] ?? '',
      }))

      return json({
        users,
        total: count ?? 0,
        page,
        page_size,
        total_pages: Math.ceil((count ?? 0) / page_size),
      })
    }

    if (action === 'detail') {
      if (!user_id) return json({ error: 'user_id requis' }, 400)

      const [profileRes, attemptsRes, paymentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, plan, sessions_used, sessions_limit, city, is_banned, created_at, updated_at')
          .eq('id', user_id)
          .single(),
        supabase
          .from('quiz_attempts')
          .select('id, score, started_at, completed_at')
          .eq('user_id', user_id)
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('payments')
          .select('id, amount, plan_id, status, created_at')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (profileRes.error) return json({ error: 'Utilisateur introuvable' }, 404)

      const { data: authUser } = await supabase.auth.admin.getUserById(user_id)

      // Dernière activité = max(created_at circuits, started_at quiz_attempts)
      const { data: lastCircuit } = await supabase
        .from('circuits')
        .select('created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastActivity = (() => {
        const dates: string[] = []
        if (attemptsRes.data?.[0]?.started_at) dates.push(attemptsRes.data[0].started_at)
        if (lastCircuit?.created_at) dates.push(lastCircuit.created_at)
        if (dates.length === 0) return profileRes.data.created_at
        return dates.sort().reverse()[0]
      })()

      return json({
        profile: {
          ...profileRes.data,
          email: authUser?.user?.email ?? '',
        },
        last_activity: lastActivity,
        recent_attempts: attemptsRes.data ?? [],
        payments: paymentsRes.data ?? [],
      })
    }

    if (action === 'change_plan') {
      if (!user_id) return json({ error: 'user_id requis' }, 400)
      if (!new_plan || !PLANS.includes(new_plan as typeof PLANS[number])) {
        return json({ error: `Plan invalide. Valeurs : ${PLANS.join(', ')}` }, 400)
      }
      const newLimit = SESSION_LIMITS[new_plan]
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ plan: new_plan, sessions_limit: newLimit })
        .eq('id', user_id)
      if (updErr) throw updErr
      return json({ success: true, plan: new_plan, sessions_limit: newLimit })
    }

    if (action === 'gift_sessions') {
      if (!user_id) return json({ error: 'user_id requis' }, 400)
      if (!sessions_to_add || sessions_to_add <= 0) {
        return json({ error: 'sessions_to_add doit être > 0' }, 400)
      }
      const { data: p } = await supabase
        .from('profiles')
        .select('sessions_limit')
        .eq('id', user_id)
        .single()
      const currentLimit = p?.sessions_limit ?? 0
      // Ne pas incrémenter si illimité (-1)
      if (currentLimit === -1) return json({ success: true, sessions_limit: -1 })
      const newLimit = currentLimit + sessions_to_add
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ sessions_limit: newLimit })
        .eq('id', user_id)
      if (updErr) throw updErr
      return json({ success: true, sessions_limit: newLimit })
    }

    if (action === 'ban') {
      if (!user_id) return json({ error: 'user_id requis' }, 400)
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', user_id)
      if (updErr) throw updErr
      // Optionnel : désactiver l'utilisateur dans auth.users
      await supabase.auth.admin.updateUserById(user_id, { ban_duration: '876600h' })
      return json({ success: true, is_banned: true })
    }

    if (action === 'unban') {
      if (!user_id) return json({ error: 'user_id requis' }, 400)
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ is_banned: false })
        .eq('id', user_id)
      if (updErr) throw updErr
      await supabase.auth.admin.updateUserById(user_id, { ban_duration: 'none' })
      return json({ success: true, is_banned: false })
    }

    return json({ error: `Action inconnue : ${action}` }, 400)
  } catch (err) {
    console.error('admin-crm error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
