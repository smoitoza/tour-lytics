-- Add client_name column to projects table
-- Allows brokers to associate projects with specific clients
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
