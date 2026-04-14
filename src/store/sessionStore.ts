import { create } from 'zustand'

interface SessionStore {
  sessionsUsed: number
  sessionsLimit: number
  sessionsRemaining: number

  setSessionStats: (used: number, limit: number) => void
  incrementUsed: () => void
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionsUsed: 0,
  sessionsLimit: 3,
  sessionsRemaining: 3,

  setSessionStats: (used, limit) =>
    set({
      sessionsUsed: used,
      sessionsLimit: limit,
      sessionsRemaining: Math.max(0, limit - used),
    }),

  incrementUsed: () => {
    const { sessionsUsed, sessionsLimit } = get()
    const newUsed = sessionsUsed + 1
    set({
      sessionsUsed: newUsed,
      sessionsRemaining: Math.max(0, sessionsLimit - newUsed),
    })
  },

  reset: () =>
    set({ sessionsUsed: 0, sessionsLimit: 3, sessionsRemaining: 3 }),
}))
