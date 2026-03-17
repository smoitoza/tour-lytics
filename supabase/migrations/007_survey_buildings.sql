-- Survey Buildings: persist AI-parsed buildings per project
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS survey_buildings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  num INTEGER NOT NULL,
  address TEXT NOT NULL,
  neighborhood TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  year_built_class TEXT DEFAULT '',
  building_sf TEXT DEFAULT '',
  stories TEXT DEFAULT '',
  space_available TEXT DEFAULT '',
  rental_rate TEXT DEFAULT '',
  direct_sublease TEXT DEFAULT '',
  floors JSONB DEFAULT '[]'::jsonb,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  survey_pdf_url TEXT,
  survey_pdf_page INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, address)
);

-- RLS
ALTER TABLE survey_buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "survey_buildings_select" ON survey_buildings FOR SELECT USING (true);
CREATE POLICY "survey_buildings_insert" ON survey_buildings FOR INSERT WITH CHECK (true);
CREATE POLICY "survey_buildings_update" ON survey_buildings FOR UPDATE USING (true);
CREATE POLICY "survey_buildings_delete" ON survey_buildings FOR DELETE USING (true);

-- Fast project lookup index
CREATE INDEX IF NOT EXISTS idx_survey_buildings_project ON survey_buildings(project_id);
