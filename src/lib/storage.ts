import { Platform } from 'react-native'

/**
 * Adaptateur de stockage compatible Supabase.
 * - Web : localStorage
 * - Native : AsyncStorage — instance initialisée une seule fois pour éviter les
 *   races de lock ("lock was released because another request stole it").
 */

const memoryFallback = new Map<string, string>()

// Cache the AsyncStorage instance so dynamic import only runs once.
let _asyncStorage: { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void>; removeItem: (k: string) => Promise<void> } | null = null
let _asyncStoragePromise: Promise<typeof _asyncStorage> | null = null

function getAsyncStorage() {
  if (_asyncStorage) return Promise.resolve(_asyncStorage)
  if (_asyncStoragePromise) return _asyncStoragePromise
  _asyncStoragePromise = import('@react-native-async-storage/async-storage')
    .then((mod) => {
      _asyncStorage = mod.default
      return _asyncStorage
    })
    .catch(() => null)
  return _asyncStoragePromise
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
