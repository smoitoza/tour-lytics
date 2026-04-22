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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Geocode a single address via Google Maps API with retry-on-throttle
async function geocodeOne(address: string, apiKey: string, retries = 3): Promise<GeocodeResult> {
  const input = address.trim()
  if (!input) {
    return { input, lat: null, lng: null, formattedAddress: null, status: 'EMPTY_INPUT' }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
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
      // Transient throttling - retry with exponential backoff
      if (data.status === 'OVER_QUERY_LIMIT' && attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt)) // 1s, 2s, 4s
        continue
      }
      return { input, lat: null, lng: null, formattedAddress: null, status: data.status || 'UNKNOWN_ERROR', error: data.error_message }
    } catch (e: any) {
      if (attempt < retries) {
        await sleep(500 * Math.pow(2, attempt))
        continue
      }
      return { input, lat: null, lng: null, formattedAddress: null, status: 'FETCH_ERROR', error: e?.message }
    }
  }
  return { input, lat: null, lng: null, formattedAddress: null, status: 'EXHAUSTED_RETRIES' }
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

    // Process in parallel batches of 5 (reduced from 10) with a small
    // delay between batches to avoid OVER_QUERY_LIMIT from Google.
    // Individual requests also retry on throttle with exponential backoff.
    const results: GeocodeResult[] = []
    const BATCH_SIZE = 5
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map(addr => geocodeOne(addr, apiKey)))
      results.push(...batchResults)
      // Small pause between batches to stay under Google's 50 req/sec rate limit
      if (i + BATCH_SIZE < addresses.length) await sleep(100)
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
