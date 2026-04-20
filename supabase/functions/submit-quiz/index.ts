/**
 * submit-quiz
 *
 * Reçoit attempt_id + answers + time_taken_seconds.
 * Récupère les questions/options, calcule le score, met à jour
 * l'attempt et retourne un QuizResult détaillé.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getUserIdFromJwt } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { attempt_id, answers, time_taken_seconds } = await req.json() as {
      attempt_id: string
      answers: Record<string, string>    // question_id → option_id
      time_taken_seconds: number
    }

    if (!attempt_id || !answers) {
      return new Response(
        JSON.stringify({ error: 'attempt_id et answers requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { userId, error: authError } = getUserIdFromJwt(req.headers.get('Authorization'))
    if (!userId) {
      return new Response(JSON.stringify({ error: authError ?? 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Récupère l'attempt et vérifie la propriété
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('*, quiz:quizzes(id, total_questions)')
      .eq('id', attempt_id)
      .eq('user_id', userId)
      .single()

    if (attemptError || !attempt) {
      return new Response(JSON.stringify({ error: 'Tentative introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Récupère toutes les questions avec leurs options
    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('id, options:quiz_options(id, is_correct)')
      .eq('quiz_id', attempt.quiz_id)

    if (qError || !questions) {
      throw new Error(`Erreur récupération questions : ${qError?.message}`)
    }

    // Calcule le score
    interface Option { id: string; is_correct: boolean }
    interface QuestionWithOptions { id: string; options: Option[] }

    const questionResults = (questions as QuestionWithOptions[]).map((q) => {
      const selectedOptionId = answers[q.id]
      const correctOption = q.options.find((o: Option) => o.is_correct)
      const isCorrect = selectedOptionId === correctOption?.id

      return {
        question_id: q.id,
        is_correct: isCorrect,
        selected_option_id: selectedOptionId ?? '',
        correct_option_id: correctOption?.id ?? '',
      }
    })

    const correctAnswers = questionResults.filter((r) => r.is_correct).length
    const totalQuestions = questions.length
    const score = totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0
    const passed = score >= 70

    // Met à jour l'attempt
    const { error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        score,
        answers,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', attempt_id)

    if (updateError) {
      throw new Error(`Erreur mise à jour attempt : ${updateError.message}`)
    }

    const result = {
      attempt_id,
      score,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      passed,
      time_taken_seconds: time_taken_seconds ?? 0,
      question_results: questionResults,
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('submit-quiz error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
