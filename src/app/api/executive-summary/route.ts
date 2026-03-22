import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { debitTokens } from '@/lib/tokens'

export const maxDuration = 90

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, userEmail } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
    }

    const supabase = getSupabase()

    // Debit tokens for executive summary generation
    try {
      const tokenResult = await debitTokens({
        projectId,
        action: 'executive_summary',
        userEmail: userEmail || undefined,
        note: 'Executive Summary generation',
      })
      if (!tokenResult.success) {
        return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 })
      }
    } catch (e) {
      console.warn('Token debit skipped:', (e as Error).message)
    }

    // Gather ALL project data in parallel
    const [
      projectRes,
      buildingsRes,
      rfpRes,
      shortlistRes,
      officesRes,
      commuteRes,
      photosRes,
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('survey_buildings').select('*').eq('project_id', projectId).order('num', { ascending: true }),
      supabase.from('rfp_submissions').select('*').eq('project_id', projectId).neq('status', 'archived').order('submitted_at', { ascending: false }),
      supabase.from('shortlist_items').select('*').eq('project_id', projectId),
      supabase.from('project_offices').select('*').eq('project_id', projectId),
      supabase.from('commute_studies').select('*').eq('project_id', projectId).single(),
      supabase.from('building_photos').select('id, building_name, ai_area_suggestion, ai_description').eq('project_id', projectId).not('ai_analyzed_at', 'is', null).limit(50),
    ])

    const project = projectRes.data
    const buildings = buildingsRes.data || []
    const rfpSubmissions = rfpRes.data || []
    const shortlistItems = shortlistRes.data || []
    const offices = officesRes.data || []
    const commute = commuteRes.data
    const photos = photosRes.data || []

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build comprehensive context for Claude
    let context = `PROJECT: ${project.name}\nMARKET: ${project.market || 'N/A'}\nBUILDINGS EVALUATED: ${buildings.length}\n`

    if (offices.length > 0) {
      context += `\nCURRENT OFFICES:\n`
      offices.forEach((o: any) => {
        context += `  - ${o.label || 'Office'}: ${o.address}\n`
      })
    }

    // Buildings summary
    context += `\nSURVEY BUILDINGS (${buildings.length} total):\n`
    buildings.forEach((b: any) => {
      context += `  #${b.num} ${b.address} (${b.neighborhood || 'N/A'})`
      if (b.space_available) context += ` - ${b.space_available} avail`
      if (b.rental_rate) context += ` - ${b.rental_rate}`
      if (b.year_built_class) context += ` - ${b.year_built_class}`
      context += '\n'
    })

    // Tour list / shortlist
    const tourListNums = shortlistItems
      .filter((s: any) => s.list_type === 'tour')
      .map((s: any) => s.building_num || s.item_id)
    const shortlistNums = shortlistItems
      .filter((s: any) => s.list_type === 'shortlist')
      .map((s: any) => s.building_num || s.item_id)

    if (tourListNums.length > 0) {
      context += `\nTOUR LIST (${tourListNums.length} buildings selected for tours):\n`
      tourListNums.forEach((num: any) => {
        const b = buildings.find((bb: any) => bb.num === num || bb.id === num)
        if (b) context += `  - #${b.num} ${b.address}\n`
      })
    }

    if (shortlistNums.length > 0) {
      context += `\nSHORTLIST (${shortlistNums.length} finalist buildings):\n`
      shortlistNums.forEach((num: any) => {
        const b = buildings.find((bb: any) => bb.num === num || bb.id === num)
        if (b) context += `  - #${b.num} ${b.address}\n`
      })
    }

    // Financial analysis
    if (rfpSubmissions.length > 0) {
      context += `\nFINANCIAL ANALYSIS (${rfpSubmissions.length} RFP/LOI submissions):\n`

      // Group by building
      const byBuilding: Record<string, any[]> = {}
      rfpSubmissions.forEach((sub: any) => {
        const addr = sub.building_address || 'Unknown'
        if (!byBuilding[addr]) byBuilding[addr] = []
        byBuilding[addr].push(sub)
      })

      for (const [addr, subs] of Object.entries(byBuilding)) {
        context += `\n  ${addr} (${subs.length} version${subs.length > 1 ? 's' : ''}):\n`
        subs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        subs.forEach((sub: any, idx: number) => {
          const terms = sub.deal_terms || {}
          const summary = sub.analysis?.summary || {}
          context += `    Version ${idx + 1} (${new Date(sub.submitted_at || sub.created_at).toLocaleDateString()}):\n`
          if (terms.rsf) context += `      RSF: ${terms.rsf.toLocaleString()}\n`
          if (terms.base_rent_rsf) context += `      Base Rent: $${terms.base_rent_rsf}/RSF/yr\n`
          if (terms.lease_term_months) context += `      Term: ${terms.lease_term_months} months\n`
          if (terms.free_rent_months) context += `      Free Rent: ${terms.free_rent_months} months\n`
          if (terms.ti_allowance_rsf) context += `      TI: $${terms.ti_allowance_rsf}/RSF\n`
          if (summary.effectiveRentRSF) context += `      Effective Rent: $${summary.effectiveRentRSF}/RSF\n`
          if (summary.totalAllInCost) context += `      Total All-in: $${summary.totalAllInCost.toLocaleString()}\n`
          if (summary.totalConcessions) context += `      Total Concessions: $${summary.totalConcessions.toLocaleString()}\n`
        })

        // Show deal progression if multiple versions
        if (subs.length > 1) {
          const first = subs[0].deal_terms || {}
          const last = subs[subs.length - 1].deal_terms || {}
          const firstSummary = subs[0].analysis?.summary || {}
          const lastSummary = subs[subs.length - 1].analysis?.summary || {}
          context += `    Deal Progression:\n`
          if (first.base_rent_rsf && last.base_rent_rsf) {
            const diff = last.base_rent_rsf - first.base_rent_rsf
            context += `      Rent: $${first.base_rent_rsf} -> $${last.base_rent_rsf} (${diff > 0 ? '+' : ''}$${diff.toFixed(2)})\n`
          }
          if (firstSummary.totalAllInCost && lastSummary.totalAllInCost) {
            const diff = lastSummary.totalAllInCost - firstSummary.totalAllInCost
            const pct = ((diff / firstSummary.totalAllInCost) * 100).toFixed(1)
            context += `      Total Cost: $${firstSummary.totalAllInCost.toLocaleString()} -> $${lastSummary.totalAllInCost.toLocaleString()} (${pct}%)\n`
          }
        }
      }
    }

    // Commute data summary
    if (commute && commute.results?.summaries) {
      context += `\nCOMMUTE STUDY:\n`
      context += `  ${commute.employees?.length || 0} employees analyzed\n`
      commute.results.summaries.forEach((s: any) => {
        const avgDrive = s.driving_avg_seconds ? Math.round(s.driving_avg_seconds / 60) : null
        const avgTransit = s.transit_avg_seconds ? Math.round(s.transit_avg_seconds / 60) : null
        context += `  ${s.building}: Avg Drive ${avgDrive || '?'} min, Avg Transit ${avgTransit || '?'} min\n`
      })
    }

    // Photos summary
    if (photos.length > 0) {
      const areaBreakdown: Record<string, number> = {}
      photos.forEach((p: any) => {
        const area = p.ai_area_suggestion || 'general'
        areaBreakdown[area] = (areaBreakdown[area] || 0) + 1
      })
      context += `\nPHOTO DOCUMENTATION: ${photos.length} photos analyzed\n`
      Object.entries(areaBreakdown).forEach(([area, count]) => {
        context += `  ${area}: ${count} photos\n`
      })
    }

    // Generate the executive summary with Claude
    const anthropic = getAnthropic()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a senior commercial real estate analyst preparing an executive summary for a C-suite audience. Based on the following project data, write a comprehensive executive summary.

