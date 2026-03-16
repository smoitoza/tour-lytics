-- ===== Tour-Lytics Token Usage Tracking - Part 1: Tables & Data =====
-- Run this FIRST in Supabase SQL Editor

-- 1. TOKEN PRICING
CREATE TABLE IF NOT EXISTS token_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  token_cost INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'ai',
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO token_pricing (action_type, display_name, token_cost, category, description) VALUES
  ('chat_message',        'AI Chat Message',         1,  'ai',        'Single message to the Tour Book AI chatbot'),
  ('rfp_analysis',        'RFP/LOI Analysis',        15, 'financial', 'Upload and analyze an RFP or LOI document with full financial modeling'),
  ('survey_map_upload',   'Broker Survey Upload',    25, 'data',      'Parse a broker survey document and generate the project map'),
  ('photo_analysis',      'Photo AI Analysis',       3,  'ai',        'AI-powered analysis and tagging of a tour photo'),
  ('photo_bulk_analysis', 'Bulk Photo Analysis',     8,  'ai',        'Batch AI analysis of multiple tour photos'),
  ('commute_study',       'Commute Study',           10, 'data',      'Process and analyze employee commute data'),
  ('assumptions_update',  'Assumptions Update',      0,  'financial', 'Update financial assumptions for a building (free action)')
ON CONFLICT (action_type) DO NOTHING;

-- 2. TOKEN BALANCES
CREATE TABLE IF NOT EXISTS token_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_consumed INTEGER NOT NULL DEFAULT 0,
  low_balance_threshold INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO token_balances (project_id, balance, total_purchased)
VALUES ('sf-office-search', 100, 100)
ON CONFLICT (project_id) DO NOTHING;

-- 3. TOKEN TRANSACTIONS
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  user_email TEXT,
  reference_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_tx_project ON token_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_project_created ON token_transactions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_project_action ON token_transactions(project_id, action_type);
CREATE INDEX IF NOT EXISTS idx_token_tx_user ON token_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_token_balances_project ON token_balances(project_id);

-- RLS
ALTER TABLE token_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read token pricing" ON token_pricing FOR SELECT USING (true);
CREATE POLICY "Service role can manage balances" ON token_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read token balances" ON token_balances FOR SELECT USING (true);
CREATE POLICY "Anyone can read token transactions" ON token_transactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert token transactions" ON token_transactions FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
