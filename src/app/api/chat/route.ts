import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { debitTokens } from '@/lib/tokens'

// Allow up to 60s for AI chat responses (default 10s can timeout on complex queries)
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============================================================
// Project-scoped data fetchers
// Every function takes projectId so each chatbot is fully isolated
// ============================================================

// Fetch project metadata (name, market) for system prompt context
async function getProjectMeta(projectId: string): Promise<{ name: string; market: string }> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('name, market')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      return { name: projectId, market: '' }
    }
    return { name: data.name || projectId, market: data.market || '' }
  } catch (e) {
    return { name: projectId, market: '' }
  }
}

// Fetch survey buildings for this project (replaces static building_context.json)
async function getBuildingContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('survey_buildings')
      .select('*')
      .eq('project_id', projectId)
      .order('num', { ascending: true })

    if (error || !data || data.length === 0) {
      return ''
    }

    let context = '\nSURVEY BUILDINGS (properties in this project):\n'
    data.forEach((b: any) => {
      context += `\n#${b.num} - ${b.address}:\n`
      if (b.neighborhood) context += `  Neighborhood: ${b.neighborhood}\n`
      if (b.owner) context += `  Owner: ${b.owner}\n`
      if (b.year_built_class) context += `  Year Built / Class: ${b.year_built_class}\n`
      if (b.building_sf) context += `  Building SF: ${b.building_sf}\n`
      if (b.stories) context += `  Stories: ${b.stories}\n`
      if (b.space_available) context += `  Space Available: ${b.space_available}\n`
      if (b.rental_rate) context += `  Rental Rate: ${b.rental_rate}\n`
      if (b.direct_sublease) context += `  Direct/Sublease: ${b.direct_sublease}\n`
      if (b.floors && b.floors.length > 0) {
        context += '  Available Floors:\n'
        b.floors.forEach((f: any) => {
          const parts = [f.floor, f.suite, f.rsf, f.available, f.rentalRate].filter(Boolean)
          context += `    - ${parts.join(' | ')}\n`
        })
      }
    })
    return context
  } catch (e) {
    console.error('Failed to fetch building context:', e)
    return ''
  }
}

// Fetch live RFP/financial submissions for this project
async function getRFPContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('rfp_submissions')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'archived')
      .order('submitted_at', { ascending: false })

    if (error || !data || data.length === 0) {
      return ''
    }

    let context = '\n\nLIVE RFP/LOI FINANCIAL SUBMISSIONS (from the Financials tab - these are REAL uploaded proposals with AI-generated analysis):\n'
    context += 'These are the current financial submissions. Use this data when answering any questions about deal terms, rent, straight-line expense, cash flow, GAAP, or P&L.\n\n'

    data.forEach(sub => {
      const terms = sub.deal_terms || {}
      const analysis = sub.analysis || {}
      const summary = analysis.summary || {}
      const slTotals = analysis.straight_line_pl?.totals || {}
      const gaapSummary = analysis.gaap?.summary || {}

      context += `--- ${sub.building_address || 'Unknown'} (${(sub.doc_type || '').toUpperCase()}) ---\n`
      if (sub.component_label) context += `  Component: ${sub.component_label} (part of a multi-component deal at this address)\n`
      if (sub.version_label) context += `  Version: ${sub.version_label}\n`
      context += `  Submitted: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Unknown'}\n`
      if (sub.doc_source) context += `  Source: ${sub.doc_source}\n`

      context += '  Deal Terms:\n'
      if (terms.rsf) context += `    RSF: ${terms.rsf.toLocaleString()}\n`
      if (terms.lease_term_months) context += `    Lease Term: ${terms.lease_term_months} months\n`
      if (terms.commencement_date) context += `    Commencement: ${terms.commencement_date}\n`
      const rentPeriods = terms.rent_periods || terms.rentPeriods
      if (rentPeriods && Array.isArray(rentPeriods) && rentPeriods.length > 0) {
        context += `    Rent Schedule: Stepped/Graduated\n`
        rentPeriods.forEach((p: any) => {
          const label = p.label ? ` (${p.label})` : ''
          const rate = p.rent_rsf_yr === 0 ? 'No Base Rent' : `$${p.rent_rsf_yr}/RSF/yr`
          const billable = p.billable_rsf ? ` [${p.billable_rsf.toLocaleString()} billable RSF]` : ''
          context += `      Months ${p.from_month}-${p.to_month}: ${rate}${billable}${label}\n`
        })
      } else if (terms.base_rent_rsf) {
        context += `    Base Rent: $${terms.base_rent_rsf}/RSF/yr\n`
      }
      if (terms.rent_basis) context += `    Rent Basis: ${terms.rent_basis}\n`
      if (terms.annual_escalation_pct) context += `    Annual Escalation: ${terms.annual_escalation_pct}%\n`
      if (!rentPeriods && terms.free_rent_months) context += `    Free Rent: ${terms.free_rent_months} months\n`
      if (terms.ti_allowance_rsf) context += `    TI Allowance: $${terms.ti_allowance_rsf}/RSF\n`
      if (terms.ti_allowance_total) context += `    TI Allowance Total: $${terms.ti_allowance_total.toLocaleString()}\n`
      if (terms.opex_monthly) context += `    OpEx (monthly): $${terms.opex_monthly.toLocaleString()}\n`
      if (terms.parking_spots) context += `    Parking: ${terms.parking_spots} spots at $${terms.parking_rate_monthly || 0}/spot/mo\n`
      if (terms.structure) context += `    Structure: ${terms.structure}\n`
      if (terms.landlord) context += `    Landlord: ${terms.landlord}\n`
      if (terms.notes) context += `    Notes: ${terms.notes}\n`

      if (summary.rsf) {
        context += '  Analysis Summary:\n'
        context += `    Effective Rent/RSF: $${summary.effectiveRentRSF}/yr\n`
        context += `    Total All-In Cost: $${summary.totalAllInCost?.toLocaleString()}\n`
        context += `    SL Monthly Rent (net of TI): $${slTotals.straightLineMonthlyRent?.toLocaleString()}\n`
        context += `    SL Annual Rent (net of TI): $${slTotals.straightLineAnnualRent?.toLocaleString()}\n`
        context += `    SL Annual Expense (incl OpEx): $${summary.straightLineAnnualExpense?.toLocaleString()}\n`
        context += `    Free Rent Value: $${summary.freeRentValue?.toLocaleString()}\n`
        if (summary.tiValue) context += `    TI Allowance Value: $${summary.tiValue.toLocaleString()}\n`
        context += `    Total Concessions: $${summary.totalConcessions?.toLocaleString()}\n`
        if (slTotals.tiAllowanceTotal) context += `    Monthly TI Amortization: $${slTotals.monthlyTIAmortization?.toLocaleString()}/mo (reduces SL expense)\n`
      }

      if (gaapSummary.leaseLiability) {
        context += '  GAAP / ASC 842:\n'
        context += `    Lease Liability (Day 1): $${gaapSummary.leaseLiability?.toLocaleString()}\n`
        context += `    ROU Asset (Day 1): $${gaapSummary.rouAsset?.toLocaleString()}\n`
        context += `    Discount Rate: ${(gaapSummary.discountRate * 100)}%\n`
        if (gaapSummary.tiAllowance) context += `    TI Offset on ROU: $${gaapSummary.tiAllowance.toLocaleString()}\n`
      }

      context += '\n'
    })

    return context
  } catch (e) {
    console.error('Failed to fetch RFP context:', e)
    return ''
  }
}

