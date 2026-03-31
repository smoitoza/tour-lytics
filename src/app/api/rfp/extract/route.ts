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
  "base_rent_rsf": <number - base rent per RSF per year, use the FIRST paid rent rate if stepped>,
  "rent_basis": <string - "Full Service Gross", "Modified Gross", "NNN", etc.>,
  "annual_escalation_pct": <number - annual rent escalation percentage>,
  "free_rent_months": <number - months of free/abated rent>,
  "rent_periods": <array or null - ONLY include if the lease has different base rent rates for different time periods (stepped/graduated rent) OR different billable square footage per period (phased RSF). Each entry: {"from_month": <number>, "to_month": <number>, "rent_rsf_yr": <number - annual rate per RSF>, "billable_rsf": <number or null>, "label": <string>}. Use rent_rsf_yr=0 for free rent periods.>,
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
- Convert all rates to annual $/RSF if given monthly (multiply monthly by 12)
- If a lease term is given in years, convert to months
- If TI is given as $/RSF, also calculate the total (RSF x TI/RSF)
- If rent is given monthly, convert to annual $/RSF
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
  const numericFields = ['rsf', 'lease_term_months', 'base_rent_rsf', 'annual_escalation_pct', 'free_rent_months', 'ti_allowance_rsf', 'ti_allowance_total', 'security_deposit', 'parking_spots', 'parking_rate_monthly', 'parking_escalation_pct', 'opex_monthly']
  Object.keys(obj).forEach(key => {
    if (obj[key] === null || obj[key] === 'null') {
      if (numericFields.includes(key)) {
        obj[key] = 0
      } else {
        obj[key] = ''
      }
    }
  })
}
