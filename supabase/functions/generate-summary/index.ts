/**
 * generate-summary
 *
 * Génère un résumé de cours condensé à partir d'un circuit.
 * Utilise Claude Sonnet (le contenu est déjà structuré en circuit_steps,
 * pas besoin d'Opus pour cette tâche de synthèse).
 *
 * Optimisations coût :
 *   - Sonnet 4.6 au lieu d'Opus (~5x moins cher)
 *   - Enregistre la consommation réelle
 *   - Résultat non persisté en DB (client-side cache via AsyncStorage)
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { checkMonthlyTokenCap, recordUsage } from '../_shared/ai-tracker.ts'
import { checkRateLimit } from '../_shared/rate-limiter.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const SUMMARY_MODEL = 'claude-sonnet-4-6'

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
    const { circuit_id } = await req.json()
    if (!circuit_id) return jsonResp({ error: 'circuit_id requis' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { userId, error: authError } = await authenticateUser(supabase, req.headers.get('Authorization'))
    if (!userId) return jsonResp({ error: authError ?? 'Non authentifié' }, 401)

    // ── Rate limiting ─────────────────────────────────────────────────────────
    const { data: profileRl } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()
    const userPlan = profileRl?.plan ?? 'alpha'

    const rl = await checkRateLimit(supabase, userId, 'summary', userPlan)
    if (!rl.allowed) {
      writeAuditLog(supabase, {
        userId: userId, action: 'summary.generate', resourceType: 'circuit', resourceId: circuit_id,
        metadata: { rate_limit_window: rl.window, count: rl.count, limit: rl.limit },
        ipAddress, userAgent, status: 'blocked',
      }).catch((e) => console.warn('audit failed:', e))
      return jsonResp({
        error: `Trop de requêtes — limite ${rl.window}ire atteinte (${rl.count}/${rl.limit})`,
        retry_after: rl.window === 'minute' ? 60 : rl.window === 'hour' ? 3600 : 86400,
      }, 429)
    }

    // Vérification du cap mensuel
    const cap = await checkMonthlyTokenCap(supabase, userId)
    if (!cap.allowed) {
      return jsonResp({
        error: 'Cap mensuel de tokens atteint',
        used: cap.used,
        limit: cap.limit,
        plan: cap.plan,
      }, 429)
    }

    const { data: circuit, error: circuitError } = await supabase
      .from('circuits')
      .select('*, steps:circuit_steps(*)')
      .eq('id', circuit_id)
      .eq('user_id', userId)
      .single()

    if (circuitError || !circuit) return jsonResp({ error: 'Circuit introuvable' }, 404)

    interface Step { order: number; title: string; content: string; key_concepts: string[] }

    const sortedSteps = (circuit.steps as Step[]).sort((a, b) => a.order - b.order)
    const circuitContent = sortedSteps
      .map((s) => `[Étape ${s.order}] ${s.title}\n${s.content}\nConcepts : ${s.key_concepts.join(', ')}`)
      .join('\n\n')

    const message = await anthropic.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 3000,
      system: `Tu es APSIA, assistant pédagogique intelligent conçu spécifiquement pour les élèves guinéens préparant le BEPC et le BAC.

CONTEXTE ÉDUCATIF GUINÉEN :
- Adapte le résumé au niveau scolaire guinéen (collège, lycée ou université)
- Mets en avant les notions qui tombent fréquemment aux examens BEPC et BAC guinéens
- Utilise des exemples concrets tirés du contexte africain quand c'est pertinent
- Privilégie les phrases courtes et mémorisables, adaptées à l'élève guinéen
- Réponds TOUJOURS en français

Tu condenses le contenu d'un cours en un résumé clair et mémorisable.
Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.`,
      messages: [{
        role: 'user',
        content: `Génère un résumé de cours condensé (1 page) pour ce circuit d'apprentissage.

TITRE : ${circuit.title}
DESCRIPTION : ${circuit.description}

CONTENU PAR ÉTAPES :
${circuitContent}

Structure JSON requise :
{
  "title": "Résumé — ${circuit.title}",
  "sections": [
    {
      "step_title": "Titre de l'étape",
      "key_points": ["Point essentiel 1", "Point essentiel 2", "Point essentiel 3"],
      "key_concepts": ["concept1", "concept2"]
    }
  ],
  "glossary": [
    { "term": "Terme technique", "definition": "Définition concise en 1 phrase" }
  ],
  "study_tips": ["Conseil pratique 1", "Conseil pratique 2"]
}

Règles :
- 2 à 4 points essentiels par étape (phrases courtes, actionnables)
- Glossaire : 5 à 10 termes clés avec définitions précises
- 3 à 5 conseils d'étude concrets et spécifiques au contenu
- Tout le contenu en français`,
      }],
    })

    // Tracking + audit non-bloquants
    recordUsage(supabase, {
      userId: userId,
      model: SUMMARY_MODEL,
      operation: 'summary',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }).catch((e) => console.warn('recordUsage summary failed:', e))

    writeAuditLog(supabase, {
      userId: userId, action: 'summary.generate', resourceType: 'circuit', resourceId: circuit_id,
      metadata: { model: SUMMARY_MODEL, tokens_in: message.usage.input_tokens, tokens_out: message.usage.output_tokens },
      ipAddress, userAgent,
    }).catch((e) => console.warn('audit failed:', e))

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    interface SummaryData {
      title: string
      sections: { step_title: string; key_points: string[]; key_concepts: string[] }[]
      glossary: { term: string; definition: string }[]
      study_tips: string[]
    }

    let summaryData: SummaryData
    try {
      summaryData = JSON.parse(rawText) as SummaryData
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Réponse Claude invalide (JSON attendu)')
      summaryData = JSON.parse(jsonMatch[0]) as SummaryData
    }

    return jsonResp({ circuit_id, ...summaryData })

  } catch (err) {
    console.error('generate-summary error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
