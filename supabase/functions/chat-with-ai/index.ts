/**
 * chat-with-ai
 *
 * Conversational AI endpoint. Receives a message + optional context,
 * detects intent, and either answers directly or returns a structured
 * action card (circuit_card, quiz_card, summary_card).
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'
import { recordUsage } from '../_shared/ai-tracker.ts'
import { checkRateLimit } from '../_shared/rate-limiter.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const CHAT_MODEL = 'claude-sonnet-4-6'

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const SYSTEM_PROMPT = `Tu es APSIA, un assistant pédagogique IA pour étudiants africains.
Tu aides à comprendre des cours, générer des circuits d'apprentissage, des quiz et des résumés.

Réponds UNIQUEMENT avec un JSON valide (sans markdown) ayant cette structure :
{
  "type": "text" | "circuit_card" | "quiz_card" | "summary_card",
  "text": "ta réponse textuelle",
  "action": null | { "label": "string", "function": "generate-circuit|generate-quiz|generate-summary", "circuit_id": "string|null" }
}

Règles d'intention :
- Si l'utilisateur veut créer un circuit/parcours d'apprentissage depuis un document → type="circuit_card", action.function="generate-circuit"
- Si l'utilisateur veut un quiz sur un circuit existant → type="quiz_card", action.function="generate-quiz", action.circuit_id=<id si fourni>
- Si l'utilisateur veut un résumé d'un circuit → type="summary_card", action.function="generate-summary", action.circuit_id=<id si fourni>
- Sinon → type="text", action=null

Réponds en français, de façon concise et encourageante.`

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const { ipAddress, userAgent } = extractRequestMeta(req)

  try {
    const body = await req.json() as {
      message: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      context?: { circuit_id?: string; document_id?: string }
    }

    if (!body.message?.trim()) return jsonResp({ error: 'message requis' }, 400)

    const { userId, error: authError } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (!userId) return jsonResp({ error: authError ?? 'Non authentifié' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profileRl } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()
    const userPlan = profileRl?.plan ?? 'free'

    const rl = await checkRateLimit(supabase, userId, 'chat', userPlan)
    if (!rl.allowed) {
      writeAuditLog(supabase, {
        userId, action: 'chat.message', resourceType: 'chat', resourceId: userId,
        metadata: { rate_limit_window: rl.window },
        ipAddress, userAgent, status: 'blocked',
      }).catch((e) => console.warn('audit failed:', e))
      return jsonResp({
        error: `Trop de requêtes — limite ${rl.window}ire atteinte (${rl.count}/${rl.limit})`,
        retry_after: rl.window === 'minute' ? 60 : rl.window === 'hour' ? 3600 : 86400,
      }, 429)
    }

    // Build messages array from history + new message
    const history = (body.history ?? []).slice(-10) // keep last 10 for context
    const contextNote = body.context?.circuit_id
      ? `\n[Contexte: circuit_id=${body.context.circuit_id}]`
      : body.context?.document_id
      ? `\n[Contexte: document_id=${body.context.document_id}]`
      : ''

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: body.message + contextNote },
    ]

    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    recordUsage(supabase, {
      userId,
      model: CHAT_MODEL,
      operation: 'chat',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }).catch((e) => console.warn('recordUsage chat failed:', e))

    writeAuditLog(supabase, {
      userId, action: 'chat.message', resourceType: 'chat', resourceId: userId,
      metadata: { model: CHAT_MODEL, tokens_in: response.usage.input_tokens, tokens_out: response.usage.output_tokens },
      ipAddress, userAgent,
    }).catch((e) => console.warn('audit failed:', e))

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    interface ChatResponse {
      type: 'text' | 'circuit_card' | 'quiz_card' | 'summary_card'
      text: string
      action: { label: string; function: string; circuit_id: string | null } | null
    }

    let parsed: ChatResponse
    try {
      parsed = JSON.parse(rawText) as ChatResponse
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0]) as ChatResponse
      } else {
        parsed = { type: 'text', text: rawText, action: null }
      }
    }

    return jsonResp({ reply: parsed })

  } catch (err) {
    console.error('chat-with-ai error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
