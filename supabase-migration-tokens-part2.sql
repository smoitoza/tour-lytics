-- ===== Tour-Lytics Token Usage Tracking - Part 2: Functions & View =====
-- Run this SECOND in Supabase SQL Editor (after Part 1 succeeds)

-- DEBIT TOKENS: atomic check-and-deduct
CREATE OR REPLACE FUNCTION debit_tokens(
  p_project_id TEXT,
  p_action_type TEXT,
  p_user_email TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_cost INTEGER;
  v_balance INTEGER;
  v_new_balance INTEGER;
  v_tx_id UUID;
  v_display_name TEXT;
BEGIN
  SELECT token_cost, display_name INTO v_cost, v_display_name
  FROM token_pricing
  WHERE action_type = p_action_type AND is_active = true;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive action type: %', p_action_type;
  END IF;

  IF v_cost = 0 THEN
    INSERT INTO token_transactions (project_id, action_type, amount, balance_after, user_email, reference_id, metadata, note)
    SELECT p_project_id, p_action_type, 0,
           COALESCE((SELECT balance FROM token_balances WHERE project_id = p_project_id), 0),
           p_user_email, p_reference_id, p_metadata,
           COALESCE(p_note, v_display_name)
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'cost', 0, 'balance_after',
      (SELECT balance FROM token_balances WHERE project_id = p_project_id));
  END IF;

  SELECT balance INTO v_balance
  FROM token_balances
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No token balance found for project: %', p_project_id;
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient token balance. Required: %, Available: %', v_cost, v_balance;
  END IF;

  v_new_balance := v_balance - v_cost;

  UPDATE token_balances
  SET balance = v_new_balance,
      total_consumed = total_consumed + v_cost,
      updated_at = now()
  WHERE project_id = p_project_id;

  INSERT INTO token_transactions (project_id, action_type, amount, balance_after, user_email, reference_id, metadata, note)
  VALUES (p_project_id, p_action_type, -v_cost, v_new_balance, p_user_email, p_reference_id, p_metadata,
          COALESCE(p_note, v_display_name))
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'cost', v_cost,
    'balance_after', v_new_balance
  );
END;
$fn$;

-- CREDIT TOKENS: for purchases, bonuses, refunds
CREATE OR REPLACE FUNCTION credit_tokens(
  p_project_id TEXT,
  p_amount INTEGER,
  p_user_email TEXT DEFAULT NULL,
  p_note TEXT DEFAULT 'Token purchase'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_new_balance INTEGER;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  INSERT INTO token_balances (project_id, balance, total_purchased)
  VALUES (p_project_id, p_amount, p_amount)
  ON CONFLICT (project_id)
  DO UPDATE SET
    balance = token_balances.balance + p_amount,
    total_purchased = token_balances.total_purchased + p_amount,
    updated_at = now();

  SELECT balance INTO v_new_balance
  FROM token_balances
  WHERE project_id = p_project_id;

  INSERT INTO token_transactions (project_id, action_type, amount, balance_after, user_email, note)
  VALUES (p_project_id, 'purchase', p_amount, v_new_balance, p_user_email, p_note)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'amount', p_amount,
    'balance_after', v_new_balance
  );
END;
$fn$;

-- USAGE SUMMARY VIEW
CREATE OR REPLACE VIEW token_usage_summary AS
SELECT
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
GROUP BY t.project_id, t.action_type, p.display_name, p.category;

GRANT SELECT ON token_usage_summary TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
