-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                          -- slug like 'sf-office-search'
  name TEXT NOT NULL,                           -- 'San Francisco Office Search'
  market TEXT NOT NULL DEFAULT '',               -- 'San Francisco, CA'
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',         -- 'active', 'archived'
  buildings_count INTEGER DEFAULT 0,
  sqft TEXT DEFAULT '',
  shortlisted_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,                     -- email of creator
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the existing SF project
INSERT INTO projects (id, name, market, description, status, buildings_count, sqft, shortlisted_count, created_by, created_at, updated_at)
VALUES (
  'sf-office-search',
  'San Francisco Office Search',
  'San Francisco, CA',
  '33 buildings surveyed across SoMa, FiDi, and South Beach neighborhoods',
  'active',
  33,
  '2.8M',
  4,
  'samoitoza@gmail.com',
  '2026-03-11T00:00:00Z',
  '2026-03-13T00:00:00Z'
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Allow anon read access (users must be authenticated via app logic)
CREATE POLICY "Allow public read" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON projects FOR UPDATE USING (true);

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
