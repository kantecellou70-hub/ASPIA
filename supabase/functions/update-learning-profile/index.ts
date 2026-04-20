/**
 * update-learning-profile
 *
 * Called after each quiz attempt to update strengths/weaknesses
 * based on quiz performance.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const { ipAddress, userAgent } = extractRequestMeta(req)

  try {
    const { circuit_id, score, subject } = await req.json() as {
      circuit_id: string
      score: number
      subject?: string
    }

    if (!circuit_id || score === undefined) {
      return jsonResp({ error: 'circuit_id et score requis' }, 400)
    }

    const { userId, error: authError } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (!userId) return jsonResp({ error: authError ?? 'Non authentifié' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: lp } = await supabase
      .from('learning_profiles')
      .select('strengths, weaknesses')
      .eq('user_id', userId)
      .single()

    if (!lp) {
      return jsonResp({ updated: false, reason: 'Pas de profil d\'apprentissage trouvé' })
    }

    const strengths: string[] = lp.strengths ?? []
    const weaknesses: string[] = lp.weaknesses ?? []
    const tag = subject ?? circuit_id

    if (score >= 70) {
      if (!strengths.includes(tag)) strengths.push(tag)
      const idx = weaknesses.indexOf(tag)
      if (idx !== -1) weaknesses.splice(idx, 1)
    } else {
      if (!weaknesses.includes(tag)) weaknesses.push(tag)
    }

    const { error: updateErr } = await supabase
      .from('learning_profiles')
      .update({ strengths, weaknesses })
      .eq('user_id', userId)

    if (updateErr) throw new Error(`Erreur mise à jour profil : ${updateErr.message}`)

    writeAuditLog(supabase, {
      userId, action: 'profile.update', resourceType: 'learning_profile', resourceId: userId,
      metadata: { circuit_id, score },
      ipAddress, userAgent,
    }).catch((e) => console.warn('audit failed:', e))

    return jsonResp({ updated: true, strengths, weaknesses })

  } catch (err) {
    console.error('update-learning-profile error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