// Fetch team members for this project
async function getTeamContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      return ''
    }

    let context = '\n\nTEAM MEMBERS (people involved in this office search project):\n'
    const byPersona: Record<string, typeof data> = {}
    data.forEach(m => {
      const p = m.persona || 'unknown'
      if (!byPersona[p]) byPersona[p] = []
      byPersona[p].push(m)
    })

    const personaLabels: Record<string, string> = {
      admin: 'Admin (project lead/decision maker)',
      broker: 'Broker (real estate broker/advisor)',
      cre_team: 'CRE Team (corporate real estate team)',
      touree: 'Touree (tour participant/evaluator)',
    }

    for (const [persona, members] of Object.entries(byPersona)) {
      context += `\n${personaLabels[persona] || persona} (${members.length}):\n`
      members.forEach(m => {
        const name = m.display_name || m.email
        context += `  - ${name} (${m.email})${m.added_by ? ' - invited by ' + m.added_by : ''}\n`
      })
    }

    context += `\nTotal team size: ${data.length} members\n`
    return context
  } catch (e) {
    console.error('Failed to fetch team context:', e)
    return ''
  }
}

// Fetch commute study data for this project
async function getCommuteContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('commute_studies')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error || !data) {
      return ''
    }

    const employees = data.employees || []
    const results = data.results || {}
    const headers = data.headers || []

    if (employees.length === 0) {
      return ''
    }

    let context = '\n\nCOMMUTE STUDY DATA (employee commute analysis to potential office locations):\n'
    context += `File: ${data.filename || 'Unknown'} | ${employees.length} employees analyzed\n`
    if (data.uploaded_by) context += `Uploaded by: ${data.uploaded_by}\n`

    const summaries = results.summaries || []
    const details = results.details || []

    const detailMap: Record<string, any> = {}
    details.forEach((d: any) => { if (d.employee) detailMap[d.employee] = d })
    const buildingOrder = summaries.map((s: any) => s.building)

    if (summaries.length > 0) {
      context += '\nCommute Results by Building (all employees):\n'
      for (const s of summaries) {
        const avgDriveMin = s.driving_avg_seconds ? Math.round(s.driving_avg_seconds / 60) : null
        const avgTransitMin = s.transit_avg_seconds ? Math.round(s.transit_avg_seconds / 60) : null

        context += `\n  ${s.building || 'Unknown'}:\n`
        if (avgDriveMin != null) context += `    Avg Drive: ${avgDriveMin} min (${s.driving_avg_distance_text || ''})\n`
        if (avgTransitMin != null) context += `    Avg Transit: ${avgTransitMin} min\n`

        let under30drive = 0, under45transit = 0, under60transit = 0
        details.forEach((d: any) => {
          const c = d.commutes?.find((x: any) => x.building === s.building)
          if (c?.driving?.duration_seconds && c.driving.duration_seconds <= 1800) under30drive++
          if (c?.transit?.duration_seconds && c.transit.duration_seconds <= 2700) under45transit++
          if (c?.transit?.duration_seconds && c.transit.duration_seconds <= 3600) under60transit++
        })
        context += `    Within 30 min drive: ${under30drive} of ${employees.length} (${Math.round(under30drive / employees.length * 100)}%)\n`
        context += `    Within 45 min transit: ${under45transit} of ${employees.length} (${Math.round(under45transit / employees.length * 100)}%)\n`
        context += `    Within 60 min transit: ${under60transit} of ${employees.length} (${Math.round(under60transit / employees.length * 100)}%)\n`
      }
    }

    const latCol = data.lat_col ?? 0
    const lngCol = data.lng_col ?? 1
    const metaCols = headers.filter((_: string, i: number) => i !== latCol && i !== lngCol)

    const groupableCols: { col: string; values: string[] }[] = []
    for (const col of metaCols) {
      const vals: Record<string, boolean> = {}
      employees.forEach((emp: any) => {
        const v = (emp.meta?.[col] || '').trim()
        if (v) vals[v] = true
      })
      const uniqueVals = Object.keys(vals)
      if (uniqueVals.length >= 2 && uniqueVals.length <= 30) {
        groupableCols.push({ col, values: uniqueVals.sort() })
      }
    }

    if (groupableCols.length > 0 && details.length > 0) {
      for (const gc of groupableCols) {
        context += `\nCommute Breakdown by ${gc.col}:\n`

        const groups: Record<string, string[]> = {}
        employees.forEach((emp: any) => {
          const key = (emp.meta?.[gc.col] || 'Unknown').trim()
          if (!groups[key]) groups[key] = []
          groups[key].push(emp.name)
        })

        for (const [groupName, empNames] of Object.entries(groups).sort()) {
          context += `\n  ${groupName} (${empNames.length} employees):\n`

          for (const bldName of buildingOrder) {
            let totalDriveSec = 0, driveCount = 0
            let totalTransitSec = 0, transitCount = 0

            for (const eName of empNames) {
              const detail = detailMap[eName]
              if (!detail?.commutes) continue
              const c = detail.commutes.find((x: any) => x.building === bldName)
              if (c?.driving?.duration_seconds) {
                totalDriveSec += c.driving.duration_seconds
                driveCount++
              }
              if (c?.transit?.duration_seconds) {
                totalTransitSec += c.transit.duration_seconds
                transitCount++
              }
            }

            const avgDrive = driveCount > 0 ? Math.round(totalDriveSec / driveCount / 60) : null
            const avgTransit = transitCount > 0 ? Math.round(totalTransitSec / transitCount / 60) : null
            const parts: string[] = []
            if (avgDrive != null) parts.push(`Avg Drive: ${avgDrive} min`)
            if (avgTransit != null) parts.push(`Avg Transit: ${avgTransit} min`)
            if (parts.length > 0) {
              context += `    ${bldName}: ${parts.join(', ')}\n`
            }
          }
        }
      }
    }

    if (employees.length > 50) {
      context += `\n${employees.length} employees in commute study.\n`
      for (const gc of groupableCols) {
        context += `  ${gc.col} values: ${gc.values.join(', ')}\n`
      }
    }

    return context
  } catch (e) {
    console.error('Failed to fetch commute context:', e)
    return ''
  }
}

