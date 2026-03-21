import { NextRequest, NextResponse } from 'next/server'
import { debitTokens } from '@/lib/tokens'

interface RouteStop {
  lat: number
  lng: number
  name: string
  id: string | number
  type: string
}

interface RouteLeg {
  startName: string
  endName: string
  distance: { text: string; value: number }
  duration: { text: string; value: number }
  startLocation: { lat: number; lng: number }
  endLocation: { lat: number; lng: number }
}

interface RouteResult {
  mode: string
  optimizedOrder: number[]
  legs: RouteLeg[]
  totalDistance: { text: string; value: number }
  totalDuration: { text: string; value: number }
  overviewPolyline: string
  bounds: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { stops, mode = 'driving', optimize = true, projectId, userEmail } = body as {
      stops: RouteStop[]
      mode?: 'driving' | 'walking'
      optimize?: boolean
      projectId?: string
      userEmail?: string
    }

    if (!stops || stops.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 stops are required to plan a route.' },
        { status: 400 }
      )
    }

    if (stops.length > 25) {
      return NextResponse.json(
        { error: 'Google Directions API supports a maximum of 25 waypoints.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key is not configured.' },
        { status: 500 }
      )
    }

    // Use first stop as origin and last stop as destination
    // Middle stops become waypoints
    const origin = `${stops[0].lat},${stops[0].lng}`
    const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`

    const params = new URLSearchParams({
      origin,
      destination,
      mode,
      key: apiKey,
    })

    // Add waypoints (middle stops)
    if (stops.length > 2) {
      const waypointStr = stops
        .slice(1, -1)
        .map((s) => `${s.lat},${s.lng}`)
        .join('|')
      params.set('waypoints', (optimize ? 'optimize:true|' : '') + waypointStr)
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Directions API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Google Directions API error (status ${response.status})` },
        { status: 502 }
      )
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return NextResponse.json(
          { error: `No ${mode} route found between these locations.` },
          { status: 404 }
        )
      }
      console.error('Directions API status:', data.status, data.error_message)
      return NextResponse.json(
        { error: `Directions API error: ${data.status}. ${data.error_message || ''}` },
        { status: 502 }
      )
    }

    const route = data.routes[0]

    // Map the optimized waypoint order back to our stop indices
    // Google returns waypoint_order for the middle stops (indices 0-based relative to waypoints array)
    // We need to map: [origin, ...reorderedWaypoints, destination]
    let optimizedOrder: number[]
    if (optimize && route.waypoint_order && route.waypoint_order.length > 0) {
      // Only use Google's reordering when optimization was requested
      // waypoint_order maps to stops[1] through stops[N-2]
      optimizedOrder = [
        0,
        ...route.waypoint_order.map((wi: number) => wi + 1),
        stops.length - 1,
      ]
    } else {
      // When not optimizing, preserve the original stop order (already sorted by schedule)
      optimizedOrder = stops.map((_: RouteStop, i: number) => i)
    }

    // Build legs with building names
    const legs: RouteLeg[] = route.legs.map(
      (
        leg: {
          start_address: string
          end_address: string
          distance: { text: string; value: number }
          duration: { text: string; value: number }
          start_location: { lat: number; lng: number }
          end_location: { lat: number; lng: number }
        },
        i: number
      ) => ({
        startName: stops[optimizedOrder[i]]?.name || leg.start_address,
        endName: stops[optimizedOrder[i + 1]]?.name || leg.end_address,
        distance: leg.distance,
        duration: leg.duration,
        startLocation: leg.start_location,
        endLocation: leg.end_location,
      })
    )

    // Calculate totals
    const totalDistanceValue = legs.reduce((sum: number, l: RouteLeg) => sum + l.distance.value, 0)
    const totalDurationValue = legs.reduce((sum: number, l: RouteLeg) => sum + l.duration.value, 0)

    const result: RouteResult = {
      mode,
      optimizedOrder,
      legs,
      totalDistance: {
        text: formatDistance(totalDistanceValue),
        value: totalDistanceValue,
      },
      totalDuration: {
        text: formatDuration(totalDurationValue),
        value: totalDurationValue,
      },
      overviewPolyline: route.overview_polyline?.points || '',
      bounds: route.bounds,
    }

    // Debit tokens for route optimization
    let tokenResult = null
    if (projectId) {
      try {
        tokenResult = await debitTokens({
          projectId,
          action: 'route_optimization',
          userEmail: userEmail || undefined,
          note: `Tour Day route: ${stops.length} stops (${mode})`,
          metadata: { stopCount: stops.length, mode },
        })
      } catch (tokenErr) {
        console.warn('Token debit failed (non-blocking):', tokenErr)
      }
    }

    return NextResponse.json({ ...result, tokenDebit: tokenResult })
  } catch (err) {
    console.error('Route optimization error:', err)
    return NextResponse.json(
      { error: 'Internal server error during route optimization.' },
      { status: 500 }
    )
  }
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.281)
    return `${feet} ft`
  }
  return `${miles.toFixed(1)} mi`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return `${hours}h ${minutes}m`
}
