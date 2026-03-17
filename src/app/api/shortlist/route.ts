import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - fetch the shortlist for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'

  const { data, error } = await supabase
    .from('shortlist_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - add a building to the shortlist
export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId = 'sf-office-search',
    buildingType,
    buildingId,
    buildingName,
    buildingAddress = '',
    buildingColor = '#9ca3af',
    buildingMeta = '',
    buildingTags = [],
    lat,
    lng,
    pdfPage,
    sortOrder = 0,
    addedBy,
  } = body

  if (!buildingType || buildingId === undefined || !buildingName) {
    return NextResponse.json({ error: 'buildingType, buildingId, and buildingName are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('shortlist_items')
    .upsert({
      project_id: projectId,
      building_type: buildingType,
      building_id: buildingId,
      building_name: buildingName,
      building_address: buildingAddress,
      building_color: buildingColor,
      building_meta: buildingMeta,
      building_tags: buildingTags,
      lat,
      lng,
      pdf_page: pdfPage,
      sort_order: sortOrder,
      added_by: addedBy,
    }, { onConflict: 'project_id,building_type,building_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - remove a building from the shortlist
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const buildingType = searchParams.get('buildingType')
  const buildingId = searchParams.get('buildingId')

  if (id) {
    const { error } = await supabase.from('shortlist_items').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (buildingType && buildingId) {
    const { error } = await supabase
      .from('shortlist_items')
      .delete()
      .eq('project_id', projectId)
      .eq('building_type', buildingType)
      .eq('building_id', Number(buildingId))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'id or buildingType+buildingId required' }, { status: 400 })
}
