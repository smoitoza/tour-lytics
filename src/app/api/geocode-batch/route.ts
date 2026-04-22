import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // geocoding can take a while for big CSVs

interface GeocodeResult {
  input: string
  lat: number | null
  lng: number | null
  formattedAddress: string | null
  status: string
  error?: string
}

// Geocode a single address via Google Maps API
async function geocodeOne(address: string, apiKey: string): Promise<GeocodeResult> {
  const input = address.trim()
  if (!input) {
    return { input, lat: null, lng: null, formattedAddress: null, status: 'EMPTY_INPUT' }
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input)}&key=${apiKey}`
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results?.[0]) {
      const r = data.results[0]
      return {
        input,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        formattedAddress: r.formatted_address,
        status: 'OK',
      }
    }
    return { input, lat: null, lng: null, formattedAddress: null, status: data.status || 'UNKNOWN_ERROR', error: data.error_message }
  } catch (e: any) {
    return { input, lat: null, lng: null, formattedAddress: null, status: 'FETCH_ERROR', error: e?.message }
  }
}

// POST /api/geocode-batch
// Body: { addresses: string[] }
// Returns: { results: GeocodeResult[], success_count, failed_count }
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured.' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const addresses: string[] = Array.isArray(body.addresses) ? body.addresses : []

    if (addresses.length === 0) {
      return NextResponse.json({ error: 'addresses array is required' }, { status: 400 })
    }
    if (addresses.length > 500) {
      return NextResponse.json({ error: 'Max 500 addresses per batch. Split your CSV.' }, { status: 400 })
    }

    // Process in parallel batches of 10 to avoid overwhelming the API
    const results: GeocodeResult[] = []
    const BATCH_SIZE = 10
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map(addr => geocodeOne(addr, apiKey)))
      results.push(...batchResults)
    }

    const success_count = results.filter(r => r.status === 'OK').length
    const failed_count = results.length - success_count

    return NextResponse.json({
      results,
      success_count,
      failed_count,
      total: results.length,
    })
  } catch (err: any) {
    console.error('geocode-batch error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
