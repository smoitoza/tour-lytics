-- Project Assumptions table for internal cost modeling
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lsckcmvoqmwxovqejvyl/sql/new

CREATE TABLE IF NOT EXISTS project_assumptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL DEFAULT 'sf-office-search',
  
  -- OpEx line items (monthly amounts)
  opex_food_beverage numeric DEFAULT 0,
  opex_workplace_experience numeric DEFAULT 0,
  opex_maintenance_security numeric DEFAULT 0,
  opex_custom_items jsonb DEFAULT '[]'::jsonb,
  -- Expected structure for custom items:
  -- [{ "label": "IT Infrastructure", "monthly": 5000 }, ...]
  
  -- Headcount & density
  headcount integer DEFAULT 0,
  target_density_rsf integer DEFAULT 0,  -- target RSF per person
  
  -- Financial assumptions
  discount_rate numeric DEFAULT 6.0,  -- IBR percentage for GAAP
  
  -- Metadata
  updated_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE project_assumptions ENABLE ROW LEVEL SECURITY;

-- Allow all access (auth handled at app level)
CREATE POLICY "Allow all access to project_assumptions" ON project_assumptions
  FOR ALL USING (true) WITH CHECK (true);
