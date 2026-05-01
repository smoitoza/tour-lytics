import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// POST - extract deal terms from uploaded document text
export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Accept both naming conventions from frontend
    const documentText = body.documentText || body.text || ''
    const buildingAddress = body.buildingAddress || body.address || ''

    if (!documentText || documentText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Document text is too short or empty. Please check the uploaded file.' },
        { status: 400 }
      )
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are a commercial real estate financial analyst. Extract the key lease deal terms from this RFP (Request for Proposal), LOI (Letter of Intent), or Lease document for the property at ${buildingAddress || 'the property'}.

IMPORTANT: First determine if this document covers MULTIPLE BUILDINGS/PREMISES with different terms (different RSF, different commencement dates, different lease terms, or different rates). This is common in campus deals, multi-building LOIs, and portfolio leases.

IF THE DOCUMENT COVERS MULTIPLE BUILDINGS with different terms, return:
{
  "multi_building": true,
  "shared_terms": {
    "rent_basis": <string>,
    "base_rent_rsf": <number - annual $/RSF if same across all>,
    "annual_escalation_pct": <number>,
    "structure": <string>,
    "landlord": <string>,
    "notes": <string - shared deal notes>
  },
  "components": [
    {
      "component_label": <string - building name/address, e.g. "190 W. Tasman">,
      "rsf": <number>,
      "lease_term_months": <number>,
      "commencement_date": <string - "YYYY-MM-DD">,
      "expiration_date": <string - "YYYY-MM-DD">,
      "base_rent_rsf": <number - annual $/RSF, or null to use shared>,
      "annual_escalation_pct": <number or null to use shared>,
      "free_rent_months": <number>,
      "rent_periods": <array or null>,
      "ti_allowance_rsf": <number>,
      "ti_allowance_total": <number>,
      "parking_spots": <number>,
      "parking_rate_monthly": <number>,
      "parking_escalation_pct": <number>,
      "opex_monthly": <number>,
      "security_deposit": <number>,
      "notes": <string - building-specific notes>
    }
  ]
}

