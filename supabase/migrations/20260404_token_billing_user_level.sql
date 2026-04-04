-- =============================================================
-- Migration: Per-User Token Billing Model
-- Target: DEV Supabase instance (lpewsfzwjnlnqnludvwt) ONLY
-- DO NOT run on production or staging
-- =============================================================

-- 1. Add user_id column to token_balances
-- --------------------------------------------------------
ALTER TABLE token_balances
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Add user_id column to token_transactions
-- --------------------------------------------------------
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Migrate existing project-level balances to user-level
-- --------------------------------------------------------
-- For each user, aggregate their project-level balances into a single user-level row.
-- We derive the user from project ownership (projects.owner_id -> auth.users.email -> auth.users.id).
-- If a user owns multiple projects, their balances are summed.

-- First, backfill user_id on existing token_balances rows using project ownership
UPDATE token_balances tb
SET user_id = u.id
FROM projects p
JOIN auth.users u ON u.email = p.owner_id
WHERE tb.project_id = p.id
  AND tb.user_id IS NULL;

-- Backfill user_id on existing token_transactions using the same mapping
UPDATE token_transactions tt
SET user_id = u.id
FROM projects p
JOIN auth.users u ON u.email = p.owner_id
WHERE tt.project_id = p.id
  AND tt.user_id IS NULL;

-- Now consolidate: for users who own multiple projects, create one user-level balance row
-- by aggregating all their project-level balances
INSERT INTO token_balances (user_id, balance, total_purchased, total_consumed, low_balance_threshold)
SELECT
  user_id,
  SUM(balance),
  SUM(total_purchased),
  SUM(total_consumed),
  10  -- default low-balance threshold
FROM token_balances
WHERE user_id IS NOT NULL
  AND project_id IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) WHERE project_id IS NULL
DO UPDATE SET
  balance = EXCLUDED.balance,
  total_purchased = EXCLUDED.total_purchased,
  total_consumed = EXCLUDED.total_consumed;

-- 4. Add unique constraint for user-level balances (one row per user, project_id IS NULL)
-- --------------------------------------------------------
-- Make project_id nullable (it may already be, but ensure it)
ALTER TABLE token_balances ALTER COLUMN project_id DROP NOT NULL;

-- Unique partial index: one user-level balance row per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_balances_user_id
  ON token_balances (user_id)
  WHERE project_id IS NULL;

-- Index for looking up user balances quickly
CREATE INDEX IF NOT EXISTS idx_token_balances_user_lookup
  ON token_balances (user_id)
  WHERE user_id IS NOT NULL;

-- Index for looking up user transactions
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id
  ON token_transactions (user_id);

-- 5. Update the token_usage_summary view
-- --------------------------------------------------------
-- Supports both user-level (filter by user_id) and project-level (filter by project_id) queries
CREATE OR REPLACE VIEW token_usage_summary AS
SELECT
  user_id,
  project_id,
  action_type,
  COUNT(*)::int AS usage_count,
  SUM(token_cost)::int AS total_tokens,
  MIN(created_at) AS first_used,
  MAX(created_at) AS last_used
FROM token_transactions
GROUP BY user_id, project_id, action_type;

-- 6. Update debit_tokens RPC to work with user-level balances
-- --------------------------------------------------------
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
  v_cost INT;
  v_balance INT;
  v_new_balance INT;
  v_tx_id UUID;
  v_resolved_user_id UUID;