${context}

Write the executive summary in HTML format with these sections. Use proper HTML tags (<h2>, <h3>, <p>, <ul>, <li>, <table>, <strong>, etc.) for clean formatting:

1. EXECUTIVE OVERVIEW - 2-3 paragraph summary of the project scope, market, and current status

2. MARKET ASSESSMENT - Brief overview of the buildings evaluated, submarkets covered, and availability landscape

3. TOUR LIST & SHORTLIST RATIONALE - Which buildings made the tour list and shortlist, and why (based on the data available: price, size, class, location)

4. FINANCIAL ANALYSIS SUMMARY - For each building with RFP data:
   - Current deal terms
   - If multiple versions exist, how the deal improved over negotiation rounds
   - Key financial metrics (effective rent, total cost, concessions)

5. COMMUTE & ACCESSIBILITY (if commute data exists) - Summary of employee commute impact by building

6. RECOMMENDATION & NEXT STEPS - Based on ALL the data, provide a structured recommendation on which buildings represent the strongest options and what next steps should be taken

IMPORTANT GUIDELINES:
- Do not use em dashes
- Write in a professional, direct tone appropriate for a CEO or CFO
- Use specific numbers from the data, not generalities
- If data is missing for a section, note it briefly and move on
- Include a summary comparison table for buildings with financial data
- Keep it concise but thorough, aim for 800-1200 words
- Format monetary values with dollar signs and commas`
        }
      ]
    })

    const summaryHTML = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('')

    return NextResponse.json({
      html: summaryHTML,
      projectName: project.name,
      market: project.market,
      buildingCount: buildings.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Executive summary error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