// Fetch project assumptions for this project (per-building)
async function getAssumptionsContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('project_assumptions')
      .select('*')
      .eq('project_id', projectId)
      .order('building_address', { ascending: true })

    if (error || !data || data.length === 0) {
      return ''
    }

    let context = '\n\nPROJECT ASSUMPTIONS (per-building internal cost modeling from the Assumptions tab):\n'
    context += 'Each building can have its own internal operating expense assumptions. These are SEPARATE from the RFP deal terms.\n'

    for (const row of data) {
      const fb = parseFloat(row.opex_food_beverage) || 0
      const wpe = parseFloat(row.opex_workplace_experience) || 0
      const maint = parseFloat(row.opex_maintenance_security) || 0
      const customItems = row.opex_custom_items || []
      let customTotal = 0
      customItems.forEach((item: { label?: string; monthly?: number }) => {
        customTotal += parseFloat(String(item.monthly)) || 0
      })
      const totalMonthlyOpex = fb + wpe + maint + customTotal
      const headcount = parseInt(row.headcount) || 0
      const densityRSF = parseInt(row.target_density_rsf) || 0
      const discountRate = parseFloat(row.discount_rate) || 6.0

      // CAPEX
      const capexConstruction = parseFloat(row.capex_construction_total) || 0
      const capexFFE = parseFloat(row.capex_ffe_total) || 0
      const capexIT = parseFloat(row.capex_it_total) || 0
      const totalCapex = capexConstruction + capexFFE + capexIT

      // Broker Fee
      const brokerFeeType = row.broker_fee_type || 'none'
      const brokerFeeAmount = parseFloat(row.broker_fee_amount) || 0
      const brokerFeeNotes = row.broker_fee_notes || ''

      if (totalMonthlyOpex === 0 && headcount === 0 && discountRate === 6.0 && totalCapex === 0 && (brokerFeeType === 'none' || brokerFeeAmount === 0)) {
        continue
      }

      const compLabel = row.component_label ? ` [${row.component_label}]` : ''
      context += `\n--- ${row.building_address || 'Unknown Building'}${compLabel} Assumptions ---\n`

      if (totalMonthlyOpex > 0) {
        context += '  Internal OpEx (Monthly):\n'
        if (fb > 0) context += `    Food & Beverage: $${fb.toLocaleString()}/mo\n`
        if (wpe > 0) context += `    Workplace Experience: $${wpe.toLocaleString()}/mo\n`
        if (maint > 0) context += `    Maintenance & Security: $${maint.toLocaleString()}/mo\n`
        customItems.forEach((item: { label?: string; monthly?: number }) => {
          const amt = parseFloat(String(item.monthly)) || 0
          if (amt > 0 && item.label) {
            context += `    ${item.label}: $${amt.toLocaleString()}/mo\n`
          }
        })
        context += `    Total Internal OpEx: $${totalMonthlyOpex.toLocaleString()}/mo ($${(totalMonthlyOpex * 12).toLocaleString()}/yr)\n`
      }

      if (totalCapex > 0) {
        context += '  CAPEX (Tenant-Funded):\n'
        if (capexConstruction > 0) context += `    Construction / Build-Out: $${capexConstruction.toLocaleString()}\n`
        if (capexFFE > 0) context += `    FF&E: $${capexFFE.toLocaleString()}\n`
        if (capexIT > 0) context += `    IT / Technology: $${capexIT.toLocaleString()}\n`
        context += `    Total CAPEX: $${totalCapex.toLocaleString()}\n`
      }

      if (brokerFeeType !== 'none' && brokerFeeAmount > 0) {
        const feeTypeLabel = brokerFeeType === 'expense' ? 'Expense (Initial Direct Cost)' : 'Credit (Lease Incentive)'
        context += `  Broker Fee: $${brokerFeeAmount.toLocaleString()} - ${feeTypeLabel}\n`
        if (brokerFeeNotes) context += `    Notes: ${brokerFeeNotes}\n`
      }

      if (headcount > 0) {
        context += `  Headcount: ${headcount} employees\n`
        if (densityRSF > 0) context += `  Target Density: ${densityRSF} RSF/person\n`
      }

      if (discountRate !== 6.0) {
        context += `  GAAP Discount Rate / IBR: ${discountRate}%\n`
      }

      if (row.updated_by) {
        context += `  Last updated by: ${row.updated_by}\n`
      }
    }

    return context
  } catch (e) {
    console.error('Failed to fetch assumptions context:', e)
    return ''
  }
}

