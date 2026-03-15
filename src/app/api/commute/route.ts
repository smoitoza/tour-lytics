import { NextResponse } from 'next/server'

interface Employee {
  name: string
  lat: number
  lng: number
}

interface Building {
  name: string
  address: string
  lat?: number
  lng?: number
}

interface MatrixElement {
  status: string
  duration?: { value: number; text: string }
  distance?: { value: number; text: string }
}

// Google Distance Matrix API allows max 25 origins or 25 destinations per request
// and max 100 elements (origins * destinations) per request
const MAX_ELEMENTS_PER_REQUEST = 100
const MAX_ORIGINS_PER_REQUEST = 25
const MAX_DESTINATIONS_PER_REQUEST = 25

async function fetchDistanceMatrix(
  origins: string[],
  destinations: string[],
  mode: 'driving' | 'transit',
  apiKey: string
): Promise<MatrixElement[][]> {
  const originsParam = origins.join('|')
  const destinationsParam = destinations.join('|')

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originsParam)}&destinations=${encodeURIComponent(destinationsParam)}&mode=${mode}&key=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix API error: ${data.status} - ${data.error_message || 'Unknown error'}`)
  }

  return data.rows.map((row: { elements: MatrixElement[] }) => row.elements)
}

// Batch origins into chunks to respect API limits
async function batchedDistanceMatrix(
  employees: Employee[],
  buildings: Building[],
  mode: 'driving' | 'transit',
  apiKey: string
): Promise<MatrixElement[][]> {
  const destinations = buildings.map(b =>
    b.lat && b.lng ? `${b.lat},${b.lng}` : b.address
  )

  // Determine chunk size for origins based on destination count
  const maxOriginsPerBatch = Math.min(
    MAX_ORIGINS_PER_REQUEST,
    Math.floor(MAX_ELEMENTS_PER_REQUEST / destinations.length)
  )

  const results: MatrixElement[][] = []

  for (let i = 0; i < employees.length; i += maxOriginsPerBatch) {
    const chunk = employees.slice(i, i + maxOriginsPerBatch)
    const origins = chunk.map(e => `${e.lat},${e.lng}`)

    const chunkResults = await fetchDistanceMatrix(origins, destinations, mode, apiKey)
    results.push(...chunkResults)

    // Small delay between batches to avoid rate limiting
    if (i + maxOriginsPerBatch < employees.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}

export async function POST(req: Request) {
  try {
    const { employees, buildings } = await req.json() as {
      employees: Employee[]
      buildings: Building[]
    }

    if (!employees?.length || !buildings?.length) {
      return NextResponse.json(
        { error: 'Employees and buildings arrays are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    // Fetch both driving and transit in parallel
    const [drivingResults, transitResults] = await Promise.all([
      batchedDistanceMatrix(employees, buildings, 'driving', apiKey),
      batchedDistanceMatrix(employees, buildings, 'transit', apiKey),
    ])

    // Build response: for each employee, for each building, driving + transit data
    const commuteData = employees.map((emp, ei) => ({
      employee: emp.name,
      commutes: buildings.map((bld, bi) => {
        const driving = drivingResults[ei]?.[bi]
        const transit = transitResults[ei]?.[bi]

        return {
          building: bld.name,
          driving: driving?.status === 'OK' ? {
            duration_seconds: driving.duration!.value,
            duration_text: driving.duration!.text,
            distance_meters: driving.distance!.value,
            distance_text: driving.distance!.text,
          } : null,
          transit: transit?.status === 'OK' ? {
            duration_seconds: transit.duration!.value,
            duration_text: transit.duration!.text,
            distance_meters: transit.distance!.value,
            distance_text: transit.distance!.text,
          } : null,
        }
      })
    }))

    // Calculate building summaries
    const buildingSummaries = buildings.map((bld, bi) => {
      let driveTotalSec = 0, driveCount = 0, driveTotalMeters = 0
      let transitTotalSec = 0, transitCount = 0, transitTotalMeters = 0

      employees.forEach((_, ei) => {
        const driving = drivingResults[ei]?.[bi]
        const transit = transitResults[ei]?.[bi]

        if (driving?.status === 'OK') {
          driveTotalSec += driving.duration!.value
          driveTotalMeters += driving.distance!.value
          driveCount++
        }
        if (transit?.status === 'OK') {
          transitTotalSec += transit.duration!.value
          transitTotalMeters += transit.distance!.value
          transitCount++
        }
      })

      return {
        building: bld.name,
        address: bld.address,
        driving_avg_seconds: driveCount ? Math.round(driveTotalSec / driveCount) : null,
        driving_avg_text: driveCount ? formatDuration(Math.round(driveTotalSec / driveCount)) : 'N/A',
        driving_avg_distance_text: driveCount ? formatDistance(Math.round(driveTotalMeters / driveCount)) : 'N/A',
        transit_avg_seconds: transitCount ? Math.round(transitTotalSec / transitCount) : null,
        transit_avg_text: transitCount ? formatDuration(Math.round(transitTotalSec / transitCount)) : 'N/A',
        transit_avg_distance_text: transitCount ? formatDistance(Math.round(transitTotalMeters / transitCount)) : 'N/A',
        employee_count: employees.length,
      }
    })

    // Sort by driving average
    const ranked = [...buildingSummaries].sort((a, b) =>
      (a.driving_avg_seconds ?? Infinity) - (b.driving_avg_seconds ?? Infinity)
    )

    return NextResponse.json({
      summaries: ranked,
      details: commuteData,
      employee_count: employees.length,
      building_count: buildings.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Commute API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins} min`
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34
  return `${miles.toFixed(1)} mi`
}
