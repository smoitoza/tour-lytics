-- Add broker fee columns to project_assumptions table
-- Run in Supabase SQL Editor for both dev and prod

ALTER TABLE project_assumptions 
  ADD COLUMN IF NOT EXISTS broker_fee_type text DEFAULT 'none' CHECK (broker_fee_type IN ('none', 'expense', 'credit')),
  ADD COLUMN IF NOT EXISTS broker_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS broker_fee_notes text DEFAULT '';

-- broker_fee_type: 
--   'none'    = no broker fee (default)
--   'expense' = tenant pays broker (common in EMEA/international)
--   'credit'  = broker rebate to tenant (common in US)
--
-- broker_fee_amount: total dollar amount (always positive, type determines direction)
--
-- Accounting treatment (ASC 842 / IFRS 16):
--   expense: Cash out in month 1. Capitalized as Initial Direct Cost into ROU Asset,
--            amortized straight-line over lease term in SL and GAAP.
--   credit:  Cash in month 1. Treated as lease incentive, reduces ROU Asset,
--            amortized straight-line over lease term in SL and GAAP.