IF THE DOCUMENT COVERS A SINGLE BUILDING/PREMISES, return:
{
  "rsf": <number - rentable square feet>,
  "lease_term_months": <number - total lease term in months>,
  "commencement_date": <string - "YYYY-MM-DD" format, or estimated>,
  "expiration_date": <string - "YYYY-MM-DD" format, or estimated>,
  "base_rent_rsf": <number - base rent per RSF per YEAR (annualized), use the FIRST paid rent rate if stepped>,
  "base_rent_unit": <string - "month" or "year" - the ORIGINAL unit as quoted in the document, BEFORE you annualized it>,
  "base_rent_source_value": <number - the EXACT rent number as written in the source document, without conversion>,
  "base_rent_source_quote": <string - the exact phrase from the document that contains the base rent figure, max 200 chars>,
  "base_rent_detection_confidence": <number 0.0-1.0 - your confidence in the unit detection. Use 0.95+ when there is an explicit time qualifier ("per month", "/yr", "annually"). Use 0.70-0.85 when the unit is implied by document context (e.g. asset class, NNN/RSF shorthand). Use below 0.60 when there is no clear time qualifier and you had to guess.>,
  "rent_basis": <string - "Full Service Gross", "Modified Gross", "NNN", etc.>,
  "annual_escalation_pct": <number - annual rent escalation percentage>,
  "free_rent_months": <number - months of free/abated rent>,
  "rent_periods": <array or null - ONLY include if the lease has stepped/graduated rent OR different billable RSF per period. Each entry: {"from_month": <number>, "to_month": <number>, "rent_rsf_yr": <number - ALWAYS the ANNUAL contractual rate per RSF (multiply monthly quotes by 12)>, "is_free_rent": <boolean - set true if this period is fully abated free rent>, "billable_rsf": <number or null>, "label": <string>}. CRITICAL RULES FOR FREE RENT: When the lease has free rent at the start (e.g. months 1-12), DO NOT use rent_rsf_yr=0. Instead, set rent_rsf_yr to the CONTRACTUAL rate that would otherwise be paid in that period (typically equal to base_rent_rsf for year 1) AND set is_free_rent=true. This preserves the rate for downstream computation while marking the period as abated. CRITICAL RULE FOR ESCALATION TIMING: With free rent in months 1-12 and a base rate of $X/mo, the FIRST PAID period (months 13-24) is the START of year 2 from a contractual standpoint -- meaning the rate is $X * (1 + escalation) (one escalation step from base). Example: base $4.70/mo, 3% annual escalation, 12 months free rent. Year 1 (months 1-12): rent_rsf_yr=56.40, is_free_rent=true. Year 2 (months 13-24, first paid): rent_rsf_yr=58.09 ($4.70 * 1.03 * 12). Year 3 (months 25-36): rent_rsf_yr=59.83. NEVER make the first paid period equal base_rent_rsf when there is free rent at the start. CRITICAL COVERAGE: rent_periods MUST cover the ENTIRE lease term. The last entry's to_month MUST equal lease_term_months. Expand 'X% annual escalation' into one row per year. If a specific year has a different escalation (e.g. 'months 13 and 25 will be at 3.5% then 3% thereafter'), apply that escalation to compute that year's rate.>,
  "ti_allowance_rsf": <number - tenant improvement allowance per RSF>,
  "ti_allowance_total": <number - total TI allowance in dollars>,
  "security_deposit": <number - security deposit amount>,
  "parking_spots": <number>,
  "parking_rate_monthly": <number - per spot per month>,
  "parking_escalation_pct": <number>,
  "opex_monthly": <number - estimated monthly operational expenses if mentioned>,
  "opex_rsf_yr": <number - operating expenses per RSF per YEAR (annualized). For NNN deals usually means tax + CAM + insurance pass-through estimate.>,
  "opex_unit": <string - "month" or "year" - the ORIGINAL unit as quoted in the document, BEFORE annualization>,
  "opex_source_value": <number - the EXACT OPEX number as written in the source document>,
  "opex_source_quote": <string - exact phrase from the document mentioning OPEX, max 200 chars>,
  "opex_detection_confidence": <number 0.0-1.0 - confidence in the OPEX unit detection. Same scale as base_rent: 0.95+ explicit, 0.70-0.85 implied, below 0.60 ambiguous.>,
  "opex_periods": <array or null - ONLY include if the lease has stepped/graduated OPEX rates. Same structure as rent_periods but with opex_rsf_yr (annual rate per RSF). Each entry: {"from_month": <number>, "to_month": <number>, "opex_rsf_yr": <number - ANNUAL>, "is_free_opex": <boolean if abated>, "label": <string>}. MUST cover full lease term if used. Otherwise null.>,
  "opex_annual_escalation_pct": <number - if the lease specifies a flat annual OPEX escalator (e.g. 1% inflation, 2.5% CPI cap), put it here. Common in long-term deals. Else 0.>,
  "structure": <string - "Direct Lease", "Sublease", etc.>,
  "landlord": <string - landlord or sublandlord name>,
  "notes": <string - any other important terms, conditions, or deal points>
}

