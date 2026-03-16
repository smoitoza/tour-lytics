-- RFP/LOI Submissions table for financial analysis engine
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS rfp_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT 'sf-office-search',
  building_num INTEGER NOT NULL,
  building_address TEXT NOT NULL,
  
  -- Document metadata
  doc_type TEXT NOT NULL CHECK (doc_type IN ('rfp', 'loi')),
  doc_name TEXT NOT NULL,
  doc_source TEXT,  -- e.g. "Counter #3 from Splunk via JLL"
  submitted_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  
  -- Extracted deal terms (JSON for flexibility)
  deal_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected structure:
  -- {
  --   "rsf": 16000,
  --   "lease_term_months": 63,
  --   "commencement_date": "2026-06-01",
  --   "expiration_date": "2031-08-31",
  --   "base_rent_rsf": 43.00,
  --   "rent_basis": "Modified Gross",
  --   "annual_escalation_pct": 3.0,
  --   "free_rent_months": 5,
  --   "ti_allowance_rsf": 0,
  --   "ti_allowance_total": 0,
  --   "security_deposit": 0,
  --   "parking_spots": 5,
  --   "parking_rate_monthly": 437,
  --   "parking_escalation_pct": 3.0,
  --   "opex_monthly": 50000,
  --   "structure": "Sublease",
  --   "landlord": "Splunk Inc.",
  --   "notes": "Free FF&E, $1 purchase option"
  -- }
  
  -- Generated analysis results (JSON)
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected structure:
  -- {
  --   "cash_flow": { "monthly": [...], "totals": {...} },
  --   "straight_line_pl": { "annual": [...], "totals": {...} },
  --   "gaap": { "rou_asset": ..., "lease_liability": ..., "schedule": [...] }
  -- }
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'archived')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rfp_project_building ON rfp_submissions(project_id, building_num);
CREATE INDEX IF NOT EXISTS idx_rfp_project_status ON rfp_submissions(project_id, status);

-- Enable RLS
ALTER TABLE rfp_submissions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (auth handled at app level)
CREATE POLICY "Allow all for rfp_submissions" ON rfp_submissions
  FOR ALL USING (true) WITH CHECK (true);
