-- ============================================================================
-- TourLytics Portfolio Module v1
-- Migration: 20260521_portfolio_module_v1
-- Description: Foundational schema for portfolio management module.
--              Companies, Leases (lease-driven hierarchy), Locations,
--              Rent/OpEx, Critical Dates, Security Instruments, Documents,
--              AI Abstractions, and FX Rates.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. companies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  reporting_currency text NOT NULL DEFAULT 'USD',
  logo_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);

-- ----------------------------------------------------------------------------
-- 2. company_members
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  invited_email text,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id),
  UNIQUE (company_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);

-- ----------------------------------------------------------------------------
-- 3. leases  (the legal instrument; the lease is the anchor)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  landlord_name text,
  landlord_entity text,
  currency text NOT NULL DEFAULT 'USD',  -- immutable after creation in app layer
  lease_type text CHECK (lease_type IN ('NNN', 'gross', 'modified_gross', 'full_service', 'ground', 'other')),
  commencement_date date,
  rent_commencement_date date,
  expiration_date date,
  term_months int,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'pending_review')),
  abstracted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leases_company ON public.leases(company_id);
CREATE INDEX IF NOT EXISTS idx_leases_expiration ON public.leases(expiration_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_leases_status ON public.leases(status);

-- ----------------------------------------------------------------------------
-- 4. lease_locations  (1..N premises per lease)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lease_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  label text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state_province text,
  postal_code text,
  country text NOT NULL,  -- ISO 3166 alpha-2
  region text,  -- 'North America' / 'EMEA' / 'APAC' / 'LATAM'
  latitude numeric(10,7),
  longitude numeric(10,7),
  rentable_sqft int,
  floor_count int,
  use_type text CHECK (use_type IN ('office', 'industrial', 'flex', 'retail', 'lab', 'warehouse', 'data_center', 'other')),
  is_primary boolean NOT NULL DEFAULT false,
  geocoded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_locations_lease ON public.lease_locations(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_locations_country ON public.lease_locations(country);
CREATE INDEX IF NOT EXISTS idx_lease_locations_region ON public.lease_locations(region);
CREATE INDEX IF NOT EXISTS idx_lease_locations_geo ON public.lease_locations(latitude, longitude);

-- ----------------------------------------------------------------------------
-- 5. rent_schedule
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rent_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  monthly_rent numeric(14,2) NOT NULL,
  rent_psf_annual numeric(8,2),
  is_free_rent boolean NOT NULL DEFAULT false,
  escalation_type text CHECK (escalation_type IN ('fixed', 'cpi', 'fmv', 'none')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_rent_schedule_lease ON public.rent_schedule(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_period ON public.rent_schedule(lease_id, period_start);

-- ----------------------------------------------------------------------------
-- 6. opex_terms  (1 row per lease)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opex_terms (
  lease_id uuid PRIMARY KEY REFERENCES public.leases(id) ON DELETE CASCADE,
  starting_opex_psf_annual numeric(8,2),
  escalation_pct numeric(5,2),
  escalation_type text CHECK (escalation_type IN ('fixed', 'cpi', 'capped', 'uncapped')),
  cap_pct numeric(5,2),
  free_opex_months int NOT NULL DEFAULT 0,
  free_opex_start date,
  base_year int,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. critical_dates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.critical_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  date_type text NOT NULL CHECK (date_type IN (
    'notice_to_renew', 'notice_to_terminate', 'option_to_extend', 'option_to_terminate',
    'rofr', 'rofo', 'cap_review', 'rent_review', 'expiration', 'cam_reconciliation',
    'loc_renewal', 'other'
  )),
  trigger_date date NOT NULL,
  trigger_date_end date,  -- for windows
  description text,
  reminder_days_before int NOT NULL DEFAULT 180,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'missed', 'n_a')),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_critical_dates_lease ON public.critical_dates(lease_id);
CREATE INDEX IF NOT EXISTS idx_critical_dates_trigger ON public.critical_dates(trigger_date) WHERE status = 'upcoming';

-- ----------------------------------------------------------------------------
-- 8. security_instruments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  instrument_type text NOT NULL CHECK (instrument_type IN (
    'cash_deposit', 'letter_of_credit', 'corporate_guaranty', 'personal_guaranty', 'surety_bond', 'other'
  )),
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  issuer text,
  expiration_date date,
  burndown_schedule jsonb,  -- [{date, new_amount}, ...] for stepdown LOCs
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_instruments_lease ON public.security_instruments(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_instruments_expiry ON public.security_instruments(expiration_date) WHERE expiration_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 9. lease_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lease_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES public.leases(id) ON DELETE CASCADE,  -- nullable: doc may exist before lease is created
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  storage_path text NOT NULL,  -- Supabase Storage path
  original_filename text NOT NULL,
  document_type text CHECK (document_type IN (
    'lease', 'amendment', 'snda', 'estoppel', 'exhibit', 'side_letter', 'work_letter', 'guaranty', 'other'
  )),
  effective_date date,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  size_bytes bigint,
  page_count int,
  mime_type text
);

CREATE INDEX IF NOT EXISTS idx_lease_documents_lease ON public.lease_documents(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_documents_company ON public.lease_documents(company_id);

-- ----------------------------------------------------------------------------
-- 10. lease_abstractions  (AI extraction staging)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lease_abstractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.lease_documents(id) ON DELETE CASCADE,
  extracted_fields jsonb NOT NULL,
  extraction_version text NOT NULL,  -- 'claude-sonnet-4-6-portfolio-v1' etc.
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'rejected', 'needs_more_info'
  )),
  confidence_score numeric(3,2),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_abstractions_company ON public.lease_abstractions(company_id);
CREATE INDEX IF NOT EXISTS idx_lease_abstractions_status ON public.lease_abstractions(status);
CREATE INDEX IF NOT EXISTS idx_lease_abstractions_lease ON public.lease_abstractions(lease_id);

-- ----------------------------------------------------------------------------
-- 11. fx_rates  (cached daily rates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fx_rates (
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric(14,8) NOT NULL,
  as_of_date date NOT NULL,
  source text NOT NULL DEFAULT 'exchangerate.host',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_as_of ON public.fx_rates(as_of_date DESC);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_updated ON public.companies;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_leases_updated ON public.leases;
CREATE TRIGGER trg_leases_updated BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_lease_locations_updated ON public.lease_locations;
CREATE TRIGGER trg_lease_locations_updated BEFORE UPDATE ON public.lease_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_opex_terms_updated ON public.opex_terms;
CREATE TRIGGER trg_opex_terms_updated BEFORE UPDATE ON public.opex_terms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_abstractions ENABLE ROW LEVEL SECURITY;
-- fx_rates is global, no RLS

-- Helper: is user a member of a company?
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: is user an admin or owner of a company?
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- companies policies
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies FOR SELECT
  USING (public.is_company_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS companies_insert ON public.companies;
CREATE POLICY companies_insert ON public.companies FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies FOR UPDATE
  USING (public.is_company_admin(id));

DROP POLICY IF EXISTS companies_delete ON public.companies;
CREATE POLICY companies_delete ON public.companies FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.company_members
            WHERE company_id = id AND user_id = auth.uid()
              AND role = 'owner' AND status = 'active')
  );

-- company_members policies
DROP POLICY IF EXISTS company_members_select ON public.company_members;
CREATE POLICY company_members_select ON public.company_members FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS company_members_admin_write ON public.company_members;
CREATE POLICY company_members_admin_write ON public.company_members FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- leases policies (members read, admins write)
DROP POLICY IF EXISTS leases_select ON public.leases;
CREATE POLICY leases_select ON public.leases FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS leases_admin_write ON public.leases;
CREATE POLICY leases_admin_write ON public.leases FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- Children of leases: cascade through lease.company_id
DROP POLICY IF EXISTS lease_locations_select ON public.lease_locations;
CREATE POLICY lease_locations_select ON public.lease_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_member(l.company_id)));

DROP POLICY IF EXISTS lease_locations_write ON public.lease_locations;
CREATE POLICY lease_locations_write ON public.lease_locations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)));