IMPORTANT:
- Return ONLY valid JSON, no markdown or explanation
- Convert all rates to annual $/RSF if given monthly (multiply monthly by 12), but ALSO record the original unit in base_rent_unit and the raw quoted number in base_rent_source_value so the user can verify.
- A rent quoted as "$7.00/RSF/month" → base_rent_rsf=84, base_rent_unit="month", base_rent_source_value=7
- A rent quoted as "$84.00/RSF/year" → base_rent_rsf=84, base_rent_unit="year", base_rent_source_value=84
- CRITICAL: rent_periods entries also use ANNUAL rates. If the schedule is quoted as $4.70/mo year 1, $4.84/mo year 2, $4.99/mo year 3, you MUST return rent_rsf_yr values of 56.40, 58.08, 59.88 (each monthly value multiplied by 12). NEVER put monthly numbers in rent_rsf_yr - downstream cash flow math treats this field as annual and will under-rent the deal by 12x if you put monthly numbers there.
- CRITICAL: rent_periods MUST span the ENTIRE lease_term_months. If the lease is 144 months (12 years) and the rent escalates annually, return 12+ entries covering months 1-12, 13-24, 25-36, ..., 133-144. The LAST entry's to_month MUST equal lease_term_months. Free rent periods at the start should also be in this array (e.g. months 1-12 with rent_rsf_yr=0). If the document gives "$4.70/RSF/mo with 3% annual escalations for 12 years", DO NOT just return 3 entries - expand the full schedule.
- Cross-check: the base_rent_rsf and the first paid rent_periods rate (de-escalated to year 1 if needed) should match within rounding. If they don't, you have a unit error.
- Verify before returning: sum the (to_month - from_month + 1) values across all rent_periods entries. The sum MUST equal lease_term_months. If it doesn't, your schedule is incomplete - add the missing periods.
- Verify before returning: confirm the LAST entry's to_month equals lease_term_months. If it doesn't, extend the last period to lease_term_months.
- For ambiguous cases (no explicit time qualifier), default to "year" for office deals (industry standard), default to "month" for industrial/flex deals, and set base_rent_detection_confidence below 0.65 so the user is prompted to confirm.
- OPEX unit detection follows the same rules as base rent. "$0.50/RSF/month NNN" -> opex_rsf_yr=6, opex_unit="month", opex_source_value=0.50. "$18/RSF/year" -> opex_rsf_yr=18, opex_unit="year", opex_source_value=18. opex_monthly should still be filled for backward compat (= opex_rsf_yr * RSF / 12).
- If the document mentions a CPI/inflation cap on OPEX (e.g. "OPEX increases capped at 3% per year"), set opex_annual_escalation_pct to that cap value as a planning assumption. Don't invent escalation if the document doesn't mention one - use 0.
- If a lease term is given in years, convert to months
- If TI is given as $/RSF, also calculate the total (RSF x TI/RSF)
- For dates, estimate if only month/year is given (use the 1st of the month)
- If the document specifies different rent rates for different periods, include them in rent_periods
- If the lease has phased/ramping billable RSF, include billable_rsf in each rent_periods entry. The top-level RSF should be the FULL premises size.
- For multi-building deals: each component should have its OWN commencement date, term, and RSF. Shared terms (rate, landlord, structure) go in shared_terms. Component-specific overrides take priority.
- Use null for any field you cannot find

