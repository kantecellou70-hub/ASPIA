/**
 * purge-expired-data
 *
 * Supprime les données expirées selon la politique de rétention de chaque utilisateur.
 * Appelé mensuellement par pg_cron ou un scheduler externe.
 *
 * Pour chaque utilisateur dont les données ont expiré :
 *   1. Télécharge les documents à supprimer
 *   2. Supprime la clé de chiffrement dans Vault (si chiffré)
 *   3. Supprime les fichiers dans Storage
 *   4. Appelle purge_expired_user_data RPC (supprime DB : documents + quiz_attempts)
 *   5. Logue dans audit_logs
 *
 * Puis appelle purge_system_data RPC pour nettoyer :
 *   - rate_limit_buckets expirés
 *   - audit_logs > 24 mois
 *   - ai_daily_costs > 13 mois
 *   - ai_usage > 13 mois
 *
 * Accès réservé : Bearer = SERVICE_ROLE_KEY (via pg_cron) ou admin authentifié.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { writeAuditLog } from '../_shared/audit.ts'

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Auth : service role direct (depuis pg_cron) ou admin authentifié
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      // Vérifie que c'est le service role key ou un admin
      const token = authHeader.replace('Bearer ', '')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      if (token !== serviceRoleKey) {
        // Vérifie admin via JWT utilisateur
        const supabaseUser = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
        )
        const { data: { user } } = await supabaseUser.auth.getUser(token)
        if (!user) return jsonResp({ error: 'Non authentifié' }, 401)

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') return jsonResp({ error: 'Accès refusé' }, 403)
      }
    }

    // ── 1. Récupère les utilisateurs avec leur politique de rétention ──────────
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, data_retention_months')

    if (profilesError) throw profilesError

    let totalDocsDeleted = 0
    let totalAttemptsDeleted = 0
    let usersProcessed = 0

    for (const profile of profiles ?? []) {
      const retentionMonths = profile.data_retention_months ?? 12
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - retentionMonths)

      // Récupère les documents expirés (pour nettoyer Storage + Vault avant suppression DB)
      const { data: expiredDocs } = await supabase
        .from('documents')
        .select('id, storage_path, vault_key_id, is_encrypted')
        .eq('user_id', profile.id)
        .lt('created_at', cutoff.toISOString())

      if (!expiredDocs || expiredDocs.length === 0) continue

      usersProcessed++

      // ── 2. Supprime les clés Vault et fichiers Storage ────────────────────
      for (const doc of expiredDocs) {
        // Supprime la clé de chiffrement dans Vault si elle existe
        if (doc.is_encrypted && doc.vault_key_id) {
          const { error: vaultErr } = await supabase.rpc('vault_delete_document_key', {
            p_vault_key_id: doc.vault_key_id,
          })
          if (vaultErr) {
            console.warn(`[purge] Vault delete failed for doc ${doc.id}:`, vaultErr.message)
          }
        }

        // Supprime le fichier de Storage
        const { error: storageErr } = await supabase.storage
          .from('documents')
          .remove([doc.storage_path])
        if (storageErr) {
          console.warn(`[purge] Storage delete failed for ${doc.storage_path}:`, storageErr.message)
        }
      }

      // ── 3. Purge DB via RPC (documents + quiz_attempts) ───────────────────
      const { data: purgeResult, error: purgeErr } = await supabase.rpc(
        'purge_expired_user_data',
        {
          p_user_id:          profile.id,
          p_retention_months: retentionMonths,
        },
      )

      if (purgeErr) {
        console.error(`[purge] RPC failed for user ${profile.id}:`, purgeErr.message)
        continue
      }

      const docsDeleted    = purgeResult?.p_out_docs_deleted     ?? expiredDocs.length
      const attemptsDeleted = purgeResult?.p_out_attempts_deleted ?? 0

      totalDocsDeleted     += docsDeleted
      totalAttemptsDeleted += attemptsDeleted

      // ── 4. Audit log ────────────────────────────────────────────────────────
      if (docsDeleted > 0 || attemptsDeleted > 0) {
        writeAuditLog(supabase, {
          userId:       profile.id,
          action:       'data.purge',
          resourceType: 'user',
          resourceId:   profile.id,
          metadata:     {
            docs_deleted:     docsDeleted,
            attempts_deleted: attemptsDeleted,
            retention_months: retentionMonths,
            cutoff:           cutoff.toISOString(),
          },
        }).catch((e) => console.warn('audit log failed:', e))
      }
    }

    // ── 5. Purge des tables système ───────────────────────────────────────────
    const { error: systemErr } = await supabase.rpc('purge_system_data')
    if (systemErr) {
      console.error('[purge] purge_system_data failed:', systemErr.message)
    }

    return jsonResp({
      status:               'ok',
      users_processed:      usersProcessed,
      docs_deleted:         totalDocsDeleted,
      attempts_deleted:     totalAttemptsDeleted,
      system_tables_purged: !systemErr,
      ran_at:               new Date().toISOString(),
    })

  } catch (err) {
    console.error('purge-expired-data error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
