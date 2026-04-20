/**
 * generate-quiz
 *
 * Génère un quiz personnalisé via Claude Sonnet (3x moins cher qu'Opus,
 * qualité suffisante pour QCM pédagogiques).
 *
 * Paramètres :
 *   circuit_id        (requis)
 *   difficulty        'easy' | 'medium' | 'hard'  — défaut : 'medium'
 *   question_count    5 | 10 | 20                  — défaut : 10
 *   weak_question_ids string[]                     — ciblage des lacunes
 *
 * Protections coût :
 *   - Vérifie le cap mensuel de tokens avant l'appel Claude
 *   - Enregistre la consommation réelle après l'appel
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'
import { checkMonthlyTokenCap, recordUsage } from '../_shared/ai-tracker.ts'
import { checkRateLimit } from '../_shared/rate-limiter.ts'
import { writeAuditLog, extractRequestMeta } from '../_shared/audit.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

// Sonnet 4.6 : ~5x moins cher qu'Opus pour une qualité largement suffisante sur les QCM
const QUIZ_MODEL = 'claude-sonnet-4-6'

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easy: `Niveau FACILE : questions de compréhension basique et mémorisation.
- Questions directes avec une seule notion à la fois
- Vocabulaire simple et accessible
- Les distracteurs sont clairement différents de la bonne réponse`,
  medium: `Niveau MOYEN : compréhension et application.
- Mélange de questions directes et de mises en situation simples
- Les distracteurs sont plausibles mais distincts
- Certaines questions requièrent de relier deux concepts`,
  hard: `Niveau DIFFICILE : analyse, synthèse et application avancée.
- Questions qui requièrent de relier plusieurs concepts
- Cas pratiques et scénarios d'application
- Distracteurs très proches, compréhension fine requise
- Certaines questions inversent des notions pour piéger les confusions classiques`,
}

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const { ipAddress, userAgent } = extractRequestMeta(req)

  try {
    const body = await req.json()
    const {
      circuit_id,
      difficulty = 'medium',
      question_count = 10,
      weak_question_ids,
    } = body as {
      circuit_id: string
      difficulty?: 'easy' | 'medium' | 'hard'
      question_count?: number
      weak_question_ids?: string[]
    }

    if (!circuit_id) return jsonResp({ error: 'circuit_id requis' }, 400)

    const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
    const validCount = [5, 10, 20].includes(question_count) ? question_count : 10

    const { userId, error: authError } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (!userId) return jsonResp({ error: authError ?? 'Non authentifié' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Rate limiting + vérification sessions ───────────────────────────────
    const { data: profileRl } = await supabase
      .from('profiles')
      .select('plan, sessions_used, sessions_limit')
      .eq('id', userId)
      .single()
    const userPlan = profileRl?.plan ?? 'free'
    const sessionsUsed = (profileRl?.sessions_used ?? 0) as number
    const sessionsLimit = (profileRl?.sessions_limit ?? 3) as number

    if (sessionsUsed >= sessionsLimit) {
      return jsonResp({
        error: 'Sessions épuisées. Passez à un plan supérieur.',
        sessions_used: sessionsUsed,
        sessions_limit: sessionsLimit,
        upgrade_required: true,
      }, 403)
    }

    const rl = await checkRateLimit(supabase, userId, 'quiz', userPlan)
    if (!rl.allowed) {
      writeAuditLog(supabase, {
        userId: userId, action: 'quiz.generate', resourceType: 'circuit', resourceId: circuit_id,
        metadata: { rate_limit_window: rl.window, count: rl.count, limit: rl.limit },
        ipAddress, userAgent, status: 'blocked',
      }).catch((e) => console.warn('audit failed:', e))
      return jsonResp({
        error: `Trop de requêtes — limite ${rl.window}ire atteinte (${rl.count}/${rl.limit})`,
        retry_after: rl.window === 'minute' ? 60 : rl.window === 'hour' ? 3600 : 86400,
      }, 429)
    }

    // ── Vérification du cap mensuel de tokens ────────────────────────────────
    const cap = await checkMonthlyTokenCap(supabase, userId)
    if (!cap.allowed) {
      return jsonResp({
        error: 'Cap mensuel de tokens atteint',
        used: cap.used,
        limit: cap.limit,
        plan: cap.plan,
        upgrade_hint: cap.plan === 'free'
          ? 'Passez au plan Starter pour 10x plus de tokens.'
          : 'Contactez-nous pour augmenter votre quota.',
      }, 429)
    }

    // Récupère le circuit et ses étapes
    const { data: circuit, error: circuitError } = await supabase
      .from('circuits')
      .select('*, steps:circuit_steps(*)')
      .eq('id', circuit_id)
      .eq('user_id', userId)
      .single()

    if (circuitError || !circuit) return jsonResp({ error: 'Circuit introuvable' }, 404)

    interface Step { order: number; title: string; content: string; key_concepts: string[] }

    const circuitContent = (circuit.steps as Step[])
      .sort((a, b) => a.order - b.order)
      .map((s) => `Étape ${s.order} — ${s.title}\n${s.content}\nConcepts clés : ${s.key_concepts.join(', ')}`)
      .join('\n\n---\n\n')

    // Section lacunes
    let weakContext = ''
    if (weak_question_ids && weak_question_ids.length > 0) {
      const { data: weakQuestions } = await supabase
        .from('quiz_questions')
        .select('question, explanation')
        .in('id', weak_question_ids)

      if (weakQuestions && weakQuestions.length > 0) {
        const weakList = weakQuestions
          .map((q: { question: string; explanation?: string }) =>
            `- "${q.question}"${q.explanation ? ` (explication : ${q.explanation})` : ''}`)
          .join('\n')
        weakContext = `\n\nFOCUS LACUNES — L'étudiant a échoué aux questions suivantes.
Génère des questions sur les MÊMES concepts, avec une formulation différente.
Questions échouées :\n${weakList}`
      }
    }

    const difficultyLabel = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' }[validDifficulty]
    const isRetry = weak_question_ids && weak_question_ids.length > 0
    const quizTitle = isRetry
      ? `Révision ciblée — ${circuit.title} (${difficultyLabel})`
      : `Quiz — ${circuit.title} (${difficultyLabel})`

    const timeLimit = Math.ceil(validCount * (validDifficulty === 'hard' ? 2.5 : validDifficulty === 'medium' ? 2 : 1.5))

    // ── Appel Claude Sonnet ───────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: QUIZ_MODEL,
      max_tokens: 4096,
      system: `Tu es un expert en évaluation pédagogique. Tu génères des quiz pertinents et calibrés.
Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.`,
      messages: [{
        role: 'user',
        content: `Génère un quiz de EXACTEMENT ${validCount} questions à partir de ce contenu.

${DIFFICULTY_INSTRUCTIONS[validDifficulty]}${weakContext}

TITRE : ${circuit.title}
DESCRIPTION : ${circuit.description}

CONTENU :
${circuitContent}

Structure JSON requise :
{
  "title": "${quizTitle}",
  "time_limit_minutes": ${timeLimit},
  "questions": [
    {
      "order": 1,
      "type": "multiple_choice",
      "question": "Texte de la question ?",
      "explanation": "Explication concise de la bonne réponse",
      "options": [
        { "text": "Option A", "is_correct": true },
        { "text": "Option B", "is_correct": false },
        { "text": "Option C", "is_correct": false },
        { "text": "Option D", "is_correct": false }
      ]
    }
  ]
}

Règles strictes :
- Exactement ${validCount} questions — ni plus, ni moins
- Exactement 1 option correcte par question
- 4 options pour multiple_choice, 2 pour true_false
- Répartir sur toutes les étapes du circuit
- Explications pédagogiques et précises`,
      }],
    })

    // ── Enregistrement de la consommation + audit (non-bloquants) ───────────
    recordUsage(supabase, {
      userId: userId,
      model: QUIZ_MODEL,
      operation: 'quiz',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }).catch((e) => console.warn('recordUsage quiz failed:', e))

    writeAuditLog(supabase, {
      userId: userId, action: 'quiz.generate', resourceType: 'circuit', resourceId: circuit_id,
      metadata: { model: QUIZ_MODEL, tokens_in: message.usage.input_tokens, tokens_out: message.usage.output_tokens, question_count: validCount, difficulty: validDifficulty },
      ipAddress, userAgent,
    }).catch((e) => console.warn('audit failed:', e))

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    interface OptionInput { text: string; is_correct: boolean }
    interface QuestionInput {
      order: number; type: string; question: string
      explanation?: string; options: OptionInput[]
    }
    interface QuizInput {
      title: string; time_limit_minutes?: number; questions: QuestionInput[]
    }

    let quizData: QuizInput
    try {
      quizData = JSON.parse(rawText) as QuizInput
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Réponse Claude invalide (JSON attendu)')
      quizData = JSON.parse(jsonMatch[0]) as QuizInput
    }

    // Insère le quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        circuit_id,
        user_id: userId,
        title: quizData.title,
        total_questions: quizData.questions.length,
        time_limit_minutes: quizData.time_limit_minutes ?? null,
      })
      .select()
      .single()

    if (quizError || !quiz) throw new Error(`Erreur insertion quiz : ${quizError?.message}`)

    const questionsWithOptions = []
    for (const q of quizData.questions) {
      const { data: question, error: qError } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quiz.id, order: q.order, type: q.type,
          question: q.question, explanation: q.explanation ?? null,
        })
        .select()
        .single()

      if (qError || !question) throw new Error(`Erreur insertion question : ${qError?.message}`)

      const { data: options, error: optError } = await supabase
        .from('quiz_options')
        .insert(q.options.map((o) => ({ question_id: question.id, text: o.text, is_correct: o.is_correct })))
        .select()

      if (optError) throw new Error(`Erreur insertion options : ${optError.message}`)
      questionsWithOptions.push({ ...question, options })
    }

    // Incrémente sessions_used côté serveur — source de vérité, non-bloquant
    supabase
      .from('profiles')
      .update({ sessions_used: sessionsUsed + 1 })
      .eq('id', userId)
      .then(() => {})
      .catch((e: Error) => console.warn('session increment failed:', e))

    return jsonResp({ ...quiz, questions: questionsWithOptions })

  } catch (err) {
    console.error('generate-quiz error:', err)
    return jsonResp({ error: (err as Error).message }, 500)
  }
})
