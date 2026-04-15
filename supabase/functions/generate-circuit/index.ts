/**
 * generate-circuit
 *
 * À partir d'un document_id, appelle analyze-document puis génère
 * un circuit d'apprentissage (circuit + circuit_steps) via Claude.
 * Retourne le circuit complet avec ses étapes.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.35.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { document_id } = await req.json()
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Récupère le JWT de l'utilisateur pour identifier user_id
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

    // Récupère le document et télécharge le PDF
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('storage_path, name')
      .eq('id', document_id)
      .eq('user_id', user.id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (fileError || !fileData) {
      throw new Error(`Erreur téléchargement : ${fileError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Génère le circuit via Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: `Tu es un expert en pédagogie. Tu génères des circuits d'apprentissage structurés à partir de documents.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Génère un circuit d'apprentissage complet pour ce document.
Structure JSON requise (5 à 8 étapes) :
{
  "title": "titre du circuit",
  "description": "description en 1-2 phrases",
  "steps": [
    {
      "order": 1,
      "title": "titre de l'étape",
      "content": "contenu pédagogique détaillé de l'étape (200-400 mots)",
      "key_concepts": ["concept1", "concept2", "concept3"]
    }
  ]
}`,
            },
          ],
        },
      ],
    }, {
      headers: { 'anthropic-beta': 'pdfs-2024-09-25' },
    })

    const rawText = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    interface StepInput {
      order: number
      title: string
      content: string
      key_concepts: string[]
    }

    interface CircuitInput {
      title: string
      description: string
      steps: StepInput[]
    }

    let circuitData: CircuitInput
    try {
      circuitData = JSON.parse(rawText) as CircuitInput
    } catch {
      throw new Error('Réponse Claude invalide (JSON attendu)')
    }

    // Insère le circuit en base
    const { data: circuit, error: circuitError } = await supabase
      .from('circuits')
      .insert({
        user_id: user.id,
        document_id,
        title: circuitData.title,
        description: circuitData.description,
        total_steps: circuitData.steps.length,
        completed_steps: 0,
        status: 'not_started',
      })
      .select()
      .single()

    if (circuitError || !circuit) {
      throw new Error(`Erreur insertion circuit : ${circuitError?.message}`)
    }

    // Insère les étapes
    const stepsToInsert = circuitData.steps.map((s: StepInput) => ({
      circuit_id: circuit.id,
      order: s.order,
      title: s.title,
      content: s.content,
      key_concepts: s.key_concepts,
      is_completed: false,
    }))

    const { data: steps, error: stepsError } = await supabase
      .from('circuit_steps')
      .insert(stepsToInsert)
      .select()

    if (stepsError) {
      throw new Error(`Erreur insertion étapes : ${stepsError.message}`)
    }

    return new Response(
      JSON.stringify({ ...circuit, steps }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('generate-circuit error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
