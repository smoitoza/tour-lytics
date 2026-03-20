import { NextRequest, NextResponse } from 'next/server'

/**
 * POI Search API - Google Places (New) Text Search
 * Searches for companies/businesses within map bounds by category.
 * 
 * POST body: {
 *   category: 'technology' | 'manufacturing' | 'energy' | 'custom',
 *   query?: string,          // custom query (for 'custom' category or AI search bar)
 *   lat: number,             // map center latitude
 *   lng: number,             // map center longitude
 *   radius: number,          // search radius in meters (max 50000)
 *   maxResults?: number      // default 20
 * }
 */

const CATEGORY_QUERIES: Record<string, string[]> = {
  technology: [
    'software company',
    'technology company headquarters',
    'tech startup office',
  ],
  manufacturing: [
    'manufacturing company',
    'industrial manufacturing facility',
    'factory headquarters',
  ],
  energy: [
    'energy company',
    'oil and gas company',
    'renewable energy company',
    'utility company headquarters',
  ],
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      )
    }

    const { category, query, lat, lng, radius = 5000, maxResults = 20 } = await request.json()

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'lat and lng are required' },
        { status: 400 }
      )
    }

    // Build search queries
    let searchQueries: string[] = []
    if (category === 'custom' && query) {
      searchQueries = [query]
    } else if (CATEGORY_QUERIES[category]) {
      searchQueries = CATEGORY_QUERIES[category]
    } else if (query) {
      searchQueries = [query]
    } else {
      return NextResponse.json(
        { error: 'category or query required' },
        { status: 400 }
      )
    }

    // Run all category queries in parallel and deduplicate by place ID
    const allPlaces = new Map<string, Record<string, unknown>>()

    await Promise.all(
      searchQueries.map(async (q) => {
        try {
          const response = await fetch(
            'https://places.googleapis.com/v1/places:searchText',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': [
                  'places.id',
                  'places.displayName',
                  'places.formattedAddress',
                  'places.location',
                  'places.primaryType',
                  'places.primaryTypeDisplayName',
                  'places.websiteUri',
                  'places.googleMapsUri',
                ].join(','),
              },
              body: JSON.stringify({
                textQuery: q,
                maxResultCount: Math.min(maxResults, 20),
                languageCode: 'en',
                locationBias: {
                  circle: {
                    center: { latitude: lat, longitude: lng },
                    radius: Math.min(radius, 50000),
                  },
                },
              }),
            }
          )

          if (response.ok) {
            const data = await response.json()
            for (const place of data.places || []) {
              const id = place.id as string
              if (!allPlaces.has(id)) {
                allPlaces.set(id, place)
              }
            }
          }
        } catch (err) {
          console.error(`POI query "${q}" failed:`, err)
        }
      })
    )

    // Format results
    const pois = Array.from(allPlaces.values()).map((place) => ({
      id: place.id,
      name: (place.displayName as Record<string, string>)?.text || 'Unknown',
      address: place.formattedAddress || '',
      lat: (place.location as Record<string, number>)?.latitude,
      lng: (place.location as Record<string, number>)?.longitude,
      type: place.primaryType || null,
      typeLabel: (place.primaryTypeDisplayName as Record<string, string>)?.text || null,
      category: category !== 'custom' ? category : 'custom',
      website: place.websiteUri || null,
      mapsUrl: place.googleMapsUri || null,
    }))

    return NextResponse.json({ pois, count: pois.length })
  } catch (err) {
    console.error('POI API route error:', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
