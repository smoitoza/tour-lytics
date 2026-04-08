-- Add property_type column to survey_buildings
-- Stores the building category from survey section headers (e.g. "Office", "Advanced Manufacturing")
ALTER TABLE survey_buildings ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT '';
