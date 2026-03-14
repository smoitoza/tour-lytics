import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - list survey submissions (optionally filtered by user or building)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const userEmail = searchParams.get('userEmail')
  const buildingKey = searchParams.get('buildingKey')
  const status = searchParams.get('status')

  let query = supabase
    .from('survey_submissions')
    .select('*')
    .eq('project_id', projectId)

  if (userEmail) query = query.eq('user_email', userEmail)
  if (buildingKey) query = query.eq('building_key', buildingKey)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('submitted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - submit or update a survey
export async function POST(req: Request) {
  const body = await req.json()
  const {
    userEmail,
    projectId = 'sf-office-search',
    buildingKey,
    buildingName,
    scores,
    notes = '',
    status = 'submitted',
  } = body

  if (!userEmail || !buildingKey || !buildingName || !scores) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('survey_submissions')
    .upsert({
      user_email: userEmail.toLowerCase().trim(),
      project_id: projectId,
      building_key: buildingKey,
      building_name: buildingName,
      scores,
      notes,
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,building_key,project_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - remove a survey submission (admin only)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  const { error } = await supabase
    .from('survey_submissions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
