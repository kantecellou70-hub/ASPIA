/**
 * analyze-document
 *
 * Analyse un PDF via Claude Opus et retourne une structure pédagogique.
 * Opus est conservé ici pour la lecture précise du contenu PDF.
 *
 * Optimisations coût :
 *   - Calcule et stocke le SHA-256 du PDF dans documents.file_hash
 *   - Enregistre la consommation réelle de tokens
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'
import { recordUsage } from '../_shared/ai-tracker.ts'
import { checkRateLimit } from '../_shared/rate-limiter.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'
import { importKeyB64, decryptBuffer } from '../_shared/crypto.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const ANALYSIS_MODEL = 'claude-opus-4-6'

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { document_id } = await req.json()
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { ipAddress, userAgent } = extractRequestMeta(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Auth : récupère user_id depuis le JWT (nécessaire pour le tracking + rate limit)
    let userPlan = 'free'
    const { userId } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', userId)
          .single()
        userPlan = profile?.plan ?? 'free'
      }

    // Rate limiting
    if (userId) {
      const rl = await checkRateLimit(supabase, userId, 'analyze', userPlan)
      if (!rl.allowed) {
        writeAuditLog(supabase, {
          userId, action: 'document.analyze', resourceType: 'document', resourceId: document_id,
          metadata: { rate_limit_window: rl.window, count: rl.count, limit: rl.limit },
          ipAddress, userAgent, status: 'blocked',
        }).catch((e) => console.warn('audit failed:', e))
        return new Response(JSON.stringify({
          error: `Trop de requêtes — limite ${rl.window}ire atteinte (${rl.count}/${rl.limit})`,
          retry_after: rl.window === 'minute' ? 60 : rl.window === 'hour' ? 3600 : 86400,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('storage_path, name, mime_type, file_hash, vault_key_id, is_encrypted')
      .eq('id', document_id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (fileError || !fileData) throw new Error(`Erreur téléchargement : ${fileError?.message}`)

    let arrayBuffer = await fileData.arrayBuffer()

    // Déchiffre le PDF si chiffré
    if (doc.is_encrypted && doc.vault_key_id) {
      const { data: keyB64 } = await supabase.rpc('vault_get_document_key', {
        p_vault_key_id: doc.vault_key_id,
      })
      if (keyB64) {
        const key = await importKeyB64(keyB64 as string)
        arrayBuffer = await decryptBuffer(arrayBuffer, key)
      }
    }

    // Calcule et stocke le hash si absent
    if (!doc.file_hash) {
      const hash = await sha256Hex(arrayBuffer)
      await supabase
        .from('documents')
        .update({ file_hash: hash })
        .eq('id', document_id)
    }

    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const message = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Analyse ce document pédagogique et réponds en JSON pur (sans markdown) avec cette structure exacte :
{
  "title": "titre principal du document",
  "subject": "matière ou domaine",
  "level": "niveau estimé (débutant/intermédiaire/avancé)",
  "language": "fr ou en",
  "main_topics": ["sujet1", "sujet2"],
  "summary": "résumé en 2-3 phrases",
  "key_concepts": ["concept1", "concept2"],
  "estimated_steps": 5
}
Réponds uniquement avec le JSON, aucun texte avant ou après.`,
          },
        ],
      }],
    }, { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } })

    // Tracking + audit non-bloquants
    if (userId) {
      recordUsage(supabase, {
        userId,
        model: ANALYSIS_MODEL,
        operation: 'analysis',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      }).catch((e) => console.warn('recordUsage analysis failed:', e))

      writeAuditLog(supabase, {
        userId, action: 'document.analyze', resourceType: 'document', resourceId: document_id,
        metadata: { model: ANALYSIS_MODEL, tokens_in: message.usage.input_tokens, tokens_out: message.usage.output_tokens },
        ipAddress, userAgent,
      }).catch((e) => console.warn('audit failed:', e))
    }

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(rawText)
    } catch {
      analysis = {
        title: doc.name.replace('.pdf', ''),
        subject: 'Général',
        level: 'intermédiaire',
        language: 'fr',
        main_topics: [],
        summary: rawText.slice(0, 300),
        key_concepts: [],
        estimated_steps: 5,
      }
    }

    return new Response(JSON.stringify({ document_id, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('analyze-document error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