DOCUMENT TEXT:
${documentText.substring(0, 15000)}`
        }
      ]
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Try to extract JSON from the response
    let dealTerms
    try {
      // Handle case where response might have markdown code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        dealTerms = JSON.parse(jsonMatch[0])
      } else {
        dealTerms = JSON.parse(responseText)
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Failed to parse extracted terms. Please try again or enter terms manually.', raw: responseText },
        { status: 422 }
      )
    }

    // Check if multi-building response
    if (dealTerms.multi_building && dealTerms.components && Array.isArray(dealTerms.components)) {
      // Clean up each component
      const shared = dealTerms.shared_terms || {}
      dealTerms.components.forEach((comp: any) => {
        // Merge shared terms into component (component overrides take priority)
        Object.keys(shared).forEach(key => {
          if (comp[key] === undefined || comp[key] === null) {
            comp[key] = shared[key]
          }
        })
        // Clean nulls
        cleanNulls(comp)
      })
      return NextResponse.json({ dealTerms, multi_building: true, raw: responseText })
    }

    // Single building - clean up null values
    cleanNulls(dealTerms)

    return NextResponse.json({ dealTerms, raw: responseText })
  } catch (error: any) {
    console.error('RFP extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract deal terms' },
      { status: 500 }
    )
  }
}

function cleanNulls(obj: any) {
  const numericFields = ['rsf', 'lease_term_months', 'base_rent_rsf', 'annual_escalation_pct', 'free_rent_months', 'ti_allowance_rsf', 'ti_allowance_total', 'security_deposit', 'parking_spots', 'parking_rate_monthly', 'parking_escalation_pct', 'opex_monthly', 'opex_rsf_yr', 'opex_source_value', 'opex_detection_confidence', 'opex_annual_escalation_pct', 'base_rent_source_value', 'base_rent_detection_confidence']
  Object.keys(obj).forEach(key => {
    if (obj[key] === null || obj[key] === 'null') {
      if (numericFields.includes(key)) {
        obj[key] = 0
      } else {
        obj[key] = ''
      }
    }
  })
  // Apply rent-unit validation heuristic.
  // If the LLM returned an annualized rent outside the $5-$300/RSF/yr band,
  // it's likely a unit-detection error. Flag by dropping confidence so the UI prompts the user.
  const annualRent = Number(obj.base_rent_rsf) || 0
  if (annualRent > 0 && (annualRent < 5 || annualRent > 300)) {
    const currentConfidence = Number(obj.base_rent_detection_confidence) || 0.5
    obj.base_rent_detection_confidence = Math.min(currentConfidence, 0.4)
    obj.base_rent_unit_warning = `Annualized rent of $${annualRent.toFixed(2)}/RSF/yr is outside typical bands ($5-$300). Verify the per-month vs per-year unit.`
  }

  // Cross-check rent_periods schedule rates against base_rent_rsf.
  // If the LLM correctly annualized base_rent_rsf but left rent_periods rates
  // as monthly numbers, we'll see a ~12x mismatch. Auto-fix by multiplying
  // schedule rates by 12, since base_rent_rsf is the more reliable signal
  // (it has the explicit "convert to annual" instruction in the prompt).
  if (annualRent > 0 && Array.isArray(obj.rent_periods) && obj.rent_periods.length > 0) {
    const periods = obj.rent_periods as any[]
    // Skip is_free_rent periods - they may have synthesized rates that don't reflect raw extraction
    const firstPaid = periods.find(p => !p.is_free_rent && Number(p.rent_rsf_yr) > 0)
    if (firstPaid) {
      const firstPaidRate = Number(firstPaid.rent_rsf_yr)
      const escalation = Number(obj.annual_escalation_pct || 0) / 100
      // De-escalate first paid period back to year 1 to compare apples-to-apples
      const paidYear = Math.ceil(Number(firstPaid.from_month || 1) / 12)
      const yearsBack = Math.max(0, paidYear - 1)
      const deEscalated = escalation > 0
        ? firstPaidRate / Math.pow(1 + escalation, yearsBack)
        : firstPaidRate
      const ratio = annualRent / deEscalated
      // If base_rent_rsf is roughly 12x the schedule rate, schedule is monthly - fix it
      if (ratio > 8 && ratio < 16) {
        periods.forEach(p => {
          if (Number(p.rent_rsf_yr) > 0 && !p.is_free_rent) {
            p.rent_rsf_yr = Math.round(Number(p.rent_rsf_yr) * 12 * 100) / 100
          }
        })
        obj.rent_periods = periods
        obj.rent_periods_unit_corrected = true
      }
    }
  }

  // Free-rent normalization: if a period has rent_rsf_yr=0 (legacy convention),
  // promote it to is_free_rent=true and fill in a contractual rate.
  // This ensures Esc % calculations and review form rate display always have real numbers.
  if (annualRent > 0 && Array.isArray(obj.rent_periods) && obj.rent_periods.length > 0) {
    const periods = obj.rent_periods as any[]
    const sortedAsc = [...periods].sort((a, b) => Number(a.from_month) - Number(b.from_month))
    const escalation = Number(obj.annual_escalation_pct || 0) / 100
    sortedAsc.forEach((p) => {
      if (Number(p.rent_rsf_yr) === 0 && !p.is_free_rent) {
        p.is_free_rent = true
        // Fill the contractual rate. Year 1 free rent gets base_rent_rsf.
        // Free rent in later years gets base * (1 + esc)^(year-1).
        const periodYear = Math.ceil(Number(p.from_month || 1) / 12)
        const yearsFromBase = Math.max(0, periodYear - 1)
        p.rent_rsf_yr = Math.round(annualRent * Math.pow(1 + escalation, yearsFromBase) * 100) / 100
      }
    })
    obj.rent_periods = sortedAsc
  }

  // Alignment check (revised for free-rent model):
  //   - If the schedule has a free-rent period followed by paid periods, the FIRST PAID
  //     period's rate should equal base_rent_rsf * (1 + escalation)^(yearsFromBase).
  //   - If the schedule has NO free-rent period, the first paid period's rate should equal base_rent_rsf.
  // If the actual first paid rate is one escalation step off the expected, fix it.
  if (annualRent > 0 && Array.isArray(obj.rent_periods) && obj.rent_periods.length > 0) {
    const periods = obj.rent_periods as any[]
    const sortedAsc = [...periods].sort((a, b) => Number(a.from_month) - Number(b.from_month))
    const firstPaid = sortedAsc.find(p => !p.is_free_rent && Number(p.rent_rsf_yr) > 0)
    if (firstPaid) {
      const escalation = Number(obj.annual_escalation_pct || 0) / 100
      const firstPaidRate = Number(firstPaid.rent_rsf_yr)
      if (escalation > 0) {
        // What year does the first paid period start in?
        const paidYear = Math.ceil(Number(firstPaid.from_month || 1) / 12)
        const yearsFromBase = Math.max(0, paidYear - 1)
        const expectedRate = annualRent * Math.pow(1 + escalation, yearsFromBase)
        const offByOneHigh = annualRent * Math.pow(1 + escalation, yearsFromBase + 1)
        const offByOneLow = annualRent * Math.pow(1 + escalation, Math.max(0, yearsFromBase - 1))
        const distExpected = Math.abs(firstPaidRate - expectedRate) / expectedRate
        const distHigh = Math.abs(firstPaidRate - offByOneHigh) / offByOneHigh
        const distLow = Math.abs(firstPaidRate - offByOneLow) / offByOneLow
        // If the rate is closer to off-by-one than to expected, correct.
        if (distExpected > 0.005 && distHigh < 0.005) {
          // One escalation too high - de-escalate all paid rates
          periods.forEach(p => {
            const r = Number(p.rent_rsf_yr)
            if (r > 0 && !p.is_free_rent) p.rent_rsf_yr = Math.round((r / (1 + escalation)) * 100) / 100
          })
          obj.rent_periods = periods
          obj.rent_periods_alignment_corrected = true
        } else if (distExpected > 0.005 && distLow < 0.005 && yearsFromBase > 0) {
          // One escalation too low - escalate all paid rates
          periods.forEach(p => {
            const r = Number(p.rent_rsf_yr)
            if (r > 0 && !p.is_free_rent) p.rent_rsf_yr = Math.round(r * (1 + escalation) * 100) / 100
          })
          obj.rent_periods = periods
          obj.rent_periods_alignment_corrected = true
        }
      }
    }
  }

  // Auto-extend rent_periods to cover the full lease term.
  // If the LLM only gave the first few periods, fill out the rest by escalating
  // the last paid rate forward at annual_escalation_pct.
  const termMonths = Number(obj.lease_term_months) || 0
  if (termMonths > 0 && Array.isArray(obj.rent_periods) && obj.rent_periods.length > 0) {
    const periods = obj.rent_periods as any[]
    // Sort by from_month so we work in order
    periods.sort((a, b) => Number(a.from_month) - Number(b.from_month))
    const lastPeriod = periods[periods.length - 1]
    const lastTo = Number(lastPeriod.to_month) || 0

    if (lastTo > 0 && lastTo < termMonths) {
      // Find the most recent paid rate to escalate forward
      let lastPaidRate = 0
      for (let i = periods.length - 1; i >= 0; i--) {
        const r = Number(periods[i].rent_rsf_yr)
        if (r > 0) { lastPaidRate = r; break }
      }
      const escalation = Number(obj.annual_escalation_pct || 0) / 100

      // Fill 12-month chunks from lastTo+1 onward.
      // Use UN-rounded internal arithmetic to avoid drift across many years.
      let chunkStart = lastTo + 1
      let currentRateFloat = lastPaidRate
      while (chunkStart <= termMonths) {
        // Apply one escalation step per new 12-month chunk
        if (escalation > 0 && currentRateFloat > 0) {
          currentRateFloat = currentRateFloat * (1 + escalation)
        }
        const chunkEnd = Math.min(chunkStart + 11, termMonths)
        periods.push({
          from_month: chunkStart,
          to_month: chunkEnd,
          rent_rsf_yr: Math.round(currentRateFloat * 100) / 100,
          label: 'Auto-extended'
        })
        chunkStart = chunkEnd + 1
      }
      obj.rent_periods = periods
      obj.rent_periods_auto_extended = true
    }
  }
}
