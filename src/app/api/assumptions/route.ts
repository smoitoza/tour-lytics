import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { debitTokens } from '@/lib/tokens'

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
    // CAPEX fields
    capex_construction_total = 0,
    capex_construction_per_rsf = 0,
    capex_construction_input_mode = 'total',
    capex_construction_depreciation_years = 15,
    capex_ffe_total = 0,
    capex_ffe_per_rsf = 0,
    capex_ffe_input_mode = 'total',
    capex_ffe_depreciation_years = 7,
    capex_it_total = 0,
    capex_it_per_rsf = 0,
    capex_it_input_mode = 'total',
    capex_it_depreciation_years = 5,
    capex_custom_items = [],
  } = body

  if (!building_address) {
    return NextResponse.json({ error: 'building_address is required' }, { status: 400 })
  }

  // Log assumptions update (free action, 0 tokens, but tracked for analytics)
  try {
    await debitTokens({
      projectId,
      action: 'assumptions_update',
      userEmail: updated_by,
      metadata: { building_address },
      note: `Assumptions: ${building_address}`,
    })
  } catch (e) {
    console.warn('Token log skipped:', (e as Error).message)
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
      // CAPEX
      capex_construction_total,
      capex_construction_per_rsf,
      capex_construction_input_mode,
      capex_construction_depreciation_years,
      capex_ffe_total,
      capex_ffe_per_rsf,
      capex_ffe_input_mode,
      capex_ffe_depreciation_years,
      capex_it_total,
      capex_it_per_rsf,
      capex_it_input_mode,
      capex_it_depreciation_years,
      capex_custom_items,
      updated_by,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,building_address' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