// Fetch current office locations for this project
async function getOfficeContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('project_offices')
      .select('label, address, lat, lng')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) return ''

    let ctx = '\n\n[CURRENT OFFICE LOCATIONS]\n'
    ctx += 'The company\'s current office locations are:\n'
    data.forEach((o, i) => {
      ctx += `${i + 1}. ${o.label || 'Office'}: ${o.address}`
      if (o.lat && o.lng) ctx += ` (${o.lat.toFixed(4)}, ${o.lng.toFixed(4)})`
      ctx += '\n'
    })
    ctx += 'These are shown as gold star markers on the map. Use these locations when the user asks about their current office, HQ, or wants directions/comparisons from their current location.\n'
    return ctx
  } catch {
    return ''
  }
}

// Fetch photo descriptions for this project
async function getPhotoContext(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('building_photos')
      .select('building_name, building_address, area_tag, ai_description, ai_tags, ai_area_suggestion, uploaded_by, created_at, file_url, ai_analyzed_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !data || data.length === 0) {
      return ''
    }

    const byBuilding: Record<string, typeof data> = {}
    data.forEach(p => {
      const key = p.building_name
      if (!byBuilding[key]) byBuilding[key] = []
      byBuilding[key].push(p)
    })

    let context = '\n\nTOUR PHOTOS (photos taken during building tours):\n'
    for (const [building, photos] of Object.entries(byBuilding)) {
      const analyzed = photos.filter(p => p.ai_analyzed_at)
      const pending = photos.filter(p => !p.ai_analyzed_at)
      context += `\n${building} (${photos.length} photos${pending.length > 0 ? `, ${pending.length} pending AI analysis` : ''}):\n`
      photos.forEach(p => {
        const area = p.ai_area_suggestion || p.area_tag || 'general'
        if (p.ai_description) {
          const tags = p.ai_tags?.join(', ') || ''
          context += `  - [${area}] ${p.ai_description}${tags ? ' (tags: ' + tags + ')' : ''} | image: ${p.file_url}\n`
        } else {
          context += `  - [${area}] (photo not yet analyzed) | image: ${p.file_url}\n`
        }
      })
    }
    return context
  } catch (e) {
    console.error('Failed to fetch photo context:', e)
    return ''
  }
}

