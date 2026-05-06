-- ============================================================
-- Lease Clause Negotiations: per-clause negotiation status + notes
-- ============================================================
-- One row per (project_id, building_address, clause_type). The status
-- describes the NEGOTIATION ISSUE, not a particular wording, so it spans
-- all lease versions for that building.
--
-- Why this table:
--   - When you decide "Holdover at 200% is acceptable" that decision applies
--     whether you're viewing v1->v2 or v2->v3 of the lease
--   - Audit trail: who set each status and when (legal/finance want this)
--   - Notes field for negotiation context: counter terms, why a clause was
--     accepted as-is, agreed language pending counsel review, etc.
--   - Future-proofs the redline editor (it will reference this row to scope
--     proposed language by clause)
-- ============================================================

CREATE TABLE IF NOT EXISTS lease_clause_negotiations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope: a clause-type negotiation for a specific building/project
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_address  TEXT NOT NULL,
  clause_type       TEXT NOT NULL,

  -- Negotiation state
  status            TEXT NOT NULL DEFAULT 'open_issue',
                    -- one of: open_issue | counter_pending | accepted | wont_address | not_applicable
  notes             TEXT DEFAULT '',

  -- Optional cross-reference to the most recent compare that informed this status
  -- (helps the UI highlight "this status was set during compare X")
  last_compare_id   UUID REFERENCES lease_compares(id) ON DELETE SET NULL,

  -- Audit
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  last_updated_by   TEXT,
  updated_at        TIMESTAMPTZ DEFAULT now(),
  status_changes    INTEGER NOT NULL DEFAULT 1,    -- how many times status was updated

  CONSTRAINT lease_clause_negotiations_unique UNIQUE (project_id, building_address, clause_type)
);

CREATE INDEX IF NOT EXISTS idx_lease_neg_project    ON lease_clause_negotiations(project_id);
CREATE INDEX IF NOT EXISTS idx_lease_neg_building   ON lease_clause_negotiations(project_id, building_address);
CREATE INDEX IF NOT EXISTS idx_lease_neg_status     ON lease_clause_negotiations(status);
CREATE INDEX IF NOT EXISTS idx_lease_neg_updated    ON lease_clause_negotiations(updated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION lease_clause_negotiations_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Increment status_changes counter when status changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changes = COALESCE(OLD.status_changes, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_clause_negotiations_updated_at ON lease_clause_negotiations;
CREATE TRIGGER trg_lease_clause_negotiations_updated_at
  BEFORE UPDATE ON lease_clause_negotiations
  FOR EACH ROW EXECUTE FUNCTION lease_clause_negotiations_set_updated_at();

-- RLS (mirrors lease_documents / lease_compares)
ALTER TABLE lease_clause_negotiations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_clause_negotiations_select" ON lease_clause_negotiations;
DROP POLICY IF EXISTS "lease_clause_negotiations_insert" ON lease_clause_negotiations;
DROP POLICY IF EXISTS "lease_clause_negotiations_update" ON lease_clause_negotiations;
DROP POLICY IF EXISTS "lease_clause_negotiations_delete" ON lease_clause_negotiations;

CREATE POLICY "lease_clause_negotiations_select" ON lease_clause_negotiations FOR SELECT USING (true);
CREATE POLICY "lease_clause_negotiations_insert" ON lease_clause_negotiations FOR INSERT WITH CHECK (true);
CREATE POLICY "lease_clause_negotiations_update" ON lease_clause_negotiations FOR UPDATE USING (true);
CREATE POLICY "lease_clause_negotiations_delete" ON lease_clause_negotiations FOR DELETE USING (true);
