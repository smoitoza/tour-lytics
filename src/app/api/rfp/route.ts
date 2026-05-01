import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { debitTokens } from '@/lib/tokens'

// Allow up to 60s for RFP AI analysis (default 10s can timeout on complex proposals)
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic()

// Touch project updated_at so dashboard sorts correctly
async function touchProject(projectId: string) {
  try {
    await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
  } catch { /* non-critical */ }
}

// GET - fetch all RFP submissions for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const buildingNum = searchParams.get('buildingNum')

  let query = supabase
    .from('rfp_submissions')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'archived')
    .order('submitted_at', { ascending: false })

  if (buildingNum) {
    query = query.eq('building_num', parseInt(buildingNum))
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST - create or update an RFP submission
export async function POST(req: Request) {
  const body = await req.json()
  const {
    id, // if provided, update existing
    projectId = 'sf-office-search',
    // Accept both camelCase and snake_case from frontend
    buildingNum, building_num,
    buildingAddress, building_address,
    docType, doc_type,
    docName, doc_name,
    docSource, doc_source,
    submittedBy, submitted_by,
    dealTerms, terms,
    componentLabel, component_label,
    status = 'confirmed',
    analysis: providedAnalysis,
  } = body

  const finalBuildingNum = buildingNum ?? building_num
  const finalBuildingAddress = buildingAddress ?? building_address ?? ''
  const finalDocType = (docType ?? doc_type ?? 'rfp').toLowerCase()
  const finalDocName = docName ?? doc_name ?? (finalDocType.toUpperCase() + ' - ' + (finalBuildingAddress || 'Unknown'))
  const finalDocSource = docSource ?? doc_source ?? ''
  const finalSubmittedBy = submittedBy ?? submitted_by ?? (new URL(req.url).searchParams.get('userEmail') || 'unknown')
  // Frontend review form sends camelCase terms; map to snake_case for analysis engine
  const rawTerms = dealTerms ?? terms ?? {}
  const finalDealTerms: DealTerms = {
    rsf: rawTerms.rsf ?? rawTerms.RSF ?? 0,
    lease_term_months: rawTerms.lease_term_months ?? rawTerms.leaseTerm ?? 0,
    commencement_date: rawTerms.commencement_date ?? rawTerms.commencementDate ?? '',
    lease_end_date: rawTerms.lease_end_date ?? rawTerms.leaseEndDate ?? '',
    base_rent_rsf: rawTerms.base_rent_rsf ?? rawTerms.baseRent ?? 0,
    annual_escalation_pct: rawTerms.annual_escalation_pct ?? rawTerms.annualEscalation ?? 0,
    free_rent_months: rawTerms.free_rent_months ?? rawTerms.freeRent ?? 0,
    rent_periods: rawTerms.rent_periods ?? rawTerms.rentPeriods ?? undefined,
    ti_allowance_rsf: rawTerms.ti_allowance_rsf ?? rawTerms.tiAllowancePerRSF ?? 0,
    ti_allowance_total: rawTerms.ti_allowance_total ?? rawTerms.tiAllowanceTotal ?? 0,
    opex_rsf_yr: rawTerms.opex_rsf_yr ?? rawTerms.opexRSF ?? 0,
    opex_monthly: rawTerms.opex_monthly ?? rawTerms.opex ?? 0,
    parking_spots: rawTerms.parking_spots ?? rawTerms.parkingSpots ?? 0,
    parking_rate_monthly: rawTerms.parking_rate_monthly ?? rawTerms.parkingRate ?? 0,
    parking_escalation_pct: rawTerms.parking_escalation_pct ?? rawTerms.parkingEscalation ?? 0,
    security_deposit: rawTerms.security_deposit ?? rawTerms.securityDeposit ?? 0,
    amortized_ti_rsf: rawTerms.amortized_ti_rsf ?? rawTerms.amortizedTIRSF ?? 0,
    amortized_ti_rate: rawTerms.amortized_ti_rate ?? rawTerms.amortizedTIRate ?? 0,
    amortized_ti_term_months: rawTerms.amortized_ti_term_months ?? rawTerms.amortizedTITermMonths ?? 0,
    management_fee_pct: rawTerms.management_fee_pct ?? rawTerms.managementFeePct ?? 0,
    management_fee_basis: rawTerms.management_fee_basis ?? rawTerms.managementFeeBasis ?? undefined,
    management_fee_amount: rawTerms.management_fee_amount ?? rawTerms.managementFeeAmount ?? 0,
    // Generalized free-rent schedule (optional)
    free_rent_type: rawTerms.free_rent_type ?? rawTerms.freeRentType ?? undefined,
    free_rent_months_count: rawTerms.free_rent_months_count ?? rawTerms.freeRentMonthsCount ?? undefined,
    free_rent_from: rawTerms.free_rent_from ?? rawTerms.freeRentFrom ?? undefined,
    free_rent_to: rawTerms.free_rent_to ?? rawTerms.freeRentTo ?? undefined,
    free_rent_month_of_year: rawTerms.free_rent_month_of_year ?? rawTerms.freeRentMonthOfYear ?? undefined,
    free_rent_custom: rawTerms.free_rent_custom ?? rawTerms.freeRentCustom ?? undefined,
    // Rent unit detection metadata - pass-through from extractor or user override.
    base_rent_unit: rawTerms.base_rent_unit ?? rawTerms.baseRentUnit ?? 'year',
    base_rent_source_value: rawTerms.base_rent_source_value ?? rawTerms.baseRentSourceValue ?? 0,
    base_rent_source_quote: rawTerms.base_rent_source_quote ?? rawTerms.baseRentSourceQuote ?? '',
    base_rent_detection_confidence: rawTerms.base_rent_detection_confidence ?? rawTerms.baseRentDetectionConfidence ?? 1.0,
    base_rent_user_confirmed: rawTerms.base_rent_user_confirmed ?? rawTerms.baseRentUserConfirmed ?? false,
    base_rent_unit_warning: rawTerms.base_rent_unit_warning ?? rawTerms.baseRentUnitWarning ?? '',
    rent_basis: rawTerms.rent_basis ?? rawTerms.rentBasis ?? '',
    structure: rawTerms.structure ?? '',
    landlord: rawTerms.landlord ?? '',
    notes: rawTerms.notes ?? '',
    ti_disbursement_type: rawTerms.ti_disbursement_type ?? rawTerms.tiDisbursementType ?? undefined,
    ti_disbursement_month: rawTerms.ti_disbursement_month ?? rawTerms.tiDisbursementMonth ?? undefined,
    ti_milestones: rawTerms.ti_milestones ?? rawTerms.tiMilestones ?? undefined,
    ti_construction_cost: rawTerms.ti_construction_cost ?? rawTerms.tiConstructionCost ?? undefined,
  }

  // Generate financial analysis from deal terms.
  // 'existing' doc_type (executed leases) goes through the same extraction ->
  // review -> deal_terms pipeline as RFPs, so we always run the analysis engine.
  const isExisting = finalDocType === 'existing'
  const analysis = generateFinancialAnalysis(finalDealTerms)
  void providedAnalysis // accepted for backward compat but no longer used

  // Debit tokens for new submissions (updates are free).
  if (!id) {
    try {
      const tokenResult = await debitTokens({
        projectId,
        action: 'rfp_analysis',
        userEmail: finalSubmittedBy,
        metadata: { building: finalBuildingAddress, docType: finalDocType },
        note: `RFP analysis: ${finalBuildingAddress}`,
      })
      if (!tokenResult.success) {
        return NextResponse.json(
          { error: 'Insufficient tokens for RFP analysis. Please purchase more tokens.' },
          { status: 402 }
        )
      }
    } catch (e) {
      // Token system not yet set up - continue without billing
      console.warn('Token debit skipped (system not initialized):', (e as Error).message)
    }
  }

  if (id) {
    // Update existing
    const updatePayload: Record<string, any> = {
      deal_terms: finalDealTerms,
      analysis,
      status,
      doc_source: finalDocSource,
      updated_at: new Date().toISOString(),
    }
    // Allow renaming an existing building via address
    if (isExisting && finalBuildingAddress) {
      updatePayload.building_address = finalBuildingAddress
      updatePayload.doc_name = finalDocName
    }
    const { data, error } = await supabase
      .from('rfp_submissions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await touchProject(projectId)
    return NextResponse.json(data)
  }

  // Create new
  const { data, error } = await supabase
    .from('rfp_submissions')
    .insert({
      project_id: projectId,
      building_num: finalBuildingNum,
      building_address: finalBuildingAddress,
      doc_type: finalDocType,
      doc_name: finalDocName,
      doc_source: finalDocSource,
      submitted_by: finalSubmittedBy,
      component_label: componentLabel || component_label || null,
      deal_terms: finalDealTerms,
      analysis,
      status,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await touchProject(projectId)
  return NextResponse.json(data)
}

// PATCH - update version label or sort order on RFP submissions
export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, versionLabel, componentLabel, reorder } = body

  // Batch reorder: [{ id, sort_order }, ...]
  if (reorder && Array.isArray(reorder)) {
    const results = []
    for (const item of reorder) {
      const { error } = await supabase
        .from('rfp_submissions')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      results.push({ id: item.id, sort_order: item.sort_order })
    }
    return NextResponse.json({ success: true, updated: results })
  }

  // Single update: version label and/or component label
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (versionLabel !== undefined) updates.version_label = versionLabel || null
  if (componentLabel !== undefined) updates.component_label = componentLabel || null

  const { data, error } = await supabase
    .from('rfp_submissions')
    .update(updates)
    .eq('id', id)
    .select('id, version_label, component_label')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT - bulk re-analyze all submissions (regenerates cash flow from stored deal_terms)
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (secret !== 'reanalyze2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all active submissions with deal_terms
  const { data: subs, error } = await supabase
    .from('rfp_submissions')
    .select('id, deal_terms, building_address')
    .neq('status', 'archived')
    .not('deal_terms', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subs || subs.length === 0) return NextResponse.json({ message: 'No submissions found', updated: 0 })

  let updated = 0
  const errors: string[] = []
  for (const sub of subs) {
    try {
      const terms = sub.deal_terms as DealTerms
      const analysis = generateFinancialAnalysis(terms)
      const { error: updateErr } = await supabase
        .from('rfp_submissions')
        .update({ analysis, updated_at: new Date().toISOString() })
        .eq('id', sub.id)
      if (updateErr) {
        errors.push(`${sub.id}: ${updateErr.message}`)
      } else {
        updated++
      }
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ message: `Re-analyzed ${updated} of ${subs.length} submissions`, updated, errors })
}

// DELETE - archive an RFP submission
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Get project_id before archiving so we can touch the project
  const { data: sub } = await supabase.from('rfp_submissions').select('project_id').eq('id', id).single()

  const { error } = await supabase
    .from('rfp_submissions')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (sub?.project_id) await touchProject(sub.project_id)
  return NextResponse.json({ success: true })
}

// ============================================================
// FINANCIAL ANALYSIS ENGINE
// ============================================================

interface RentPeriod {
  from_month: number
  to_month: number
  rent_rsf_yr: number       // Contractual rate. For free-rent periods this is what would be paid absent the abatement.
  billable_rsf?: number
  label?: string
  is_free_rent?: boolean    // When true, the rate is fully abated (free rent credit = full base rent)
}

interface DealTerms {
  rsf?: number
  lease_term_months?: number
  commencement_date?: string
  lease_end_date?: string
  base_rent_rsf?: number
  annual_escalation_pct?: number
  free_rent_months?: number
  rent_periods?: RentPeriod[]
  ti_allowance_rsf?: number
  ti_allowance_total?: number
  opex_rsf_yr?: number
  opex_monthly?: number
  parking_spots?: number
  parking_rate_monthly?: number
  parking_escalation_pct?: number
  security_deposit?: number
  amortized_ti_rsf?: number
  amortized_ti_rate?: number
  amortized_ti_term_months?: number
  // Management fee.
  // basis = 'pct' (% of base rent), 'rsf_yr' ($ per RSF per year), 'rsf_mo' ($ per RSF per month), 'flat' ($ flat per month).
  // - 'pct' uses management_fee_pct (legacy field, stored as whole-number e.g. 3 = 3%)
  // - other bases use management_fee_amount (the dollar value in the chosen basis)
  // - When basis is unset, falls back to legacy management_fee_pct only.
  // - For 'pct': fee scales with rent escalations and abates with free rent.
  // - For dollar bases: fee is constant (no escalation, no free-rent abatement).
  //   This matches how landlords actually invoice flat fees.
  management_fee_pct?: number
  management_fee_basis?: 'pct' | 'rsf_yr' | 'rsf_mo' | 'flat' | string
  management_fee_amount?: number
  // Generalized free rent schedule (new, preferred over legacy free_rent_months/is_free_rent).
  // Four types:
  //   'first_n'        -> abate first free_rent_months_count months
  //   'range'          -> abate months [free_rent_from .. free_rent_to]
  //   'month_of_year'  -> abate one month per year (e.g. every Dec = month 12, 24, 36, ...)
  //   'custom'         -> abate exactly the months listed in free_rent_custom
  //   undefined        -> use legacy behavior (free_rent_months first-N or is_free_rent on periods)
  free_rent_type?: 'first_n' | 'range' | 'month_of_year' | 'custom' | string
  free_rent_months_count?: number
  free_rent_from?: number
  free_rent_to?: number
  free_rent_month_of_year?: number
  free_rent_custom?: number[]
  // Rent unit detection metadata (per spec).
  // base_rent_rsf is ALWAYS canonical $/RSF/year. These fields preserve
  // the original quoted unit so the UI can show both and flag low-confidence detections.
  base_rent_unit?: 'month' | 'year' | string
  base_rent_source_value?: number
  base_rent_source_quote?: string
  base_rent_detection_confidence?: number
  base_rent_user_confirmed?: boolean
  base_rent_unit_warning?: string
  rent_basis?: string
  structure?: string
  landlord?: string
  notes?: string
  ti_disbursement_type?: string
  ti_disbursement_month?: number
  ti_milestones?: { month: number; pct: number }[]
  ti_construction_cost?: number
}

// Helper: determine rent/RSF/yr and billable RSF for a given month
function getRentForMonth(
  month: number,
  rentPeriods: RentPeriod[] | undefined,
  baseRentRSF: number,
  escalation: number,
  freeMonths: number,
  defaultRSF: number
): { rentRSFYr: number; isFreeRent: boolean; billableRSF: number } {
  // If rent_periods defined, they take full control of the rent schedule.
  // After the last defined period, escalation kicks in annually from the last period's rate.
  if (rentPeriods && rentPeriods.length > 0) {
    // Sort periods by from_month
    const sorted = [...rentPeriods].sort((a, b) => a.from_month - b.from_month)

    // Check if month falls within a defined period
    for (const p of sorted) {
      if (month >= p.from_month && month <= p.to_month) {
        // A period is free rent when the explicit flag is set OR (legacy) the rate is zero.
        const free = !!p.is_free_rent || p.rent_rsf_yr === 0
        return {
          rentRSFYr: p.rent_rsf_yr,
          isFreeRent: free,
          billableRSF: p.billable_rsf || defaultRSF
        }
      }
    }

    // Month is past all defined periods -- escalate from last period's rate
    const lastPeriod = sorted[sorted.length - 1]
    const lastRate = lastPeriod.rent_rsf_yr
    const monthsAfterLastPeriod = month - lastPeriod.to_month
    const escalationYears = Math.ceil(monthsAfterLastPeriod / 12)
    const escalatedRate = lastRate * Math.pow(1 + escalation, escalationYears)
    return {
      rentRSFYr: escalatedRate,
      isFreeRent: false,
      billableRSF: lastPeriod.billable_rsf || defaultRSF
    }
  }

  // Legacy mode: single base rent + free months + annual escalation
  const leaseYear = Math.ceil(month / 12)
  const yearMultiplier = Math.pow(1 + escalation, leaseYear - 1)
  const currentRentRSFYr = baseRentRSF * yearMultiplier
  return { rentRSFYr: currentRentRSFYr, isFreeRent: false, billableRSF: defaultRSF }
}

// Resolve the set of abated months from the generalized free_rent_schedule fields.
// Returns an empty set if no generalized schedule is set. Legacy free_rent_months and
// per-period is_free_rent are NOT handled here; they're handled via existing code paths.
function resolveFreeRentMonths(terms: DealTerms, termMonths: number): Set<number> {
  const out = new Set<number>()
  const t = terms.free_rent_type
  if (!t) return out
  if (t === 'first_n') {
    const n = terms.free_rent_months_count || 0
    for (let i = 1; i <= Math.min(n, termMonths); i++) out.add(i)
  } else if (t === 'range') {
    const from = Math.max(1, terms.free_rent_from || 1)
    const to = Math.min(termMonths, terms.free_rent_to || 0)
    for (let i = from; i <= to; i++) out.add(i)
  } else if (t === 'month_of_year') {
    // N = 12 means month 12 of every year (12, 24, 36, ...)
    // N = 1 means month 1 of every year (1, 13, 25, ...)
    const monthN = terms.free_rent_month_of_year || 12
    if (monthN >= 1 && monthN <= 12) {
      for (let y = 0; y * 12 + monthN <= termMonths; y++) {
        out.add(y * 12 + monthN)
      }
    }
  } else if (t === 'custom') {
    const list = terms.free_rent_custom || []
    list.forEach(m => {
      const n = Number(m)
      if (n >= 1 && n <= termMonths) out.add(n)
    })
  }
  return out
}

function generateFinancialAnalysis(terms: DealTerms) {
  const rsf = terms.rsf || 0
  const termMonths = terms.lease_term_months || 60
  const baseRentRSF = terms.base_rent_rsf || 0
  const escalation = (terms.annual_escalation_pct || 0) / 100
  const freeMonths = terms.free_rent_months || 0
  const rentPeriods = terms.rent_periods
  const useSteppedRent = rentPeriods && rentPeriods.length > 0
  // Generalized free-rent schedule (new). Computed once up front.
  const generalizedFreeMonths = resolveFreeRentMonths(terms, termMonths)
  const tiRSF = terms.ti_allowance_rsf || 0
  const tiTotal = terms.ti_allowance_total || (tiRSF * rsf)
  const opexMonthly = terms.opex_monthly || 0
  const parkingSpots = terms.parking_spots || 0
  const parkingRate = terms.parking_rate_monthly || 0
  const parkingEsc = (terms.parking_escalation_pct || 0) / 100
  const amortTIRSF = terms.amortized_ti_rsf || 0
  const amortTIRate = (terms.amortized_ti_rate || 0) / 100
  // Management fee. Resolves any of four basis modes into a per-month dollar figure.
  // 'pct' is the legacy percent-of-rent mode; the others are flat dollar values.
  const mgmtFeeBasis = terms.management_fee_basis || (terms.management_fee_pct ? 'pct' : undefined)
  const mgmtFeePct = (terms.management_fee_pct || 0) / 100
  const mgmtFeeAmount = terms.management_fee_amount || 0
  // Pre-compute the monthly dollar fee for non-pct bases so the loop can use it directly.
  // For 'pct', fee is computed inside the loop because it depends on netCashRent each month.
  let mgmtFeeFlatMonthly = 0
  if (mgmtFeeBasis === 'rsf_yr') mgmtFeeFlatMonthly = (mgmtFeeAmount * rsf) / 12
  else if (mgmtFeeBasis === 'rsf_mo') mgmtFeeFlatMonthly = mgmtFeeAmount * rsf
  else if (mgmtFeeBasis === 'flat') mgmtFeeFlatMonthly = mgmtFeeAmount
  const amortTITermMonths = (terms.amortized_ti_term_months || 0) > 0 ? terms.amortized_ti_term_months! : termMonths
  const amortTIPrincipal = amortTIRSF * rsf
  let amortTIMonthlyPayment = 0
  if (amortTIPrincipal > 0) {
    if (amortTIRate === 0) {
      amortTIMonthlyPayment = amortTIPrincipal / amortTITermMonths
    } else {
      const monthlyRate = amortTIRate / 12
      amortTIMonthlyPayment = amortTIPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, amortTITermMonths)) / (Math.pow(1 + monthlyRate, amortTITermMonths) - 1)
    }
  }
  const hasAmortTI = amortTIPrincipal > 0

  // TI Disbursement schedule
  const tiDisbType = terms.ti_disbursement_type || 'commencement'
  const tiDisbMonth = terms.ti_disbursement_month || 1
  const tiMilestones = terms.ti_milestones || []
  const tiConstructionCost = terms.ti_construction_cost || 0

  function getTIReceivedForMonth(month: number, totalAmount: number): number {
    if (totalAmount <= 0) return 0
    if (tiDisbType === 'commencement') {
      return month === 1 ? totalAmount : 0
    }
    if (tiDisbType === 'specific_month') {
      return month === tiDisbMonth ? totalAmount : 0
    }
    if (tiDisbType === 'milestones') {
      const milestone = tiMilestones.find((m: { month: number; pct: number }) => m.month === month)
      return milestone ? Math.round(totalAmount * milestone.pct / 100) : 0
    }
    return month === 1 ? totalAmount : 0
  }

  const commDate = terms.commencement_date ? new Date(terms.commencement_date + 'T00:00:00') : new Date()
  const leaseEndDate = terms.lease_end_date ? new Date(terms.lease_end_date + 'T00:00:00') : null

  // Proration: compute fraction of first and last month
  // Month 1 proration: remaining days in the commencement month / total days in that month
  const commDay = commDate.getDate()
  const commMonthDays = new Date(commDate.getFullYear(), commDate.getMonth() + 1, 0).getDate()
  const firstMonthProration = commDay === 1 ? 1.0 : (commMonthDays - commDay + 1) / commMonthDays

  // Last month proration: if lease_end_date is set, days used in final month / total days
  let lastMonthProration = 1.0
  if (leaseEndDate) {
    const endDay = leaseEndDate.getDate()
    const endMonthDays = new Date(leaseEndDate.getFullYear(), leaseEndDate.getMonth() + 1, 0).getDate()
    lastMonthProration = endDay === endMonthDays ? 1.0 : endDay / endMonthDays
  }

  // ===== 1. MONTHLY CASH FLOW =====
  const monthly: any[] = []
  let cumulativeCash = 0
  let totalBaseRent = 0
  let totalFreeRentValue = 0
  let totalOpex = 0
  let totalParking = 0
  let totalAmortTI = 0
  let totalTIReceived = 0
  let totalAmortTIReceived = 0
  let totalMgmtFee = 0

  for (let m = 1; m <= termMonths; m++) {
    const leaseYear = Math.ceil(m / 12)
    const monthDate = new Date(commDate)
    monthDate.setMonth(monthDate.getMonth() + m - 1)
    const period = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    // Proration factor: partial month for first and/or last month
    const proration = (m === 1 ? firstMonthProration : 1.0) * (m === termMonths ? lastMonthProration : 1.0)

    let currentRentRSF: number
    let monthlyBaseRent: number
    let freeRentCredit = 0
    let billableRSF = rsf // default: full premises RSF

    if (useSteppedRent) {
      // Stepped rent mode: rent_periods drives everything
      const result = getRentForMonth(m, rentPeriods, baseRentRSF, escalation, freeMonths, rsf)
      currentRentRSF = result.rentRSFYr
      billableRSF = result.billableRSF
      // Use billable RSF (not full premises RSF) for rent calculation
      monthlyBaseRent = (currentRentRSF * billableRSF) / 12
      // Generalized free rent wins: if this month is in the generalized schedule,
      // credit the full base rent regardless of the period's is_free_rent flag.
      const isGeneralizedFree = generalizedFreeMonths.has(m)
      if (isGeneralizedFree && currentRentRSF > 0) {
        freeRentCredit = monthlyBaseRent
      } else if (result.isFreeRent) {
        // If the period has a real contractual rate, use it directly.
        // Otherwise (legacy rate=0 case), de-escalate from the next paid period.
        if (currentRentRSF > 0) {
          // is_free_rent=true with contractual rate already set; just credit fully
          freeRentCredit = monthlyBaseRent
        } else {
          const sorted = [...rentPeriods!].sort((a, b) => a.from_month - b.from_month)
          const firstPaidPeriod = sorted.find(p => !p.is_free_rent && p.rent_rsf_yr > 0)
          const shadowRSF = firstPaidPeriod?.billable_rsf || rsf
          let shadowRent = baseRentRSF
          if (firstPaidPeriod && escalation > 0) {
            const freeYear = Math.ceil(m / 12)
            const paidYear = Math.ceil(firstPaidPeriod.from_month / 12)
            const yearsBack = paidYear - freeYear
            shadowRent = firstPaidPeriod.rent_rsf_yr / Math.pow(1 + escalation, yearsBack)
          } else if (firstPaidPeriod) {
            shadowRent = firstPaidPeriod.rent_rsf_yr
          }
          currentRentRSF = Math.round(shadowRent * 100) / 100
          monthlyBaseRent = (currentRentRSF * shadowRSF) / 12
          freeRentCredit = monthlyBaseRent
        }
      }
    } else {
      // Legacy mode: single base rent + escalation
      const yearMultiplier = Math.pow(1 + escalation, leaseYear - 1)
      currentRentRSF = baseRentRSF * yearMultiplier
      monthlyBaseRent = (currentRentRSF * rsf) / 12

      // Generalized free rent schedule wins over legacy free_rent_months count
      if (generalizedFreeMonths.has(m)) {
        freeRentCredit = monthlyBaseRent
      } else if (m <= Math.floor(freeMonths)) {
        // Legacy free-rent count: free_rent_months at start of lease
        freeRentCredit = monthlyBaseRent
      } else if (m === Math.floor(freeMonths) + 1 && freeMonths % 1 > 0) {
        freeRentCredit = monthlyBaseRent * (freeMonths % 1)
      }
    }
    // Apply proration to partial months (first/last month of lease)
    monthlyBaseRent = monthlyBaseRent * proration
    freeRentCredit = freeRentCredit * proration
    const netCashRent = monthlyBaseRent - freeRentCredit

    // Management fee: per-month dollar amount based on basis.
    // - 'pct': % of net cash rent (free rent abates the fee, escalations scale it)
    // - 'rsf_yr' / 'rsf_mo' / 'flat': constant flat amount (no abatement, no escalation)
    let mgmtFee = 0
    if (mgmtFeeBasis === 'pct' || (!mgmtFeeBasis && mgmtFeePct > 0)) {
      mgmtFee = netCashRent * mgmtFeePct
    } else if (mgmtFeeFlatMonthly > 0) {
      mgmtFee = mgmtFeeFlatMonthly * proration
    }

    // OpEx (constant, user-defined) - prorated for partial months
    const opex = opexMonthly * proration

    // Parking with escalation (starts year 2 typically) - prorated for partial months
    const parkYearMultiplier = m <= 12 ? 1 : Math.pow(1 + parkingEsc, leaseYear - 1)
    const monthlyParking = parkingSpots * parkingRate * parkYearMultiplier * proration

    // Amortized TI: fixed monthly payment, starts month 1, stops after amort term
    const amortTI = hasAmortTI && m <= amortTITermMonths ? amortTIMonthlyPayment : 0

    // TI Received: cash inflow from landlord (positive = cash in)
    const tiReceived = getTIReceivedForMonth(m, tiTotal)
    const amortTIReceived = getTIReceivedForMonth(m, amortTIPrincipal)

    // Total monthly cost: TI received REDUCES net cash out
    const totalMonthlyCost = netCashRent + mgmtFee + opex + monthlyParking + amortTI - tiReceived - amortTIReceived
    cumulativeCash += totalMonthlyCost

    totalBaseRent += monthlyBaseRent
    totalFreeRentValue += freeRentCredit
    totalOpex += opex
    totalParking += monthlyParking
    totalAmortTI += amortTI
    totalTIReceived += tiReceived
    totalAmortTIReceived += amortTIReceived
    totalMgmtFee += mgmtFee

    monthly.push({
      month: m,
      period,
      leaseYear,
      billableRSF: billableRSF,
      usableRSF: rsf,
      rentRSF: Math.round(currentRentRSF * 100) / 100,
      monthlyBaseRent: Math.round(monthlyBaseRent),
      freeRentCredit: Math.round(freeRentCredit),
      netCashRent: Math.round(netCashRent),
      managementFee: Math.round(mgmtFee),
      opex: Math.round(opex),
      parking: Math.round(monthlyParking),
      amortizedTI: Math.round(amortTI),
      tiReceived: Math.round(tiReceived),
      amortTIReceived: Math.round(amortTIReceived),
      totalMonthlyCost: Math.round(totalMonthlyCost),
      cumulativeCash: Math.round(cumulativeCash),
    })
  }

  // ===== 2. ANNUAL / STRAIGHT-LINE P&L =====
  // Group monthly into annual
  const annualMap: Record<number, any> = {}
  monthly.forEach(m => {
    if (!annualMap[m.leaseYear]) {
      annualMap[m.leaseYear] = {
        year: m.leaseYear,
        months: 0,
        baseRent: 0,
        freeRent: 0,
        netRent: 0,
        managementFee: 0,
        opex: 0,
        parking: 0,
        amortizedTI: 0,
        tiReceived: 0,
        amortTIReceived: 0,
        totalCost: 0,
      }
    }
    const yr = annualMap[m.leaseYear]
    yr.months++
    yr.baseRent += m.monthlyBaseRent
    yr.freeRent += m.freeRentCredit
    yr.netRent += m.netCashRent
    yr.managementFee += (m.managementFee || 0)
    yr.opex += m.opex
    yr.parking += m.parking
    yr.amortizedTI += m.amortizedTI
    yr.tiReceived += m.tiReceived
    yr.amortTIReceived += m.amortTIReceived
    yr.totalCost += m.totalMonthlyCost
  })
  const annual = Object.values(annualMap).map((yr: any) => ({
    ...yr,
    baseRent: Math.round(yr.baseRent),
    freeRent: Math.round(yr.freeRent),
    netRent: Math.round(yr.netRent),
    managementFee: Math.round(yr.managementFee),
    opex: Math.round(yr.opex),
    parking: Math.round(yr.parking),
    amortizedTI: Math.round(yr.amortizedTI),
    tiReceived: Math.round(yr.tiReceived),
    amortTIReceived: Math.round(yr.amortTIReceived),
    totalCost: Math.round(yr.totalCost),
  }))

  // Straight-line rent = (total net rent - TI allowance) / total months
  // TI is a lease incentive that reduces the straight-line rent expense over the term
  const totalNetRent = monthly.reduce((s, m) => s + m.netCashRent, 0)
  const monthlyTIAmortization = tiTotal / termMonths
  const straightLineMonthlyRent = (totalNetRent - tiTotal) / termMonths
  const straightLineAnnualRent = straightLineMonthlyRent * 12

  // ===== 3. GAAP / ASC 842 =====
  // Simplified GAAP lease accounting
  // Total lease payments (undiscounted)
  const totalLeasePayments = monthly.reduce((s, m) => s + m.netCashRent, 0)
  // Discount rate assumption (typical IBR)
  const discountRate = 0.06 // 6% IBR
  const monthlyDiscountRate = discountRate / 12

  // Present value of lease payments (lease liability)
  let leaseLiability = 0
  for (let m = 0; m < termMonths; m++) {
    const payment = monthly[m] ? monthly[m].netCashRent : 0
    leaseLiability += payment / Math.pow(1 + monthlyDiscountRate, m + 1)
  }
  leaseLiability = Math.round(leaseLiability)

  // ROU Asset = Lease Liability + Initial Direct Costs - Lease Incentives (TI)
  const rouAsset = Math.round(leaseLiability - tiTotal)

  // Monthly amortization schedule
  const gaapSchedule: any[] = []
  let remainingLiability = leaseLiability
  let remainingROU = rouAsset
  const monthlyROUAmort = rouAsset / termMonths

  for (let m = 0; m < termMonths; m++) {
    const payment = monthly[m] ? monthly[m].netCashRent : 0
    const interestExpense = Math.round(remainingLiability * monthlyDiscountRate)
    const principalReduction = payment - interestExpense
    remainingLiability = Math.max(0, remainingLiability - principalReduction)
    remainingROU = Math.max(0, remainingROU - monthlyROUAmort)

    // Straight-line lease expense for GAAP P&L (already includes TI amortization)
    const straightLineExpense = Math.round(straightLineMonthlyRent)
    // GAAP total expense including OpEx
    const totalGAAPExpense = straightLineExpense + opexMonthly

    gaapSchedule.push({
      month: m + 1,
      period: monthly[m]?.period || '',
      cashPayment: Math.round(payment),
      interestExpense: Math.round(interestExpense),
      principalReduction: Math.round(principalReduction),
      leaseLiability: Math.round(remainingLiability),
      rouAmortization: Math.round(monthlyROUAmort),
      rouAsset: Math.round(remainingROU),
      straightLineExpense,
      tiAmortization: Math.round(monthlyTIAmortization),
      totalGAAPExpense,
    })
  }

  // Summary metrics
  const totalAllIn = Math.round(cumulativeCash)
  // Effective rent accounts for TI as a concession
  const netRentAfterTI = totalNetRent - tiTotal
  const effectiveRentRSF = rsf > 0 ? Math.round((netRentAfterTI / (termMonths / 12)) / rsf * 100) / 100 : 0
  const totalCostPerRSFPerYear = rsf > 0 ? Math.round(((totalAllIn - tiTotal) / (termMonths / 12)) / rsf * 100) / 100 : 0

  // Build TI disbursement schedule (only non-zero months)
  const tiDisbursementSchedule: { month: number; standardTI: number; amortTI: number; total: number }[] = []
  for (let dm = 1; dm <= termMonths; dm++) {
    const stdTI = getTIReceivedForMonth(dm, tiTotal)
    const amtTI = getTIReceivedForMonth(dm, amortTIPrincipal)
    if (stdTI > 0 || amtTI > 0) {
      tiDisbursementSchedule.push({ month: dm, standardTI: Math.round(stdTI), amortTI: Math.round(amtTI), total: Math.round(stdTI + amtTI) })
    }
  }

  // ===== 4. NPV / PRESENT VALUE ANALYSIS =====
  // Compute NPV of total lease obligation at multiple discount rates
  // Uses monthly cash flows (totalMonthlyCost) which include rent + opex + parking
  // Also factors in upfront capital (TI out-of-pocket = buildout cost - TI allowance)
  function computeNPV(monthlyCashFlows: any[], annualRate: number): number {
    const monthlyRate = annualRate / 12
    let npv = 0
    for (let i = 0; i < monthlyCashFlows.length; i++) {
      const cf = monthlyCashFlows[i].totalMonthlyCost || 0
      npv += cf / Math.pow(1 + monthlyRate, i + 1)
    }
    return Math.round(npv)
  }

  const npvRates = [0.06, 0.07, 0.08, 0.09, 0.10]
  const npvResults: Record<string, { rate: number, npv: number, npvPerRSF: number, avgAnnual: number }> = {}
  npvRates.forEach(rate => {
    const npvVal = computeNPV(monthly, rate)
    npvResults[String(rate)] = {
      rate,
      npv: npvVal,
      npvPerRSF: rsf > 0 ? Math.round(npvVal / rsf * 100) / 100 : 0,
      avgAnnual: termMonths > 0 ? Math.round(npvVal / (termMonths / 12)) : 0,
    }
  })

  // Default NPV at 8% (CRE industry standard)
  const npvDefault = npvResults['0.08'] || npvResults['0.08']

  return {
    cash_flow: {
      monthly,
      totals: {
        totalBaseRent: Math.round(totalBaseRent),
        totalFreeRentValue: Math.round(totalFreeRentValue),
        totalNetRent: Math.round(totalNetRent),
        totalManagementFee: Math.round(totalMgmtFee),
        managementFeePct: terms.management_fee_pct || 0,
        managementFeeBasis: terms.management_fee_basis || (terms.management_fee_pct ? 'pct' : ''),
        managementFeeAmount: terms.management_fee_amount || 0,
        totalOpex: Math.round(totalOpex),
        totalParking: Math.round(totalParking),
        totalAmortizedTI: Math.round(totalAmortTI),
        amortizedTIPrincipal: Math.round(amortTIPrincipal),
        amortizedTIInterest: Math.round(totalAmortTI - amortTIPrincipal),
        amortizedTIMonthlyPayment: Math.round(amortTIMonthlyPayment),
        totalTIReceived: Math.round(totalTIReceived),
        totalAmortTIReceived: Math.round(totalAmortTIReceived),
        totalAllInCost: totalAllIn,
        termMonths,
      }
    },
    straight_line_pl: {
      annual,
      totals: {
        straightLineMonthlyRent: Math.round(straightLineMonthlyRent),
        straightLineAnnualRent: Math.round(straightLineAnnualRent),
        totalManagementFee: Math.round(totalMgmtFee),
        managementFeePct: terms.management_fee_pct || 0,
        managementFeeBasis: terms.management_fee_basis || (terms.management_fee_pct ? 'pct' : ''),
        managementFeeAmount: terms.management_fee_amount || 0,
        monthlyManagementFee: termMonths > 0 ? Math.round(totalMgmtFee / termMonths) : 0,
        effectiveRentRSF,
        totalCostPerRSFPerYear,
        tiAllowanceTotal: tiTotal,
        monthlyTIAmortization: Math.round(monthlyTIAmortization),
        annualTIAmortization: Math.round(monthlyTIAmortization * 12),
        amortizedTIMonthlyPayment: Math.round(amortTIMonthlyPayment),
        totalAmortizedTI: Math.round(totalAmortTI),
        amortizedTIPrincipal: Math.round(amortTIPrincipal),
        amortizedTIRate: terms.amortized_ti_rate || 0,
        amortizedTITermMonths: amortTIPrincipal > 0 ? amortTITermMonths : 0,
      }
    },
    gaap: {
      summary: {
        discountRate,
        leaseLiability,
        rouAsset,
        totalLeasePayments: Math.round(totalLeasePayments),
        tiAllowance: tiTotal,
        amortizedTIPrincipal: Math.round(amortTIPrincipal),
        amortizedTIRate: terms.amortized_ti_rate || 0,
        amortizedTITermMonths: amortTIPrincipal > 0 ? amortTITermMonths : 0,
        amortizedTIMonthlyPayment: Math.round(amortTIMonthlyPayment),
        amortizedTIAnnualPayment: Math.round(amortTIMonthlyPayment * 12),
        amortizedTITotalInterest: Math.round(totalAmortTI - amortTIPrincipal),
        amortizedTITotalPaid: Math.round(totalAmortTI),
        amortizedTIImpactPerRSFYr: rsf > 0 && termMonths > 0 ? Math.round((totalAmortTI / (termMonths / 12)) / rsf * 100) / 100 : 0,
      },
      schedule: gaapSchedule,
    },
    npv: {
      defaultRate: 0.08,
      results: npvResults,
      default: npvDefault,
    },
    summary: {
      rsf,
      termMonths,
      totalAllInCost: totalAllIn,
      effectiveRentRSF,
      totalCostPerRSFPerYear,
      straightLineMonthlyRent: Math.round(straightLineMonthlyRent),
      straightLineAnnualExpense: Math.round(straightLineAnnualRent + (opexMonthly * 12)),
      freeRentValue: Math.round(totalFreeRentValue),
      tiValue: tiTotal,
      totalConcessions: Math.round(totalFreeRentValue + tiTotal),
      npv: npvDefault?.npv || 0,
      npvPerRSF: npvDefault?.npvPerRSF || 0,
      npvRate: 0.08,
      tiDisbursementType: tiDisbType,
      tiDisbursementSchedule,
      tiConstructionCost,
    }
  }
}
