-- ============================================================================
-- TourLytics Portfolio Module v1 — Namespaced
-- Migration: 20260523_portfolio_module_v1_namespaced
-- Description: Foundational schema for portfolio module. All tables prefixed
--              with `portfolio_` to avoid collision with existing lease
--              negotiation/comparison tables (lease_documents already exists
--              in the deal-evaluation module).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. portfolio_companies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  reporting_currency text NOT NULL DEFAULT 'USD',
  logo_url text,
  storage_quota_bytes bigint NOT NULL DEFAULT 5368709120, -- 5 GB default
  storage_used_bytes bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_companies_slug ON public.portfolio_companies(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_companies_created_by ON public.portfolio_companies(created_by);

-- ----------------------------------------------------------------------------
-- 2. portfolio_company_members
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.portfolio_companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  invited_email text,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id),
  UNIQUE (company_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_members_user ON public.portfolio_company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_members_company ON public.portfolio_company_members(company_id);

-- ----------------------------------------------------------------------------
-- 3. portfolio_leases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.portfolio_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  landlord_name text,
  landlord_entity text,
  currency text NOT NULL DEFAULT 'USD',
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

CREATE INDEX IF NOT EXISTS idx_portfolio_leases_company ON public.portfolio_leases(company_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_leases_expiration ON public.portfolio_leases(expiration_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_portfolio_leases_status ON public.portfolio_leases(status);

-- ----------------------------------------------------------------------------
-- 4. portfolio_lease_locations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_lease_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.portfolio_leases(id) ON DELETE CASCADE,
  label text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state_province text,
  postal_code text,
  country text NOT NULL,
  region text,
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

CREATE INDEX IF NOT EXISTS idx_portfolio_locations_lease ON public.portfolio_lease_locations(lease_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_locations_country ON public.portfolio_lease_locations(country);
CREATE INDEX IF NOT EXISTS idx_portfolio_locations_region ON public.portfolio_lease_locations(region);
CREATE INDEX IF NOT EXISTS idx_portfolio_locations_geo ON public.portfolio_lease_locations(latitude, longitude);

-- ----------------------------------------------------------------------------
-- 5. portfolio_rent_schedule
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_rent_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.portfolio_leases(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  monthly_rent numeric(14,2) NOT NULL,
  rent_psf_annual numeric(8,2),
  is_free_rent boolean NOT NULL DEFAULT false,
  escalation_type text CHECK (escalation_type IN ('fixed', 'cpi', 'fmv', 'none')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_rent_lease ON public.portfolio_rent_schedule(lease_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_rent_period ON public.portfolio_rent_schedule(lease_id, period_start);

-- ----------------------------------------------------------------------------
-- 6. portfolio_opex_terms
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_opex_terms (
  lease_id uuid PRIMARY KEY REFERENCES public.portfolio_leases(id) ON DELETE CASCADE,
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
-- 7. portfolio_critical_dates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_critical_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.portfolio_leases(id) ON DELETE CASCADE,
  date_type text NOT NULL CHECK (date_type IN (
    'notice_to_renew', 'notice_to_terminate', 'option_to_extend', 'option_to_terminate',
    'rofr', 'rofo', 'cap_review', 'rent_review', 'expiration', 'cam_reconciliation',
    'loc_renewal', 'other'
  )),
  trigger_date date NOT NULL,
  trigger_date_end date,
  description text,
  reminder_days_before int NOT NULL DEFAULT 180,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'missed', 'n_a')),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_dates_lease ON public.portfolio_critical_dates(lease_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_dates_trigger ON public.portfolio_critical_dates(trigger_date) WHERE status = 'upcoming';

-- ----------------------------------------------------------------------------
-- 8. portfolio_security_instruments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_security_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.portfolio_leases(id) ON DELETE CASCADE,
  instrument_type text NOT NULL CHECK (instrument_type IN (
    'cash_deposit', 'letter_of_credit', 'corporate_guaranty', 'personal_guaranty', 'surety_bond', 'other'
  )),
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  issuer text,
  expiration_date date,
  burndown_schedule jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_security_lease ON public.portfolio_security_instruments(lease_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_security_expiry ON public.portfolio_security_instruments(expiration_date) WHERE expiration_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 9. portfolio_documents  (the PDFs and other lease-related files)
--    Renamed from `lease_documents` to avoid collision with existing table.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES public.portfolio_leases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.portfolio_companies(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  document_type text CHECK (document_type IN (
    'lease', 'amendment', 'snda', 'estoppel', 'exhibit', 'side_letter', 'work_letter', 'guaranty', 'other'
  )),
  effective_date date,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  size_bytes bigint,
  page_count int,
  mime_type text,
  CONSTRAINT portfolio_documents_storage_path_prefix CHECK (storage_path LIKE 'companies/%')
);

CREATE INDEX IF NOT EXISTS idx_portfolio_documents_lease ON public.portfolio_documents(lease_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_documents_company ON public.portfolio_documents(company_id);

-- ----------------------------------------------------------------------------
-- 10. portfolio_abstractions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_abstractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES public.portfolio_leases(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.portfolio_companies(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.portfolio_documents(id) ON DELETE CASCADE,
  extracted_fields jsonb NOT NULL,
  extraction_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'rejected', 'needs_more_info'
  )),
  confidence_score numeric(3,2),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_abs_company ON public.portfolio_abstractions(company_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_abs_status ON public.portfolio_abstractions(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_abs_lease ON public.portfolio_abstractions(lease_id);

-- ----------------------------------------------------------------------------
-- 11. portfolio_fx_rates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_fx_rates (
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric(14,8) NOT NULL,
  as_of_date date NOT NULL,
  source text NOT NULL DEFAULT 'exchangerate.host',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_fx_as_of ON public.portfolio_fx_rates(as_of_date DESC);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.portfolio_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portfolio_companies_updated ON public.portfolio_companies;
CREATE TRIGGER trg_portfolio_companies_updated BEFORE UPDATE ON public.portfolio_companies
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_touch_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_leases_updated ON public.portfolio_leases;
CREATE TRIGGER trg_portfolio_leases_updated BEFORE UPDATE ON public.portfolio_leases
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_touch_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_locations_updated ON public.portfolio_lease_locations;
CREATE TRIGGER trg_portfolio_locations_updated BEFORE UPDATE ON public.portfolio_lease_locations
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_touch_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_opex_updated ON public.portfolio_opex_terms;
CREATE TRIGGER trg_portfolio_opex_updated BEFORE UPDATE ON public.portfolio_opex_terms
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_touch_updated_at();

-- ============================================================================
-- Storage usage trigger: maintain portfolio_companies.storage_used_bytes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.portfolio_update_storage_usage()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.portfolio_companies
      SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.size_bytes, 0)
      WHERE id = NEW.company_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.portfolio_companies
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.size_bytes, 0))
      WHERE id = OLD.company_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.company_id = OLD.company_id THEN
      UPDATE public.portfolio_companies
        SET storage_used_bytes = GREATEST(0, storage_used_bytes
          + COALESCE(NEW.size_bytes, 0) - COALESCE(OLD.size_bytes, 0))
        WHERE id = NEW.company_id;
    ELSE
      UPDATE public.portfolio_companies
        SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.size_bytes, 0))
        WHERE id = OLD.company_id;
      UPDATE public.portfolio_companies
        SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.size_bytes, 0)
        WHERE id = NEW.company_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_portfolio_docs_storage_usage ON public.portfolio_documents;
CREATE TRIGGER trg_portfolio_docs_storage_usage
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_documents
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_update_storage_usage();

-- ============================================================================
-- Helper view + functions
-- ============================================================================
CREATE OR REPLACE VIEW public.v_portfolio_storage_summary AS
SELECT
  c.id AS company_id,
  c.name,
  c.slug,
  c.storage_quota_bytes,
  c.storage_used_bytes,
  ROUND(100.0 * c.storage_used_bytes::numeric / NULLIF(c.storage_quota_bytes, 0), 2) AS pct_used,
  c.storage_quota_bytes - c.storage_used_bytes AS bytes_remaining,
  (SELECT COUNT(*) FROM public.portfolio_documents d WHERE d.company_id = c.id) AS document_count,
  (SELECT COUNT(*) FROM public.portfolio_leases l WHERE l.company_id = c.id) AS lease_count
FROM public.portfolio_companies c;

CREATE OR REPLACE FUNCTION public.portfolio_would_exceed_quota(
  p_company_id uuid,
  p_additional_bytes bigint
) RETURNS boolean AS $$
  SELECT (storage_used_bytes + p_additional_bytes) > storage_quota_bytes
  FROM public.portfolio_companies
  WHERE id = p_company_id;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.portfolio_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_lease_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_rent_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_opex_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_critical_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_security_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_abstractions ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_portfolio_company_member(p_company_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_portfolio_company_admin(p_company_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- companies
DROP POLICY IF EXISTS portfolio_companies_select ON public.portfolio_companies;
CREATE POLICY portfolio_companies_select ON public.portfolio_companies FOR SELECT
  USING (public.is_portfolio_company_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS portfolio_companies_insert ON public.portfolio_companies;
CREATE POLICY portfolio_companies_insert ON public.portfolio_companies FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS portfolio_companies_update ON public.portfolio_companies;
CREATE POLICY portfolio_companies_update ON public.portfolio_companies FOR UPDATE
  USING (public.is_portfolio_company_admin(id));

DROP POLICY IF EXISTS portfolio_companies_delete ON public.portfolio_companies;
CREATE POLICY portfolio_companies_delete ON public.portfolio_companies FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.portfolio_company_members
            WHERE company_id = id AND user_id = auth.uid()
              AND role = 'owner' AND status = 'active')
  );

-- members
DROP POLICY IF EXISTS portfolio_members_select ON public.portfolio_company_members;
CREATE POLICY portfolio_members_select ON public.portfolio_company_members FOR SELECT
  USING (public.is_portfolio_company_member(company_id));

DROP POLICY IF EXISTS portfolio_members_admin_write ON public.portfolio_company_members;
CREATE POLICY portfolio_members_admin_write ON public.portfolio_company_members FOR ALL
  USING (public.is_portfolio_company_admin(company_id))
  WITH CHECK (public.is_portfolio_company_admin(company_id));

-- leases
DROP POLICY IF EXISTS portfolio_leases_select ON public.portfolio_leases;
CREATE POLICY portfolio_leases_select ON public.portfolio_leases FOR SELECT
  USING (public.is_portfolio_company_member(company_id));

DROP POLICY IF EXISTS portfolio_leases_admin_write ON public.portfolio_leases;
CREATE POLICY portfolio_leases_admin_write ON public.portfolio_leases FOR ALL
  USING (public.is_portfolio_company_admin(company_id))
  WITH CHECK (public.is_portfolio_company_admin(company_id));

-- lease_locations
DROP POLICY IF EXISTS portfolio_locations_select ON public.portfolio_lease_locations;
CREATE POLICY portfolio_locations_select ON public.portfolio_lease_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_member(l.company_id)));

DROP POLICY IF EXISTS portfolio_locations_write ON public.portfolio_lease_locations;
CREATE POLICY portfolio_locations_write ON public.portfolio_lease_locations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)));

-- rent_schedule
DROP POLICY IF EXISTS portfolio_rent_select ON public.portfolio_rent_schedule;
CREATE POLICY portfolio_rent_select ON public.portfolio_rent_schedule FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_member(l.company_id)));

