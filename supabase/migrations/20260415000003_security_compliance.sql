-- ============================================================
-- APSIA — Sécurité & conformité
-- audit_logs, rate_limit_buckets, rétention des données,
-- RPCs Vault pour le chiffrement PDF, rate-limit atomique
-- ============================================================

-- ============================================================
-- 1. Rétention des données — paramètre par utilisateur
-- ============================================================
alter table public.profiles
  add column if not exists data_retention_months integer not null default 12;

-- ============================================================
-- 2. Journaux d'audit
-- ============================================================
create table if not exists public.audit_logs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references public.profiles(id) on delete set null,
  action        text        not null,      -- ex: 'circuit.generate', 'admin.ban'
  resource_type text,                      -- 'document', 'circuit', 'quiz', 'payment', 'user'
  resource_id   text,                      -- UUID de la ressource
  metadata      jsonb       not null default '{}',
  ip_address    text,
  user_agent    text,
  status        text        not null default 'success'
                check (status in ('success', 'failure', 'blocked')),
  created_at    timestamptz not null default now()
);

create index if not exists audit_logs_user_idx    on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_action_idx  on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

-- Un utilisateur ne peut lire que ses propres logs (les admins passent par service role)
create policy "Lecture audit_logs propres"
  on public.audit_logs for select
  using (auth.uid() = user_id);

-- ============================================================
-- 3. Rate limiting — buckets par utilisateur
-- ============================================================
create table if not exists public.rate_limit_buckets (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  bucket_key text        not null,  -- ex: 'ai:min:2026-04-16T10:30'
  count      integer     not null default 1,
  expires_at timestamptz not null,
  primary key (user_id, bucket_key)
);

create index if not exists rate_limit_expires_idx on public.rate_limit_buckets (expires_at);

-- Pas de RLS — accès uniquement via service role depuis les Edge Functions
alter table public.rate_limit_buckets enable row level security;

-- ============================================================
-- 4. Chiffrement PDF — vault_key_id sur documents
-- ============================================================
alter table public.documents
  add column if not exists vault_key_id uuid,
  add column if not exists is_encrypted boolean not null default false;

-- ============================================================
-- 5. Fonctions RPC
-- ============================================================

-- 5a. Incrément atomique d'un bucket de rate limiting
create or replace function public.rate_limit_increment(
  p_user_id      uuid,
  p_bucket_key   text,
  p_ttl_seconds  integer
)
returns integer   -- retourne le count courant
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Supprime le bucket expiré s'il existe
  delete from public.rate_limit_buckets
  where user_id = p_user_id
    and bucket_key = p_bucket_key
    and expires_at <= now();

  insert into public.rate_limit_buckets(user_id, bucket_key, count, expires_at)
  values (p_user_id, p_bucket_key, 1,
          now() + (p_ttl_seconds || ' seconds')::interval)
  on conflict (user_id, bucket_key) do update
    set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return coalesce(v_count, 1);
end;
$$;

-- 5b. Création d'un secret dans Vault pour la clé de chiffrement d'un document
-- Nécessite l'extension vault (pgsodium) — activée par défaut sur Supabase Cloud
create or replace function public.vault_create_document_key(
  p_document_id  uuid,
  p_key_b64      text
)
returns uuid    -- vault_key_id à stocker dans documents.vault_key_id
language sql
security definer
set search_path = public
as $$
  select vault.create_secret(
    p_key_b64,
    'apsia_doc_' || p_document_id::text,
    'AES-256-GCM key for document ' || p_document_id::text
  );
$$;

-- 5c. Lecture d'un secret Vault par son UUID
create or replace function public.vault_get_document_key(
  p_vault_key_id  uuid
)
returns text
language sql
security definer
set search_path = public
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where id = p_vault_key_id;
$$;

-- 5d. Suppression d'un secret Vault (utilisé lors de la purge)
create or replace function public.vault_delete_document_key(
  p_vault_key_id  uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from vault.secrets where id = p_vault_key_id;
$$;

-- 5e. Purge des données expirées d'un utilisateur (appelée par Edge Function)
create or replace function public.purge_expired_user_data(
  p_user_id               uuid,
  p_retention_months      integer,
  p_out_docs_deleted      out integer,
  p_out_attempts_deleted  out integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - (p_retention_months || ' months')::interval;
begin
  -- Quiz attempts expirés (sans supprimer les circuits — valeur pédagogique)
  delete from public.quiz_attempts
  where user_id = p_user_id and started_at < v_cutoff;
  get diagnostics p_out_attempts_deleted = row_count;

  -- Documents expirés (CASCADE → circuits, quizzes, steps, options)
  -- La suppression Storage se fait dans l'Edge Function avant cet appel
  delete from public.documents
  where user_id = p_user_id and created_at < v_cutoff;
  get diagnostics p_out_docs_deleted = row_count;
end;
$$;

-- 5f. Purge globale des données système expirées
create or replace function public.purge_system_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Buckets de rate limiting expirés
  delete from public.rate_limit_buckets where expires_at < now();

  -- Logs d'audit de plus de 24 mois
  delete from public.audit_logs where created_at < now() - interval '24 months';

  -- Coûts journaliers de plus de 13 mois
  delete from public.ai_daily_costs where date < (current_date - interval '13 months');

  -- Suivi tokens de plus de 13 mois
  delete from public.ai_usage
  where to_date(year_month, 'YYYY-MM') < (current_date - interval '13 months');
end;
$$;

-- ============================================================
-- Cron mensuel pour la purge (décommenter après configuration)
-- Nécessite pg_cron + pg_net activés dans Supabase
-- ============================================================
-- select cron.schedule(
--   'purge-expired-data-monthly',
--   '0 3 1 * *',   -- 1er du mois à 3h UTC
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/purge-expired-data',
--     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );
