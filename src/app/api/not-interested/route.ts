import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

// GET - fetch all not-interested items for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('not_interested_items')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - mark building(s) as not interested
// Supports single: { projectId, buildingType, buildingId, markedBy }
// Supports bulk:   { projectId, items: [{ buildingType, buildingId }], markedBy }
export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId = 'sf-office-search',
    buildingType,
    buildingId,
    items,
    markedBy,
  } = body

  const supabase = createAdminClient()

  // Bulk mode
  if (Array.isArray(items) && items.length > 0) {
    const rows = items.map((item: { buildingType: string; buildingId: number }) => ({
      project_id: projectId,
      building_type: item.buildingType,
      building_id: item.buildingId,
      marked_by: markedBy || null,
    }))

    const { data, error } = await supabase
      .from('not_interested_items')
      .upsert(rows, { onConflict: 'project_id,building_type,building_id' })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Single mode
  if (!buildingType || buildingId === undefined) {
    return NextResponse.json({ error: 'buildingType and buildingId are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('not_interested_items')
    .upsert({
      project_id: projectId,
      building_type: buildingType,
      building_id: buildingId,
      marked_by: markedBy || null,
    }, { onConflict: 'project_id,building_type,building_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - remove not-interested status
// Single: ?projectId=...&buildingType=...&buildingId=...
// Bulk:   body { projectId, items: [{ buildingType, buildingId }] }
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const buildingType = searchParams.get('buildingType')
  const buildingId = searchParams.get('buildingId')

  const supabase = createAdminClient()

  // Check for bulk delete via body
  try {
    const body = await req.json()
    if (Array.isArray(body.items) && body.items.length > 0) {
      const pid = body.projectId || projectId
      // Delete each item
      for (const item of body.items) {
        await supabase
          .from('not_interested_items')
          .delete()
          .eq('project_id', pid)
          .eq('building_type', item.buildingType)
          .eq('building_id', item.buildingId)
      }
      return NextResponse.json({ success: true })
    }
  } catch (e) {
    // No body - use query params for single delete
  }

  // Single delete via query params
  if (buildingType && buildingId) {
    const { error } = await supabase
      .from('not_interested_items')
      .delete()
      .eq('project_id', projectId)
      .eq('building_type', buildingType)
      .eq('building_id', Number(buildingId))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'buildingType+buildingId required' }, { status: 400 })
}
