import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { debitTokens } from '@/lib/tokens'

export const maxDuration = 90

function getSupabase() {
  return createAdminClient()
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, userEmail, customPrompt } = await request.json()

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
        // Check if this building has multiple components (multi-component deal)
        const componentLabels = [...new Set(subs.map((s: any) => s.component_label).filter(Boolean))]
        const isMultiComponent = componentLabels.length > 1
        if (isMultiComponent) {
          const totalRSF = subs.reduce((sum: number, s: any) => {
            const latest = subs.filter((x: any) => x.component_label === s.component_label).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            return s === latest ? sum + (s.deal_terms?.rsf || s.analysis?.summary?.rsf || 0) : sum
          }, 0)
          context += `\n  ${addr} -- MULTI-COMPONENT DEAL (${componentLabels.join(' + ')}, ~${totalRSF.toLocaleString()} RSF combined):\n`
          context += `    NOTE: These components are parts of ONE unified deal being pursued together, NOT competing options.\n`
        } else {
          context += `\n  ${addr} (${subs.length} version${subs.length > 1 ? 's' : ''}):\n`
        }
        subs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        subs.forEach((sub: any, idx: number) => {
          const terms = sub.deal_terms || {}
          const summary = sub.analysis?.summary || {}
          const slPL = sub.analysis?.straight_line_pl || {}
          const slTotals = slPL.totals || {}
          const gaap = sub.analysis?.gaap || {}
          const gaapSummary = gaap.summary || {}

          const versionLabel = sub.version_label || `Version ${idx + 1}`
          const componentTag = sub.component_label ? ` [${sub.component_label}]` : ''
          context += `    ${versionLabel}${componentTag} (${new Date(sub.submitted_at || sub.created_at).toLocaleDateString()}):\n`
          if (terms.rsf) context += `      RSF: ${terms.rsf.toLocaleString()}\n`
          if (terms.base_rent_rsf) context += `      Base Rent: $${terms.base_rent_rsf}/RSF/yr\n`
          if (terms.lease_term_months) context += `      Term: ${terms.lease_term_months} months\n`
          if (terms.free_rent_months) context += `      Free Rent: ${terms.free_rent_months} months\n`
          if (terms.ti_allowance_rsf) context += `      TI: $${terms.ti_allowance_rsf}/RSF\n`
          if (terms.annual_escalation) context += `      Annual Escalation: ${terms.annual_escalation}%\n`
          if (terms.opex_rsf) context += `      OpEx: $${terms.opex_rsf}/RSF/yr\n`

          // Cash basis metrics
          context += `      --- CASH BASIS ---\n`
          if (summary.effectiveRentRSF) context += `      Effective Rent: $${summary.effectiveRentRSF}/RSF\n`
          if (summary.totalAllInCost) context += `      Total All-in Cost: $${summary.totalAllInCost.toLocaleString()}\n`
          if (summary.totalConcessions) context += `      Total Concessions: $${summary.totalConcessions.toLocaleString()}\n`
          if (summary.straightLineAnnualExpense) context += `      Cash Annual Expense: $${summary.straightLineAnnualExpense.toLocaleString()}\n`

          // Straight-Line P&L metrics
          if (slTotals.straightLineMonthlyRent || slTotals.straightLineAnnualRent) {
            context += `      --- STRAIGHT-LINE (ASC 842 / GAAP) ---\n`
            if (slTotals.straightLineMonthlyRent) context += `      SL Monthly Rent: $${slTotals.straightLineMonthlyRent.toLocaleString()}\n`
            if (slTotals.straightLineAnnualRent) context += `      SL Annual Rent: $${slTotals.straightLineAnnualRent.toLocaleString()}\n`
            if (slTotals.tiAllowanceTotal) context += `      TI Allowance Total: $${slTotals.tiAllowanceTotal.toLocaleString()}\n`
            if (slTotals.monthlyTIAmortization) context += `      Monthly TI Amortization: $${slTotals.monthlyTIAmortization.toLocaleString()}\n`
            if (slTotals.effectiveRentRSF) context += `      SL Effective Rent/RSF: $${slTotals.effectiveRentRSF}\n`
            if (slTotals.totalCostPerRSFPerYear) context += `      SL Total Cost/RSF/Year: $${slTotals.totalCostPerRSFPerYear}\n`
          }

          // GAAP / ASC 842 lease accounting
          if (gaapSummary.leaseLiability || gaapSummary.rouAsset) {
            context += `      --- GAAP LEASE ACCOUNTING (ASC 842) ---\n`
            if (gaapSummary.discountRate) context += `      Discount Rate: ${gaapSummary.discountRate}%\n`
            if (gaapSummary.leaseLiability) context += `      Lease Liability (Day 1): $${gaapSummary.leaseLiability.toLocaleString()}\n`
            if (gaapSummary.rouAsset) context += `      ROU Asset (Day 1): $${gaapSummary.rouAsset.toLocaleString()}\n`
            if (gaapSummary.totalLeasePayments) context += `      Total Lease Payments: $${gaapSummary.totalLeasePayments.toLocaleString()}\n`
          }
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

You MUST output valid HTML only. Do NOT use markdown. Do NOT use # headers or ** bold. Use only HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>, <em>. Start your response with an <h2> tag directly.

Structure the summary with these sections:

1. EXECUTIVE OVERVIEW - 2-3 paragraph summary of the project scope, market, and current status

2. MARKET ASSESSMENT - Brief overview of the buildings evaluated, submarkets covered, and availability landscape

3. TOUR LIST & SHORTLIST RATIONALE - Which buildings made the tour list and shortlist, and why (based on the data available: price, size, class, location)

4. FINANCIAL ANALYSIS: CASH BASIS - For each building with RFP data, present the cash flow analysis:
   - Current deal terms (base rent, free rent, TI, escalation, OpEx)
   - Effective rent per RSF
   - Total all-in cost over the lease term
   - Total concessions secured
   - If multiple versions exist, how the deal improved across negotiation rounds
   - Include a comparison table across buildings showing cash basis metrics side by side

5. FINANCIAL ANALYSIS: STRAIGHT-LINE (GAAP/ASC 842) - This section is CRITICAL for CFO review. For each building with straight-line data:
   - Straight-line monthly and annual rent (net of TI amortization)
   - SL effective rent per RSF and total cost per RSF per year
   - TI allowance total and monthly TI amortization
   - Day 1 Lease Liability and ROU Asset (if GAAP data exists)
   - Discount rate used
   - Total lease payments over the term
   - Include a comparison table showing straight-line metrics side by side across buildings
   - Clearly note the difference between cash basis and straight-line figures, explaining why they differ (front-loaded concessions like free rent and TI are spread evenly in straight-line)

6. COMMUTE & ACCESSIBILITY (if commute data exists) - Summary of employee commute impact by building

7. RECOMMENDATION & NEXT STEPS - Based on ALL the data (cash, straight-line, commute, location), provide a structured recommendation on which buildings represent the strongest options from both an operational AND financial reporting perspective. Call out which building looks best on a cash basis vs. which looks best on a GAAP/straight-line basis if they differ.

CRITICAL - MULTI-COMPONENT DEALS:
When the data shows multiple components at the same address (marked with component labels like "Office" and "BTS"), these are NOT competing options. They are parts of a SINGLE combined deal being pursued together as a campus or multi-use arrangement. Present them as one unified deal with combined RSF totals and per-component breakdowns. The total deal size is the SUM of all components.

IMPORTANT GUIDELINES:
- Do not use em dashes
- Write in a professional, direct tone appropriate for a CEO or CFO
- Use specific numbers from the data, not generalities
- ALWAYS present both cash basis AND straight-line analysis when the data exists. The CFO needs both perspectives.
- If data is missing for a section, note it briefly and move on
- Include comparison tables for buildings with financial data (separate tables for cash and straight-line)
- Keep it concise but thorough, aim for 1000-1500 words
- Format monetary values with dollar signs and commas
- REMINDER: Output pure HTML only. No markdown syntax whatsoever. Start with <h2>.${customPrompt ? `

ADDITIONAL USER INSTRUCTIONS (incorporate these into the summary):
${customPrompt}` : ''}`
        }
      ]
    })

    const summaryHTML = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('')

    const generatedAt = new Date().toISOString()

    // Save as draft to database
    let summaryId: string | null = null
    let dbError: string | null = null

    const { error: insertErr } = await supabase.from('executive_summaries').insert({
      project_id: projectId,
      html: summaryHTML,
      custom_prompt: customPrompt || null,
      generated_by: userEmail || null,
      project_name: project.name,
      market: project.market,
      building_count: buildings.length,
      generated_at: generatedAt,
      status: 'draft',
    })

    if (insertErr) {
      dbError = insertErr.message || JSON.stringify(insertErr)
    } else {
      // Fetch the ID of what we just inserted
      const { data: latest, error: fetchErr } = await supabase
        .from('executive_summaries')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      summaryId = latest?.id || null
      if (fetchErr) {
        dbError = 'Insert OK but fetch failed: ' + (fetchErr.message || JSON.stringify(fetchErr))
      }
    }

    return NextResponse.json({
      id: summaryId,
      html: summaryHTML,
      projectName: project.name,
      market: project.market,
      buildingCount: buildings.length,
      generatedAt,
      generatedBy: userEmail || null,
      status: 'draft',
    })
  } catch (err) {
    console.error('Executive summary error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET endpoint to load summaries
// - If userEmail is provided: returns the user's latest draft OR the published version (draft takes priority for the author)
// - If no userEmail: returns only the published version
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const userEmail = searchParams.get('userEmail')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // First, check if the current user has a draft
    if (userEmail) {
      const { data: draft } = await supabase
        .from('executive_summaries')
        .select('*')
        .eq('project_id', projectId)
        .eq('generated_by', userEmail)
        .eq('status', 'draft')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (draft) {
        return NextResponse.json({
          found: true,
          id: draft.id,
          html: draft.html,
          projectName: draft.project_name,
          market: draft.market,
          buildingCount: draft.building_count,
          generatedAt: draft.generated_at,
          generatedBy: draft.generated_by,
          customPrompt: draft.custom_prompt,
          status: 'draft',
        })
      }
    }

    // No draft for this user, look for the latest published version
    const { data: published } = await supabase
      .from('executive_summaries')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .single()

    if (!published) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found: true,
      id: published.id,
      html: published.html,
      projectName: published.project_name,
      market: published.market,
      buildingCount: published.building_count,
      generatedAt: published.generated_at,
      generatedBy: published.generated_by,
      publishedBy: published.published_by,
      publishedAt: published.published_at,
      customPrompt: published.custom_prompt,
      status: 'published',
    })
  } catch (err) {
    console.error('Executive summary load error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH endpoint to publish a draft
export async function PATCH(request: NextRequest) {
  try {
    const { summaryId, projectId, userEmail } = await request.json()

    const supabase = getSupabase()

    // Find the draft to publish - by ID if provided, otherwise latest draft for this project+user
    let targetId = summaryId
    if (!targetId && projectId && userEmail) {
      const { data: latest } = await supabase
        .from('executive_summaries')
        .select('id')
        .eq('project_id', projectId)
        .eq('generated_by', userEmail)
        .eq('status', 'draft')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()
      targetId = latest?.id
    }
    // Still no target? Try latest draft for this project regardless of user
    if (!targetId && projectId) {
      const { data: latest } = await supabase
        .from('executive_summaries')
        .select('id, project_id')
        .eq('project_id', projectId)
        .eq('status', 'draft')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()
      targetId = latest?.id
    }

    if (!targetId) {
      return NextResponse.json({ error: 'No draft found to publish' }, { status: 404 })
    }

    // Get the project_id for this summary
    const { data: current } = await supabase
      .from('executive_summaries')
      .select('project_id')
      .eq('id', targetId)
      .single()

    if (current) {
      // Unpublish any previously published summaries for this project
      await supabase
        .from('executive_summaries')
        .update({ status: 'draft' })
        .eq('project_id', current.project_id)
        .eq('status', 'published')
    }

    // Publish this one
    const { data, error } = await supabase
      .from('executive_summaries')
      .update({
        status: 'published',
        published_by: userEmail || null,
        published_at: new Date().toISOString(),
      })
      .eq('id', targetId)
      .select('*')
      .single()

    if (error) {
      console.error('Publish update error:', error)
      return NextResponse.json({ error: 'Failed to publish' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: 'published',
      publishedBy: userEmail,
      publishedAt: data.published_at,
    })
  } catch (err) {
    console.error('Executive summary publish error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
