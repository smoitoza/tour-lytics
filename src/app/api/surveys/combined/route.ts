import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - combined/averaged scores for all buildings
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const includeDetails = searchParams.get('includeDetails') === 'true'

  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'submitted')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate scores by building
  const buildingMap: Record<string, {
    building_key: string
    building_name: string
    total_responses: number
    category_averages: Record<string, number>
    overall_average: number
    submissions?: Array<{
      user_email: string
      scores: Record<string, number>
      notes: string
      submitted_at: string
    }>
  }> = {}

  for (const submission of (data || [])) {
    const key = submission.building_key
    if (!buildingMap[key]) {
      buildingMap[key] = {
        building_key: key,
        building_name: submission.building_name,
        total_responses: 0,
        category_averages: {},
        overall_average: 0,
        ...(includeDetails ? { submissions: [] } : {}),
      }
    }

    buildingMap[key].total_responses++

    // Accumulate category scores
    const scores = submission.scores as Record<string, number>
    for (const [cat, score] of Object.entries(scores)) {
      if (typeof score === 'number' && score > 0) {
        buildingMap[key].category_averages[cat] =
          (buildingMap[key].category_averages[cat] || 0) + score
      }
    }

    if (includeDetails && buildingMap[key].submissions) {
      buildingMap[key].submissions!.push({
        user_email: submission.user_email,
        scores: submission.scores,
        notes: submission.notes,
        submitted_at: submission.submitted_at,
      })
    }
  }

  // Calculate averages
  const results = Object.values(buildingMap).map((building) => {
    const avgCategories: Record<string, number> = {}
    let totalCatScore = 0
    let totalCatCount = 0

    for (const [cat, totalScore] of Object.entries(building.category_averages)) {
      avgCategories[cat] = Number((totalScore / building.total_responses).toFixed(1))
      totalCatScore += avgCategories[cat]
      totalCatCount++
    }

    return {
      ...building,
      category_averages: avgCategories,
      overall_average: totalCatCount > 0
        ? Number((totalCatScore / totalCatCount).toFixed(1))
        : 0,
    }
  })

  // Sort by overall average descending
  results.sort((a, b) => b.overall_average - a.overall_average)

  return NextResponse.json(results)
}
