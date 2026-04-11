-- Add CAPEX payout schedule and in-service date columns to project_assumptions
-- Run on PRODUCTION: https://supabase.com/dashboard/project/lsckcmvoqmwxovqejvyl/sql/new

ALTER TABLE project_assumptions
ADD COLUMN IF NOT EXISTS capex_payout_type text DEFAULT 'month1',
ADD COLUMN IF NOT EXISTS capex_payout_month integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS capex_payout_start integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS capex_payout_end integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS capex_milestones jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS capex_in_service_month integer DEFAULT 1;
