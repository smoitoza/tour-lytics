import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Places API (New) - Text Search
 * Searches for nearby places using natural language queries like
 * "coffee shops near 250 Brannan Street, San Francisco"
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      )
    }

    const { query, maxResults = 5 } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'places.displayName',
            'places.formattedAddress',
            'places.rating',
            'places.userRatingCount',
            'places.priceLevel',
            'places.currentOpeningHours',
            'places.regularOpeningHours',
            'places.websiteUri',
            'places.googleMapsUri',
            'places.primaryType',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: Math.min(maxResults, 10),
          languageCode: 'en',
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Google Places API error:', response.status, errorData)
      return NextResponse.json(
        { error: `Google Places API error: ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()

    // Simplify the response for the chatbot
    const places = (data.places || []).map((place: Record<string, unknown>) => {
      const openingHours = (place.currentOpeningHours || place.regularOpeningHours) as Record<string, unknown> | undefined
      const weekday = openingHours?.weekdayDescriptions as string[] | undefined

      return {
        name: (place.displayName as Record<string, string>)?.text || 'Unknown',
        address: place.formattedAddress || '',
        rating: place.rating || null,
        reviewCount: place.userRatingCount || null,
        priceLevel: place.priceLevel || null,
        type: place.primaryType || null,
        website: place.websiteUri || null,
        googleMapsUrl: place.googleMapsUri || null,
        hours: weekday ? weekday.slice(0, 7) : null,
      }
    })

    return NextResponse.json({ places })
  } catch (err) {
    console.error('Places API route error:', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
