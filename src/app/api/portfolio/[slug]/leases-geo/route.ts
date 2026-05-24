import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 60

type LocRow = {
  id: string
  lease_id: string
  address_line1: string
  address_line2: string | null
  city: string
  state_province: string | null
  postal_code: string | null
  country: string
  latitude: number | null
  longitude: number | null
  geocoded_at: string | null
  is_primary: boolean
}

type LeaseRow = {
  id: string
  name: string
  status: string
  expiration_date: string | null
}

// Server-side geocode via Google Geocoding API. Uses GOOGLE_GEOCODE_API_KEY,
// falling back to GOOGLE_MAPS_API_KEY (both already configured in Vercel for
// the survey/tour-lytics workflows).
// Returns [lng, lat] or null.
async function geocode(query: string, key: string): Promise<[number, number] | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) return null
    const loc = data.results[0]?.geometry?.location
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null
    return [Number(loc.lng), Number(loc.lat)]
  } catch {
    return null
  }
}

function fullAddress(loc: LocRow): string {
  const parts = [
    loc.address_line1,
    loc.city,
    loc.state_province,
    loc.postal_code,
    loc.country,
  ].filter(Boolean)
  return parts.join(', ')
}

// GET /api/portfolio/[slug]/leases-geo
// Returns leases with their primary location's coords. Geocodes lazily and
// caches coords + geocoded_at on portfolio_lease_locations.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getPortfolioAdminClient()

    const { data: company, error: cErr } = await admin
      .from('portfolio_companies')
      .select('id, name, slug')
      .eq('slug', slug)
      .single()
    if (cErr || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('status')
      .eq('company_id', company.id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { data: leases, error: lErr } = await admin
      .from('portfolio_leases')
      .select('id, name, status, expiration_date')
      .eq('company_id', company.id)
    if (lErr) {
      return NextResponse.json({ error: lErr.message }, { status: 500 })
    }

    if (!leases || leases.length === 0) {
      return NextResponse.json({ leases: [] })
    }

    const leaseIds = (leases as LeaseRow[]).map((l) => l.id)

    const { data: locsRaw, error: locErr } = await admin
      .from('portfolio_lease_locations')
      .select('id, lease_id, address_line1, address_line2, city, state_province, postal_code, country, latitude, longitude, geocoded_at, is_primary')
      .in('lease_id', leaseIds)
    if (locErr) {
      return NextResponse.json({ error: locErr.message }, { status: 500 })
    }

    const locs = (locsRaw || []) as LocRow[]

    // Pick primary location per lease (or first if no primary).
    const byLease: Record<string, LocRow> = {}
    for (const loc of locs) {
      const existing = byLease[loc.lease_id]
      if (!existing) {
        byLease[loc.lease_id] = loc
      } else if (!existing.is_primary && loc.is_primary) {
        byLease[loc.lease_id] = loc
      }
    }

    // Geocode any missing coords.
    const geocodeKey = process.env.GOOGLE_GEOCODE_API_KEY || process.env.GOOGLE_MAPS_API_KEY
    if (geocodeKey) {
      for (const leaseId of Object.keys(byLease)) {
        const loc = byLease[leaseId]
        if (loc.latitude != null && loc.longitude != null) continue
        const addr = fullAddress(loc)
        if (!addr) continue
        const coords = await geocode(addr, geocodeKey)
        if (coords) {
          const [lng, lat] = coords
          await admin
            .from('portfolio_lease_locations')
            .update({ latitude: lat, longitude: lng, geocoded_at: new Date().toISOString() })
            .eq('id', loc.id)
          byLease[leaseId] = { ...loc, latitude: lat, longitude: lng }
        }
      }
    }

    const output = (leases as LeaseRow[]).map((l) => {
      const loc = byLease[l.id]
      if (!loc || loc.latitude == null || loc.longitude == null) {
        return {
          id: l.id,
          name: l.name,
          status: l.status,
          expiration_date: l.expiration_date,
          location: null,
        }
      }
      return {
        id: l.id,
        name: l.name,
        status: l.status,
        expiration_date: l.expiration_date,
        location: {
          id: loc.id,
          address_line1: loc.address_line1,
          city: loc.city,
          state_province: loc.state_province,
          country: loc.country,
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
        },
      }
    })

    return NextResponse.json({
      leases: output,
      mapbox_configured: Boolean(geocodeKey),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