BEGIN
  -- Resolve user_id: use provided, or look up from email, or from project owner
  v_resolved_user_id := p_user_id;

  IF v_resolved_user_id IS NULL AND p_user_email IS NOT NULL THEN
    SELECT id INTO v_resolved_user_id
    FROM auth.users
    WHERE email = p_user_email;
  END IF;

  IF v_resolved_user_id IS NULL AND p_project_id IS NOT NULL THEN
    SELECT u.id INTO v_resolved_user_id
    FROM projects p
    JOIN auth.users u ON u.email = p.owner_id
    WHERE p.id = p_project_id;
  END IF;

  -- Look up the cost of this action
  SELECT token_cost INTO v_cost
  FROM token_pricing
  WHERE action_type = p_action_type AND is_active = true;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown action type: %', p_action_type;
  END IF;

  -- Get user-level balance (row where project_id IS NULL)
  IF v_resolved_user_id IS NOT NULL THEN
    SELECT balance INTO v_balance
    FROM token_balances
    WHERE user_id = v_resolved_user_id AND project_id IS NULL
    FOR UPDATE;
  ELSE
    -- Fallback to project-level balance for backward compatibility
    SELECT balance INTO v_balance
    FROM token_balances
    WHERE project_id = p_project_id AND user_id IS NULL
    FOR UPDATE;
  END IF;

  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient token balance (have: %, need: %)', COALESCE(v_balance, 0), v_cost;
  END IF;

  -- Deduct from user-level balance
  v_new_balance := v_balance - v_cost;

  IF v_resolved_user_id IS NOT NULL THEN
    UPDATE token_balances
    SET balance = v_new_balance,
        total_consumed = total_consumed + v_cost,
        updated_at = NOW()
    WHERE user_id = v_resolved_user_id AND project_id IS NULL;
  ELSE
    UPDATE token_balances
    SET balance = v_new_balance,
        total_consumed = total_consumed + v_cost,
        updated_at = NOW()
    WHERE project_id = p_project_id AND user_id IS NULL;
  END IF;

  -- Record the transaction with both user_id and project_id
  INSERT INTO token_transactions (
    project_id, user_id, action_type, token_cost,
    balance_after, user_email, reference_id, metadata, note
  ) VALUES (
    p_project_id, v_resolved_user_id, p_action_type, v_cost,
    v_new_balance, p_user_email, p_reference_id, p_metadata, p_note
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'balance_after', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 7. Update credit_tokens RPC to work with user-level balances
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_tokens(
  p_project_id TEXT DEFAULT NULL,
  p_amount INT DEFAULT 0,
  p_user_email TEXT DEFAULT NULL,
  p_note TEXT DEFAULT 'Token purchase',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INT;
  v_resolved_user_id UUID;
BEGIN
  -- Resolve user_id
  v_resolved_user_id := p_user_id;

  IF v_resolved_user_id IS NULL AND p_user_email IS NOT NULL THEN
    SELECT id INTO v_resolved_user_id
    FROM auth.users
    WHERE email = p_user_email;
  END IF;

  IF v_resolved_user_id IS NULL AND p_project_id IS NOT NULL THEN
    SELECT u.id INTO v_resolved_user_id
    FROM projects p
    JOIN auth.users u ON u.email = p.owner_id
    WHERE p.id = p_project_id;
  END IF;

  -- Credit user-level balance
  IF v_resolved_user_id IS NOT NULL THEN
    INSERT INTO token_balances (user_id, project_id, balance, total_purchased, total_consumed, low_balance_threshold)
    VALUES (v_resolved_user_id, NULL, p_amount, p_amount, 0, 10)
    ON CONFLICT (user_id) WHERE project_id IS NULL
    DO UPDATE SET
      balance = token_balances.balance + p_amount,
      total_purchased = token_balances.total_purchased + p_amount,
      updated_at = NOW();

    SELECT balance INTO v_new_balance
    FROM token_balances
    WHERE user_id = v_resolved_user_id AND project_id IS NULL;
  ELSE
    -- Fallback: credit by project_id for backward compatibility
    UPDATE token_balances
    SET balance = balance + p_amount,
        total_purchased = total_purchased + p_amount,
        updated_at = NOW()
    WHERE project_id = p_project_id;

    SELECT balance INTO v_new_balance
    FROM token_balances
    WHERE project_id = p_project_id;
  END IF;

  -- Record the credit transaction
  INSERT INTO token_transactions (
    project_id, user_id, action_type, token_cost,
    balance_after, user_email, note
  ) VALUES (
    p_project_id, v_resolved_user_id, 'credit', p_amount,
    v_new_balance, p_user_email, p_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'balance_after', v_new_balance
  );
END;
$$;

-- 8. Database trigger: seed 100 tokens for new users on signup
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_tokens_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO token_balances (user_id, project_id, balance, total_purchased, total_consumed, low_balance_threshold)
  VALUES (NEW.id, NULL, 100, 100, 0, 10);

  INSERT INTO token_transactions (user_id, project_id, action_type, token_cost, balance_after, user_email, note)
  VALUES (NEW.id, NULL, 'credit', 100, 100, NEW.email, 'Welcome bonus - 100 tokens');

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists, then create
DROP TRIGGER IF EXISTS trg_seed_tokens_new_user ON auth.users;
CREATE TRIGGER trg_seed_tokens_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION seed_tokens_for_new_user();

-- ============================================================
-- DONE. Verify with:
--   SELECT * FROM token_balances WHERE user_id IS NOT NULL AND project_id IS NULL;
--   SELECT * FROM token_usage_summary WHERE user_id IS NOT NULL;
-- ============================================================
