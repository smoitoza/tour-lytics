import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { debitTokens } from '@/lib/tokens'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Touch project updated_at so dashboard sorts correctly
async function touchProject(projectId: string) {
  try {
    await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
  } catch { /* non-critical */ }
}

// GET - fetch assumptions for a project + building (or all buildings)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const buildingAddress = searchParams.get('buildingAddress')

  const componentLabel = searchParams.get('componentLabel') || null

  if (buildingAddress) {
    // Fetch assumptions for a specific building (+ optional component)
    let query = supabase
      .from('project_assumptions')
      .select('*')
      .eq('project_id', projectId)
      .eq('building_address', buildingAddress)

    if (componentLabel) {
      query = query.eq('component_label', componentLabel)
    } else {
      query = query.is('component_label', null)
    }

    const { data, error } = await query.single()

    if (error && error.code === 'PGRST116') {
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
    component_label = null,
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
    // CAPEX payout schedule fields
    capex_payout_type = 'month1',
    capex_payout_month = 1,
    capex_payout_start = 1,
    capex_payout_end = 1,
    capex_milestones = null,
    capex_in_service_month = 1,
    // Broker fee fields
    broker_fee_type = 'none',
    broker_fee_amount = 0,
    broker_fee_notes = '',
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

  const rowData = {
    project_id: projectId,
    building_address,
    component_label: component_label || null,
    opex_food_beverage,
    opex_workplace_experience,
    opex_maintenance_security,
    opex_custom_items,
    headcount,
    target_density_rsf,
    discount_rate,
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
    capex_payout_type,
    capex_payout_month,
    capex_payout_start,
    capex_payout_end,
    capex_milestones,
    capex_in_service_month,
    broker_fee_type,
    broker_fee_amount,
    broker_fee_notes,
    updated_by,
    updated_at: new Date().toISOString(),
  }

  // Check if a row exists for this project + building + component
  let existsQuery = supabase
    .from('project_assumptions')
    .select('id')
    .eq('project_id', projectId)
    .eq('building_address', building_address)
  if (component_label) {
    existsQuery = existsQuery.eq('component_label', component_label)
  } else {
    existsQuery = existsQuery.is('component_label', null)
  }
  const { data: existing } = await existsQuery.maybeSingle()

  let data, error
  if (existing) {
    // Update
    const result = await supabase
      .from('project_assumptions')
      .update(rowData)
      .eq('id', existing.id)
      .select()
      .single()
    data = result.data
    error = result.error
  } else {
    // Insert
    const result = await supabase
      .from('project_assumptions')
      .insert(rowData)
      .select()
      .single()
    data = result.data
    error = result.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await touchProject(projectId)
  return NextResponse.json(data)
}
