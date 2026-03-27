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
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are a commercial real estate financial analyst. Extract the key lease deal terms from this RFP (Request for Proposal) or LOI (Letter of Intent) document for the building at ${buildingAddress || 'the property'}.

Return a JSON object with these fields (use null for any field you cannot find):

{
  "rsf": <number - rentable square feet>,
  "lease_term_months": <number - total lease term in months>,
  "commencement_date": <string - "YYYY-MM-DD" format, or estimated>,
  "expiration_date": <string - "YYYY-MM-DD" format, or estimated>,
  "base_rent_rsf": <number - base rent per RSF per year, use the FIRST paid rent rate if stepped>,
  "rent_basis": <string - "Full Service Gross", "Modified Gross", "NNN", etc.>,
  "annual_escalation_pct": <number - annual rent escalation percentage>,
  "free_rent_months": <number - months of free/abated rent>,
  "rent_periods": <array or null - ONLY include if the lease has different base rent rates for different time periods (stepped/graduated rent). Each entry: {"from_month": <number>, "to_month": <number>, "rent_rsf_yr": <number - annual rate per RSF>, "label": <string - short description>}. Use rent_rsf_yr=0 for free rent periods. Do NOT include this field if rent is a single flat rate with standard annual escalation.>,
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
- Convert all rates to annual $/RSF if given monthly
- If a lease term is given in years, convert to months
- If TI is given as $/RSF, also calculate the total (RSF x TI/RSF)
- If rent is given monthly, convert to annual $/RSF
- For dates, estimate if only month/year is given (use the 1st of the month)
- If the document specifies different rent rates for different periods (e.g. months 1-12 at $0, months 13-24 at $16.83/RSF/yr), include them in rent_periods. After the last defined period, the annual_escalation_pct applies automatically.
- Do NOT use rent_periods for simple deals with one flat rate + escalation. Only use it for genuinely stepped/graduated rent structures.

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

    // Clean up null values
    Object.keys(dealTerms).forEach(key => {
      if (dealTerms[key] === null || dealTerms[key] === 'null') {
        if (['rsf', 'lease_term_months', 'base_rent_rsf', 'annual_escalation_pct', 'free_rent_months', 'ti_allowance_rsf', 'ti_allowance_total', 'security_deposit', 'parking_spots', 'parking_rate_monthly', 'parking_escalation_pct', 'opex_monthly'].includes(key)) {
          dealTerms[key] = 0
        } else {
          dealTerms[key] = ''
        }
      }
    })

    return NextResponse.json({ dealTerms, raw: responseText })
  } catch (error: any) {
    console.error('RFP extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract deal terms' },
      { status: 500 }
    )
  }
}