DROP POLICY IF EXISTS rent_schedule_select ON public.rent_schedule;
CREATE POLICY rent_schedule_select ON public.rent_schedule FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_member(l.company_id)));

DROP POLICY IF EXISTS rent_schedule_write ON public.rent_schedule;
CREATE POLICY rent_schedule_write ON public.rent_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)));

DROP POLICY IF EXISTS opex_terms_select ON public.opex_terms;
CREATE POLICY opex_terms_select ON public.opex_terms FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_member(l.company_id)));

DROP POLICY IF EXISTS opex_terms_write ON public.opex_terms;
CREATE POLICY opex_terms_write ON public.opex_terms FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)));

DROP POLICY IF EXISTS critical_dates_select ON public.critical_dates;
CREATE POLICY critical_dates_select ON public.critical_dates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_member(l.company_id)));

DROP POLICY IF EXISTS critical_dates_write ON public.critical_dates;
CREATE POLICY critical_dates_write ON public.critical_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)));

DROP POLICY IF EXISTS security_instruments_select ON public.security_instruments;
CREATE POLICY security_instruments_select ON public.security_instruments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_member(l.company_id)));

DROP POLICY IF EXISTS security_instruments_write ON public.security_instruments;
CREATE POLICY security_instruments_write ON public.security_instruments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND public.is_company_admin(l.company_id)));

DROP POLICY IF EXISTS lease_documents_select ON public.lease_documents;
CREATE POLICY lease_documents_select ON public.lease_documents FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS lease_documents_write ON public.lease_documents;
CREATE POLICY lease_documents_write ON public.lease_documents FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS lease_abstractions_select ON public.lease_abstractions;
CREATE POLICY lease_abstractions_select ON public.lease_abstractions FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS lease_abstractions_write ON public.lease_abstractions;
CREATE POLICY lease_abstractions_write ON public.lease_abstractions FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

COMMIT;

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'companies','company_members','leases','lease_locations',
--     'rent_schedule','opex_terms','critical_dates','security_instruments',
--     'lease_documents','lease_abstractions','fx_rates'
--   )
-- ORDER BY table_name;
--
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename LIKE 'lease%' OR tablename LIKE 'company%' OR tablename IN ('critical_dates','opex_terms','rent_schedule','security_instruments','fx_rates');
