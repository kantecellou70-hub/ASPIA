import { create } from 'zustand'

export type MessageType = 'text' | 'pdf_upload' | 'image_upload' | 'circuit_card' | 'quiz_card' | 'summary_card' | 'error'

export interface ChatAction {
  label: string
  function: 'generate-circuit' | 'generate-quiz' | 'generate-summary'
  circuit_id: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  type: MessageType
  text: string
  action?: ChatAction | null
  timestamp: number
  attachment?: {
    name: string
    uri: string
    mimeType: string
  }
}

interface ChatStore {
  messages: ChatMessage[]
  isTyping: boolean
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage
  setTyping: (val: boolean) => void
  clearMessages: () => void
}

const MAX_MESSAGES = 50

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isTyping: false,

  addMessage: (msg) => {
    const full: ChatMessage = {
      ...msg,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    }
    set((state) => {
      const messages = [...state.messages, full]
      return { messages: messages.slice(-MAX_MESSAGES) }
    })
    return full
  },

  setTyping: (val) => set({ isTyping: val }),

  clearMessages: () => set({ messages: [] }),
}))
