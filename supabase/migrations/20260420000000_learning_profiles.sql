-- learning_profiles table + onboarding fields on profiles

CREATE TABLE IF NOT EXISTS learning_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  niveau        TEXT,
  filiere       TEXT,
  ville         TEXT,
  objectif      TEXT,
  learning_style TEXT,
  available_time TEXT,
  subjects      TEXT[],
  difficulties  TEXT[],
  strengths     TEXT[],
  weaknesses    TEXT[],
  ai_recommendations JSONB,
  analyzed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE learning_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_learning_profile" ON learning_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS learning_style       TEXT;

CREATE OR REPLACE FUNCTION update_learning_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learning_profiles_updated_at ON learning_profiles;
CREATE TRIGGER trg_learning_profiles_updated_at
  BEFORE UPDATE ON learning_profiles
  FOR EACH ROW EXECUTE FUNCTION update_learning_profiles_updated_at();
