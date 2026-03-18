import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VALID_PERSONAS = ['admin', 'broker', 'cre_team', 'touree']
const VALID_ROLES = ['owner', 'admin', 'member', 'viewer']

// GET - list team members for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const email = searchParams.get('email') // optional: for fetching user's projects

  // If email is provided without projectId filter, return all projects for this user
  if (email && searchParams.get('mode') === 'my-projects') {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, projects:project_id(id, name, market, status, buildings_count, sqft, shortlisted_count, owner_id, created_by, created_at)')
      .eq('email', email.toLowerCase().trim())
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

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
  const { email, displayName, display_name, persona, role, projectId = 'sf-office-search', addedBy } = body
  const memberName = displayName || display_name || null

  if (!email || !persona) {
    return NextResponse.json({ error: 'Email and persona are required' }, { status: 400 })
  }

  if (!VALID_PERSONAS.includes(persona)) {
    return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
  }

  // Determine role: if not provided, infer from persona
  let memberRole = role || 'member'
  if (!role) {
    if (persona === 'admin') memberRole = 'admin'
    else if (persona === 'touree') memberRole = 'viewer'
    else memberRole = 'member'
  }

  if (!VALID_ROLES.includes(memberRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Prevent assigning owner role through add member (owner is set at project creation)
  if (memberRole === 'owner') {
    return NextResponse.json({ error: 'Cannot assign owner role through team management. Owner is set at project creation.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_members')
    .upsert({
      email: email.toLowerCase().trim(),
      display_name: memberName,
      persona,
      role: memberRole,
      project_id: projectId,
      added_by: addedBy,
    }, { onConflict: 'email,project_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH - update a team member's role or persona
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { email, persona, role, projectId = 'sf-office-search' } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const updates: Record<string, string> = {}

    if (persona) {
      if (!VALID_PERSONAS.includes(persona)) {
        return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
      }
      updates.persona = persona
    }

    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      // Cannot change someone to/from owner via PATCH
      if (role === 'owner') {
        return NextResponse.json({ error: 'Cannot assign owner role via team management.' }, { status: 400 })
      }
      // Check if target is the current owner (can't demote owner)
      const { data: member } = await supabase
        .from('project_members')
        .select('role')
        .eq('email', email.toLowerCase().trim())
        .eq('project_id', projectId)
        .single()

      if (member?.role === 'owner') {
        return NextResponse.json({ error: 'Cannot change the Project Owner role. Transfer ownership first.' }, { status: 400 })
      }
      updates.role = role
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_members')
      .update(updates)
      .eq('email', email.toLowerCase().trim())
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// DELETE - remove a team member
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  // Support both query param (?id=...) and JSON body ({ email, projectId })
  if (id) {
    // Check if trying to remove an owner
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('id', id)
      .single()

    if (member?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the Project Owner.' }, { status: 400 })
    }

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

    // Check if trying to remove an owner
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('email', email.toLowerCase().trim())
      .eq('project_id', projectId)
      .single()

    if (member?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the Project Owner.' }, { status: 400 })
    }

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
