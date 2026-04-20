/**
 * analyze-learning-profile
 *
 * Receives onboarding questionnaire answers, calls Claude Sonnet to generate
 * personalized AI recommendations, and stores the result in learning_profiles.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
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

    // supabase MUST be created before authenticateUser
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { userId, error: authError } = await authenticateUser(supabase, req.headers.get('Authorization'))
    if (!userId) return jsonResp({ error: authError ?? 'Non authentifié' }, 401)

    const prompt = `Tu es APSIA, conseiller pédagogique pour élèves guinéens préparant le BEPC et le BAC.

CONTEXTE ÉDUCATIF GUINÉEN :
- Filières lycée : SM, SS, SE, A, B1, C, D
- Matières BEPC : Mathématiques, Français, Sciences Physiques, Sciences Naturelles, Histoire-Géographie, Anglais, Éducation Civique
- BEPC en juin, BAC en juillet — adapte tes recommandations au calendrier scolaire guinéen
- Le taux de réussite au BAC est inférieur à 40% — aide cet élève à faire partie des 40% qui réussissent
- Adapte ton vocabulaire au niveau scolaire indiqué, encourage et motive l'élève
- Réponds TOUJOURS en français

Analyse ce profil d'élève et génère des recommandations personnalisées :

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
    { "title": "Titre", "description": "Description courte adaptée au contexte guinéen", "priority": "high|medium|low" }
  ],
  "study_plan": "Plan d'étude personnalisé en 2-3 phrases, adapté au calendrier BEPC/BAC guinéen",
  "motivational_message": "Message d'encouragement personnalisé, en tutoiement, adapté au contexte guinéen"
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
