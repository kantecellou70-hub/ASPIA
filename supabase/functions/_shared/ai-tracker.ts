/**
 * ai-tracker — Utilitaire partagé pour le tracking et le contrôle des coûts IA
 *
 * Fonctions :
 *   checkMonthlyTokenCap  — vérifie si l'utilisateur a dépassé son quota mensuel
 *   recordUsage           — enregistre la consommation dans ai_usage et ai_daily_costs
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// ─── Coûts par modèle (USD / token) ──────────────────────────────────────────

export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6':           { input: 15   / 1_000_000, output: 75  / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3    / 1_000_000, output: 15  / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.80 / 1_000_000, output: 4   / 1_000_000 },
}

// ─── Limites mensuelles de tokens par plan (input + output combinés) ──────────
// free     : ~10 circuits ou ~50 quiz/mois
// starter  : ~100 circuits ou ~500 quiz/mois
// pro      : ~500 circuits ou ~2500 quiz/mois
// enterprise : illimité

export const MONTHLY_TOKEN_LIMITS: Record<string, number> = {
  free:       100_000,
  starter:    1_000_000,
  pro:        5_000_000,
  enterprise: -1,  // illimité
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiOperation = 'circuit' | 'quiz' | 'summary' | 'analysis'

export interface UsageRecord {
  inputTokens: number
  outputTokens: number
  model: string
  operation: AiOperation
  userId: string
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS['claude-sonnet-4-6']
  return inputTokens * costs.input + outputTokens * costs.output
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Vérifie si l'utilisateur a dépassé son cap mensuel de tokens.
 * Retourne { allowed, used, limit, plan } — si allowed = false, refuser l'opération.
 */
export async function checkMonthlyTokenCap(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number; plan: string }> {
  // Récupère le plan de l'utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = profile?.plan ?? 'free'
  const limit = MONTHLY_TOKEN_LIMITS[plan] ?? MONTHLY_TOKEN_LIMITS.free

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1, plan }
  }

  const yearMonth = currentYearMonth()
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('tokens_input, tokens_output')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .single()

  const used = (usage?.tokens_input ?? 0) + (usage?.tokens_output ?? 0)
  return { allowed: used < limit, used, limit, plan }
}

/**
 * Enregistre la consommation d'une opération IA dans :
 *  - ai_usage (par user, par mois)
 *  - ai_daily_costs (global par jour)
 *
 * Utilise UPSERT pour éviter les conflits concurrents.
 * Non bloquant : les erreurs sont logguées mais n'interrompent pas le flux.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  record: UsageRecord,
): Promise<void> {
  const { userId, model, operation, inputTokens, outputTokens } = record
  const cost = estimateCost(model, inputTokens, outputTokens)
  const yearMonth = currentYearMonth()
  const today = todayDate()

  const opColumn = `ops_${operation}` as const

  // Upsert ai_usage (par user / mois)
  const { error: usageErr } = await supabase.rpc('upsert_ai_usage', {
    p_user_id:      userId,
    p_year_month:   yearMonth,
    p_tokens_input: inputTokens,
    p_tokens_output: outputTokens,
    p_cost_usd:     cost,
    p_op_column:    opColumn,
  })

  if (usageErr) {
    // Fallback : INSERT ... ON CONFLICT DO UPDATE via SQL direct
    console.warn('upsert_ai_usage RPC failed, using manual upsert:', usageErr.message)
    await supabase.from('ai_usage').upsert(
      {
        user_id: userId,
        year_month: yearMonth,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_usd: cost,
        [opColumn]: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,year_month', ignoreDuplicates: false },
    )
  }

  // Upsert ai_daily_costs (global par jour)
  const { error: dailyErr } = await supabase.rpc('upsert_ai_daily_costs', {
    p_date:          today,
    p_tokens_input:  inputTokens,
    p_tokens_output: outputTokens,
    p_cost_usd:      cost,
  })

  if (dailyErr) {
    console.warn('upsert_ai_daily_costs RPC failed, using manual upsert:', dailyErr.message)
    await supabase.from('ai_daily_costs').upsert(
      {
        date: today,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_usd: cost,
        operations_count: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date', ignoreDuplicates: false },
    )
  }
}
