/**
 * audit.ts — Journaux d'audit APSIA
 *
 * Écrit de manière non-bloquante dans la table public.audit_logs.
 * Toujours appeler avec .catch() pour ne pas faire échouer la requête principale.
 */

export interface AuditEntry {
  userId: string | null
  action: string                  // ex: 'circuit.generate', 'admin.ban', 'document.upload'
  resourceType?: string           // 'document' | 'circuit' | 'quiz' | 'payment' | 'user'
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
  status?: 'success' | 'failure' | 'blocked'
}

/**
 * Écrit une entrée dans audit_logs (non-bloquant).
 * Usage : writeAuditLog(supabase, entry).catch(e => console.warn('audit failed:', e))
 */
export async function writeAuditLog(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id:       entry.userId,
    action:        entry.action,
    resource_type: entry.resourceType ?? null,
    resource_id:   entry.resourceId   ?? null,
    metadata:      entry.metadata     ?? {},
    ip_address:    entry.ipAddress    ?? null,
    user_agent:    entry.userAgent    ?? null,
    status:        entry.status       ?? 'success',
  })
  if (error) throw new Error(`audit_logs insert: ${error.message}`)
}

/** Extrait l'IP et User-Agent d'une Request Deno. */
export function extractRequestMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  }
}
