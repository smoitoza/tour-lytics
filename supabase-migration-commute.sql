-- Commute Study persistence
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lsckcmvoqmwxovqejvyl/sql/new

CREATE TABLE IF NOT EXISTS commute_studies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL DEFAULT 'sf-office-search',
  filename text NOT NULL DEFAULT '',
  headers jsonb NOT NULL DEFAULT '[]',
  lat_col integer NOT NULL DEFAULT 0,
  lng_col integer NOT NULL DEFAULT 0,
  employees jsonb NOT NULL DEFAULT '[]',
  results jsonb NOT NULL DEFAULT '{}',
  uploaded_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE commute_studies ENABLE ROW LEVEL SECURITY;

-- Allow all access (auth handled at API level)
CREATE POLICY "Allow all access to commute_studies" ON commute_studies
  FOR ALL USING (true) WITH CHECK (true);
