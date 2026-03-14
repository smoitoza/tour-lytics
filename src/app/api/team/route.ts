import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - list team members for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'

  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - add a team member
export async function POST(req: Request) {
  const body = await req.json()
  const { email, displayName, display_name, persona, projectId = 'sf-office-search', addedBy } = body
  const memberName = displayName || display_name || null

  if (!email || !persona) {
    return NextResponse.json({ error: 'Email and persona are required' }, { status: 400 })
  }

  if (!['admin', 'broker', 'touree'].includes(persona)) {
    return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_members')
    .upsert({
      email: email.toLowerCase().trim(),
      display_name: memberName,
      persona,
      project_id: projectId,
      added_by: addedBy,
    }, { onConflict: 'email,project_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - remove a team member
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  // Support both query param (?id=...) and JSON body ({ email, projectId })
  if (id) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // JSON body approach: delete by email + projectId
  try {
    const body = await req.json()
    const { email, projectId = 'sf-office-search' } = body
    if (!email) return NextResponse.json({ error: 'Email or ID is required' }, { status: 400 })

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('email', email.toLowerCase().trim())
      .eq('project_id', projectId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'ID or email is required' }, { status: 400 })
  }
}
