/**
 * encrypt-document
 *
 * Chiffre un PDF uploadé dans Supabase Storage via AES-256-GCM.
 * La clé de chiffrement est stockée dans Supabase Vault (pgsodium).
 *
 * Appelé depuis useUpload après l'upload initial, avant l'analyse IA.
 *
 * Flow :
 *   1. Télécharge le fichier depuis Storage
 *   2. Génère une clé AES-256 + IV aléatoires
 *   3. Chiffre le contenu
 *   4. Stocke la clé dans Vault via vault_create_document_key RPC
 *   5. Réupload le fichier chiffré (remplace l'original)
 *   6. Met à jour documents.vault_key_id + documents.is_encrypted
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { generateKey, exportKeyB64, encryptBuffer } from '../_shared/crypto.ts'
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
    const { document_id } = await req.json()
    if (!document_id) return jsonResp({ error: 'document_id requis' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResp({ error: 'Non authentifié' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token)
    if (userError || !user) return jsonResp({ error: 'Non authentifié' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Récupère le document (doit appartenir à l'utilisateur)
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, storage_path, is_encrypted, vault_key_id')
      .eq('id', document_id)
      .eq('user_id', user.id)
      .single()

    if (docError || !doc) return jsonResp({ error: 'Document introuvable' }, 404)

    // Déjà chiffré — idempotent
    if (doc.is_encrypted && doc.vault_key_id) {
      return jsonResp({ document_id, already_encrypted: true })
    }

    // ── 1. Télécharge le fichier original ────────────────────────────────────
    const { data: fileBlob, error: dlError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (dlError || !fileBlob) throw new Error(`Téléchargement échoué : ${dlError?.message}`)

    const plaintext = await fileBlob.arrayBuffer()

    // ── 2. Génère la clé AES-256 et chiffre ──────────────────────────────────
    const key = await generateKey()
    const keyB64 = await exportKeyB64(key)
    const ciphertext = await encryptBuffer(plaintext, key)

    // ── 3. Stocke la clé dans Vault ───────────────────────────────────────────
    const { data: vaultKeyId, error: vaultErr } = await supabase.rpc(
      'vault_create_document_key',
      { p_document_id: document_id, p_key_b64: keyB64 },
    )
    if (vaultErr || !vaultKeyId) throw new Error(`Vault error : ${vaultErr?.message}`)

    // ── 4. Remplace le fichier par la version chiffrée ────────────────────────
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .update(doc.storage_path, ciphertext, {
        contentType: 'application/octet-stream',
        upsert: true,
      })
    if (uploadErr) throw new Error(`Upload chiffré échoué : ${uploadErr.message}`)

    // ── 5. Met à jour la table documents ─────────────────────────────────────
    const { error: updErr } = await supabase
      .from('documents')
      .update({ vault_key_id: vaultKeyId, is_encrypted: true })
      .eq('id', document_id)
    if (updErr) throw new Error(`Update documents échoué : ${updErr.message}`)

    // ── 6. Audit log ─────────────────────────────────────────────────────────
    writeAuditLog(supabase, {
      userId:       user.id,
      action:       'document.encrypt',
      resourceType: 'document',
      resourceId:   document_id,
      metadata:     { vault_key_id: vaultKeyId },
      ipAddress,
      userAgent,
    }).catch((e) => console.warn('audit log failed:', e))

    return jsonResp({ document_id, encrypted: true, vault_key_id: vaultKeyId })

  } catch (err) {
    console.error('encrypt-document error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
