import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
}

/* GET /api/projects -- list all projects (optionally filter by user email) */
export async function GET(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const email = req.nextUrl.searchParams.get('email')

  if (email) {
    // Return projects the user is a member of, with their role
    const { data: memberships, error: memberError } = await supabase
      .from('project_members')
      .select('role, persona, project_id')
      .eq('email', email.toLowerCase().trim())

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Get all project IDs this user belongs to
    const projectIds = (memberships || []).map(m => m.project_id)

    if (projectIds.length === 0) {
      return NextResponse.json([])
    }

    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 })
    }

    // Merge role info into projects
    const memberMap = new Map(
      (memberships || []).map(m => [m.project_id, { role: m.role, persona: m.persona }])
    )

    const enriched = (projects || []).map(p => ({
      ...p,
      user_role: memberMap.get(p.id)?.role || 'viewer',
      user_persona: memberMap.get(p.id)?.persona || 'touree',
    }))

    return NextResponse.json(enriched)
  }

  // No email filter - return all non-deleted projects
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

/* DELETE /api/projects?id=<slug>&email=<admin-email> -- soft-delete a project */
export async function DELETE(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const projectId = req.nextUrl.searchParams.get('id')
  const email = req.nextUrl.searchParams.get('email')

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 })
  }

  // Check if user is the project owner or the global admin
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, created_by')
    .eq('id', projectId)
    .single()

  const isOwner = email === project?.owner_id || email === project?.created_by
  const isGlobalAdmin = email === 'samoitoza@gmail.com'

  if (!isOwner && !isGlobalAdmin) {
    return NextResponse.json({ error: 'Only the project owner can delete projects.' }, { status: 403 })
  }

  // Prevent deleting the SF demo project
  if (projectId === 'sf-office-search') {
    return NextResponse.json({ error: 'Cannot delete the demo project.' }, { status: 400 })
  }

  // Soft-delete: mark status as 'deleted'
  const { error } = await supabase
    .from('projects')
    .update({ status: 'deleted' })
    .eq('id', projectId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/* PATCH /api/projects -- update project fields (owner only) */
export async function PATCH(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)
  try {
    const body = await req.json()
    const { projectId, hq_address } = body
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}

    // Name update
    if (body.name !== undefined && body.name.trim()) {
      updates.name = body.name.trim()
    }

    // Market update
    if (body.market !== undefined) {
      updates.market = (body.market || '').trim()
    }

    // Status update
    if (body.status !== undefined) {
      const validStatuses = ['active', 'on_hold', 'complete']
      if (validStatuses.includes(body.status)) {
        updates.status = body.status
      }
    }

    if (hq_address !== undefined) {
      const addr = (hq_address || '').trim()
      updates.hq_address = addr

      if (addr) {
        // Geocode server-side using the unrestricted API key
        const mapsKey = process.env.GOOGLE_MAPS_API_KEY
        if (mapsKey) {
          try {
            const geoRes = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${mapsKey}`
            )
            const geoData = await geoRes.json()
            if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
              updates.hq_lat = geoData.results[0].geometry.location.lat
              updates.hq_lng = geoData.results[0].geometry.location.lng
            } else {
              return NextResponse.json({ error: 'Could not geocode that address. Please check and try again.' }, { status: 400 })
            }
          } catch {
            return NextResponse.json({ error: 'Geocoding service unavailable.' }, { status: 500 })
          }
        }
      } else {
        // Clearing HQ
        updates.hq_lat = null
        updates.hq_lng = null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, hq_lat: updates.hq_lat, hq_lng: updates.hq_lng })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/* POST /api/projects -- create a new project (any authenticated user) */
export async function POST(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    const { name, market, description, createdBy, client_name, hq_address, currency } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
    }
    if (!createdBy) {
      return NextResponse.json({ error: 'Creator email is required.' }, { status: 400 })
    }

    // Generate a slug from the name
    let slug = slugify(name)
    
    // Check for uniqueness
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', slug)
      .maybeSingle()

    if (existing) {
      // Append a short random suffix
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`
    }

    const project: Record<string, any> = {
      id: slug,
      name: name.trim(),
      market: (market || '').trim(),
      description: (description || '').trim(),
      client_name: (client_name || '').trim(),
      status: 'active',
      buildings_count: 0,
      sqft: '',
      shortlisted_count: 0,
      created_by: createdBy,
      owner_id: createdBy, // Project creator is the owner
      currency: currency || 'USD',
    }

    // Geocode HQ address server-side if provided
    if (hq_address && hq_address.trim()) {
      project.hq_address = hq_address.trim()
      const mapsKey = process.env.GOOGLE_MAPS_API_KEY
      if (mapsKey) {
        try {
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(hq_address.trim())}&key=${mapsKey}`
          )
          const geoData = await geoRes.json()
          if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
            project.hq_lat = geoData.results[0].geometry.location.lat
            project.hq_lng = geoData.results[0].geometry.location.lng
          }
        } catch { /* geocode failed, skip */ }
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Add the creator as owner + admin persona on the project
    await supabase
      .from('project_members')
      .upsert({
        email: createdBy,
        project_id: slug,
        persona: 'admin',
        role: 'owner',
        display_name: createdBy.split('@')[0],
      }, { onConflict: 'email,project_id' })

    // Token seeding is now handled at the user level via a database trigger on auth.users INSERT.
    // New projects draw from the user's account balance — no per-project seeding needed.

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
