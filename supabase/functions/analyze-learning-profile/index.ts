/**
 * analyze-learning-profile
 *
 * Receives onboarding questionnaire answers, calls Claude Sonnet to generate
 * personalized AI recommendations, and stores the result in learning_profiles.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'
import { recordUsage } from '../_shared/ai-tracker.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const MODEL = 'claude-sonnet-4-6'

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
    const profile = await req.json() as {
      niveau?: string
      filiere?: string
      ville?: string
      objectif?: string
      learning_style?: string
      available_time?: string
      subjects?: string[]
      difficulties?: string[]
    }

    const { userId, error: authError } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (!userId) return jsonResp({ error: authError ?? 'Non authentifié' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const prompt = `Tu es un conseiller pédagogique. Analyse ce profil d'étudiant et génère des recommandations personnalisées.

Profil :
- Niveau : ${profile.niveau ?? 'non précisé'}
- Filière : ${profile.filiere ?? 'non précisé'}
- Ville : ${profile.ville ?? 'non précisé'}
- Objectif : ${profile.objectif ?? 'non précisé'}
- Style d'apprentissage : ${profile.learning_style ?? 'non précisé'}
- Temps disponible : ${profile.available_time ?? 'non précisé'}
- Matières : ${(profile.subjects ?? []).join(', ') || 'non précisé'}
- Difficultés : ${(profile.difficulties ?? []).join(', ') || 'aucune'}

Réponds UNIQUEMENT en JSON valide (sans markdown) :
{
  "strengths": ["force1", "force2", "force3"],
  "weaknesses": ["faiblesse1", "faiblesse2"],
  "recommendations": [
    { "title": "Titre", "description": "Description courte", "priority": "high|medium|low" }
  ],
  "study_plan": "Plan d'étude personnalisé en 2-3 phrases",
  "motivational_message": "Message d'encouragement personnalisé"
}`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    recordUsage(supabase, {
      userId,
      model: MODEL,
      operation: 'profile_analysis',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }).catch((e) => console.warn('recordUsage profile failed:', e))

    writeAuditLog(supabase, {
      userId, action: 'profile.analyze', resourceType: 'learning_profile', resourceId: userId,
      metadata: { model: MODEL, tokens_in: response.usage.input_tokens },
      ipAddress, userAgent,
    }).catch((e) => console.warn('audit failed:', e))

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    interface AiResult {
      strengths: string[]
      weaknesses: string[]
      recommendations: { title: string; description: string; priority: string }[]
      study_plan: string
      motivational_message: string
    }

    let aiResult: AiResult
    try {
      aiResult = JSON.parse(rawText) as AiResult
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Réponse IA invalide')
      aiResult = JSON.parse(match[0]) as AiResult
    }

    // Upsert learning profile
    const { error: upsertErr } = await supabase
      .from('learning_profiles')
      .upsert({
        user_id: userId,
        ...profile,
        strengths: aiResult.strengths,
        weaknesses: aiResult.weaknesses,
        ai_recommendations: aiResult,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertErr) throw new Error(`Erreur sauvegarde profil : ${upsertErr.message}`)

    // Mark onboarding completed
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true, learning_style: profile.learning_style ?? null })
      .eq('id', userId)

    return jsonResp({ ...aiResult })

  } catch (err) {
    console.error('analyze-learning-profile error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
