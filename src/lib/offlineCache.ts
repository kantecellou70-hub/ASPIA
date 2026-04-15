import { Platform } from 'react-native'
import type { Circuit } from '@/types/circuit.types'
import type { Quiz, CourseSummary } from '@/types/quiz.types'

const PREFIX = 'apsia:cache:'
/** TTL : 7 jours — les données générées par IA évoluent peu */
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CacheEntry<T> {
  data: T
  cachedAt: number
}

// ─── Couche de stockage ────────────────────────────────────────────────────────

async function getAS() {
  try {
    const m = await import('@react-native-async-storage/async-storage')
    return m.default
  } catch {
    return null
  }
}

async function write(key: string, value: string): Promise<void> {
  const k = PREFIX + key
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(k, value) } catch {}
    return
  }
  const AS = await getAS()
  if (AS) { try { await AS.setItem(k, value) } catch {} }
}

async function read(key: string): Promise<string | null> {
  const k = PREFIX + key
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(k) ?? null
  }
  const AS = await getAS()
  if (AS) { try { return await AS.getItem(k) } catch {} }
  return null
}

// ─── API générique ─────────────────────────────────────────────────────────────

async function setCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
  await write(key, JSON.stringify(entry))
}

async function getCache<T>(key: string): Promise<T | null> {
  const raw = await read(key)
  if (!raw) return null
  try {
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.cachedAt > TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

// ─── Circuits ─────────────────────────────────────────────────────────────────

export async function cacheCircuit(circuit: Circuit): Promise<void> {
  await setCache(`circuit:${circuit.id}`, circuit)
}

export async function getCachedCircuit(id: string): Promise<Circuit | null> {
  return getCache<Circuit>(`circuit:${id}`)
}

export async function cacheUserCircuits(userId: string, circuits: Circuit[]): Promise<void> {
  await setCache(`circuits:user:${userId}`, circuits)
  // Met aussi à jour le cache individuel de chaque circuit de la liste
  await Promise.all(circuits.map((c) => setCache(`circuit:${c.id}`, c)))
}

export async function getCachedUserCircuits(userId: string): Promise<Circuit[] | null> {
  return getCache<Circuit[]>(`circuits:user:${userId}`)
}

/** Applique une mise à jour locale d'une étape directement dans le cache */
export async function patchCachedCircuitStep(
  circuitId: string,
  stepId: string,
): Promise<void> {
  const cached = await getCachedCircuit(circuitId)
  if (!cached?.steps) return

  const steps = cached.steps.map((s) =>
    s.id === stepId ? { ...s, is_completed: true } : s,
  )
  const completedSteps = steps.filter((s) => s.is_completed).length
  await cacheCircuit({
    ...cached,
    steps,
    completed_steps: completedSteps,
    status: completedSteps === cached.total_steps ? 'completed' : 'in_progress',
  })
}

// ─── Résumé de cours ──────────────────────────────────────────────────────────

export async function cacheSummary(summary: CourseSummary): Promise<void> {
  await setCache(`summary:${summary.circuit_id}`, summary)
}

export async function getCachedSummary(circuitId: string): Promise<CourseSummary | null> {
  return getCache<CourseSummary>(`summary:${circuitId}`)
}

// ─── Quiz ──────────────────────────────────────────────────────────────────────

export async function cacheQuiz(quiz: Quiz): Promise<void> {
  await setCache(`quiz:${quiz.id}`, quiz)
  await setCache(`quiz:circuit:${quiz.circuit_id}`, quiz)
}

export async function getCachedQuiz(id: string): Promise<Quiz | null> {
  return getCache<Quiz>(`quiz:${id}`)
}

export async function getCachedQuizByCircuit(circuitId: string): Promise<Quiz | null> {
  return getCache<Quiz>(`quiz:circuit:${circuitId}`)
}
