-- Add building name column to survey_buildings
-- Building names like "Parmer 3.4", "The District", etc.
ALTER TABLE survey_buildings ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
