import { supabase } from '@/lib/supabase'
import type { Circuit } from '@/types/circuit.types'
import type { Quiz } from '@/types/quiz.types'

/**
 * Appelle les Supabase Edge Functions qui orchestrent l'IA côté serveur.
 * Toute la logique IA (Claude / OpenAI) est encapsulée dans les fonctions Supabase
 * pour ne pas exposer les clés API dans l'app.
 */
export const aiService = {
  async analyzeDocument(documentId: string): Promise<{ circuit_id: string }> {
    const { data, error } = await supabase.functions.invoke('analyze-document', {
      body: { document_id: documentId },
    })
    if (error) throw error
    return data as { circuit_id: string }
  },

  async generateCircuit(documentId: string): Promise<Circuit> {
    const { data, error } = await supabase.functions.invoke('generate-circuit', {
      body: { document_id: documentId },
    })
    if (error) throw error
    return data as Circuit
  },

  async generateQuiz(circuitId: string): Promise<Quiz> {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: { circuit_id: circuitId },
    })
    if (error) throw error
    return data as Quiz
  },
}
