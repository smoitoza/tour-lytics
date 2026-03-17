import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'
import { debitTokens } from '@/lib/tokens'

// Allow up to 60s for AI parsing + geocoding (default is 10s which times out)
export const maxDuration = 60

// POST /api/survey-parse - Parse a broker survey document and extract building data
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { text, userEmail, projectId, market, pdfUrl } = body

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: 'Survey text too short or missing.' }, { status: 400 })
    }

    const aiApiKey = process.env.GOOGLE_AI_API_KEY
    if (!aiApiKey) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })
    }

    // Debit 25 tokens for survey upload
    try {
      const tokenResult = await debitTokens({
        projectId: projectId || 'sf-office-search',
        action: 'survey_map_upload',
        userEmail,
        metadata: { text_length: text.length },
        note: 'Survey document upload and parsing',
      })
      if (!tokenResult.success) {
        return NextResponse.json(
          { error: 'Insufficient tokens for survey upload (25 tokens required).' },
          { status: 402 }
        )
      }
    } catch (e) {
      console.warn('Token debit skipped:', (e as Error).message)
    }

    const ai = new GoogleGenAI({ apiKey: aiApiKey })

    const prompt = `You are a commercial real estate data extraction expert. Parse this broker survey document and extract every building/property listed.

For EACH building found, extract these fields (use null if not found):
- address: The street address (just street, no city/state)
- neighborhood: The neighborhood or district name (e.g. "DUMBO, Brooklyn" or "Financial District")
- owner: The building owner/landlord name
- yearBuiltClass: Year built and class info (e.g., "2015 / Class A Office")
- buildingSF: Total building square footage (e.g., "307,235 SF")
- stories: Number of stories/floors
- spaceAvailable: Available space in SF (e.g., "35,648 SF")
- rentalRate: The rental rate (e.g., "Mid $70's FSG")
- directSublease: "Direct", "Sublease", or "Both"
- estimatedPage: The estimated page number in the original document where this building's detailed listing begins (integer, starting from 1). Look at the document structure - typically a cover/intro page, then a location map, then individual building pages. If the document follows a pattern of one building per page, count accordingly.

IMPORTANT: 
- Extract ALL buildings listed, not just a few
- Keep the exact phrasing from the document for rates, SF figures, etc.
- If a building appears multiple times (different suites), consolidate into one entry with the combined available space
- Include floor/suite details in a "floors" field if available
- The estimatedPage field is critical for linking back to the source document - be as accurate as possible

Return a JSON array. Example format:
[
  {
    "address": "535 Mission Street",
    "neighborhood": "Financial District",
    "owner": "BXP, Inc.",
    "yearBuiltClass": "2015 / Class A Office",
    "buildingSF": "307,235 SF",
    "stories": "27",
    "spaceAvailable": "35,648 SF",
    "rentalRate": "Upper $70's FSG",
    "directSublease": "Direct",
    "estimatedPage": 3,
    "floors": [
      { "floor": "14th Floor", "suite": "1400", "rsf": "12,500 SF", "available": "Now" }
    ]
  }
]

Here is the survey document text:

${text.substring(0, 80000)}

Return ONLY the JSON array, no other text.`

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const responseText = result.text || ''
    
    // Extract JSON from response
    let buildings: any[]
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in AI response')
      buildings = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      return NextResponse.json({ 
        error: 'Failed to parse AI response into structured data.', 
        raw: responseText.substring(0, 2000) 
      }, { status: 500 })
    }

    // Geocode addresses using Google Geocoding API for building-level accuracy
    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY
    const marketCtx = market || 'USA'

    // Build a clean geocoding address from building data + market context
    function buildGeoAddress(b: any): string {
      const addr = b.address?.trim()
      const hood = b.neighborhood?.trim()
      
      // Skip CRE jargon neighborhoods that confuse geocoders
      // (e.g. "CBD Submarket", "East Submarket", "Class A District")
      const isRealNeighborhood = hood && 
        !/(submarket|district|corridor|class\s*[abc])/i.test(hood) &&
        hood.length > 2
      
      if (isRealNeighborhood) {
        // Real neighborhood (e.g. "DUMBO, Brooklyn" or "City of London")
        // Use: address, neighborhood, market
        return `${addr}, ${hood}, ${marketCtx}`
      }
      
      // No useful neighborhood - rely on market context
      return `${addr}, ${marketCtx}`
    }

    async function geocodeBuilding(b: any): Promise<void> {
      const fullAddr = buildGeoAddress(b)
      console.log('Geocoding:', fullAddr)

      // Try Google Geocoding API first (building-level accuracy)
      if (mapsApiKey) {
        try {
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddr)}&key=${mapsApiKey}`
          )
          const geoData = await geoRes.json()
          if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
            const loc = geoData.results[0].geometry.location
            b.lat = loc.lat
            b.lng = loc.lng
            console.log('  Google OK:', b.address, '->', b.lat, b.lng)
            return
          }
          console.warn('  Google returned:', geoData.status, geoData.error_message || '')
        } catch (e) {
          console.warn('  Google error for:', b.address, e)
        }
      } else {
        console.log('  No GOOGLE_MAPS_API_KEY, using Nominatim')
      }

      // Fallback to Nominatim
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddr)}&limit=1`,
          { headers: { 'User-Agent': 'TourLytics/1.0' } }
        )
        const geoData = await geoRes.json()
        if (geoData?.[0]) {
          b.lat = parseFloat(geoData[0].lat)
          b.lng = parseFloat(geoData[0].lon)
          console.log('  Nominatim OK:', b.address, '->', b.lat, b.lng)
        } else {
          console.warn('  Nominatim returned empty for:', fullAddr)
        }
      } catch (e) {
        console.warn('  Nominatim error for:', b.address, e)
      }
    }

    // Geocode all buildings
    // Use Nominatim sequentially (rate limit) unless Google key is available
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
    for (let i = 0; i < buildings.length; i++) {
      try {
        if (!mapsApiKey && i > 0) await delay(1100) // Nominatim rate limit
        await geocodeBuilding(buildings[i])
      } catch (geoErr) {
        console.warn('Geocode failed for:', buildings[i].address, geoErr)
      }
    }

    // Attach the PDF URL to each building so the popup can link back
    if (pdfUrl) {
      buildings.forEach((b: any) => {
        b.surveyPdfUrl = pdfUrl
      })
    }

    return NextResponse.json({
      buildings,
      count: buildings.length,
      geocoded_count: buildings.filter((b: any) => b.lat && b.lng).length,
    })
  } catch (err) {
    console.error('Survey parse error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
