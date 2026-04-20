-- Migration : mise en conformité des noms de plans (alpha/beta/gamma)
-- À exécuter APRÈS la migration initiale 20260420000000_learning_profiles.sql

-- ── 1. Supprimer les contraintes CHECK AVANT toute modification ──────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_plan_id_check;

-- ── 2. Mettre à jour les valeurs de plan dans profiles ───────────────────────
UPDATE profiles SET plan = 'alpha'      WHERE plan IN ('free', 'alpha');
UPDATE profiles SET plan = 'beta'       WHERE plan IN ('starter', 'beta');
UPDATE profiles SET plan = 'gamma'      WHERE plan IN ('pro', 'gamma');
UPDATE profiles SET plan = 'ecole_beta' WHERE plan IN ('enterprise', 'ecole_beta');

-- ── 3. Recalculer sessions_limit selon le nouveau plan ───────────────────────
UPDATE profiles SET sessions_limit = 3      WHERE plan = 'alpha';
UPDATE profiles SET sessions_limit = 20     WHERE plan = 'beta';
UPDATE profiles SET sessions_limit = 999999 WHERE plan = 'gamma';
UPDATE profiles SET sessions_limit = 20     WHERE plan = 'ecole_beta';
UPDATE profiles SET sessions_limit = 999999 WHERE plan = 'ecole_gamma';

-- ── 4. Recréer la contrainte CHECK profiles ──────────────────────────────────
ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('alpha', 'beta', 'gamma', 'ecole_beta', 'ecole_gamma'));

-- ── 5. Mettre à jour les enregistrements payments ────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'plan_id'
  ) THEN
    UPDATE payments SET plan_id = 'alpha'       WHERE plan_id IN ('free');
    UPDATE payments SET plan_id = 'beta'        WHERE plan_id IN ('starter');
    UPDATE payments SET plan_id = 'gamma'       WHERE plan_id IN ('pro');
    UPDATE payments SET plan_id = 'ecole_gamma' WHERE plan_id IN ('enterprise');
  END IF;
END $$;

-- ── 6. Recréer la contrainte CHECK payments ──────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_plan_id_check
      CHECK (plan_id IN ('alpha', 'beta', 'gamma', 'ecole_beta', 'ecole_gamma'));
  END IF;
END $$;

-- ── 7. Mettre à jour la devise dans payments ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'currency'
  ) THEN
    UPDATE payments SET currency = 'GNF' WHERE currency IN ('XOF', 'xof');
  END IF;
END $$;
