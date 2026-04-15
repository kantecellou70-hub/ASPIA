-- ============================================================
-- APSIA — CRM fields : city + is_banned sur profiles
-- ============================================================

alter table public.profiles
  add column if not exists city       text,
  add column if not exists is_banned  boolean not null default false;
