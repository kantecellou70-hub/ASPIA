/**
 * Utilitaire d'authentification pour les Edge Functions.
 *
 * Évite d'appeler supabase.auth.getUser() qui échoue pour les projets ES256
 * (bug GoTrue : génère des tokens ES256 mais rejette leur vérification via REST).
 *
 * À la place :
 *  1. Décode le payload JWT (base64url → JSON, sans vérification de signature).
 *  2. Vérifie l'expiration (claim `exp`).
 *  3. Retourne le `sub` (user ID) si le token est valide.
 *
 * Sécurité : le Supabase Edge Runtime vérifie la signature JWT en amont
 * si le flag `--verify-jwt` est activé (vrai par défaut sur Supabase Cloud).
 * Cette fonction fait confiance à cette vérification platforme.
 */

export function getUserIdFromJwt(authHeader: string | null): { userId: string | null; error: string | null } {
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, error: 'Non authentifié' }
  }

  const token = authHeader.slice(7) // strip "Bearer "

  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { userId: null, error: 'JWT invalide' }
    }

    // base64url → standard base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as {
      sub?: string
      exp?: number
      aud?: string | string[]
      role?: string
    }

    // Vérifie l'expiration
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return { userId: null, error: 'Session expirée — reconnectez-vous pour continuer.' }
    }

    // Doit être un token utilisateur (pas le anon key ni le service role)
    if (!payload.sub || payload.role === 'anon' || payload.role === 'service_role') {
      return { userId: null, error: 'Non authentifié' }
    }

    return { userId: payload.sub, error: null }
  } catch {
    return { userId: null, error: 'JWT invalide' }
  }
}
