import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/dashboard-stats?email=xxx - Aggregate stats across all user's projects
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  try {
    // Get all project IDs this user owns
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('email', email.toLowerCase().trim())

    const projectIds = (memberships || []).map(m => m.project_id)
    if (projectIds.length === 0) {
      return NextResponse.json({ buildings: 0, sqft: 0, shortlisted: 0, leaseValue: 0, projects: 0 })
    }

    // Count survey buildings across all projects
    const { count: buildingCount } = await supabase
      .from('survey_buildings')
      .select('*', { count: 'exact', head: true })
      .in('project_id', projectIds)

    // Count shortlisted buildings
    const { count: shortlistedCount } = await supabase
      .from('shortlist')
      .select('*', { count: 'exact', head: true })
      .in('project_id', projectIds)

    // Sum total available SF from survey buildings
    const { data: sqftData } = await supabase
      .from('survey_buildings')
      .select('space_available')
      .in('project_id', projectIds)

    let totalSqft = 0
    ;(sqftData || []).forEach((b: any) => {
      const val = String(b.space_available || '').replace(/[^0-9]/g, '')
      const num = parseInt(val)
      if (!isNaN(num)) totalSqft += num
    })

    // Sum total lease value from RFP submissions (all-in cost or total rent)
    const { data: rfpData } = await supabase
      .from('rfp_submissions')
      .select('analysis')
      .in('project_id', projectIds)

    let totalLeaseValue = 0
    ;(rfpData || []).forEach((r: any) => {
      if (r.analysis?.summary) {
        const s = r.analysis.summary
        // Use total_all_in_cost or total_base_rent_all_years
        const val = s.total_all_in_cost || s.total_base_rent_all_years || s.total_rent_all_years || 0
        if (typeof val === 'number') totalLeaseValue += val
      }
    })

    return NextResponse.json({
      buildings: buildingCount || 0,
      sqft: totalSqft,
      shortlisted: shortlistedCount || 0,
      leaseValue: Math.round(totalLeaseValue),
      projects: projectIds.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
