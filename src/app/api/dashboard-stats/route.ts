import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/dashboard-stats?email=xxx - Aggregate stats across all user's projects
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  try {
    let projectIds: string[] = []
    if (isAdminEmail(email)) {
      // Admin sees aggregate stats across ALL projects
      const { data: allProjects } = await supabase
        .from('projects')
        .select('id')
        .neq('status', 'deleted')
      projectIds = (allProjects || []).map(p => p.id)
    } else {
      // Regular user: only their project memberships
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('email', email.toLowerCase().trim())
      projectIds = (memberships || []).map(m => m.project_id)
    }
    if (projectIds.length === 0) {
      return NextResponse.json({ buildings: 0, sqft: 0, shortlisted: 0, leaseValue: 0, projects: 0 })
    }

    // Fetch survey buildings (id + space_available) for count and sqft sum
    const { data: surveyData } = await supabase
      .from('survey_buildings')
      .select('id, space_available')
      .in('project_id', projectIds)
      .limit(1000)

    const buildingCount = (surveyData || []).length

    let totalSqft = 0
    ;(surveyData || []).forEach((b: any) => {
      const val = String(b.space_available || '').replace(/[^0-9]/g, '')
      const num = parseInt(val)
      if (!isNaN(num)) totalSqft += num
    })

    // Count shortlisted buildings
    const { data: shortlistData } = await supabase
      .from('shortlist')
      .select('id')
      .in('project_id', projectIds)

    const shortlistedCount = (shortlistData || []).length

    // Sum total lease value from RFP submissions
    const { data: rfpData } = await supabase
      .from('rfp_submissions')
      .select('analysis')
      .in('project_id', projectIds)

    let totalLeaseValue = 0
    ;(rfpData || []).forEach((r: any) => {
      const a = r.analysis
      if (!a) return
      // Check multiple possible locations for total lease cost
      const val =
        a.summary?.totalAllInCost ||
        a.summary?.total_all_in_cost ||
        a.cash_flow?.totals?.totalAllInCost ||
        a.cash_flow?.totals?.total_all_in_cost ||
        a.straight_line_pl?.totals?.straightLineAnnualRent ||
        a.summary?.straightLineAnnualExpense ||
        0
      if (typeof val === 'number' && val > 0) totalLeaseValue += val
    })

    // Also sum from projects table as fallback for buildings_count
    const { data: projData } = await supabase
      .from('projects')
      .select('buildings_count')
      .in('id', projectIds)

    const projBuildingCount = (projData || []).reduce((sum: number, p: any) => sum + (p.buildings_count || 0), 0)

    return NextResponse.json({
      buildings: buildingCount || projBuildingCount || 0,
      sqft: totalSqft,
      shortlisted: shortlistedCount,
      leaseValue: Math.round(totalLeaseValue),
      projects: projectIds.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