// ============================================================
// AI client + helpers
// ============================================================

function getClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

// ---- Google Directions helper ----
async function getDirections(
  origin: string,
  destination: string,
  mode: 'walking' | 'driving' | 'transit' | 'bicycling' = 'walking'
): Promise<string> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return 'Google Maps API key is not configured. Unable to get directions.'
  }

  try {
    const params = new URLSearchParams({
      origin,
      destination,
      mode,
      key: apiKey,
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Directions API error:', response.status, errorText)
      return `Google Directions API returned an error (status ${response.status}). Unable to get directions at this time.`
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return `No ${mode} route found between these locations.`
      }
      console.error('Directions API status:', data.status, data.error_message)
      return `Directions API error: ${data.status}. ${data.error_message || ''}`
    }

    const route = data.routes[0]
    const leg = route.legs[0]

    const result = {
      origin: leg.start_address,
      destination: leg.end_address,
      mode,
      distance: leg.distance.text,
      duration: leg.duration.text,
      steps: leg.steps.map((step: { html_instructions: string; distance: { text: string }; duration: { text: string }; travel_mode: string; transit_details?: { line?: { short_name?: string; name?: string; vehicle?: { type?: string } }; departure_stop?: { name?: string }; arrival_stop?: { name?: string }; num_stops?: number } }) => {
        const info: Record<string, unknown> = {
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance.text,
          duration: step.duration.text,
        }
        if (step.travel_mode === 'TRANSIT' && step.transit_details) {
          info.transit_line = step.transit_details.line?.short_name || step.transit_details.line?.name
          info.transit_type = step.transit_details.line?.vehicle?.type
          info.departure_stop = step.transit_details.departure_stop?.name
          info.arrival_stop = step.transit_details.arrival_stop?.name
          info.num_stops = step.transit_details.num_stops
        }
        return info
      }),
    }

    return JSON.stringify(result, null, 2)
  } catch (err) {
    console.error('Directions error:', err)
    return `Error getting directions: ${String(err)}`
  }
}

// ---- Google Places helper ----
async function searchNearbyPlaces(query: string, maxResults = 5): Promise<string> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return 'Google Places API key is not configured. Unable to search for nearby places.'
  }

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.rating',
            'places.userRatingCount',
            'places.priceLevel',
            'places.currentOpeningHours',
            'places.regularOpeningHours',
            'places.websiteUri',
            'places.googleMapsUri',
            'places.primaryType',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: Math.min(maxResults, 10),
          languageCode: 'en',
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Places API error:', response.status, errorText)
      return `Google Places API returned an error (status ${response.status}). Unable to search for nearby places at this time.`
    }

    const data = await response.json()
    const places = (data.places || []).map((place: Record<string, unknown>) => {
      const openingHours = (place.currentOpeningHours || place.regularOpeningHours) as Record<string, unknown> | undefined
      const weekday = openingHours?.weekdayDescriptions as string[] | undefined
      const displayName = place.displayName as Record<string, string> | undefined
      const priceMap: Record<string, string> = {
        PRICE_LEVEL_FREE: 'Free',
        PRICE_LEVEL_INEXPENSIVE: '$',
        PRICE_LEVEL_MODERATE: '$$',
        PRICE_LEVEL_EXPENSIVE: '$$$',
        PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
      }

      const location = place.location as { latitude?: number; longitude?: number } | undefined
      return {
        name: displayName?.text || 'Unknown',
        address: place.formattedAddress || '',
        lat: location?.latitude || null,
        lng: location?.longitude || null,
        rating: place.rating || null,
        reviewCount: place.userRatingCount || null,
        price: priceMap[place.priceLevel as string] || null,
        type: place.primaryType || null,
        website: place.websiteUri || null,
        googleMapsUrl: place.googleMapsUri || null,
        todayHours: weekday ? weekday[new Date().getDay()] : null,
      }
    })

    if (places.length === 0) {
      return 'No places found matching that search.'
    }

    return JSON.stringify(places, null, 2)
  } catch (err) {
    console.error('Places search error:', err)
    return `Error searching for places: ${String(err)}`
  }
}

