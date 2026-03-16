-- Migration: Per-building assumptions (instead of per-project)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lsckcmvoqmwxovqejvyl/sql/new

-- 1. Add building_address column
ALTER TABLE project_assumptions ADD COLUMN IF NOT EXISTS building_address text NOT NULL DEFAULT '';

-- 2. Drop the old unique constraint (project_id only)
ALTER TABLE project_assumptions DROP CONSTRAINT IF EXISTS project_assumptions_project_id_key;

-- 3. Add new unique constraint (project_id + building_address)
ALTER TABLE project_assumptions ADD CONSTRAINT project_assumptions_project_building_key UNIQUE (project_id, building_address);

-- 4. Delete any existing row that has empty building_address (the old global row)
-- so it doesn't conflict with per-building rows
DELETE FROM project_assumptions WHERE building_address = '';
