-- ============================================================
-- Add counter language fields to lease_clause_negotiations
-- ============================================================
-- Stores AI-generated (or manually authored) counter-proposal language
-- per clause. Used by:
--   - The Counter Proposal DOCX export (tenant counters as track changes)
--   - The future redline editor (each draft is a counter against current language)
--
-- These columns extend the existing table rather than create a new one because
-- a counter is conceptually scoped to the same (project, building, clause_type)
-- as the negotiation itself.
-- ============================================================

ALTER TABLE lease_clause_negotiations
  ADD COLUMN IF NOT EXISTS counter_language TEXT,                    -- Tenant proposed text (replaces v2 excerpt)
  ADD COLUMN IF NOT EXISTS counter_rationale TEXT,                   -- Why we're countering
  ADD COLUMN IF NOT EXISTS counter_source TEXT DEFAULT 'manual',     -- 'manual' | 'ai_generated' | 'ai_edited'
  ADD COLUMN IF NOT EXISTS counter_against_v2_id UUID REFERENCES lease_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counter_against_excerpt TEXT,             -- Snapshot of v2 excerpt at time of counter (for staleness detection)
  ADD COLUMN IF NOT EXISTS counter_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS counter_generated_by TEXT,
  ADD COLUMN IF NOT EXISTS counter_ai_model TEXT;
