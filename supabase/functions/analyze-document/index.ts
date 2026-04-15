/**
 * analyze-document
 *
 * Reçoit un document_id, récupère le PDF depuis Storage, l'envoie à
 * l'API Anthropic (Claude) et retourne une analyse structurée.
 * Cette analyse est ensuite utilisée par generate-circuit.
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

    // Client Supabase avec service_role pour lire le Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Récupère le chemin du fichier depuis la table documents
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('storage_path, name, mime_type')
      .eq('id', document_id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Télécharge le fichier depuis Supabase Storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (fileError || !fileData) {
      throw new Error(`Erreur téléchargement fichier : ${fileError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer)),
    )

    // Analyse via Claude avec vision PDF
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analyse ce document pédagogique et réponds en JSON pur (sans markdown) avec cette structure exacte :
{
  "title": "titre principal du document",
  "subject": "matière ou domaine",
  "level": "niveau estimé (débutant/intermédiaire/avancé)",
  "language": "fr ou en",
  "main_topics": ["sujet1", "sujet2", ...],
  "summary": "résumé en 2-3 phrases",
  "key_concepts": ["concept1", "concept2", ...],
  "estimated_steps": 5
}
Réponds uniquement avec le JSON, aucun texte avant ou après.`,
            },
          ],
        },
      ],
    }, {
      headers: {
        'anthropic-beta': 'pdfs-2024-09-25',
      },
    })

    const rawText = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(rawText)
    } catch {
      // Fallback si Claude n'a pas renvoyé du JSON pur
      analysis = {
        title: doc.name.replace('.pdf', ''),
        subject: 'Général',
        level: 'intermédiaire',
        language: 'fr',
        main_topics: [],
        summary: rawText.slice(0, 300),
        key_concepts: [],
        estimated_steps: 5,
      }
    }

    return new Response(JSON.stringify({ document_id, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('analyze-document error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
