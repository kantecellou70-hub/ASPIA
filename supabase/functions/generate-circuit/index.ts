/**
 * generate-circuit
 *
 * Génère un circuit d'apprentissage depuis un document PDF via Claude Opus.
 * Opus est conservé ici car la lecture PDF + structuration pédagogique requiert
 * la meilleure capacité de raisonnement disponible.
 *
 * Optimisations coût :
 *   1. Cache par hash SHA-256 du PDF : si le même fichier a déjà été traité
 *      (même upload ou re-upload), retourne le circuit existant sans appel API.
 *   2. Vérification du cap mensuel avant l'appel Claude.
 *   3. Tracking de la consommation réelle après l'appel.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { checkMonthlyTokenCap, recordUsage } from '../_shared/ai-tracker.ts'
import { checkRateLimit } from '../_shared/rate-limiter.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'
import { importKeyB64, decryptBuffer } from '../_shared/crypto.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const CIRCUIT_MODEL = 'claude-opus-4-6'

/** Calcule le SHA-256 d'un ArrayBuffer, retourne une chaîne hex. */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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
    const { document_id } = await req.json()
    if (!document_id) return jsonResp({ error: 'document_id requis' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (userError || !user) return jsonResp({ error: 'Non authentifié' }, 401)

    // Rate limiting
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()
    const userPlan = profile?.plan ?? 'free'

    const rl = await checkRateLimit(supabase, user.id, 'circuit', userPlan)
    if (!rl.allowed) {
      writeAuditLog(supabase, {
        userId: user.id, action: 'circuit.generate', resourceType: 'document', resourceId: document_id,
        metadata: { rate_limit_window: rl.window, count: rl.count, limit: rl.limit },
        ipAddress, userAgent, status: 'blocked',
      }).catch((e) => console.warn('audit failed:', e))
      return jsonResp({
        error: `Trop de requêtes — limite ${rl.window}ire atteinte (${rl.count}/${rl.limit})`,
        retry_after: rl.window === 'minute' ? 60 : rl.window === 'hour' ? 3600 : 86400,
      }, 429)
    }

    // ── 1. Récupère le document ───────────────────────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('storage_path, name, file_hash, vault_key_id, is_encrypted')
      .eq('id', document_id)
      .eq('user_id', user.id)
      .single()

    if (docError || !doc) return jsonResp({ error: 'Document introuvable' }, 404)

    // ── 2. Télécharge le PDF (nécessaire pour le hash et la génération) ───────
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (fileError || !fileData) throw new Error(`Erreur téléchargement : ${fileError?.message}`)

    let arrayBuffer = await fileData.arrayBuffer()

    // Déchiffre si nécessaire
    if (doc.is_encrypted && doc.vault_key_id) {
      const { data: keyB64 } = await supabase.rpc('vault_get_document_key', {
        p_vault_key_id: doc.vault_key_id,
      })
      if (keyB64) {
        const key = await importKeyB64(keyB64 as string)
        arrayBuffer = await decryptBuffer(arrayBuffer, key)
      }
    }

    // ── 3. Calcule ou récupère le hash SHA-256 du fichier ─────────────────────
    let fileHash = doc.file_hash as string | null
    if (!fileHash) {
      fileHash = await sha256Hex(arrayBuffer)
      // Stocke le hash pour les prochaines requêtes
      await supabase
        .from('documents')
        .update({ file_hash: fileHash })
        .eq('id', document_id)
    }

    // ── 4. Vérifie le cache : circuit existant pour ce document ou même hash ──
    // Niveau 1 : circuit lié directement à ce document_id
    const { data: existingByDoc } = await supabase
      .from('circuits')
      .select('*, steps:circuit_steps(*)')
      .eq('document_id', document_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingByDoc) {
      console.log(`[generate-circuit] Cache hit (document_id) for doc ${document_id}`)
      return jsonResp({ ...existingByDoc, _cached: true })
    }

    // Niveau 2 : circuit lié à un autre document avec le même hash (re-upload)
    const { data: sameHashDocs } = await supabase
      .from('documents')
      .select('id')
      .eq('file_hash', fileHash)
      .eq('user_id', user.id)
      .neq('id', document_id)

    if (sameHashDocs && sameHashDocs.length > 0) {
      const otherDocIds = sameHashDocs.map((d: { id: string }) => d.id)
      const { data: existingByHash } = await supabase
        .from('circuits')
        .select('*, steps:circuit_steps(*)')
        .in('document_id', otherDocIds)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingByHash) {
        console.log(`[generate-circuit] Cache hit (file_hash) for doc ${document_id}`)
        return jsonResp({ ...existingByHash, _cached: true })
      }
    }

    // ── 5. Aucun cache : vérification du cap mensuel ──────────────────────────
    const cap = await checkMonthlyTokenCap(supabase, user.id)
    if (!cap.allowed) {
      return jsonResp({
        error: 'Cap mensuel de tokens atteint',
        used: cap.used,
        limit: cap.limit,
        plan: cap.plan,
        upgrade_hint: cap.plan === 'free'
          ? 'Passez au plan Starter pour 10x plus de tokens.'
          : 'Contactez-nous pour augmenter votre quota.',
      }, 429)
    }

    // ── 6. Génération via Claude Opus ─────────────────────────────────────────
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const message = await anthropic.messages.create({
      model: CIRCUIT_MODEL,
      max_tokens: 4096,
      system: `Tu es un expert en pédagogie. Tu génères des circuits d'apprentissage structurés à partir de documents.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après.`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Génère un circuit d'apprentissage complet pour ce document.
Structure JSON requise (5 à 8 étapes) :
{
  "title": "titre du circuit",
  "description": "description en 1-2 phrases",
  "steps": [
    {
      "order": 1,
      "title": "titre de l'étape",
      "content": "contenu pédagogique détaillé de l'étape (200-400 mots)",
      "key_concepts": ["concept1", "concept2", "concept3"]
    }
  ]
}`,
          },
        ],
      }],
    }, { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } })

    // ── 7. Tracking + audit (non-bloquants) ──────────────────────────────────
    recordUsage(supabase, {
      userId: user.id,
      model: CIRCUIT_MODEL,
      operation: 'circuit',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }).catch((e) => console.warn('recordUsage circuit failed:', e))

    writeAuditLog(supabase, {
      userId: user.id, action: 'circuit.generate', resourceType: 'document', resourceId: document_id,
      metadata: { model: CIRCUIT_MODEL, tokens_in: message.usage.input_tokens, tokens_out: message.usage.output_tokens, cached: false },
      ipAddress, userAgent,
    }).catch((e) => console.warn('audit failed:', e))

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    interface StepInput {
      order: number; title: string; content: string; key_concepts: string[]
    }
    interface CircuitInput {
      title: string; description: string; steps: StepInput[]
    }

    let circuitData: CircuitInput
    try {
      circuitData = JSON.parse(rawText) as CircuitInput
    } catch {
      throw new Error('Réponse Claude invalide (JSON attendu)')
    }

    // Insère le circuit
    const { data: circuit, error: circuitError } = await supabase
      .from('circuits')
      .insert({
        user_id: user.id,
        document_id,
        title: circuitData.title,
        description: circuitData.description,
        total_steps: circuitData.steps.length,
        completed_steps: 0,
        status: 'not_started',
      })
      .select()
      .single()

    if (circuitError || !circuit) throw new Error(`Erreur insertion circuit : ${circuitError?.message}`)

    const { data: steps, error: stepsError } = await supabase
      .from('circuit_steps')
      .insert(circuitData.steps.map((s) => ({
        circuit_id: circuit.id,
        order: s.order,
        title: s.title,
        content: s.content,
        key_concepts: s.key_concepts,
        is_completed: false,
      })))
      .select()

    if (stepsError) throw new Error(`Erreur insertion étapes : ${stepsError.message}`)

    return jsonResp({ ...circuit, steps, _cached: false })

  } catch (err) {
    console.error('generate-circuit error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
