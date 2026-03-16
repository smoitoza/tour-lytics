import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'
import { debitTokens } from '@/lib/tokens'

// POST /api/survey-parse - Parse a broker survey document and extract building data
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { text, userEmail } = body

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: 'Survey text too short or missing.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })
    }

    // Debit 25 tokens for survey upload
    try {
      const tokenResult = await debitTokens({
        projectId: 'sf-office-search',
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

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `You are a commercial real estate data extraction expert. Parse this broker survey document and extract every building/property listed.

For EACH building found, extract these fields (use null if not found):
- address: The street address (just street, no city/state)
- neighborhood: The neighborhood or district name
- owner: The building owner/landlord name
- yearBuiltClass: Year built and class info (e.g., "2015 / Class A Office")
- buildingSF: Total building square footage (e.g., "307,235 SF")
- stories: Number of stories/floors
- spaceAvailable: Available space in SF (e.g., "35,648 SF")
- rentalRate: The rental rate (e.g., "Mid $70's FSG")
- directSublease: "Direct", "Sublease", or "Both"

IMPORTANT: 
- Extract ALL buildings listed, not just a few
- Keep the exact phrasing from the document for rates, SF figures, etc.
- If a building appears multiple times (different suites), consolidate into one entry with the combined available space
- Include floor/suite details in a "floors" field if available

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

    // Geocode addresses to get lat/lng
    const geocoded = await Promise.all(
      buildings.map(async (b: any) => {
        try {
          // Use Nominatim (free, no key needed) for geocoding
          const addr = encodeURIComponent(`${b.address}, San Francisco, CA`)
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${addr}&limit=1`,
            { headers: { 'User-Agent': 'TourLytics/1.0' } }
          )
          const geoData = await geoRes.json()
          if (geoData && geoData[0]) {
            b.lat = parseFloat(geoData[0].lat)
            b.lng = parseFloat(geoData[0].lon)
          }
        } catch (geoErr) {
          console.warn('Geocode failed for:', b.address, geoErr)
        }
        return b
      })
    )

    return NextResponse.json({
      buildings: geocoded,
      count: geocoded.length,
      geocoded_count: geocoded.filter((b: any) => b.lat && b.lng).length,
    })
  } catch (err) {
    console.error('Survey parse error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
