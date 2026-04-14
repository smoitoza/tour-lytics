import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/projects/touch?projectId=xxx -- update project's updated_at timestamp
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const { error } = await supabase
    .from('projects')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
