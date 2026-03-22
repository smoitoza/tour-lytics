import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/project-offices?projectId=xxx
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('project_offices')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/project-offices - Add a new office location (geocodes server-side)
export async function POST(req: NextRequest) {
  try {
    const { projectId, label, address } = await req.json()
    if (!projectId || !address?.trim()) {
      return NextResponse.json({ error: 'projectId and address are required' }, { status: 400 })
    }

    const addr = address.trim()
    const officeLabel = (label || 'Current Office').trim()

    // Geocode server-side
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY
    let lat: number | null = null
    let lng: number | null = null

    if (mapsKey) {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${mapsKey}`
      )
      const geoData = await geoRes.json()
      if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
        lat = geoData.results[0].geometry.location.lat
        lng = geoData.results[0].geometry.location.lng
      } else {
        return NextResponse.json({ error: 'Could not find that address. Please check and try again.' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('project_offices')
      .insert({ project_id: projectId, label: officeLabel, address: addr, lat, lng })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/project-offices?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('project_offices')
    .delete()
    .eq('id', parseInt(id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
