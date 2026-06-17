-- Per-version internal OpEx + CAPEX overrides.
-- Building-default assumption rows keep submission_id NULL (legacy behavior).
-- Version-override rows reference rfp_submissions.id.
--
-- Read path: first look up (project, building, component, submission_id),
-- fall back to (project, building, component, NULL) for the default.

ALTER TABLE public.project_assumptions
  ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.rfp_submissions(id) ON DELETE CASCADE;

ALTER TABLE public.project_assumptions
  DROP CONSTRAINT IF EXISTS project_assumptions_project_id_building_address_key;

ALTER TABLE public.project_assumptions
  DROP CONSTRAINT IF EXISTS project_assumptions_project_building_component_key;

CREATE UNIQUE INDEX IF NOT EXISTS project_assumptions_pbcs_key
  ON public.project_assumptions (project_id, building_address, component_label, submission_id);

CREATE INDEX IF NOT EXISTS project_assumptions_submission_id_idx
  ON public.project_assumptions (submission_id) WHERE submission_id IS NOT NULL;

COMMENT ON COLUMN public.project_assumptions.submission_id IS
  'NULL = building-default assumptions. Non-NULL = per-version override (joins rfp_submissions.id).';
