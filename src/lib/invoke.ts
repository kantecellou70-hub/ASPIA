import { supabase } from './supabase'

/**
 * Erreur enrichie avec les détails renvoyés par une Edge Function.
 * Exportée ici pour être partagée entre tous les services qui appellent des Edge Functions.
 */
export class EdgeFunctionError extends Error {
  upgradeRequired: boolean
  sessionExpired: boolean
  sessionsUsed?: number
  sessionsLimit?: number

  constructor(
    message: string,
    opts: {
      upgradeRequired?: boolean
      sessionExpired?: boolean
      sessionsUsed?: number
      sessionsLimit?: number
    } = {},
  ) {
    super(message)
    this.name = 'EdgeFunctionError'
    this.upgradeRequired = opts.upgradeRequired ?? false
    this.sessionExpired = opts.sessionExpired ?? false
    this.sessionsUsed = opts.sessionsUsed
    this.sessionsLimit = opts.sessionsLimit
  }
}

/**
 * Extrait le message d'erreur depuis la réponse d'une Edge Function.
 * Utilise `response.text()` pour lire le corps brut (jamais consommé par le SDK),
 * puis tente un parse JSON.
 */
export async function throwFromInvoke(
  error: unknown,
  data: unknown,
  response?: Response,
): Promise<never> {
  // Cas 1 : data contient un champ `error`
  if (data && typeof data === 'object' && 'error' in data) {
    const body = data as Record<string, unknown>
    throw new EdgeFunctionError(body.error as string, {
      upgradeRequired: body.upgrade_required === true,
      sessionsUsed: body.sessions_used as number | undefined,
      sessionsLimit: body.sessions_limit as number | undefined,
    })
  }

  // Cas 2 : Response brute disponible
  const rawResponse: Response | undefined =
    response ??
    (error && typeof error === 'object' && 'context' in error
      ? (error as { context: Response }).context
      : undefined)

  if (rawResponse) {
    let bodyText = ''
    try { bodyText = await rawResponse.text() } catch { /* stream déjà consommé */ }

    if (bodyText) {
      try {
        const body = JSON.parse(bodyText) as Record<string, unknown>
        // Supabase gateway uses `msg`/`message`; Edge Functions use `error`
        const message =
          (body?.error as string) ??
          (body?.message as string) ??
          (body?.msg as string) ??
          `Erreur serveur (HTTP ${rawResponse.status})`
        throw new EdgeFunctionError(message, {
          upgradeRequired: body?.upgrade_required === true,
          sessionsUsed: body?.sessions_used as number | undefined,
          sessionsLimit: body?.sessions_limit as number | undefined,
        })
      } catch (jsonErr) {
        if (jsonErr instanceof EdgeFunctionError) throw jsonErr
        throw new EdgeFunctionError(bodyText.slice(0, 200))
      }
    }
  }

  const msg = error instanceof Error ? error.message : String(error)
  throw new EdgeFunctionError(msg || 'Erreur Edge Function inconnue')
}

/**
 * Décode le payload d'un JWT (sans vérification de signature) et retourne
 * true si le token est expiré ou illisible.
 */
function isTokenExpired(token: string): boolean {
  try {
    // JWTs use base64url — convert to standard base64 before atob
    const base64url = token.split('.')[1]
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

/**
 * Récupère le JWT courant et l'injecte explicitement dans l'appel Edge Function.
 * Bypass le mécanisme interne du SDK Supabase qui peut retourner le anon key
 * si la session n'est pas encore restaurée (race condition à l'init).
 * Force un refresh si le token est absent OU déjà expiré.
 */
export async function invokeWithAuth(
  functionName: string,
  body: Record<string, unknown>,
) {
  let { data: { session } } = await supabase.auth.getSession()

  // Refresh si token absent ou expiré (session en cache mais JWT périmé)
  if (!session?.access_token || isTokenExpired(session.access_token)) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    session = refreshed.session
  }

  if (!session?.access_token) {
    throw new EdgeFunctionError('Session expirée — reconnectez-vous pour continuer.', {
      sessionExpired: true,
    })
  }

  return supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}
