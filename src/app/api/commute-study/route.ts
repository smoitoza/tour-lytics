import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - fetch saved commute study for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'

  const { data, error } = await supabase
    .from('commute_studies')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error && error.code === 'PGRST116') {
    // No row found - return empty
    return NextResponse.json(null)
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - save/update commute study for a project
export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId = 'sf-office-search',
    filename = '',
    headers = [],
    latCol = 0,
    lngCol = 0,
    employees = [],
    results = {},
    uploadedBy = '',
  } = body

  const { data, error } = await supabase
    .from('commute_studies')
    .upsert({
      project_id: projectId,
      filename,
      headers,
      lat_col: latCol,
      lng_col: lngCol,
      employees,
      results,
      uploaded_by: uploadedBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - clear commute study for a project
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'

  const { error } = await supabase
    .from('commute_studies')
    .delete()
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
