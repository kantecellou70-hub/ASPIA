import { create } from 'zustand'
import type { DocumentFile } from '@/types/upload.types'

/** Un upload mis en attente quand le réseau est indisponible */
export interface QueuedUpload {
  id: string
  file: DocumentFile
  userId: string
  queuedAt: number
}

/** Une soumission de quiz mise en attente hors-ligne */
export interface PendingAttempt {
  id: string
  quizId: string
  answers: Record<string, string>
  timeTaken: number
  queuedAt: number
}

/** Une complétion d'étape de circuit mise en attente hors-ligne */
export interface PendingStepCompletion {
  id: string
  stepId: string
  circuitId: string
  queuedAt: number
}

interface OfflineStore {
  uploadQueue: QueuedUpload[]
  pendingAttempts: PendingAttempt[]
  pendingStepCompletions: PendingStepCompletion[]

  enqueueUpload: (upload: Omit<QueuedUpload, 'id' | 'queuedAt'>) => string
  dequeueUpload: (id: string) => void

  enqueuePendingAttempt: (attempt: Omit<PendingAttempt, 'id' | 'queuedAt'>) => string
  dequeuePendingAttempt: (id: string) => void

  enqueuePendingStep: (step: Omit<PendingStepCompletion, 'id' | 'queuedAt'>) => void
  dequeuePendingStep: (id: string) => void
}

let counter = 0
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${++counter}`
}

export const useOfflineStore = create<OfflineStore>((set) => ({
  uploadQueue: [],
  pendingAttempts: [],
  pendingStepCompletions: [],

  enqueueUpload: (upload) => {
    const id = nextId('upload')
    set((s) => ({
      uploadQueue: [...s.uploadQueue, { ...upload, id, queuedAt: Date.now() }],
    }))
    return id
  },
  dequeueUpload: (id) =>
    set((s) => ({ uploadQueue: s.uploadQueue.filter((u) => u.id !== id) })),

  enqueuePendingAttempt: (attempt) => {
    const id = nextId('attempt')
    set((s) => ({
      pendingAttempts: [...s.pendingAttempts, { ...attempt, id, queuedAt: Date.now() }],
    }))
    return id
  },
  dequeuePendingAttempt: (id) =>
    set((s) => ({
      pendingAttempts: s.pendingAttempts.filter((a) => a.id !== id),
    })),

  enqueuePendingStep: (step) => {
    const id = nextId('step')
    set((s) => ({
      pendingStepCompletions: [
        ...s.pendingStepCompletions,
        { ...step, id, queuedAt: Date.now() },
      ],
    }))
  },
  dequeuePendingStep: (id) =>
    set((s) => ({
      pendingStepCompletions: s.pendingStepCompletions.filter((s) => s.id !== id),
    })),
}))
