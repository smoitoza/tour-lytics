-- =============================================================
-- Migration: Per-User Token Billing Model (FINAL)
-- Written against actual schema as of April 4, 2026
-- Target: DEV Supabase (lpewsfzwjnlnqnludvwt) ONLY
-- =============================================================
--
-- Current state (confirmed):
--   token_balances: id, project_id (text, NOT NULL, UNIQUE),
--     balance, total_purchased, total_consumed,
--     low_balance_threshold, created_at, updated_at
--   token_transactions: id, project_id (text, NOT NULL),
--     action_type, amount, balance_after, user_email,
--     reference_id, metadata, note, created_at
--   Neither table has user_id yet.
-- =============================================================

BEGIN;

-- 1. Add user_id to both tables
ALTER TABLE token_balances
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE token_transactions
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- 2. Make project_id nullable on both tables
ALTER TABLE token_balances ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE token_transactions ALTER COLUMN project_id DROP NOT NULL;

-- 3. Create indexes (before consolidation so ON CONFLICT works)
CREATE UNIQUE INDEX idx_token_balances_user_level
  ON token_balances (user_id)
  WHERE project_id IS NULL;

CREATE INDEX idx_token_balances_user_lookup
  ON token_balances (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_token_transactions_user_id
  ON token_transactions (user_id);

-- 4. Backfill user_id on existing rows
UPDATE token_balances tb
SET user_id = u.id
FROM projects p
JOIN auth.users u ON u.email = p.owner_id
WHERE tb.project_id = p.id
  AND tb.user_id IS NULL;

UPDATE token_transactions tt
SET user_id = u.id
FROM projects p
JOIN auth.users u ON u.email = p.owner_id
WHERE tt.project_id = p.id
  AND tt.user_id IS NULL;

-- 5. Consolidate project balances into one user-level row per user
INSERT INTO token_balances (user_id, balance, total_purchased, total_consumed, low_balance_threshold)
SELECT
  user_id,
  SUM(balance),
  SUM(total_purchased),
  SUM(total_consumed),
  10
FROM token_balances
WHERE user_id IS NOT NULL
  AND project_id IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) WHERE project_id IS NULL
DO UPDATE SET
  balance = EXCLUDED.balance,
  total_purchased = EXCLUDED.total_purchased,
  total_consumed = EXCLUDED.total_consumed;

-- 6. Drop and recreate token_usage_summary view (columns changed)
DROP VIEW IF EXISTS token_usage_summary;
CREATE VIEW token_usage_summary AS
SELECT
  t.user_id,
  t.project_id,
  t.action_type,
  p.display_name,
  p.category,
  COUNT(*) AS total_actions,
  SUM(ABS(t.amount)) AS total_tokens,
  MIN(t.created_at) AS first_used,
  MAX(t.created_at) AS last_used,
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '1 day') AS actions_today,
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '7 days') AS actions_7d,
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '30 days') AS actions_30d,
  SUM(ABS(t.amount)) FILTER (WHERE t.created_at >= now() - interval '30 days') AS tokens_30d
FROM token_transactions t
JOIN token_pricing p ON p.action_type = t.action_type
WHERE t.amount < 0
GROUP BY t.user_id, t.project_id, t.action_type, p.display_name, p.category;

GRANT SELECT ON token_usage_summary TO anon, authenticated;