// ---- Claude tool definitions (dynamic per market) ----
function getTools(market: string): Anthropic.Tool[] {
  const locationHint = market || 'the project market area'
  return [
    {
      name: 'search_nearby_places',
      description:
        `Search for places, businesses, or company locations using Google Places. Use this for: (1) nearby places like restaurants, coffee shops, parking near tour buildings, (2) company office locations like "Tesla offices in Silicon Valley" or "Amazon headquarters", (3) any business or brand the user asks about. Always include "${locationHint}" in the query when searching near project buildings. This is a LIVE Google search - you can find any business, not just project data.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description:
              `A natural language search query. Examples: "coffee shops near 250 Main Street, ${locationHint}", "Tesla offices Silicon Valley", "WeWork locations San Francisco"`,
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (1-10, default 5)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_directions',
      description:
        `Get walking, driving, transit, or bicycling directions between two locations. Returns travel time, distance, and step-by-step directions. Use this when a user asks how far apart two buildings are, how long it takes to walk/drive between locations, or asks for directions. Always use full street addresses with the city/state for best results.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          origin: {
            type: 'string',
            description:
              `Starting address, e.g. "250 Main Street, ${locationHint}"`,
          },
          destination: {
            type: 'string',
            description:
              `Destination address, e.g. "505 Howard Street, ${locationHint}"`,
          },
          mode: {
            type: 'string',
            enum: ['walking', 'driving', 'transit', 'bicycling'],
            description:
              'Travel mode. Default is walking. Use "transit" for public transportation.',
          },
        },
        required: ['origin', 'destination'],
      },
    },
  ]
}

// Build current date/time string in Pacific Time for the system prompt
function getCurrentDateContext(): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'long'
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))
  const pacificDate = `${parts.year}-${parts.month}-${parts.day}`
  const pacificDay = parts.weekday
  const pacificTime = `${parts.hour}:${parts.minute}`

  const todayMs = new Date(`${pacificDate}T12:00:00`).getTime()
  const tomorrowDate = new Date(todayMs + 86400000).toISOString().slice(0, 10)

  return `CURRENT DATE AND TIME (Pacific Time): ${pacificDay}, ${pacificDate} at ${pacificTime}.
Today's date is ${pacificDate} (${pacificDay}). Tomorrow's date is ${tomorrowDate}.
IMPORTANT: When the user says "tomorrow", they mean ${tomorrowDate}. When they say "today", they mean ${pacificDate}. Always use these exact dates when resolving relative date references like "today", "tomorrow", "this week", etc.`
}

