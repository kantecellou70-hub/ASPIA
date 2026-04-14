import { Platform } from 'react-native'

/**
 * Adaptateur de stockage compatible Supabase.
 * - Web : localStorage
 * - Native : AsyncStorage v3 avec fallback mémoire si le module natif n'est pas disponible
 */

const memoryFallback = new Map<string, string>()

async function getAsyncStorage() {
  try {
    const mod = await import('@react-native-async-storage/async-storage')
    return mod.default
  } catch {
    return null
  }
}

export const supabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) ?? null
    }
    try {
      const AS = await getAsyncStorage()
      if (AS) return await AS.getItem(key)
    } catch {}
    return memoryFallback.get(key) ?? null
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value)
      return
    }
    try {
      const AS = await getAsyncStorage()
      if (AS) { await AS.setItem(key, value); return }
    } catch {}
    memoryFallback.set(key, value)
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key)
      return
    }
    try {
      const AS = await getAsyncStorage()
      if (AS) { await AS.removeItem(key); return }
    } catch {}
    memoryFallback.delete(key)
  },
}
