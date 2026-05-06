-- ============================================================
-- Lease Compares: dedicated table for cached version comparisons
-- ============================================================
-- Replaces the ad-hoc summary_json.compare_cache approach with a proper
-- relational structure. One row per (v1_id, v2_id) pair regardless of how
-- many lease versions a building accumulates.
--
-- Cache invalidation strategy:
--   - Each row stores the SHA-256 hash of v1.extraction_json and v2.extraction_json
--   - On lookup, the API recomputes hashes and compares - mismatch = stale
--   - When stale, the API regenerates and updates the row
--
-- Audit:
--   - generated_by, generated_at, last_regenerated_at, last_regenerated_by
--   - generation_count tracks how many times the AI summary was regenerated
--   - ai_model_version captures which model wrote the summary (for traceability
--     when we change models or prompts)
-- ============================================================

CREATE TABLE IF NOT EXISTS lease_compares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Pair (always v1 = earlier, v2 = later by convention, but the API enforces this on insert)
  v1_id UUID NOT NULL REFERENCES lease_documents(id) ON DELETE CASCADE,
  v2_id UUID NOT NULL REFERENCES lease_documents(id) ON DELETE CASCADE,

  -- Building + project denormalized for fast filtering on the dashboard
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_address  TEXT NOT NULL,

  -- Cached output
  diff_json   JSONB NOT NULL,                  -- full CompareResult (clauseDiffs, counts, riskDelta)
  ai_summary  TEXT,                            -- nullable: generation may have failed

  -- Cache invalidation: hashes of source extraction_json at the time of generation
  v1_extraction_hash TEXT NOT NULL,
  v2_extraction_hash TEXT NOT NULL,

  -- Provenance / audit
  generated_by         TEXT,                    -- user email of first generation
  generated_at         TIMESTAMPTZ DEFAULT now(),
  last_regenerated_by  TEXT,                    -- user email of most recent regeneration
  last_regenerated_at  TIMESTAMPTZ,
  generation_count     INTEGER NOT NULL DEFAULT 1,
  ai_model_version     TEXT,                    -- e.g. 'claude-sonnet-4-20250514'
  ai_prompt_version    TEXT DEFAULT 'v1',       -- bump when we change the prompt template

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Each pair has at most one cached compare
  CONSTRAINT lease_compares_pair_unique UNIQUE (v1_id, v2_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_lease_compares_project   ON lease_compares(project_id);
CREATE INDEX IF NOT EXISTS idx_lease_compares_building  ON lease_compares(project_id, building_address);
CREATE INDEX IF NOT EXISTS idx_lease_compares_v1        ON lease_compares(v1_id);
CREATE INDEX IF NOT EXISTS idx_lease_compares_v2        ON lease_compares(v2_id);
CREATE INDEX IF NOT EXISTS idx_lease_compares_recent    ON lease_compares(generated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION lease_compares_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_compares_updated_at ON lease_compares;
CREATE TRIGGER trg_lease_compares_updated_at
  BEFORE UPDATE ON lease_compares
  FOR EACH ROW EXECUTE FUNCTION lease_compares_set_updated_at();

-- RLS (mirrors lease_documents)
ALTER TABLE lease_compares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_compares_select" ON lease_compares;
DROP POLICY IF EXISTS "lease_compares_insert" ON lease_compares;
DROP POLICY IF EXISTS "lease_compares_update" ON lease_compares;
DROP POLICY IF EXISTS "lease_compares_delete" ON lease_compares;

CREATE POLICY "lease_compares_select" ON lease_compares FOR SELECT USING (true);
CREATE POLICY "lease_compares_insert" ON lease_compares FOR INSERT WITH CHECK (true);
CREATE POLICY "lease_compares_update" ON lease_compares FOR UPDATE USING (true);
CREATE POLICY "lease_compares_delete" ON lease_compares FOR DELETE USING (true);

-- ============================================================
-- BACKFILL: migrate existing summary_json.compare_cache rows into the new table
-- ============================================================
-- Each lease_documents row may have summary_json.compare_cache as a map of v1Id -> {diff, summary, generated_at}
-- Convert each entry into a lease_compares row. v2_id is the row that holds the cache, v1_id is the map key.
-- We use a placeholder hash 'legacy-pre-hash' so the next compare regenerates and writes a real hash.
DO $$
DECLARE
  doc_record RECORD;
  cache_record JSONB;
  v1_id_text TEXT;
BEGIN
  FOR doc_record IN
    SELECT id, project_id, building_address, summary_json
    FROM lease_documents
    WHERE summary_json ? 'compare_cache'
      AND jsonb_typeof(summary_json -> 'compare_cache') = 'object'
  LOOP
    FOR v1_id_text, cache_record IN
      SELECT * FROM jsonb_each(doc_record.summary_json -> 'compare_cache')
    LOOP
      -- Skip rows where the diff or summary is missing
      IF (cache_record ? 'diff') AND (cache_record -> 'diff' IS NOT NULL) THEN
        INSERT INTO lease_compares (
          v1_id, v2_id, project_id, building_address,
          diff_json, ai_summary,
          v1_extraction_hash, v2_extraction_hash,
          generated_by, generated_at, generation_count,
          ai_model_version, ai_prompt_version
        ) VALUES (
          v1_id_text::UUID, doc_record.id, doc_record.project_id, doc_record.building_address,
          cache_record -> 'diff',
          NULLIF(cache_record ->> 'summary', ''),
          'legacy-pre-hash',  -- forces regen on next access for fresh hashes
          'legacy-pre-hash',
          NULL,
          COALESCE((cache_record ->> 'generated_at')::TIMESTAMPTZ, now()),
          1,
          'claude-sonnet-4-20250514',
          'v1'
        )
        ON CONFLICT (v1_id, v2_id) DO NOTHING;
      END IF;
    END LOOP;

    -- Strip compare_cache out of summary_json now that it's migrated
    UPDATE lease_documents
       SET summary_json = summary_json - 'compare_cache'
     WHERE id = doc_record.id;
  END LOOP;
END $$;

-- ============================================================
-- HELPER: get_lease_compare(v1, v2)
-- Returns the cached compare or NULL. Lets the API do a single round trip.
-- ============================================================
CREATE OR REPLACE FUNCTION get_lease_compare(p_v1_id UUID, p_v2_id UUID)
RETURNS TABLE (
  id UUID,
  diff_json JSONB,
  ai_summary TEXT,
  v1_extraction_hash TEXT,
  v2_extraction_hash TEXT,
  generated_by TEXT,
  generated_at TIMESTAMPTZ,
  last_regenerated_by TEXT,
  last_regenerated_at TIMESTAMPTZ,
  generation_count INTEGER,
  ai_model_version TEXT,
  ai_prompt_version TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      lc.id, lc.diff_json, lc.ai_summary,
      lc.v1_extraction_hash, lc.v2_extraction_hash,
      lc.generated_by, lc.generated_at,
      lc.last_regenerated_by, lc.last_regenerated_at,
      lc.generation_count, lc.ai_model_version, lc.ai_prompt_version
    FROM lease_compares lc
    WHERE lc.v1_id = p_v1_id AND lc.v2_id = p_v2_id;
END;
$$ LANGUAGE plpgsql;
