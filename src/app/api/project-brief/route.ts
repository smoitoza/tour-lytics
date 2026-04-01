import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { debitTokens } from '@/lib/tokens'

export const maxDuration = 60

function getSupabase() {
  return createAdminClient()
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

// POST - generate a brief from a user prompt
export async function POST(request: NextRequest) {
  try {
    const { projectId, userEmail, prompt } = await request.json()

    if (!projectId || !prompt) {
      return NextResponse.json({ error: 'projectId and prompt required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
    }

    const supabase = getSupabase()

    // Debit tokens
    try {
      const tokenResult = await debitTokens({
        projectId,
        action: 'project_brief',
        userEmail: userEmail || undefined,
        note: 'Project Brief generation',
      })
      if (!tokenResult.success) {
        return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 })
      }
    } catch (e) {
      console.warn('Token debit skipped:', (e as Error).message)
    }

    // Gather project data (same as exec summary but lighter)
    const [
      projectRes,
      buildingsRes,
      rfpRes,
      shortlistRes,
      officesRes,
      commuteRes,
      assumptionsRes,
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('survey_buildings').select('*').eq('project_id', projectId).order('num', { ascending: true }),
      supabase.from('rfp_submissions').select('*').eq('project_id', projectId).neq('status', 'archived').order('submitted_at', { ascending: false }),
      supabase.from('shortlist_items').select('*').eq('project_id', projectId),
      supabase.from('project_offices').select('*').eq('project_id', projectId),
      supabase.from('commute_studies').select('*').eq('project_id', projectId).single(),
      supabase.from('project_assumptions').select('*').eq('project_id', projectId).order('building_address', { ascending: true }),
    ])

    const project = projectRes.data
    const buildings = buildingsRes.data || []
    const rfpSubmissions = rfpRes.data || []
    const shortlistItems = shortlistRes.data || []
    const offices = officesRes.data || []
    const commute = commuteRes.data
    const assumptions = assumptionsRes.data || []

    // Build context
    let context = `PROJECT: ${project?.name || projectId}\nMARKET: ${project?.market || 'N/A'}\nBUILDINGS EVALUATED: ${buildings.length}\n`

    if (offices.length > 0) {
      context += `\nCURRENT OFFICES:\n`
      offices.forEach((o: any) => {
        context += `  - ${o.label || 'Office'}: ${o.address}\n`
      })
    }

    // Buildings summary (compact)
    context += `\nSURVEY BUILDINGS (${buildings.length}):\n`
    buildings.forEach((b: any) => {
      context += `  #${b.num} ${b.address} (${b.neighborhood || 'N/A'})`
      if (b.space_available) context += ` - ${b.space_available} avail`
      if (b.rental_rate) context += ` - ${b.rental_rate}`
      context += '\n'
    })

    // Shortlist
    const tourListNums = shortlistItems.filter((s: any) => s.list_type === 'tour').map((s: any) => s.building_num || s.item_id)
    const shortlistNums = shortlistItems.filter((s: any) => s.list_type === 'shortlist').map((s: any) => s.building_num || s.item_id)

    if (tourListNums.length > 0) {
      context += `\nTOUR LIST (${tourListNums.length}):\n`
      tourListNums.forEach((num: any) => {
        const b = buildings.find((bb: any) => bb.num === num || bb.id === num)
        if (b) context += `  - #${b.num} ${b.address}\n`
      })
    }
    if (shortlistNums.length > 0) {
      context += `\nSHORTLIST (${shortlistNums.length}):\n`
      shortlistNums.forEach((num: any) => {
        const b = buildings.find((bb: any) => bb.num === num || bb.id === num)
        if (b) context += `  - #${b.num} ${b.address}\n`
      })
    }

    // RFP summary (compact)
    if (rfpSubmissions.length > 0) {
      context += `\nACTIVE RFPs/LOIs (${rfpSubmissions.length}):\n`
      rfpSubmissions.forEach((sub: any) => {
        const terms = sub.deal_terms || {}
        const summary = sub.analysis?.summary || {}
        const slTotals = sub.analysis?.straight_line_pl?.totals || {}
        const label = sub.version_label || (sub.doc_type || 'rfp').toUpperCase()
        context += `  ${sub.building_address} - ${label}`
        if (sub.component_label) context += ` [Component: ${sub.component_label}]`
        if (terms.rsf) context += ` | ${terms.rsf.toLocaleString()} RSF`
        const bpRentPeriods = terms.rent_periods || terms.rentPeriods
        if (bpRentPeriods && Array.isArray(bpRentPeriods) && bpRentPeriods.length > 0) {
          const firstPaid = bpRentPeriods.find((p: any) => p.rent_rsf_yr > 0)
          const hasPhasedRSF = bpRentPeriods.some((p: any) => p.billable_rsf && p.billable_rsf > 0)
          const phasedNote = hasPhasedRSF ? ', phased RSF' : ''
          context += ` | Stepped rent (${firstPaid ? '$' + firstPaid.rent_rsf_yr + '/RSF starting Mo.' + firstPaid.from_month : 'see schedule'}${phasedNote})`
        } else if (terms.base_rent_rsf) {
          context += ` | $${terms.base_rent_rsf}/RSF`
        }
        if (terms.lease_term_months) context += ` | ${terms.lease_term_months}mo`
        if (!bpRentPeriods && terms.free_rent_months) context += ` | ${terms.free_rent_months}mo free`
        if (terms.ti_allowance_rsf) context += ` | $${terms.ti_allowance_rsf}/RSF TI`
        if (summary.effectiveRentRSF) context += ` | Eff: $${summary.effectiveRentRSF}/RSF`
        if (summary.totalAllInCost) context += ` | All-in: $${summary.totalAllInCost.toLocaleString()}`
        if (slTotals.straightLineAnnualRent) context += ` | SL Annual: $${slTotals.straightLineAnnualRent.toLocaleString()}`
        context += '\n'
      })
    }

    // Commute summary (compact)
    if (commute && commute.results?.summaries) {
      context += `\nCOMMUTE STUDY (${commute.employees?.length || 0} employees):\n`
      commute.results.summaries.forEach((s: any) => {
        const avgDrive = s.driving_avg_seconds ? Math.round(s.driving_avg_seconds / 60) : null
        const avgTransit = s.transit_avg_seconds ? Math.round(s.transit_avg_seconds / 60) : null
        context += `  ${s.building}: Drive ${avgDrive || '?'} min, Transit ${avgTransit || '?'} min\n`
      })
    }

    // Project assumptions (CAPEX, broker fees, internal OpEx)
    if (assumptions.length > 0) {
      let hasAnyData = false
      let assumptionsContext = ''
      for (const row of assumptions) {
        const capexConstruction = parseFloat(row.capex_construction_total) || 0
        const capexFFE = parseFloat(row.capex_ffe_total) || 0
        const capexIT = parseFloat(row.capex_it_total) || 0
        const totalCapex = capexConstruction + capexFFE + capexIT
        const brokerFeeType = row.broker_fee_type || 'none'
        const brokerFeeAmount = parseFloat(row.broker_fee_amount) || 0
        const brokerFeeNotes = row.broker_fee_notes || ''
        const fb = parseFloat(row.opex_food_beverage) || 0
        const wpe = parseFloat(row.opex_workplace_experience) || 0
        const maint = parseFloat(row.opex_maintenance_security) || 0
        const customItems = row.opex_custom_items || []
        let customTotal = 0
        customItems.forEach((item: any) => { customTotal += parseFloat(item.monthly) || 0 })
        const totalMonthlyOpex = fb + wpe + maint + customTotal

        if (totalCapex === 0 && (brokerFeeType === 'none' || brokerFeeAmount === 0) && totalMonthlyOpex === 0) continue

        hasAnyData = true
        const compLabel = row.component_label ? ` [${row.component_label}]` : ''
        assumptionsContext += `  ${row.building_address || 'Unknown'}${compLabel}:`
        if (totalCapex > 0) assumptionsContext += ` CAPEX $${totalCapex.toLocaleString()}`
        if (brokerFeeType !== 'none' && brokerFeeAmount > 0) {
          const feeLabel = brokerFeeType === 'expense' ? 'IDC' : 'Incentive'
          assumptionsContext += ` | Broker Fee $${brokerFeeAmount.toLocaleString()} (${feeLabel})`
          if (brokerFeeNotes) assumptionsContext += ` - ${brokerFeeNotes}`
        }
        if (totalMonthlyOpex > 0) assumptionsContext += ` | Internal OpEx $${totalMonthlyOpex.toLocaleString()}/mo`
        assumptionsContext += '\n'
      }
      if (hasAnyData) {
        context += `\nPROJECT ASSUMPTIONS:\n${assumptionsContext}`
      }
    }

    // Generate with Claude
    const anthropic = getAnthropic()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a senior commercial real estate professional helping draft internal communications and project briefs. You have full access to the following project data:

${context}

Based on this data, respond to the following request:

${prompt}

MULTI-COMPONENT DEALS:
When multiple RFP submissions at the same building address have different component labels (e.g., "Office" and "BTS"), these are NOT competing options. They are parts of a SINGLE combined deal being pursued together. Present them as one unified deal with combined RSF totals and per-component breakdowns.

GUIDELINES:
- Write in a professional but approachable tone
- Use specific data from the project (addresses, numbers, terms) - do not generalize
- Do not use em dashes
- If asked to write an email, include a subject line
- If asked for a brief or memo, use clear headings
- Keep it concise and actionable
- If the request references specific buildings or deals, use the actual data from the project
- Format as clean HTML using <p>, <strong>, <ul>, <li>, <h3> tags. Start with a <p> or <h3> tag directly.
- Do NOT use markdown syntax`
        }
      ]
    })

    const responseHTML = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('')

    // Save to database (private per user)
    const { error: insertErr } = await supabase.from('project_briefs').insert({
      project_id: projectId,
      user_email: userEmail || null,
      prompt,
      response: responseHTML,
    })
    if (insertErr) {
      console.error('Failed to save project brief:', insertErr)
    }

    return NextResponse.json({
      response: responseHTML,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Project brief error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET - load user's brief history for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const userEmail = searchParams.get('userEmail')

    if (!projectId || !userEmail) {
      return NextResponse.json({ error: 'projectId and userEmail required' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('project_briefs')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Project brief load error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
