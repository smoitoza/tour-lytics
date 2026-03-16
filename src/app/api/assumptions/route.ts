import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - fetch assumptions for a project + building (or all buildings)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const buildingAddress = searchParams.get('buildingAddress')

  if (buildingAddress) {
    // Fetch assumptions for a specific building
    const { data, error } = await supabase
      .from('project_assumptions')
      .select('*')
      .eq('project_id', projectId)
      .eq('building_address', buildingAddress)
      .single()

    if (error && error.code === 'PGRST116') {
      // No row found - return null (no assumptions for this building yet)
      return NextResponse.json(null)
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    // Fetch ALL assumptions for the project (used by chatbot)
    const { data, error } = await supabase
      .from('project_assumptions')
      .select('*')
      .eq('project_id', projectId)
      .order('building_address', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }
}

// POST - save/update assumptions for a project + building
export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId = 'sf-office-search',
    building_address = '',
    opex_food_beverage = 0,
    opex_workplace_experience = 0,
    opex_maintenance_security = 0,
    opex_custom_items = [],
    headcount = 0,
    target_density_rsf = 0,
    discount_rate = 6.0,
    updated_by = '',
  } = body

  if (!building_address) {
    return NextResponse.json({ error: 'building_address is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_assumptions')
    .upsert({
      project_id: projectId,
      building_address,
      opex_food_beverage,
      opex_workplace_experience,
      opex_maintenance_security,
      opex_custom_items,
      headcount,
      target_density_rsf,
      discount_rate,
      updated_by,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,building_address' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
