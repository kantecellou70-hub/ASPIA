import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface UiStore {
  isGlobalLoading: boolean
  toasts: Toast[]
  activeModal: string | null

  setGlobalLoading: (loading: boolean) => void
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  openModal: (name: string) => void
  closeModal: () => void
}

let toastCounter = 0

export const useUiStore = create<UiStore>((set) => ({
  isGlobalLoading: false,
  toasts: [],
  activeModal: null,

  setGlobalLoading: (isGlobalLoading) => set({ isGlobalLoading }),

  showToast: (toast) => {
    const id = String(++toastCounter)
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
}))
