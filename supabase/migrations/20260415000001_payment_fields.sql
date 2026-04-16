-- ============================================================
-- APSIA — Champs gestion paiements
-- ============================================================

alter table public.payments
  add column if not exists operator      text,          -- MTN, Moov, Orange, Wave, etc.
  add column if not exists refund_reason text,          -- motif du remboursement
  add column if not exists refunded_at   timestamptz;  -- horodatage du remboursement

-- Index pour accélérer les requêtes admin (filtres courants)
create index if not exists payments_status_idx       on public.payments (status);
create index if not exists payments_created_at_idx   on public.payments (created_at desc);
create index if not exists payments_operator_idx     on public.payments (operator);
