/**
 * generate-summary
 *
 * Génère un résumé de cours condensé en 1 page à partir d'un circuit.
 * Retourne : sections par étape, glossaire des termes clés, conseils d'étude.
 * Le résultat est renvoyé au client qui le met en cache — aucune persistance DB.
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

    // Récupère le circuit avec ses étapes
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

    const sortedSteps = (circuit.steps as Step[]).sort((a, b) => a.order - b.order)

    const circuitContent = sortedSteps
      .map((s: Step) =>
        `[Étape ${s.order}] ${s.title}\n${s.content}\nConcepts : ${s.key_concepts.join(', ')}`
      )
      .join('\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      system: `Tu es un expert en synthèse pédagogique. Tu condenses le contenu d'un cours en un résumé clair et mémorisable.
Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.`,
      messages: [
        {
          role: 'user',
          content: `Génère un résumé de cours condensé (1 page) pour ce circuit d'apprentissage.

TITRE : ${circuit.title}
DESCRIPTION : ${circuit.description}

CONTENU PAR ÉTAPES :
${circuitContent}

Structure JSON requise :
{
  "title": "Résumé — ${circuit.title}",
  "sections": [
    {
      "step_title": "Titre de l'étape",
      "key_points": [
        "Point essentiel 1 (phrase courte, actionnable)",
        "Point essentiel 2",
        "Point essentiel 3"
      ],
      "key_concepts": ["concept1", "concept2"]
    }
  ],
  "glossary": [
    {
      "term": "Terme technique",
      "definition": "Définition concise en 1 phrase"
    }
  ],
  "study_tips": [
    "Conseil pratique pour mémoriser ou appliquer ce cours",
    "Conseil 2"
  ]
}

Règles :
- 2 à 4 points essentiels par étape (phrases courtes, actionnables)
- Glossaire : 5 à 10 termes clés du cours avec définitions précises
- 3 à 5 conseils d'étude concrets et spécifiques au contenu
- Tout le contenu en français`,
        },
      ],
    })

    const rawText = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    interface SummaryData {
      title: string
      sections: { step_title: string; key_points: string[]; key_concepts: string[] }[]
      glossary: { term: string; definition: string }[]
      study_tips: string[]
    }

    let summaryData: SummaryData
    try {
      summaryData = JSON.parse(rawText) as SummaryData
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          summaryData = JSON.parse(jsonMatch[0]) as SummaryData
        } catch {
          throw new Error('Réponse Claude invalide (JSON attendu)')
        }
      } else {
        throw new Error('Réponse Claude invalide (JSON attendu)')
      }
    }

    return new Response(
      JSON.stringify({ circuit_id, ...summaryData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('generate-summary error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
