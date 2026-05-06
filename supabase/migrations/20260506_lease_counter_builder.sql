-- ============================================================
-- Counter Builder v2: track instructions + mode for AI counters
-- ============================================================
-- Adds two columns so we can:
--   1. Replay a counter generation with the same instructions
--   2. Audit which mode + which instruction produced each counter
--   3. Pre-fill the regenerate prompt with the previous instruction
-- ============================================================

ALTER TABLE lease_clause_negotiations
  ADD COLUMN IF NOT EXISTS counter_instructions TEXT,                -- user's plain-English directive
  ADD COLUMN IF NOT EXISTS counter_mode TEXT DEFAULT 'auto';         -- 'auto' | 'with_instructions' | 'legal_drafter' | 'manual' | 'ai_edit'

-- Note: counter_source already exists ('manual' | 'ai_generated' | 'ai_edited')
-- counter_mode is more granular and tracks how the AI was prompted.
