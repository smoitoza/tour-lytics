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

  let query = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  // If email is provided, show projects the user created or is a member of
  // For now, show all projects (access control via project_members in the future)
  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

/* POST /api/projects -- create a new project (admin only) */
export async function POST(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    const { name, market, description, createdBy } = body

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

    const project = {
      id: slug,
      name: name.trim(),
      market: (market || '').trim(),
      description: (description || '').trim(),
      status: 'active',
      buildings_count: 0,
      sqft: '',
      shortlisted_count: 0,
      created_by: createdBy,
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also add the creator as an admin member on the project
    await supabase
      .from('project_members')
      .upsert({
        email: createdBy,
        project_id: slug,
        persona: 'admin',
        display_name: createdBy.split('@')[0],
      }, { onConflict: 'email,project_id' })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
