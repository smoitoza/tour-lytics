// ============================================================
// LEASE CLAUSE TAXONOMY
// ============================================================
// Single source of truth for the clause types we extract, classify, and
// risk-score on every uploaded lease. Order matters - it drives display
// order in the summary view (most important deal points first).
//
// To add a new clause type:
//   1. Add it to LEASE_CLAUSE_TYPES below
//   2. Add classification guidance in the extraction prompt
//   3. (Optional) Add risk rubric entry in lease-risk-rubric.ts
// ============================================================

export type LeaseClauseType =
  // ---- Core economics ----
  | 'rent_base'              // Base rent, rate per RSF, periodic escalations
  | 'rent_abatement'         // Free rent / rent abatement schedule
  | 'opex_passthrough'       // Operating expenses, CAM, taxes, insurance
  | 'opex_caps'              // Caps on controllable opex / expense stops / base year
  | 'security_deposit'       // Security deposit, LOC, burn-down provisions
  | 'parking'                // Parking spaces, rates, escalation
  | 'tenant_improvements'    // TI allowance, work letter, build-out
  // ---- Term & options ----
  | 'term_dates'             // Commencement, rent commencement, expiration
  | 'renewal_options'        // Renewal options, fair market rent definitions
  | 'expansion_rights'       // Expansion options, ROFR, ROFO on contiguous space
  | 'termination_rights'     // Early termination, kick-out, contraction
  | 'holdover'               // Holdover rent multiplier and term
  // ---- Use & alterations ----
  | 'permitted_use'          // Permitted use, exclusivity
  | 'alterations'            // Alterations, restoration obligations
  | 'signage'                // Building signage, suite signage rights
  | 'subletting_assignment'  // Sublet/assignment consent, profit sharing
  // ---- Risk allocation ----
  | 'maintenance_repair'     // Landlord vs tenant maintenance scope
  | 'services_utilities'     // HVAC hours, after-hours, utilities included
  | 'insurance'              // Insurance limits, waivers of subrogation
  | 'indemnity'              // Indemnification obligations both directions
  | 'casualty_condemnation'  // Casualty/condemnation termination rights
  | 'default_remedies'       // Default events, cure periods, remedies
  | 'estoppel_snda'          // Estoppel certificates, SNDA, financial reporting
  | 'surrender'              // Surrender condition, removal of alterations
  // ---- Misc ----
  | 'other'                  // Catch-all for clauses that don't fit above

export interface LeaseClauseTypeMeta {
  type: LeaseClauseType
  label: string                 // Display label in summary card
  group: 'economics' | 'term' | 'use' | 'risk' | 'misc'
  description: string           // What this clause covers (used in extraction prompt)
}

