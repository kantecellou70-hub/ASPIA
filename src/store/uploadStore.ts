import { create } from 'zustand'
import type { DocumentFile, UploadProgress, UploadStatus } from '@/types/upload.types'
import type { UploadedDocument } from '@/types/upload.types'

interface UploadStore {
  selectedFile: DocumentFile | null
  progress: UploadProgress
  documents: UploadedDocument[]
  currentDocumentId: string | null

  setSelectedFile: (file: DocumentFile | null) => void
  setProgress: (progress: Partial<UploadProgress>) => void
  setDocuments: (documents: UploadedDocument[]) => void
  addDocument: (document: UploadedDocument) => void
  setCurrentDocumentId: (id: string | null) => void
  reset: () => void
}

const defaultProgress: UploadProgress = {
  status: 'idle',
  progress: 0,
  step: '',
}

export const useUploadStore = create<UploadStore>((set) => ({
  selectedFile: null,
  progress: defaultProgress,
  documents: [],
  currentDocumentId: null,

  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setProgress: (update) =>
    set((state) => ({ progress: { ...state.progress, ...update } as UploadProgress })),
  setDocuments: (documents) => set({ documents }),
  addDocument: (document) =>
    set((state) => ({ documents: [document, ...state.documents] })),
  setCurrentDocumentId: (currentDocumentId) => set({ currentDocumentId }),
  reset: () =>
    set({ selectedFile: null, progress: defaultProgress, currentDocumentId: null }),
}))
