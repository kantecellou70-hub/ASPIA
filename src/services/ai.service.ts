import { supabase } from '@/lib/supabase'
import type { Circuit } from '@/types/circuit.types'
import type { Quiz } from '@/types/quiz.types'
import type { CourseSummary, QuizGenerationOptions } from '@/types/quiz.types'

/**
 * Appelle les Supabase Edge Functions qui orchestrent l'IA côté serveur.
 * Toute la logique IA (Claude) est encapsulée dans les fonctions Supabase
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

  /**
   * Génère un quiz personnalisé.
   * @param circuitId   UUID du circuit source
   * @param options     Niveau de difficulté, nombre de questions, lacunes optionnelles
   */
  async generateQuiz(
    circuitId: string,
    options: QuizGenerationOptions = { difficulty: 'medium', questionCount: 10 },
  ): Promise<Quiz> {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: {
        circuit_id: circuitId,
        difficulty: options.difficulty,
        question_count: options.questionCount,
        weak_question_ids: options.weakQuestionIds ?? [],
      },
    })
    if (error) throw error
    return data as Quiz
  },

  /**
   * Génère un résumé de cours condensé (1 page) pour un circuit.
   * Le résultat n'est pas stocké en DB — le client le met en cache AsyncStorage.
   */
  async generateSummary(circuitId: string): Promise<CourseSummary> {
    const { data, error } = await supabase.functions.invoke('generate-summary', {
      body: { circuit_id: circuitId },
    })
    if (error) throw error
    return data as CourseSummary
  },
}
