-- ============================================================
-- APSIA — Optimisation des coûts IA
-- ============================================================

-- 1. Hash du fichier sur documents (cache circuit)
alter table public.documents
  add column if not exists file_hash text;

create index if not exists documents_file_hash_idx
  on public.documents (file_hash)
  where file_hash is not null;

-- 2. Suivi des tokens IA par utilisateur et par mois
create table if not exists public.ai_usage (
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  year_month     text        not null,  -- format : '2026-04'
  tokens_input   bigint      not null default 0,
  tokens_output  bigint      not null default 0,
  cost_usd       numeric(12,6) not null default 0,
  ops_circuit    integer     not null default 0,
  ops_quiz       integer     not null default 0,
  ops_summary    integer     not null default 0,
  ops_analysis   integer     not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, year_month)
);

alter table public.ai_usage enable row level security;

-- Lecture de ses propres stats uniquement
create policy "Lecture ai_usage propre"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- 3. Suivi journalier global des coûts (pour alertes)
create table if not exists public.ai_daily_costs (
  date              date        not null primary key,
  tokens_input      bigint      not null default 0,
  tokens_output     bigint      not null default 0,
  cost_usd          numeric(12,6) not null default 0,
  operations_count  integer     not null default 0,
  alert_sent        boolean     not null default false,
  updated_at        timestamptz not null default now()
);

-- Seuls les admins lisent les coûts globaux (via service role dans les Edge Functions)
alter table public.ai_daily_costs enable row level security;

-- ============================================================
-- Cron toutes les heures : vérifie les coûts et envoie l'alerte
-- Nécessite les extensions pg_cron et pg_net (activées dans Supabase)
-- Remplacer <PROJECT_REF> par l'identifiant du projet Supabase
-- et <SERVICE_ROLE_KEY> par la clé service role (via Supabase Vault idéalement)
-- ============================================================
-- select cron.schedule(
--   'check-daily-costs-hourly',
--   '0 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-daily-costs',
--     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body    := '{}'::jsonb
--   ) as request_id;
--   $$
-- );

-- ============================================================
-- 4. Fonctions RPC pour les upserts atomiques
-- ============================================================

-- Incrémente les compteurs mensuels d'un utilisateur (atomique)
create or replace function public.upsert_ai_usage(
  p_user_id        uuid,
  p_year_month     text,
  p_tokens_input   bigint,
  p_tokens_output  bigint,
  p_cost_usd       numeric,
  p_op_column      text      -- 'ops_circuit' | 'ops_quiz' | 'ops_summary' | 'ops_analysis'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_usage (user_id, year_month, tokens_input, tokens_output, cost_usd,
    ops_circuit, ops_quiz, ops_summary, ops_analysis, updated_at)
  values (
    p_user_id, p_year_month, p_tokens_input, p_tokens_output, p_cost_usd,
    case when p_op_column = 'ops_circuit'  then 1 else 0 end,
    case when p_op_column = 'ops_quiz'     then 1 else 0 end,
    case when p_op_column = 'ops_summary'  then 1 else 0 end,
    case when p_op_column = 'ops_analysis' then 1 else 0 end,
    now()
  )
  on conflict (user_id, year_month) do update set
    tokens_input  = ai_usage.tokens_input  + excluded.tokens_input,
    tokens_output = ai_usage.tokens_output + excluded.tokens_output,
    cost_usd      = ai_usage.cost_usd      + excluded.cost_usd,
    ops_circuit   = ai_usage.ops_circuit   + excluded.ops_circuit,
    ops_quiz      = ai_usage.ops_quiz      + excluded.ops_quiz,
    ops_summary   = ai_usage.ops_summary   + excluded.ops_summary,
    ops_analysis  = ai_usage.ops_analysis  + excluded.ops_analysis,
    updated_at    = now();
end;
$$;

-- Incrémente les compteurs journaliers globaux (atomique)
create or replace function public.upsert_ai_daily_costs(
  p_date           date,
  p_tokens_input   bigint,
  p_tokens_output  bigint,
  p_cost_usd       numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_daily_costs (date, tokens_input, tokens_output, cost_usd, operations_count, updated_at)
  values (p_date, p_tokens_input, p_tokens_output, p_cost_usd, 1, now())
  on conflict (date) do update set
    tokens_input     = ai_daily_costs.tokens_input     + excluded.tokens_input,
    tokens_output    = ai_daily_costs.tokens_output    + excluded.tokens_output,
    cost_usd         = ai_daily_costs.cost_usd         + excluded.cost_usd,
    operations_count = ai_daily_costs.operations_count + 1,
    updated_at       = now();
end;
$$;
