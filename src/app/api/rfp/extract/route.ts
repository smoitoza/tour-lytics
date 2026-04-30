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
  "rent_periods": <array or null - ONLY include if the lease has different base rent rates for different time periods (stepped/graduated rent) OR different billable square footage per period (phased RSF). Each entry: {"from_month": <number>, "to_month": <number>, "rent_rsf_yr": <number - ALWAYS the ANNUAL rate per RSF, even if the source quotes it monthly. If a stepped schedule is quoted as $4.70/mo escalating 3%, return rent_rsf_yr values of 56.40, 58.09, 59.83 (annualized).>, "billable_rsf": <number or null>, "label": <string>}. Use rent_rsf_yr=0 for free rent periods. CRITICAL: rent_periods MUST cover the ENTIRE lease term from month 1 to lease_term_months. The to_month of the last entry MUST equal lease_term_months. If the document only specifies escalation rules ("3% annual escalation") rather than itemized rates per year, you MUST still expand them out into one entry per escalation period for the full term. For a 144-month lease with year-1 rate $X and 3% annual escalations, return 12 entries (one per year) with appropriately escalated rates.>,
  "ti_allowance_rsf": <number - tenant improvement allowance per RSF>,
  "ti_allowance_total": <number - total TI allowance in dollars>,
  "security_deposit": <number - security deposit amount>,
  "parking_spots": <number>,
  "parking_rate_monthly": <number - per spot per month>,
  "parking_escalation_pct": <number>,
  "opex_monthly": <number - estimated monthly operational expenses if mentioned>,
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
  const numericFields = ['rsf', 'lease_term_months', 'base_rent_rsf', 'annual_escalation_pct', 'free_rent_months', 'ti_allowance_rsf', 'ti_allowance_total', 'security_deposit', 'parking_spots', 'parking_rate_monthly', 'parking_escalation_pct', 'opex_monthly', 'base_rent_source_value', 'base_rent_detection_confidence']
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
    const firstPaid = periods.find(p => Number(p.rent_rsf_yr) > 0)
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
          if (Number(p.rent_rsf_yr) > 0) {
            p.rent_rsf_yr = Math.round(Number(p.rent_rsf_yr) * 12 * 100) / 100
          }
        })
        obj.rent_periods = periods
        obj.rent_periods_unit_corrected = true
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

      // Fill 12-month chunks from lastTo+1 onward
      let chunkStart = lastTo + 1
      let currentRate = lastPaidRate
      while (chunkStart <= termMonths) {
        // Apply escalation if this chunk crosses an anniversary
        // Each new 12-month chunk gets one escalation step
        if (escalation > 0 && currentRate > 0) {
          currentRate = Math.round(currentRate * (1 + escalation) * 100) / 100
        }
        const chunkEnd = Math.min(chunkStart + 11, termMonths)
        periods.push({
          from_month: chunkStart,
          to_month: chunkEnd,
          rent_rsf_yr: currentRate,
          label: 'Auto-extended'
        })
        chunkStart = chunkEnd + 1
      }
      obj.rent_periods = periods
      obj.rent_periods_auto_extended = true
    }
  }
}
