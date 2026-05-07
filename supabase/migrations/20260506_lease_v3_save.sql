-- ============================================================
-- Save-as-v3 support: track which counters were promoted into a real version
-- and add metadata to lease_documents for AI-generated versions.
-- ============================================================

-- Audit fields on negotiations to track promotion to a saved version.
-- When a user clicks "Save as v3", every counter that gets folded into the
-- new version is marked here. The counter_language stays in place (so the
-- audit trail shows what was actually promoted), but a flag indicates
-- "this is locked - don't show in next round of compares".
ALTER TABLE lease_clause_negotiations
  ADD COLUMN IF NOT EXISTS promoted_to_version_id UUID REFERENCES lease_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by TEXT,
  ADD COLUMN IF NOT EXISTS excluded_from_save BOOLEAN DEFAULT FALSE;
  -- excluded_from_save = true means "I marked this clause as 'don't include
  -- the counter, just carry forward v2's language' on save"

CREATE INDEX IF NOT EXISTS idx_lease_neg_promoted ON lease_clause_negotiations(promoted_to_version_id);

-- ============================================================
-- lease_documents: add provenance fields for AI-generated / merged versions
-- ============================================================
-- A v3 created by Save-as-v3 is computer-generated. Track:
--   - which version it was based on
--   - which negotiation rows were merged in
--   - any counters that were excluded from the merge
ALTER TABLE lease_documents
  ADD COLUMN IF NOT EXISTS based_on_version_id UUID REFERENCES lease_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'upload',
                  -- 'upload' | 'merged_counters' | 'manual_edit' | 'ai_extracted'
  ADD COLUMN IF NOT EXISTS merged_counter_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merged_excluded_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{}'::jsonb;
                  -- {clauses_changed: [...], ai_refreshed: [...], generated_at, etc.}

CREATE INDEX IF NOT EXISTS idx_lease_documents_based_on ON lease_documents(based_on_version_id);
