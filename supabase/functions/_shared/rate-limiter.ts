/**
 * rate-limiter.ts — Rate limiting par utilisateur basé sur PostgreSQL
 *
 * Fenêtres glissantes par plan :
 *   free      : 5/min · 30/h  · 50/day
 *   starter   : 15/min · 100/h · 200/day
 *   pro       : 30/min · 300/h · 1000/day
 *   enterprise: 60/min · 600/h · unlimited
 */

export interface RateLimitConfig {
  minute: number
  hour: number
  day: number
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free:       { minute: 5,  hour: 30,  day: 50    },
  starter:    { minute: 15, hour: 100, day: 200   },
  pro:        { minute: 30, hour: 300, day: 1000  },
  enterprise: { minute: 60, hour: 600, day: 99999 },
}

export interface RateLimitResult {
  allowed: boolean
  window: 'minute' | 'hour' | 'day' | null
  count: number
  limit: number
}

/**
 * Vérifie et incrémente les 3 fenêtres de rate limiting pour un utilisateur.
 * Appelle la RPC `rate_limit_increment` pour chaque fenêtre.
 * Retourne le résultat de la première fenêtre bloquante (ou allowed: true).
 */
export async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  operation: string,
  plan: string,
): Promise<RateLimitResult> {
  const limits = RATE_LIMITS[plan] ?? RATE_LIMITS['free']
  const now = new Date()

  // Clés de fenêtres : minute courante, heure courante, jour courant
  const minuteKey = `${operation}:min:${now.toISOString().slice(0, 16)}`  // YYYY-MM-DDTHH:MM
  const hourKey   = `${operation}:h:${now.toISOString().slice(0, 13)}`    // YYYY-MM-DDTHH
  const dayKey    = `${operation}:d:${now.toISOString().slice(0, 10)}`    // YYYY-MM-DD

  const windows: Array<{ key: string; ttl: number; limit: number; label: 'minute' | 'hour' | 'day' }> = [
    { key: minuteKey, ttl: 60,    limit: limits.minute, label: 'minute' },
    { key: hourKey,   ttl: 3600,  limit: limits.hour,   label: 'hour'   },
    { key: dayKey,    ttl: 86400, limit: limits.day,    label: 'day'    },
  ]

  for (const w of windows) {
    const { data: count, error } = await supabase.rpc('rate_limit_increment', {
      p_user_id:     userId,
      p_bucket_key:  w.key,
      p_ttl_seconds: w.ttl,
    })

    if (error) {
      // Ne pas bloquer en cas d'erreur DB — on logue et on laisse passer
      console.warn(`[rate-limiter] RPC error for ${w.label}:`, error.message)
      continue
    }

    if ((count as number) > w.limit) {
      return { allowed: false, window: w.label, count: count as number, limit: w.limit }
    }
  }

  return { allowed: true, window: null, count: 0, limit: 0 }
}