// ---- Dynamic system prompt (adapts to project) ----
function buildSystemPrompt(projectName: string, market: string, buildingCount: number): string {
  const marketLabel = market || 'the target market'
  return `You are the Tour-Lytics Tour Book Assistant -- an AI concierge for a commercial real estate office search project.

PROJECT: ${projectName}
MARKET: ${marketLabel}

You have detailed knowledge of the survey buildings in this project. Your job is to answer questions about these properties clearly and helpfully, like a knowledgeable broker assistant.

SCORING CATEGORIES (1-10 scale, used by the client to rate buildings during tours):
- Location: Proximity to transit, restaurants, walkability
- Price: Rental rate competitiveness
- Parking: Availability and cost of parking
- Security: Building security features
- Interior Fit Out: Quality of the existing space buildout
- Furniture/Vibe: Existing furniture quality and office atmosphere
- Natural Light: Window lines, floor-to-ceiling glass, exposure
- Amenities: On-site amenities (gym, cafe, rooftop, etc.)
- Overall Feel: General impression of the building
- The Davis Effect: Named after Steve Davis who has a very high bar for office quality

MULTI-COMPONENT DEALS:
A single building address may have MULTIPLE components (e.g., "Office" and "BTS" at the same address). These are NOT competing proposals. They are parts of a SINGLE combined deal being pursued together. When a building has multiple component labels:
- Treat all components as one unified deal at that address
- Combine the RSF across components for total deal size (e.g., 320K Office + 300K BTS = 620K SF total)
- Each component may have its own versions/proposals (v1, v2, v3) within it
- The "Combined Analysis" view shows the full deal picture across all components
- When summarizing the deal, always present the combined totals alongside per-component breakdowns
- Components are identified by the "component_label" field (e.g., "Office", "BTS")
- Submissions WITHOUT a component_label are single-component deals (no grouping needed)

FINANCIAL DATA:
Financial data comes from LIVE RFP/LOI submissions in the Financials tab (injected at the end of this prompt). These are real proposals uploaded by the team with AI-generated analysis including Cash Flow, Straight-Line P&L (with TI amortization), and GAAP/ASC 842 schedules. ALWAYS use these when answering financial questions.
If a building has no RFP submission, tell the user no financial data has been submitted yet for that building.

FINANCIAL SCOPE:
- The Financials tab is strictly focused on deal terms from submitted RFPs and LOIs.
- Internal operating expense assumptions live in the separate Assumptions tab.
- If PROJECT ASSUMPTIONS data is injected below, you can use it to compute all-in occupancy cost when the user asks.
- If a user asks about "all-in cost" or "total occupancy cost", combine the straight-line lease expense from the RFP with the internal OpEx from the Assumptions tab. Show the breakdown clearly: lease cost + internal OpEx = all-in cost.
- If assumptions have not been configured yet, tell the user they can set them up in the Assumptions tab under Financials.

TI ALLOWANCE IN STRAIGHT-LINE:
- When a deal includes a TI (Tenant Improvement) allowance, it is amortized over the lease term and REDUCES the straight-line rent expense.
- The SL Monthly Rent and SL Annual Rent in the live RFP data already reflect this TI amortization.

LIVE TOUR CONTEXT:
Each message may include [LIVE TOUR LIST], [LIVE SCORES], and [LIVE TOUR SCHEDULE] data.
- When the user asks about "my tour book", "my tour list", "buildings on my tour", ONLY reference the buildings in the LIVE TOUR LIST.
- The Tour Book is the user's shortlist. It is NOT the full survey.
- CRITICAL: When matching schedule dates to words like "today" or "tomorrow", use the CURRENT DATE AND TIME provided at the top of this prompt.

NEARBY PLACES & COMPANY SEARCH CAPABILITY:
You have access to search_nearby_places (Google Places). Use this tool for TWO purposes:

1. NEARBY PLACES: When a user asks about places near a building (restaurants, coffee, parking, gyms, etc.):
   - Identify the building address from your data
   - Call search_nearby_places with the query including "${marketLabel}"
   - Present results with name, rating, distance context, and Google Maps link

2. COMPANY/BUSINESS LOCATIONS: When a user asks about office locations, headquarters, or branches of ANY company (e.g. "where are Tesla's offices?", "show me Google locations", "find Amazon offices near here"):
   - Call search_nearby_places with a query like "Tesla offices" or "Google headquarters ${marketLabel}"
   - You CAN search for any company, brand, or business. You are NOT limited to survey buildings.
   - Present results with name, address, and Google Maps link
   - If the user asks about locations in a specific area, include the area in the query

IMPORTANT: Do NOT say you don't have access to company location data. You can always search for any business or company using search_nearby_places. This is a live Google Places search, not limited to your project data.

DIRECTIONS & TRAVEL TIME CAPABILITY:
You have access to get_directions (Google Maps). Use for travel time, directions, and route comparisons between buildings or locations. Always include the city/state in addresses.

TOUR PHOTOS CAPABILITY:
Photos uploaded during tours may have AI analysis (Gemini Vision) with descriptions, area tags, feature tags, and direct image URLs. Show photos using markdown: ![description](url). Show up to 3-4 photos at a time.

ASSUMPTIONS / ALL-IN COST CAPABILITY:
PROJECT ASSUMPTIONS data includes per-building internal OpEx, headcount, target density, and GAAP discount rate. Combine with RFP data for all-in cost calculations.

TEAM MEMBERS CAPABILITY:
Live team data is injected below. Group by persona: Admin, Broker, CRE Team, Touree.

COMMUTE STUDY CAPABILITY:
Full commute study data (employee commute analysis) is available with per-building averages and per-department breakdowns.

CURRENT OFFICE LOCATIONS:
The company's current office locations (HQ, labs, warehouses, etc.) may be listed at the end of this prompt. Use these when the user asks "where is my current office?", "how far is X from our HQ?", or wants to compare proposed buildings to their current location. You can use the get_directions tool to calculate travel time from a current office to any survey building.

DISPLAYING PHOTOS:
Show photos using markdown image syntax: ![description](url). Show up to 3-4 at a time.

GUIDELINES:
- Be concise but thorough. Use specific numbers when available.
- If comparing buildings, use a structured format.
- When a building detail is "TBD" or "Negotiable", say so honestly.
- Reference building numbers and addresses together for clarity.
- If asked about something not in the project data, try using your tools first (search_nearby_places for locations/businesses, get_directions for travel). Only say you don't have the information if your tools also cannot help.
- Do not use em dashes in your responses. Use commas, periods, or semicolons instead.
- Be conversational and professional, like a sharp real estate analyst.
- Keep responses focused. Don't dump all data unless asked for a full comparison.
- When asked about costs, always distinguish between lease-only P&L and all-in occupancy cost.`
}

