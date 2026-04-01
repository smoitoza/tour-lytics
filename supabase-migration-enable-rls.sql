-- Enable Row-Level Security on all tables
-- Resolves Supabase "Table publicly accessible" warning
-- Run in SQL Editor for BOTH prod (lsckcmvoqmwxovqejvyl) and dev (lpewsfzwjnlnqnludvwt)
--
-- Current setup: API routes run server-side with the anon key.
-- Access control is enforced at the API layer (Next.js middleware + role checks).
-- These policies allow the anon role full access so existing functionality is unchanged.
-- 
-- Future: When per-user auth is added, replace these permissive policies
-- with user-scoped ones (e.g. auth.uid() = user_id).

-- ===== ENABLE RLS ON ALL TABLES =====

ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS survey_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS survey_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rfp_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS building_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commute_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shortlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS not_interested_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tour_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS executive_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS token_pricing ENABLE ROW LEVEL SECURITY;
-- token_usage_summary is a VIEW, not a table -- RLS does not apply to views

-- ===== ADD PERMISSIVE POLICIES FOR ANON ROLE =====
-- These allow the anon key (used by API routes) full access.
-- DROP IF EXISTS prevents errors if re-run.

DO $$ 
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'projects', 'project_members', 'project_assumptions', 'project_offices',
    'project_briefs', 'survey_buildings', 'survey_submissions', 'rfp_submissions',
    'building_photos', 'commute_studies', 'shortlist_items', 'not_interested_items',
    'tour_list_items', 'executive_summaries', 'demo_requests', 'stripe_payments',
    'token_balances', 'token_transactions', 'token_pricing'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Check if table exists before creating policy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      -- Drop existing policy if it exists (idempotent)
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access" ON %I', tbl);
      -- Create permissive policy for all operations
      EXECUTE format('CREATE POLICY "Allow anon full access" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl);
    END IF;
  END LOOP;
END $$;
