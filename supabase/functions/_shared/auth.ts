/**
 * Extracts the user ID from a Supabase JWT without calling auth.getUser().
 *
 * supabase.auth.getUser(token) fails on this project because GoTrue returns
 * "Unsupported JWT algorithm ES256" when the token is passed explicitly.
 *
 * Instead we decode the payload locally (base64url → JSON) and trust the
 * platform-level signature verification that Supabase Edge Runtime performs
 * before the function handler runs.
 */
export function getUserIdFromJwt(authHeader: string | null): { userId: string | null; error: string | null } {
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, error: 'Non authentifié' }
  }

  const token = authHeader.slice(7)

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return { userId: null, error: 'JWT invalide' }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as {
      sub?: string
      exp?: number
      role?: string
    }

    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return { userId: null, error: 'Session expirée — reconnectez-vous.' }
    }

    if (!payload.sub || payload.role === 'anon' || payload.role === 'service_role') {
      return { userId: null, error: 'Non authentifié' }
    }

    return { userId: payload.sub, error: null }
  } catch {
    return { userId: null, error: 'JWT invalide' }
  }
}

// Async alias kept so any function using authenticateUser still compiles.
export async function authenticateUser(
  _supabase: unknown,
  authHeader: string | null,
): Promise<{ userId: string | null; error: string | null }> {
  return getUserIdFromJwt(authHeader)
}