-- 7. Replace debit_tokens RPC
CREATE OR REPLACE FUNCTION debit_tokens(
  p_project_id TEXT,
  p_action_type TEXT,
  p_user_email TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_note TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost INTEGER;
  v_balance INTEGER;
  v_new_balance INTEGER;
  v_tx_id UUID;
  v_display_name TEXT;
  v_resolved_user_id UUID;
BEGIN
  v_resolved_user_id := p_user_id;

  IF v_resolved_user_id IS NULL AND p_user_email IS NOT NULL THEN
    SELECT id INTO v_resolved_user_id FROM auth.users WHERE email = p_user_email;
  END IF;

  IF v_resolved_user_id IS NULL AND p_project_id IS NOT NULL THEN
    SELECT u.id INTO v_resolved_user_id
    FROM projects p JOIN auth.users u ON u.email = p.owner_id
    WHERE p.id = p_project_id;
  END IF;

  SELECT token_cost, display_name INTO v_cost, v_display_name
  FROM token_pricing WHERE action_type = p_action_type AND is_active = true;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive action type: %', p_action_type;
  END IF;

  -- Free actions
  IF v_cost = 0 THEN
    INSERT INTO token_transactions (project_id, user_id, action_type, amount, balance_after, user_email, reference_id, metadata, note)
    SELECT p_project_id, v_resolved_user_id, p_action_type, 0,
           COALESCE(
             (SELECT balance FROM token_balances WHERE user_id = v_resolved_user_id AND project_id IS NULL),
             (SELECT balance FROM token_balances WHERE project_id = p_project_id), 0
           ),
           p_user_email, p_reference_id, p_metadata, COALESCE(p_note, v_display_name)
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'cost', 0, 'balance_after',
      COALESCE(
        (SELECT balance FROM token_balances WHERE user_id = v_resolved_user_id AND project_id IS NULL),
        (SELECT balance FROM token_balances WHERE project_id = p_project_id), 0
      ));
  END IF;

  -- Try user-level balance first
  IF v_resolved_user_id IS NOT NULL THEN
    SELECT balance INTO v_balance FROM token_balances
    WHERE user_id = v_resolved_user_id AND project_id IS NULL FOR UPDATE;
  END IF;

  -- Fallback to project-level
  IF v_balance IS NULL THEN
    SELECT balance INTO v_balance FROM token_balances
    WHERE project_id = p_project_id AND user_id IS NULL FOR UPDATE;
  END IF;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No token balance found for user or project: %', COALESCE(p_project_id, 'unknown');
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient token balance. Required: %, Available: %', v_cost, v_balance;
  END IF;

  v_new_balance := v_balance - v_cost;

  IF v_resolved_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM token_balances WHERE user_id = v_resolved_user_id AND project_id IS NULL
  ) THEN
    UPDATE token_balances SET balance = v_new_balance, total_consumed = total_consumed + v_cost, updated_at = now()
    WHERE user_id = v_resolved_user_id AND project_id IS NULL;
  ELSE
    UPDATE token_balances SET balance = v_new_balance, total_consumed = total_consumed + v_cost, updated_at = now()
    WHERE project_id = p_project_id AND user_id IS NULL;
  END IF;

  INSERT INTO token_transactions (project_id, user_id, action_type, amount, balance_after, user_email, reference_id, metadata, note)
  VALUES (p_project_id, v_resolved_user_id, p_action_type, -v_cost, v_new_balance, p_user_email, p_reference_id, p_metadata,
          COALESCE(p_note, v_display_name))
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'cost', v_cost, 'balance_after', v_new_balance);
END;
$$;

-- 8. Replace credit_tokens RPC
CREATE OR REPLACE FUNCTION credit_tokens(
  p_project_id TEXT DEFAULT NULL,
  p_amount INTEGER DEFAULT 0,
  p_user_email TEXT DEFAULT NULL,
  p_note TEXT DEFAULT 'Token purchase',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
  v_tx_id UUID;
  v_resolved_user_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  v_resolved_user_id := p_user_id;

  IF v_resolved_user_id IS NULL AND p_user_email IS NOT NULL THEN
    SELECT id INTO v_resolved_user_id FROM auth.users WHERE email = p_user_email;
  END IF;

  IF v_resolved_user_id IS NULL AND p_project_id IS NOT NULL THEN
    SELECT u.id INTO v_resolved_user_id
    FROM projects p JOIN auth.users u ON u.email = p.owner_id
    WHERE p.id = p_project_id;
  END IF;

  IF v_resolved_user_id IS NOT NULL THEN
    INSERT INTO token_balances (user_id, project_id, balance, total_purchased, total_consumed, low_balance_threshold)
    VALUES (v_resolved_user_id, NULL, p_amount, p_amount, 0, 10)
    ON CONFLICT (user_id) WHERE project_id IS NULL
    DO UPDATE SET
      balance = token_balances.balance + p_amount,
      total_purchased = token_balances.total_purchased + p_amount,
      updated_at = now();

    SELECT balance INTO v_new_balance FROM token_balances
    WHERE user_id = v_resolved_user_id AND project_id IS NULL;
  ELSE
    INSERT INTO token_balances (project_id, balance, total_purchased)
    VALUES (p_project_id, p_amount, p_amount)
    ON CONFLICT (project_id)
    DO UPDATE SET
      balance = token_balances.balance + p_amount,
      total_purchased = token_balances.total_purchased + p_amount,
      updated_at = now();

    SELECT balance INTO v_new_balance FROM token_balances WHERE project_id = p_project_id;
  END IF;

  INSERT INTO token_transactions (project_id, user_id, action_type, amount, balance_after, user_email, note)
  VALUES (p_project_id, v_resolved_user_id, 'purchase', p_amount, v_new_balance, p_user_email, p_note)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'amount', p_amount, 'balance_after', v_new_balance);
END;
$$;

-- 9. Signup trigger: seed 100 tokens for new users
CREATE OR REPLACE FUNCTION seed_tokens_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO token_balances (user_id, project_id, balance, total_purchased, total_consumed, low_balance_threshold)
  VALUES (NEW.id, NULL, 100, 100, 0, 10);

  INSERT INTO token_transactions (user_id, project_id, action_type, amount, balance_after, user_email, note)
  VALUES (NEW.id, NULL, 'credit', 100, 100, NEW.email, 'Welcome bonus - 100 tokens');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tokens_new_user ON auth.users;
CREATE TRIGGER trg_seed_tokens_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION seed_tokens_for_new_user();

COMMIT;

-- Reload schema cache (must be outside transaction)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE. Verify:
--   SELECT * FROM token_balances WHERE user_id IS NOT NULL AND project_id IS NULL;
--   SELECT * FROM token_usage_summary WHERE user_id IS NOT NULL;
-- ============================================================
