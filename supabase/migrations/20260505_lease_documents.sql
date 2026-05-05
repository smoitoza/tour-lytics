-- ============================================================
-- Lease Review v1: lease_documents table
-- ============================================================
-- Stores uploaded leases at the building level (project_id + building_address)
-- with versioning so a single building can have multiple lease drafts:
--   - landlord first draft
--   - tenant redline
--   - landlord redline
--   - executed
--
-- Mirrors the rfp_submissions pattern:
--   - project_id + building_address scope each row
--   - version_number auto-increments per (project_id, building_address)
--   - extraction_json holds the AI-extracted clause structure
--   - summary_json holds the AI-generated rollup with risk scoring
-- ============================================================

CREATE TABLE IF NOT EXISTS lease_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_num      INTEGER,
  building_address  TEXT NOT NULL,

  -- Versioning
  version_number    INTEGER NOT NULL DEFAULT 1,
  version_label     TEXT NOT NULL DEFAULT 'v1',         -- user-facing, editable
  parent_version_id UUID REFERENCES lease_documents(id) ON DELETE SET NULL,

  -- Document classification (drives badge in UI)
  doc_type          TEXT NOT NULL DEFAULT 'initial_draft', -- initial_draft | tenant_redline | landlord_redline | executed | other
  doc_name          TEXT NOT NULL DEFAULT '',              -- e.g. "Master Lease v3 - Cushman 2026-05-05"

  -- Source file
  source_url        TEXT,                  -- public URL to PDF/DOCX in Supabase storage
  source_path       TEXT,                  -- storage path (for cleanup)
  source_filename   TEXT,                  -- original filename
  source_mime       TEXT,                  -- application/pdf | application/vnd.openxmlformats-officedocument.wordprocessingml.document

  -- AI output
  raw_text          TEXT,                  -- full extracted text (for diffing later)
  extraction_json   JSONB DEFAULT '{}'::jsonb,  -- {clauses: [{type, label, section, original_text, key_terms, ...}], document_meta: {...}}
  summary_json      JSONB DEFAULT '{}'::jsonb,  -- {by_group: {economics: {...}, ...}, top_risks: [...], headline_metrics: {...}}
  extraction_status TEXT NOT NULL DEFAULT 'pending', -- pending | extracting | done | error
  extraction_error  TEXT,

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'draft',     -- draft | active | archived
  uploaded_by       TEXT NOT NULL,                      -- user email
  notes             TEXT DEFAULT '',

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_lease_documents_project        ON lease_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_lease_documents_building       ON lease_documents(project_id, building_address);
CREATE INDEX IF NOT EXISTS idx_lease_documents_status         ON lease_documents(status);
CREATE INDEX IF NOT EXISTS idx_lease_documents_parent         ON lease_documents(parent_version_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION lease_documents_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_documents_updated_at ON lease_documents;
CREATE TRIGGER trg_lease_documents_updated_at
  BEFORE UPDATE ON lease_documents
  FOR EACH ROW EXECUTE FUNCTION lease_documents_set_updated_at();

-- RLS (mirrors rfp_submissions / survey_buildings)
ALTER TABLE lease_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_documents_select" ON lease_documents;
DROP POLICY IF EXISTS "lease_documents_insert" ON lease_documents;
DROP POLICY IF EXISTS "lease_documents_update" ON lease_documents;
DROP POLICY IF EXISTS "lease_documents_delete" ON lease_documents;

CREATE POLICY "lease_documents_select" ON lease_documents FOR SELECT USING (true);
CREATE POLICY "lease_documents_insert" ON lease_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "lease_documents_update" ON lease_documents FOR UPDATE USING (true);
CREATE POLICY "lease_documents_delete" ON lease_documents FOR DELETE USING (true);

-- Helper function to allocate the next version_number for a building
CREATE OR REPLACE FUNCTION lease_next_version_number(p_project_id TEXT, p_building_address TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_num
    FROM lease_documents
    WHERE project_id = p_project_id
      AND building_address = p_building_address
      AND status != 'archived';
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;
