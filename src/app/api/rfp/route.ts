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
    base_rent_rsf: rawTerms.base_rent_rsf ?? rawTerms.baseRent ?? 0,
    annual_escalation_pct: rawTerms.annual_escalation_pct ?? rawTerms.annualEscalation ?? 0,
    free_rent_months: rawTerms.free_rent_months ?? rawTerms.freeRent ?? 0,
    ti_allowance_rsf: rawTerms.ti_allowance_rsf ?? rawTerms.tiAllowancePerRSF ?? 0,
    ti_allowance_total: rawTerms.ti_allowance_total ?? rawTerms.tiAllowanceTotal ?? 0,
    opex_rsf_yr: rawTerms.opex_rsf_yr ?? rawTerms.opexRSF ?? 0,
    opex_monthly: rawTerms.opex_monthly ?? rawTerms.opex ?? 0,
    parking_spots: rawTerms.parking_spots ?? rawTerms.parkingSpots ?? 0,
    parking_rate_monthly: rawTerms.parking_rate_monthly ?? rawTerms.parkingRate ?? 0,
    parking_escalation_pct: rawTerms.parking_escalation_pct ?? rawTerms.parkingEscalation ?? 0,
    security_deposit: rawTerms.security_deposit ?? rawTerms.securityDeposit ?? 0,
    rent_basis: rawTerms.rent_basis ?? rawTerms.rentBasis ?? '',
    structure: rawTerms.structure ?? '',
    landlord: rawTerms.landlord ?? '',
    notes: rawTerms.notes ?? '',
  }

  // Generate financial analysis from deal terms
  const analysis = generateFinancialAnalysis(finalDealTerms)

  // Debit tokens for new RFP analysis (updates are free)
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
    const { data, error } = await supabase
      .from('rfp_submissions')
      .update({
        deal_terms: finalDealTerms,
        analysis,
        status,
        doc_source: finalDocSource,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

// DELETE - archive an RFP submission
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('rfp_submissions')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================================
// FINANCIAL ANALYSIS ENGINE
// ============================================================

interface DealTerms {
  rsf?: number
  lease_term_months?: number
  commencement_date?: string
  base_rent_rsf?: number
  annual_escalation_pct?: number
  free_rent_months?: number
  ti_allowance_rsf?: number
  ti_allowance_total?: number
  opex_rsf_yr?: number
  opex_monthly?: number
  parking_spots?: number
  parking_rate_monthly?: number
  parking_escalation_pct?: number
  security_deposit?: number
  rent_basis?: string
  structure?: string
  landlord?: string
  notes?: string
}

function generateFinancialAnalysis(terms: DealTerms) {
  const rsf = terms.rsf || 0
  const termMonths = terms.lease_term_months || 60
  const baseRentRSF = terms.base_rent_rsf || 0
  const escalation = (terms.annual_escalation_pct || 0) / 100
  const freeMonths = terms.free_rent_months || 0
  const tiRSF = terms.ti_allowance_rsf || 0
  const tiTotal = terms.ti_allowance_total || (tiRSF * rsf)
  const opexMonthly = terms.opex_monthly || 0
  const parkingSpots = terms.parking_spots || 0
  const parkingRate = terms.parking_rate_monthly || 0
  const parkingEsc = (terms.parking_escalation_pct || 0) / 100
  const commDate = terms.commencement_date ? new Date(terms.commencement_date) : new Date()

  // ===== 1. MONTHLY CASH FLOW =====
  const monthly: any[] = []
  let cumulativeCash = 0
  let totalBaseRent = 0
  let totalFreeRentValue = 0
  let totalOpex = 0
  let totalParking = 0

  for (let m = 1; m <= termMonths; m++) {
    const leaseYear = Math.ceil(m / 12)
    const monthDate = new Date(commDate)
    monthDate.setMonth(monthDate.getMonth() + m - 1)
    const period = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    // Rent with annual escalation
    const yearMultiplier = Math.pow(1 + escalation, leaseYear - 1)
    const currentRentRSF = baseRentRSF * yearMultiplier
    const monthlyBaseRent = (currentRentRSF * rsf) / 12

    // Free rent (supports fractional months, e.g. 0.5 = half month free)
    let freeRentCredit = 0
    if (m <= Math.floor(freeMonths)) {
      freeRentCredit = monthlyBaseRent // full free month
    } else if (m === Math.floor(freeMonths) + 1 && freeMonths % 1 > 0) {
      freeRentCredit = monthlyBaseRent * (freeMonths % 1) // partial free month
    }
    const netCashRent = monthlyBaseRent - freeRentCredit

    // OpEx (constant, user-defined)
    const opex = opexMonthly

    // Parking with escalation (starts year 2 typically)
    const parkYearMultiplier = m <= 12 ? 1 : Math.pow(1 + parkingEsc, leaseYear - 1)
    const monthlyParking = parkingSpots * parkingRate * parkYearMultiplier

    // Total monthly cost
    const totalMonthlyCost = netCashRent + opex + monthlyParking
    cumulativeCash += totalMonthlyCost

    totalBaseRent += monthlyBaseRent
    totalFreeRentValue += freeRentCredit
    totalOpex += opex
    totalParking += monthlyParking

    monthly.push({
      month: m,
      period,
      leaseYear,
      rentRSF: Math.round(currentRentRSF * 100) / 100,
      monthlyBaseRent: Math.round(monthlyBaseRent),
      freeRentCredit: Math.round(freeRentCredit),
      netCashRent: Math.round(netCashRent),
      opex: Math.round(opex),
      parking: Math.round(monthlyParking),
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
        opex: 0,
        parking: 0,
        totalCost: 0,
      }
    }
    const yr = annualMap[m.leaseYear]
    yr.months++
    yr.baseRent += m.monthlyBaseRent
    yr.freeRent += m.freeRentCredit
    yr.netRent += m.netCashRent
    yr.opex += m.opex
    yr.parking += m.parking
    yr.totalCost += m.totalMonthlyCost
  })
  const annual = Object.values(annualMap).map((yr: any) => ({
    ...yr,
    baseRent: Math.round(yr.baseRent),
    freeRent: Math.round(yr.freeRent),
    netRent: Math.round(yr.netRent),
    opex: Math.round(yr.opex),
    parking: Math.round(yr.parking),
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
        totalOpex: Math.round(totalOpex),
        totalParking: Math.round(totalParking),
        totalAllInCost: totalAllIn,
        termMonths,
      }
    },
    straight_line_pl: {
      annual,
      totals: {
        straightLineMonthlyRent: Math.round(straightLineMonthlyRent),
        straightLineAnnualRent: Math.round(straightLineAnnualRent),
        effectiveRentRSF,
        totalCostPerRSFPerYear,
        tiAllowanceTotal: tiTotal,
        monthlyTIAmortization: Math.round(monthlyTIAmortization),
        annualTIAmortization: Math.round(monthlyTIAmortization * 12),
      }
    },
    gaap: {
      summary: {
        discountRate,
        leaseLiability,
        rouAsset,
        totalLeasePayments: Math.round(totalLeasePayments),
        tiAllowance: tiTotal,
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
    }
  }
}
