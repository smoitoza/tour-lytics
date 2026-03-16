import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - fetch assumptions for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'

  const { data, error } = await supabase
    .from('project_assumptions')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error && error.code === 'PGRST116') {
    // No row found - return defaults
    return NextResponse.json(null)
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - save/update assumptions for a project
export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId = 'sf-office-search',
    opex_food_beverage = 0,
    opex_workplace_experience = 0,
    opex_maintenance_security = 0,
    opex_custom_items = [],
    headcount = 0,
    target_density_rsf = 0,
    discount_rate = 6.0,
    updated_by = '',
  } = body

  const { data, error } = await supabase
    .from('project_assumptions')
    .upsert({
      project_id: projectId,
      opex_food_beverage,
      opex_workplace_experience,
      opex_maintenance_security,
      opex_custom_items,
      headcount,
      target_density_rsf,
      discount_rate,
      updated_by,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
