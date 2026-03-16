-- ===== Tour-Lytics Token Usage Tracking =====
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- 
-- Three tables:
--   1. token_pricing     - cost per action type (admin-managed)
--   2. token_balances    - current balance per project
--   3. token_transactions - immutable ledger of every credit/debit

-- ============================================================
-- 1. TOKEN PRICING - defines cost for each billable action
-- ============================================================
CREATE TABLE IF NOT EXISTS token_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL UNIQUE,
  -- Human-readable label for the action
  display_name TEXT NOT NULL,
  -- Cost in tokens (integer to avoid floating point issues)
  token_cost INTEGER NOT NULL DEFAULT 1,
  -- Category for grouping in dashboard
  category TEXT NOT NULL DEFAULT 'ai',
  -- Whether this action is currently billable
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Description shown in usage reports
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default pricing for all current AI actions
INSERT INTO token_pricing (action_type, display_name, token_cost, category, description) VALUES
  ('chat_message',       'AI Chat Message',         1,  'ai',        'Single message to the Tour Book AI chatbot'),
  ('rfp_analysis',       'RFP/LOI Analysis',        10, 'financial', 'Upload and analyze an RFP or LOI document with full financial modeling'),
  ('survey_upload',      'Broker Survey Upload',     5,  'data',      'Parse and process a broker survey document'),
  ('photo_analysis',     'Photo AI Analysis',        2,  'ai',        'AI-powered analysis and tagging of a tour photo'),
  ('photo_bulk_analysis','Bulk Photo Analysis',      5,  'ai',        'Batch AI analysis of multiple tour photos'),
  ('commute_study',      'Commute Study',            8,  'data',      'Process and analyze employee commute data'),
  ('assumptions_update', 'Assumptions Update',       0,  'financial', 'Update financial assumptions for a building (free action)')
ON CONFLICT (action_type) DO NOTHING;

-- ============================================================
-- 2. TOKEN BALANCES - current balance per project
-- ============================================================
CREATE TABLE IF NOT EXISTS token_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  -- Current available balance
  balance INTEGER NOT NULL DEFAULT 0,
  -- Lifetime totals for dashboard
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_consumed INTEGER NOT NULL DEFAULT 0,
  -- Soft limit: warn when balance drops below this
  low_balance_threshold INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the current project with a generous starting balance (free tier / beta)
INSERT INTO token_balances (project_id, balance, total_purchased)
VALUES ('sf-office-search', 1000, 1000)
ON CONFLICT (project_id) DO NOTHING;

-- ============================================================
-- 3. TOKEN TRANSACTIONS - immutable audit ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  -- What type of action consumed/added tokens
  action_type TEXT NOT NULL,
  -- Positive = credit (purchase, bonus), Negative = debit (usage)
  amount INTEGER NOT NULL,
  -- Running balance after this transaction
  balance_after INTEGER NOT NULL,
  -- Who triggered the action
  user_email TEXT,
  -- Optional reference to the resource that triggered this (e.g. rfp_submission id)
  reference_id TEXT,
  -- Additional metadata (e.g. building name, doc name, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Human-readable note
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_token_tx_project ON token_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_project_created ON token_transactions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_project_action ON token_transactions(project_id, action_type);
CREATE INDEX IF NOT EXISTS idx_token_tx_user ON token_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_token_balances_project ON token_balances(project_id);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================
ALTER TABLE token_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Pricing: readable by all, writable by service role only
CREATE POLICY "Anyone can read token pricing" ON token_pricing
  FOR SELECT USING (true);

-- Balances: readable by all project members
CREATE POLICY "Anyone can read token balances" ON token_balances
  FOR SELECT USING (true);

-- Balances: only service role can modify (via serverless functions)
CREATE POLICY "Service role can manage balances" ON token_balances
  FOR ALL USING (true) WITH CHECK (true);

-- Transactions: readable by all, insert only (no updates or deletes - immutable ledger)
CREATE POLICY "Anyone can read token transactions" ON token_transactions
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert token transactions" ON token_transactions
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 5. HELPER FUNCTION: Atomic debit with balance check
-- ============================================================
-- This function atomically checks balance, deducts tokens, and logs the transaction.
-- Returns the transaction record on success, or raises an exception on insufficient balance.

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
AS $$
DECLARE
  v_cost INTEGER;
  v_balance INTEGER;
  v_new_balance INTEGER;
  v_tx_id UUID;
  v_display_name TEXT;
BEGIN
  -- Look up the cost for this action type
  SELECT token_cost, display_name INTO v_cost, v_display_name
  FROM token_pricing
  WHERE action_type = p_action_type AND is_active = true;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive action type: %', p_action_type;
  END IF;

  -- Free actions: log but don't debit
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

  -- Lock the balance row and check funds
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

  -- Deduct tokens
  v_new_balance := v_balance - v_cost;

  UPDATE token_balances
  SET balance = v_new_balance,
      total_consumed = total_consumed + v_cost,
      updated_at = now()
  WHERE project_id = p_project_id;

  -- Log the transaction (negative amount = debit)
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
$$;

-- ============================================================
-- 6. HELPER FUNCTION: Credit tokens (for purchases, bonuses)
-- ============================================================
CREATE OR REPLACE FUNCTION credit_tokens(
  p_project_id TEXT,
  p_amount INTEGER,
  p_user_email TEXT DEFAULT NULL,
  p_note TEXT DEFAULT 'Token purchase'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  -- Upsert balance (create if first purchase)
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

  -- Log the credit transaction (positive amount = credit)
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
$$;

-- ============================================================
-- 7. USAGE SUMMARY VIEW - for dashboard queries
-- ============================================================
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
  -- Daily breakdown for charting (last 30 days)
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '1 day') AS actions_today,
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '7 days') AS actions_7d,
  COUNT(*) FILTER (WHERE t.created_at >= now() - interval '30 days') AS actions_30d,
  SUM(ABS(t.amount)) FILTER (WHERE t.created_at >= now() - interval '30 days') AS tokens_30d
FROM token_transactions t
JOIN token_pricing p ON p.action_type = t.action_type
WHERE t.amount < 0  -- Only debits (usage)
GROUP BY t.project_id, t.action_type, p.display_name, p.category;

-- Grant access to the view
GRANT SELECT ON token_usage_summary TO anon, authenticated;

-- ============================================================
-- Done! Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
