/**
 * generate-quiz
 *
 * À partir d'un circuit_id, récupère les étapes du circuit et
 * génère un quiz (questions + options) via Claude.
 * Insère quiz, quiz_questions et quiz_options en base.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { circuit_id } = await req.json()
    if (!circuit_id) {
      return new Response(JSON.stringify({ error: 'circuit_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    // Prépare le contenu du circuit pour Claude
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

    // Génère le quiz via Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: `Tu es un expert en évaluation pédagogique. Tu génères des quiz pertinents à partir de contenu éducatif.
Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.`,
      messages: [
        {
          role: 'user',
          content: `Génère un quiz de 5 à 10 questions à partir de ce contenu de circuit d'apprentissage :

TITRE : ${circuit.title}
DESCRIPTION : ${circuit.description}

CONTENU :
${circuitContent}

Structure JSON requise :
{
  "title": "Quiz — ${circuit.title}",
  "time_limit_minutes": 15,
  "questions": [
    {
      "order": 1,
      "type": "multiple_choice",
      "question": "Texte de la question ?",
      "explanation": "Explication de la bonne réponse",
      "options": [
        { "text": "Option A", "is_correct": true },
        { "text": "Option B", "is_correct": false },
        { "text": "Option C", "is_correct": false },
        { "text": "Option D", "is_correct": false }
      ]
    }
  ]
}

Règles :
- Exactement 1 option correcte par question
- 4 options pour multiple_choice, 2 pour true_false
- Questions variées couvrant tout le circuit
- Explications claires et pédagogiques`,
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
      throw new Error('Réponse Claude invalide (JSON attendu)')
    }

    // Insère le quiz
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
