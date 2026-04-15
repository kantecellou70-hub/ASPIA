-- ============================================================
-- APSIA — Migration initiale
-- Tables : profiles, documents, circuits, circuit_steps,
--          quizzes, quiz_questions, quiz_options,
--          quiz_attempts, payments
-- ============================================================

-- uuid-ossp n'est plus nécessaire sur Postgres 15 (gen_random_uuid() est natif)

-- ============================================================
-- 1. PROFILES
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  full_name       text        not null default '',
  avatar_url      text,
  role            text        not null default 'student'
                  check (role in ('student', 'teacher', 'admin')),
  plan            text        not null default 'free'
                  check (plan in ('free', 'starter', 'pro', 'enterprise')),
  sessions_used   integer     not null default 0,
  sessions_limit  integer     not null default 3,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Trigger : crée automatiquement un profil à la création du compte
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger : updated_at automatique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- RLS policies
create policy "Lecture profil propre"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Mise à jour profil propre"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- 2. DOCUMENTS
-- ============================================================
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles on delete cascade,
  name         text        not null,
  file_url     text        not null,
  storage_path text        not null,
  file_size    bigint      not null default 0,
  mime_type    text        not null default 'application/pdf',
  created_at   timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "CRUD documents propres"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 3. CIRCUITS
-- ============================================================
create table public.circuits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles on delete cascade,
  document_id     uuid        not null references public.documents on delete cascade,
  title           text        not null,
  description     text        not null default '',
  total_steps     integer     not null default 0,
  completed_steps integer     not null default 0,
  status          text        not null default 'not_started'
                  check (status in ('not_started', 'in_progress', 'completed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.circuits enable row level security;

create trigger circuits_updated_at
  before update on public.circuits
  for each row execute procedure public.set_updated_at();

create policy "CRUD circuits propres"
  on public.circuits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 4. CIRCUIT_STEPS
-- ============================================================
create table public.circuit_steps (
  id           uuid    primary key default gen_random_uuid(),
  circuit_id   uuid    not null references public.circuits on delete cascade,
  "order"      integer not null,
  title        text    not null,
  content      text    not null,
  key_concepts text[]  not null default '{}',
  is_completed boolean not null default false,
  unique (circuit_id, "order")
);

alter table public.circuit_steps enable row level security;

create policy "Lecture steps via circuit propre"
  on public.circuit_steps for select
  using (
    exists (
      select 1 from public.circuits c
      where c.id = circuit_id and c.user_id = auth.uid()
    )
  );

create policy "Mise à jour steps via circuit propre"
  on public.circuit_steps for update
  using (
    exists (
      select 1 from public.circuits c
      where c.id = circuit_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. QUIZZES
-- ============================================================
create table public.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  circuit_id         uuid        not null references public.circuits on delete cascade,
  user_id            uuid        not null references public.profiles on delete cascade,
  title              text        not null,
  total_questions    integer     not null default 0,
  time_limit_minutes integer,
  created_at         timestamptz not null default now()
);

alter table public.quizzes enable row level security;

create policy "CRUD quizzes propres"
  on public.quizzes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 6. QUIZ_QUESTIONS
-- ============================================================
create table public.quiz_questions (
  id          uuid    primary key default gen_random_uuid(),
  quiz_id     uuid    not null references public.quizzes on delete cascade,
  "order"     integer not null,
  type        text    not null default 'multiple_choice'
              check (type in ('multiple_choice', 'true_false')),
  question    text    not null,
  explanation text,
  unique (quiz_id, "order")
);

alter table public.quiz_questions enable row level security;

create policy "Lecture questions via quiz propre"
  on public.quiz_questions for select
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. QUIZ_OPTIONS
-- ============================================================
create table public.quiz_options (
  id          uuid    primary key default gen_random_uuid(),
  question_id uuid    not null references public.quiz_questions on delete cascade,
  text        text    not null,
  is_correct  boolean not null default false
);

alter table public.quiz_options enable row level security;

create policy "Lecture options via quiz propre"
  on public.quiz_options for select
  using (
    exists (
      select 1
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = question_id and q.user_id = auth.uid()
    )
  );

-- ============================================================
-- 8. QUIZ_ATTEMPTS
-- ============================================================
create table public.quiz_attempts (
  id           uuid        primary key default gen_random_uuid(),
  quiz_id      uuid        not null references public.quizzes on delete cascade,
  user_id      uuid        not null references public.profiles on delete cascade,
  score        integer     not null default 0,
  answers      jsonb       not null default '{}',
  status       text        not null default 'in_progress'
               check (status in ('not_started', 'in_progress', 'completed')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.quiz_attempts enable row level security;

create policy "CRUD attempts propres"
  on public.quiz_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 9. PAYMENTS
-- ============================================================
create table public.payments (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references public.profiles on delete cascade,
  plan_id                 text        not null
                          check (plan_id in ('free', 'starter', 'pro', 'enterprise')),
  amount                  integer     not null,
  currency                text        not null default 'XOF',
  status                  text        not null default 'pending'
                          check (status in ('pending', 'completed', 'failed', 'refunded')),
  kkiapay_transaction_id  text,
  phone                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.payments enable row level security;

create trigger payments_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

create policy "Lecture paiements propres"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Insertion paiements propres"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET : documents
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,  -- 50 MB
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "Upload documents propres"
  on storage.objects for insert
  with check (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Lecture documents propres"
  on storage.objects for select
  using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Suppression documents propres"
  on storage.objects for delete
  using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
