/**
 * generate-quiz
 *
 * Génère un quiz personnalisé via Claude à partir d'un circuit.
 *
 * Paramètres :
 *   circuit_id        (requis) UUID du circuit
 *   difficulty        (optionnel) 'easy' | 'medium' | 'hard'  — défaut : 'medium'
 *   question_count    (optionnel) 5 | 10 | 20                  — défaut : 10
 *   weak_question_ids (optionnel) string[]  — IDs des questions précédemment échouées
 *                                             pour un quiz ciblé sur les lacunes
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easy: `Niveau FACILE : pose des questions de compréhension basique et de mémorisation.
- Questions directes avec une seule notion à la fois
- Vocabulaire simple et accessible
- Les distracteurs sont clairement différents de la bonne réponse`,
  medium: `Niveau MOYEN : pose des questions de compréhension et d'application.
- Mélange de questions directes et de mises en situation simples
- Les distracteurs sont plausibles mais distincts
- Certaines questions requièrent de relier deux concepts`,
  hard: `Niveau DIFFICILE : pose des questions d'analyse, de synthèse et d'application avancée.
- Questions qui requièrent de relier plusieurs concepts entre eux
- Inclure des cas pratiques et des scénarios d'application
- Les distracteurs sont très proches et requièrent une compréhension fine
- Certaines questions inversent des notions pour piéger les confusions classiques`,
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

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

    if (!circuit_id) {
      return new Response(JSON.stringify({ error: 'circuit_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Valider et normaliser les paramètres
    const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
    const validCount = [5, 10, 20].includes(question_count) ? question_count : 10

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérification identité via anon key + token (pattern officiel Supabase)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client service role pour les requêtes DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Récupère le circuit et ses étapes
    const { data: circuit, error: circuitError } = await supabase
      .from('circuits')
      .select('*, steps:circuit_steps(*)')
      .eq('id', circuit_id)
      .eq('user_id', user.id)
      .single()

    if (circuitError || !circuit) {
      return new Response(JSON.stringify({ error: 'Circuit introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    interface Step {
      order: number
      title: string
      content: string
      key_concepts: string[]
    }

    const circuitContent = (circuit.steps as Step[])
      .sort((a: Step, b: Step) => a.order - b.order)
      .map((s: Step) =>
        `Étape ${s.order} — ${s.title}\n${s.content}\nConcepts clés : ${s.key_concepts.join(', ')}`
      )
      .join('\n\n---\n\n')

    // ── Section lacunes : récupérer les questions précédemment échouées ──────
    let weakContext = ''
    if (weak_question_ids && weak_question_ids.length > 0) {
      const { data: weakQuestions } = await supabase
        .from('quiz_questions')
        .select('question, explanation')
        .in('id', weak_question_ids)

      if (weakQuestions && weakQuestions.length > 0) {
        const weakList = weakQuestions
          .map((q: { question: string; explanation?: string }) =>
            `- "${q.question}"${q.explanation ? ` (explication : ${q.explanation})` : ''}`
          )
          .join('\n')

        weakContext = `\n\nFOCUS LACUNES — L'étudiant a échoué aux questions suivantes lors du quiz précédent.
Génère des questions portant sur les MÊMES concepts, mais avec une formulation différente.
Questions échouées :
${weakList}`
      }
    }

    const difficultyInstructions = DIFFICULTY_INSTRUCTIONS[validDifficulty]
    const isRetry = weak_question_ids && weak_question_ids.length > 0

    // Titre du quiz avec indicateurs
    const difficultyLabel = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' }[validDifficulty]
    const quizTitle = isRetry
      ? `Révision ciblée — ${circuit.title} (${difficultyLabel})`
      : `Quiz — ${circuit.title} (${difficultyLabel})`

    // Génère le quiz via Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: `Tu es un expert en évaluation pédagogique. Tu génères des quiz pertinents et calibrés.
Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.`,
      messages: [
        {
          role: 'user',
          content: `Génère un quiz de EXACTEMENT ${validCount} questions à partir de ce contenu.

${difficultyInstructions}${weakContext}

TITRE : ${circuit.title}
DESCRIPTION : ${circuit.description}

CONTENU :
${circuitContent}

Structure JSON requise :
{
  "title": "${quizTitle}",
  "time_limit_minutes": ${Math.ceil(validCount * (validDifficulty === 'hard' ? 2.5 : validDifficulty === 'medium' ? 2 : 1.5))},
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
- 4 options pour multiple_choice, 2 options pour true_false
- Répartir les questions sur l'ensemble des étapes du circuit
- Explications pédagogiques et précises`,
        },
      ],
    })

    const rawText = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    interface OptionInput { text: string; is_correct: boolean }
    interface QuestionInput {
      order: number
      type: string
      question: string
      explanation?: string
      options: OptionInput[]
    }
    interface QuizInput {
      title: string
      time_limit_minutes?: number
      questions: QuestionInput[]
    }

    let quizData: QuizInput
    try {
      quizData = JSON.parse(rawText) as QuizInput
    } catch {
      // Tentative d'extraction du JSON si Claude a ajouté du texte autour
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          quizData = JSON.parse(jsonMatch[0]) as QuizInput
        } catch {
          throw new Error('Réponse Claude invalide (JSON attendu)')
        }
      } else {
        throw new Error('Réponse Claude invalide (JSON attendu)')
      }
    }

    // Insère le quiz avec les métadonnées de personnalisation
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        circuit_id,
        user_id: user.id,
        title: quizData.title,
        total_questions: quizData.questions.length,
        time_limit_minutes: quizData.time_limit_minutes ?? null,
      })
      .select()
      .single()

    if (quizError || !quiz) {
      throw new Error(`Erreur insertion quiz : ${quizError?.message}`)
    }

    // Insère les questions et leurs options
    const questionsWithOptions = []
    for (const q of quizData.questions) {
      const { data: question, error: qError } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quiz.id,
          order: q.order,
          type: q.type,
          question: q.question,
          explanation: q.explanation ?? null,
        })
        .select()
        .single()

      if (qError || !question) {
        throw new Error(`Erreur insertion question : ${qError?.message}`)
      }

      const { data: options, error: optError } = await supabase
        .from('quiz_options')
        .insert(
          q.options.map((o: OptionInput) => ({
            question_id: question.id,
            text: o.text,
            is_correct: o.is_correct,
          })),
        )
        .select()

      if (optError) {
        throw new Error(`Erreur insertion options : ${optError.message}`)
      }

      questionsWithOptions.push({ ...question, options })
    }

    return new Response(
      JSON.stringify({ ...quiz, questions: questionsWithOptions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('generate-quiz error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
