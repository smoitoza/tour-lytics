import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Allow up to 30s for DB operations (cold starts + large building arrays)
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/survey-buildings?projectId=xxx - Load all survey buildings for a project
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('survey_buildings')
    .select('*')
    .eq('project_id', projectId)
    .order('num', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform DB column names (snake_case) to client format (camelCase)
  const buildings = (data || []).map((row: any) => ({
    num: row.num,
    address: row.address,
    neighborhood: row.neighborhood || '',
    owner: row.owner || '',
    yearBuiltClass: row.year_built_class || '',
    buildingSF: row.building_sf || '',
    stories: row.stories || '',
    spaceAvailable: row.space_available || '',
    rentalRate: row.rental_rate || '',
    directSublease: row.direct_sublease || '',
    floors: row.floors || [],
    lat: row.lat,
    lng: row.lng,
    surveyPdfUrl: row.survey_pdf_url || '',
    estimatedPage: row.survey_pdf_page || null,
    links: row.links || [],
    property_type: row.property_type || '',
  }))

  return NextResponse.json(buildings)
}

// DELETE /api/survey-buildings?projectId=xxx - Delete all survey buildings for a project
export async function DELETE(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('survey_buildings')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Reset project buildings count
  await supabase
    .from('projects')
    .update({ buildings_count: 0 })
    .eq('id', projectId)

  return NextResponse.json({ success: true })
}

// POST /api/survey-buildings - Save parsed buildings for a project
// Body: { projectId, buildings: [...] }
export async function POST(req: NextRequest) {
  try {
    const { projectId, buildings } = await req.json()

    if (!projectId || !buildings || !Array.isArray(buildings)) {
      return NextResponse.json({ error: 'projectId and buildings array required' }, { status: 400 })
    }

    // Transform to DB format and upsert (dedup by project_id + address)
    const rows = buildings.map((b: any) => ({
      project_id: projectId,
      num: b.num,
      address: b.address,
      neighborhood: b.neighborhood || '',
      owner: b.owner || '',
      year_built_class: b.yearBuiltClass || '',
      building_sf: b.buildingSF || '',
      stories: b.stories || '',
      space_available: b.spaceAvailable || '',
      rental_rate: b.rentalRate || '',
      direct_sublease: b.directSublease || '',
      floors: b.floors || [],
      lat: b.lat,
      lng: b.lng,
      survey_pdf_url: b.surveyPdfUrl || null,
      survey_pdf_page: b.estimatedPage || null,
      links: b.links || [],
      property_type: b.property_type || '',
    }))

    const { data, error } = await supabase
      .from('survey_buildings')
      .upsert(rows, { onConflict: 'project_id,address' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update the project's buildings_count
    const { count } = await supabase
      .from('survey_buildings')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (count !== null) {
      await supabase
        .from('projects')
        .update({ buildings_count: count })
        .eq('id', projectId)
    }

    return NextResponse.json({ saved: data?.length || 0, total: count || 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