export const LEASE_CLAUSE_TYPES: LeaseClauseTypeMeta[] = [
  // Economics
  { type: 'rent_base',             group: 'economics', label: 'Base Rent',                 description: 'Base rent rate (per RSF or flat), commencement, escalations, stepped increases.' },
  { type: 'rent_abatement',        group: 'economics', label: 'Free Rent / Abatement',     description: 'Months of free rent, abatement schedule, recapture provisions.' },
  { type: 'opex_passthrough',      group: 'economics', label: 'Operating Expenses (NNN)',  description: 'CAM, real estate taxes, insurance pass-throughs, gross-up, audit rights.' },
  { type: 'opex_caps',             group: 'economics', label: 'Opex Caps / Base Year',     description: 'Caps on controllable operating expenses, expense stops, base year.' },
  { type: 'security_deposit',      group: 'economics', label: 'Security Deposit',          description: 'Cash deposit, letter of credit, burn-down/reduction provisions.' },
  { type: 'parking',               group: 'economics', label: 'Parking',                   description: 'Parking ratio, monthly cost per space, reserved vs unreserved, escalation.' },
  { type: 'tenant_improvements',   group: 'economics', label: 'Tenant Improvements',       description: 'TI allowance, work letter, landlord vs tenant work, deadlines.' },
  // Term & options
  { type: 'term_dates',            group: 'term',      label: 'Term & Key Dates',          description: 'Commencement date, rent commencement, expiration, delivery condition.' },
  { type: 'renewal_options',       group: 'term',      label: 'Renewal Options',           description: 'Number and length of renewal options, FMR definition, notice windows.' },
  { type: 'expansion_rights',      group: 'term',      label: 'Expansion Rights',          description: 'Must-take, expansion options, ROFR, ROFO on adjacent space.' },
  { type: 'termination_rights',    group: 'term',      label: 'Termination Rights',        description: 'Early termination, contraction options, exit fees, notice.' },
  { type: 'holdover',              group: 'term',      label: 'Holdover',                  description: 'Holdover rent percentage, consent requirement, consequential damages.' },
  // Use & alterations
  { type: 'permitted_use',         group: 'use',       label: 'Permitted Use',             description: 'Permitted use, exclusivity, no compete, prohibited uses.' },
  { type: 'alterations',           group: 'use',       label: 'Alterations',               description: 'Tenant alteration rights, consent thresholds, restoration obligations.' },
  { type: 'signage',               group: 'use',       label: 'Signage',                   description: 'Exterior building signage, suite signage, monument, lobby directory.' },
  { type: 'subletting_assignment', group: 'use',       label: 'Sublet & Assignment',       description: 'Consent standards, recapture, profit sharing, permitted transfers.' },
  // Risk allocation
  { type: 'maintenance_repair',    group: 'risk',      label: 'Maintenance & Repair',      description: 'Landlord obligations, tenant obligations, capital repairs, HVAC.' },
  { type: 'services_utilities',    group: 'risk',      label: 'Services & Utilities',      description: 'HVAC hours, after-hours rate, included utilities, interruption remedies.' },
  { type: 'insurance',             group: 'risk',      label: 'Insurance',                 description: 'Required limits, waivers of subrogation, additional insureds.' },
  { type: 'indemnity',             group: 'risk',      label: 'Indemnification',           description: 'Tenant and landlord indemnity scope, mutual carve-outs.' },
  { type: 'casualty_condemnation', group: 'risk',      label: 'Casualty & Condemnation',   description: 'Restoration obligations, termination triggers, rent abatement during.' },
  { type: 'default_remedies',      group: 'risk',      label: 'Default & Remedies',        description: 'Events of default, monetary/non-monetary cure periods, landlord remedies.' },
  { type: 'estoppel_snda',         group: 'risk',      label: 'Estoppel & SNDA',           description: 'Estoppel certificates, SNDA, financial reporting, mortgagee protections.' },
  { type: 'surrender',             group: 'risk',      label: 'Surrender Condition',       description: 'Condition at surrender, removal of alterations, broom-clean, normal wear.' },
  // Misc
  { type: 'other',                 group: 'misc',      label: 'Other',                     description: 'Anything that does not fit a specific category above.' },
]

export const CLAUSE_TYPE_BY_KEY: Record<LeaseClauseType, LeaseClauseTypeMeta> =
  LEASE_CLAUSE_TYPES.reduce((acc, t) => { acc[t.type] = t; return acc }, {} as Record<LeaseClauseType, LeaseClauseTypeMeta>)

export const CLAUSE_GROUP_LABELS: Record<LeaseClauseTypeMeta['group'], string> = {
  economics: 'Economics',
  term:      'Term & Options',
  use:       'Use & Alterations',
  risk:      'Risk Allocation',
  misc:      'Other',
}

// Risk levels used in the summary view + future redline suggestions
export type LeaseRiskLevel = 'low' | 'medium' | 'high' | 'unknown'

export const RISK_COLORS: Record<LeaseRiskLevel, { fg: string; bg: string; label: string }> = {
  low:     { fg: '#15803D', bg: '#F0FDF4', label: 'Low risk' },
  medium:  { fg: '#B45309', bg: '#FFFBEB', label: 'Medium risk' },
  high:    { fg: '#B91C1C', bg: '#FEF2F2', label: 'High risk' },
  unknown: { fg: '#475569', bg: '#F8FAFC', label: 'Not assessed' },
}