DROP POLICY IF EXISTS portfolio_rent_write ON public.portfolio_rent_schedule;
CREATE POLICY portfolio_rent_write ON public.portfolio_rent_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)));

-- opex_terms
DROP POLICY IF EXISTS portfolio_opex_select ON public.portfolio_opex_terms;
CREATE POLICY portfolio_opex_select ON public.portfolio_opex_terms FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_member(l.company_id)));

DROP POLICY IF EXISTS portfolio_opex_write ON public.portfolio_opex_terms;
CREATE POLICY portfolio_opex_write ON public.portfolio_opex_terms FOR ALL
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)));

-- critical_dates
DROP POLICY IF EXISTS portfolio_dates_select ON public.portfolio_critical_dates;
CREATE POLICY portfolio_dates_select ON public.portfolio_critical_dates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_member(l.company_id)));

DROP POLICY IF EXISTS portfolio_dates_write ON public.portfolio_critical_dates;
CREATE POLICY portfolio_dates_write ON public.portfolio_critical_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)));

-- security_instruments
DROP POLICY IF EXISTS portfolio_security_select ON public.portfolio_security_instruments;
CREATE POLICY portfolio_security_select ON public.portfolio_security_instruments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_member(l.company_id)));

DROP POLICY IF EXISTS portfolio_security_write ON public.portfolio_security_instruments;
CREATE POLICY portfolio_security_write ON public.portfolio_security_instruments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_leases l WHERE l.id = lease_id AND public.is_portfolio_company_admin(l.company_id)));

-- documents
DROP POLICY IF EXISTS portfolio_docs_select ON public.portfolio_documents;
CREATE POLICY portfolio_docs_select ON public.portfolio_documents FOR SELECT
  USING (public.is_portfolio_company_member(company_id));

DROP POLICY IF EXISTS portfolio_docs_write ON public.portfolio_documents;
CREATE POLICY portfolio_docs_write ON public.portfolio_documents FOR ALL
  USING (public.is_portfolio_company_admin(company_id))
  WITH CHECK (public.is_portfolio_company_admin(company_id));

-- abstractions
DROP POLICY IF EXISTS portfolio_abs_select ON public.portfolio_abstractions;
CREATE POLICY portfolio_abs_select ON public.portfolio_abstractions FOR SELECT
  USING (public.is_portfolio_company_member(company_id));

DROP POLICY IF EXISTS portfolio_abs_write ON public.portfolio_abstractions;
CREATE POLICY portfolio_abs_write ON public.portfolio_abstractions FOR ALL
  USING (public.is_portfolio_company_admin(company_id))
  WITH CHECK (public.is_portfolio_company_admin(company_id));

COMMIT;
