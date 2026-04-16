import type { Circuit } from '@/types/circuit.types'
import type { Quiz } from '@/types/quiz.types'
import type { CourseSummary, QuizGenerationOptions } from '@/types/quiz.types'
import { invokeWithAuth, throwFromInvoke } from '@/lib/invoke'

// Ré-export pour compatibilité avec les imports existants dans useUpload
export { EdgeFunctionError } from '@/lib/invoke'

/**
 * Appelle les Supabase Edge Functions qui orchestrent l'IA côté serveur.
 * Toute la logique IA (Claude) est encapsulée dans les fonctions Supabase
 * pour ne pas exposer les clés API dans l'app.
 */
export const aiService = {
  async analyzeDocument(documentId: string): Promise<void> {
    const { data, error, response } = await invokeWithAuth('analyze-document', { document_id: documentId })
    if (error || (data && 'error' in (data as object))) await throwFromInvoke(error, data, response)
  },

  async generateCircuit(documentId: string): Promise<Circuit> {
    const { data, error, response } = await invokeWithAuth('generate-circuit', { document_id: documentId })
    if (error || (data && 'error' in (data as object))) await throwFromInvoke(error, data, response)
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
    const { data, error, response } = await invokeWithAuth('generate-quiz', {
      circuit_id: circuitId,
      difficulty: options.difficulty,
      question_count: options.questionCount,
      weak_question_ids: options.weakQuestionIds ?? [],
    })
    if (error || (data && 'error' in (data as object))) await throwFromInvoke(error, data, response)
    return data as Quiz
  },

  /**
   * Génère un résumé de cours condensé (1 page) pour un circuit.
   * Le résultat n'est pas stocké en DB — le client le met en cache AsyncStorage.
   */
  async generateSummary(circuitId: string): Promise<CourseSummary> {
    const { data, error, response } = await invokeWithAuth('generate-summary', { circuit_id: circuitId })
    if (error || (data && 'error' in (data as object))) await throwFromInvoke(error, data, response)
    return data as CourseSummary
  },
}
