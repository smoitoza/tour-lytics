-- ===== Tour-Lytics Survey System Migration =====
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  persona text NOT NULL CHECK (persona IN ('admin', 'broker', 'touree')),
  project_id text NOT NULL DEFAULT 'sf-office-search',
  added_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(email, project_id)
);

-- Survey submissions table
CREATE TABLE IF NOT EXISTS survey_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  project_id text NOT NULL DEFAULT 'sf-office-search',
  building_key text NOT NULL,
  building_name text NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_email, building_key, project_id)
);

-- Insert the admin user
INSERT INTO project_members (email, display_name, persona, project_id, added_by)
VALUES ('samoitoza@gmail.com', 'Scott Moitoza', 'admin', 'sf-office-search', 'system')
ON CONFLICT (email, project_id) DO NOTHING;

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for project_members
CREATE POLICY "Anyone can read project members" ON project_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert members" ON project_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update members" ON project_members FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete members" ON project_members FOR DELETE USING (true);

-- Policies for survey_submissions
CREATE POLICY "Anyone can read survey submissions" ON survey_submissions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert survey submissions" ON survey_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update survey submissions" ON survey_submissions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete survey submissions" ON survey_submissions FOR DELETE USING (true);