// In-memory conversation store (keyed by projectId + visitorId for isolation)
const conversations = new Map<string, Array<{ role: string; content: string | Anthropic.ContentBlockParam[] }>>()
const MAX_HISTORY = 20

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            'ANTHROPIC_API_KEY is not configured. Please add it in Vercel Environment Variables and redeploy.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const body = await request.json()
    const { message, visitor_id, tour_list, scores, schedule, projectId: rawProjectId } = body
    const projectId = rawProjectId || 'sf-office-search'
    const visitorId =
      visitor_id || request.headers.get('x-visitor-id') || 'default'

    // Conversation key includes projectId for full isolation
    const convoKey = `${projectId}::${visitorId}`

    // Get or create conversation history
    let history = conversations.get(convoKey) || []

    // Build context-enriched message
    let userContent = message
    const contextParts: string[] = []

    if (tour_list && tour_list.length > 0) {
      contextParts.push(
        `[LIVE TOUR LIST - these are the buildings currently on the user's Tour Book tab: ${JSON.stringify(tour_list)}]`
      )
    }
    if (scores && Object.keys(scores).length > 0) {
      contextParts.push(
        `[LIVE SCORES - the user's current building scores/notes from the Tour Book: ${JSON.stringify(scores)}]`
      )
    }
    if (schedule && Object.keys(schedule).length > 0) {
      contextParts.push(
        `[LIVE TOUR SCHEDULE - scheduled tour dates and times for buildings: ${JSON.stringify(schedule)}]`
      )
    }

    if (contextParts.length > 0) {
      userContent = contextParts.join('\n') + '\n\nUser question: ' + message
    }

    history.push({ role: 'user', content: userContent })

    // Trim history
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY)
    }

    // Debit token for chat message (project-scoped)
    try {
      const tokenResult = await debitTokens({
        projectId,
        action: 'chat_message',
        userEmail: visitorId,
        note: `Chat: ${message.substring(0, 80)}`,
      })
      if (!tokenResult.success) {
        return new Response(
          JSON.stringify({ error: 'Insufficient tokens. Please purchase more tokens to continue chatting.' }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch (e) {
      // Token system not yet set up - continue without billing
      console.warn('Token debit skipped:', (e as Error).message)
    }

    // Fetch all project-scoped data in parallel
    const [projectMeta, buildingCtx, photoContext, rfpContext, teamContext, commuteContext, assumptionsContext, officeContext] = await Promise.all([
      getProjectMeta(projectId),
      getBuildingContext(projectId),
      getPhotoContext(projectId),
      getRFPContext(projectId),
      getTeamContext(projectId),
      getCommuteContext(projectId),
      getAssumptionsContext(projectId),
      getOfficeContext(projectId),
    ])

    const dynamicSystemPrompt = buildSystemPrompt(projectMeta.name, projectMeta.market, 0)
    const SYSTEM_PROMPT = getCurrentDateContext() + '\n\n' + dynamicSystemPrompt + '\n' + buildingCtx + rfpContext + assumptionsContext + teamContext + commuteContext + photoContext + officeContext

    const tools = getTools(projectMeta.market)

    // Stream response with tool use support
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let apiMessages = history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content as string | Anthropic.ContentBlockParam[],
          }))

          let assistantResponse = ''
          let needsToolCall = true

          while (needsToolCall) {
            needsToolCall = false

            const response = await getClient().messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              system: SYSTEM_PROMPT,
              tools,
              messages: apiMessages,
            })

            const toolUseBlocks = response.content.filter(
              (block) => block.type === 'tool_use'
            )
            const textBlocks = response.content.filter(
              (block) => block.type === 'text'
            )

            // Stream any text that came before tool use
            for (const block of textBlocks) {
              if (block.type === 'text' && block.text) {
                assistantResponse += block.text
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: block.text })}\n\n`
                  )
                )
              }
            }

            if (toolUseBlocks.length > 0 && response.stop_reason === 'tool_use') {
              const toolResults: Anthropic.ToolResultBlockParam[] = []

              for (const toolBlock of toolUseBlocks) {
                if (toolBlock.type === 'tool_use') {
                  const { name, id, input } = toolBlock
                  const toolInput = input as { query: string; max_results?: number }

                  if (name === 'search_nearby_places') {
                    const result = await searchNearbyPlaces(
                      toolInput.query,
                      toolInput.max_results || 5
                    )
                    // Emit places with coordinates to frontend for map markers
                    try {
                      const parsed = JSON.parse(result)
                      if (Array.isArray(parsed)) {
                        const withCoords = parsed.filter((p: { lat?: number; lng?: number }) => p.lat && p.lng)
                        if (withCoords.length > 0) {
                          controller.enqueue(
                            encoder.encode(
                              `data: ${JSON.stringify({ map_places: withCoords })}\n\n`
                            )
                          )
                        }
                      }
                    } catch (_) { /* non-JSON result, skip map plotting */ }
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: id,
                      content: result,
                    })
                  } else if (name === 'get_directions') {
                    const dirInput = input as { origin: string; destination: string; mode?: string }
                    const result = await getDirections(
                      dirInput.origin,
                      dirInput.destination,
                      (dirInput.mode as 'walking' | 'driving' | 'transit' | 'bicycling') || 'walking'
                    )
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: id,
                      content: result,
                    })
                  }
                }
              }

              apiMessages = [
                ...apiMessages,
                { role: 'assistant' as const, content: response.content as Anthropic.ContentBlockParam[] },
                { role: 'user' as const, content: toolResults as Anthropic.ContentBlockParam[] },
              ]

              needsToolCall = true
            }
          }

          // Save final response to history
          if (assistantResponse) {
            history.push({ role: 'assistant', content: assistantResponse })
            conversations.set(convoKey, history)
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          )
          controller.close()
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: String(err) })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
