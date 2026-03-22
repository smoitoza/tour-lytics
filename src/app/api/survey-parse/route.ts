import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'
import { debitTokens } from '@/lib/tokens'

// Allow up to 90s for AI parsing + geocoding + link extraction
export const maxDuration = 90

// ============================================================
// PDF Link Extraction - Extracts hyperlink annotations from PDFs
// and maps them to buildings using page + Y-position correlation
// ============================================================
type ExtractedLink = { type: string; label: string; url: string }
type PageLinkData = {
  page: number
  links: { url: string; y: number }[]
  textItems: { str: string; y: number; x: number }[]
  pageHeight: number
}

const VIRTUAL_TOUR_DOMAINS = [
  'matterport.com', 'cloudpano.com', 'shoootin.com',
  'kuula.co', 'my.matterport', 'cupix.com', 'asteroom.com',
  '3dvista.com', 'teliportme.com',
]

const FLOORPLAN_KEYWORDS = ['floorplan', 'floor-plan', 'floor_plan', 'floor+plan', 'masterplan', 'master-plan', 'master_plan', 'siteplan', 'site-plan']

function classifyLink(url: string, nearbyText?: string): { type: string; label: string } {
  const lower = url.toLowerCase()
  const text = (nearbyText || '').toLowerCase()
  if (VIRTUAL_TOUR_DOMAINS.some(d => lower.includes(d))) {
    return { type: 'virtual_tour', label: 'Virtual Tour' }
  }
  if (FLOORPLAN_KEYWORDS.some(k => lower.includes(k))) {
    return { type: 'floorplan', label: 'Floor Plan' }
  }
  // Check nearby text for "CLICK FOR" patterns
  if (text.includes('floor plan') || text.includes('floorplan')) {
    return { type: 'floorplan', label: 'Floor Plan' }
  }
  if (text.includes('masterplan') || text.includes('master plan') || text.includes('site plan') || text.includes('siteplan')) {
    return { type: 'floorplan', label: 'Site Plan' }
  }
  if (text.includes('virtual tour') || text.includes('3d tour') || text.includes('360')) {
    return { type: 'virtual_tour', label: 'Virtual Tour' }
  }
  return { type: 'brochure', label: 'Brochure' }
}

async function extractPdfLinks(pdfUrl: string): Promise<PageLinkData[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

    // Fetch the PDF binary from storage
    const res = await fetch(pdfUrl)
    if (!res.ok) {
      console.warn('Failed to fetch PDF for link extraction:', res.status)
      return []
    }
    const arrayBuf = await res.arrayBuffer()
    const data = new Uint8Array(arrayBuf)

    const doc = await pdfjsLib.getDocument({ data }).promise
    const pageData: PageLinkData[] = []

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale: 1.0 })
      const pageHeight = viewport.height

      // Get text content with positions
      const textContent = await page.getTextContent()
      const textItems = (textContent.items as any[]).map(item => ({
        str: item.str,
        y: pageHeight - item.transform[5], // Convert to top-down coords
        x: item.transform[4],
      }))

      // Get link annotations
      const annotations = await page.getAnnotations()
      const links = annotations
        .filter((a: any) => a.subtype === 'Link' && a.url)
        .map((a: any) => ({
          url: a.url,
          y: pageHeight - a.rect[3], // Top of link box in top-down coords
        }))

      if (links.length > 0) {
        pageData.push({ page: i, links, textItems, pageHeight })
      }
    }

    console.log(`PDF link extraction: found links on ${pageData.length} pages`)
    return pageData
  } catch (err) {
    console.warn('PDF link extraction failed (non-fatal):', err)
    return []
  }
}

function mapLinksToBuildings(
  buildings: any[],
  pageData: PageLinkData[]
): void {
  if (pageData.length === 0) return

  // Group buildings by their estimated page
  // First pass: exact page match only
  const buildingsByPage: Record<number, any[]> = {}
  for (const b of buildings) {
    const pg = b.estimatedPage
    if (!pg) continue
    if (!buildingsByPage[pg]) buildingsByPage[pg] = []
    buildingsByPage[pg].push(b)
  }
  // Second pass: for pages with links but no exact buildings, try +/-1 tolerance
  for (const pd of pageData) {
    if (!buildingsByPage[pd.page] || buildingsByPage[pd.page].length === 0) {
      for (const b of buildings) {
        const pg = b.estimatedPage
        if (!pg) continue
        if (Math.abs(pg - pd.page) === 1) {
          if (!buildingsByPage[pd.page]) buildingsByPage[pd.page] = []
          if (!buildingsByPage[pd.page].includes(b)) buildingsByPage[pd.page].push(b)
        }
      }
    }
  }

  for (const pd of pageData) {
    const pageBldgs = buildingsByPage[pd.page]
    if (!pageBldgs || pageBldgs.length === 0) continue

    // Find each building's Y position on this page
    const bldgPositions: { building: any; y: number }[] = []
    for (const b of pageBldgs) {
      if (!b.address) continue
      const addrClean = b.address.replace(/[.,]/g, '').toLowerCase().trim()
      const addrWords = addrClean.split(/\s+/)

      // Build multiple search variants for robust matching
      const variants: string[] = []
      // Full address
      variants.push(addrClean)
      // Street number + first 2 words (e.g. "400 w california")
      if (addrWords.length >= 3) variants.push(addrWords.slice(0, 3).join(' '))
      // Street number + second word (e.g. "4453 first")
      if (addrWords.length >= 2) {
        // Skip directional prefixes (N, S, E, W)
        const meaningful = addrWords.filter((w: string) => !['n', 's', 'e', 'w', 'st', 'rd', 'ave', 'blvd', 'dr', 'pl', 'ln'].includes(w))
        if (meaningful.length >= 2) variants.push(meaningful[0] + ' ' + meaningful[1])
      }

      let foundY = -1
      for (const variant of variants) {
        for (const item of pd.textItems) {
          const clean = item.str.replace(/[.,]/g, '').toLowerCase()
          if (clean.length > 2 && clean.includes(variant)) {
            foundY = item.y
            break
          }
        }
        if (foundY >= 0) break
      }

      // Fallback: just match the street number if unique enough (3+ digits)
      if (foundY < 0) {
        const streetNum = addrWords[0]
        if (streetNum && streetNum.length >= 3 && /^\d+$/.test(streetNum)) {
          for (const item of pd.textItems) {
            if (item.str.includes(streetNum)) {
              foundY = item.y
              break
            }
          }
        }
      }

      // Fallback: try matching building/project name if one was parsed
      if (foundY < 0 && b.projectName) {
        const projWords = b.projectName.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
        for (const word of projWords) {
          for (const item of pd.textItems) {
            if (item.str.toLowerCase().includes(word)) {
              foundY = item.y
              break
            }
          }
          if (foundY >= 0) break
        }
      }

      if (foundY >= 0) {
        bldgPositions.push({ building: b, y: foundY })
      }
    }

    // Sort buildings by Y position (top to bottom)
    bldgPositions.sort((a, b) => a.y - b.y)

    // Assign links to buildings based on Y-zone
    for (let i = 0; i < bldgPositions.length; i++) {
      const { building, y: bldgY } = bldgPositions[i]
      const nextY = i + 1 < bldgPositions.length
        ? bldgPositions[i + 1].y
        : pd.pageHeight + 50 // allow some overflow for last building

      // Links in this building's zone: from 10px above the address to the next building
      const zoneLinks = pd.links.filter(l => l.y >= bldgY - 10 && l.y < nextY)

      if (zoneLinks.length > 0) {
        building.links = zoneLinks.map(l => {
          // Find nearby text (within 20px of the link) to help classify it
          const nearbyText = pd.textItems
            .filter(t => Math.abs(t.y - l.y) < 20)
            .map(t => t.str)
            .join(' ')
          const { type, label } = classifyLink(l.url, nearbyText)
          return { type, label, url: l.url }
        })
        console.log(`  Links mapped: ${building.address} -> ${building.links.length} links`)
      }
    }

    // Handle unmatched buildings on this page: if there are buildings that weren't
    // found in text but we have unassigned links, distribute them in order
    if (pageBldgs.length > bldgPositions.length && pd.links.length > 0) {
      const assignedUrls = new Set<string>()
      for (const bp of bldgPositions) {
        for (const l of (bp.building.links || [])) assignedUrls.add(l.url)
      }
      const unassignedLinks = pd.links.filter(l => !assignedUrls.has(l.url))
      const unmatchedBldgs = pageBldgs.filter(b => !bldgPositions.some(bp => bp.building === b))

      if (unassignedLinks.length > 0 && unmatchedBldgs.length > 0) {
        // Sort unassigned links by Y position and distribute in order
        unassignedLinks.sort((a, b) => a.y - b.y)
        const linksPerBldg = Math.max(1, Math.ceil(unassignedLinks.length / unmatchedBldgs.length))
        for (let j = 0; j < unmatchedBldgs.length; j++) {
          const chunk = unassignedLinks.slice(j * linksPerBldg, (j + 1) * linksPerBldg)
          if (chunk.length > 0) {
            unmatchedBldgs[j].links = chunk.map(l => {
              const nearbyText = pd.textItems
                .filter(t => Math.abs(t.y - l.y) < 20)
                .map(t => t.str)
                .join(' ')
              const { type, label } = classifyLink(l.url, nearbyText)
              return { type, label, url: l.url }
            })
            console.log(`  Links (fallback): ${unmatchedBldgs[j].address} -> ${unmatchedBldgs[j].links.length} links`)
          }
        }
      }
    }
  }
}

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

    // ============================================================
    // Fix page numbers: match each building's address to actual PDF pages
    // The client sends text with "--- PAGE N ---" delimiters
    // ============================================================
    const pagePattern = /--- PAGE (\d+) ---\n([\s\S]*?)(?=--- PAGE \d+ ---|$)/g
    const pageTexts: { page: number; text: string }[] = []
    let pageMatch
    while ((pageMatch = pagePattern.exec(text)) !== null) {
      pageTexts.push({ page: parseInt(pageMatch[1]), text: pageMatch[2] })
    }

    if (pageTexts.length > 0) {
      // Detect pages that list many addresses (TOC/map pages) so we can deprioritize them
      // Count how many building addresses appear on each page
      const pageAddrCounts: Record<number, number> = {}
      for (const pt of pageTexts) {
        const pageText = pt.text.toLowerCase().replace(/[.,]/g, '')
        let count = 0
        for (const b of buildings) {
          if (!b.address) continue
          const ac = b.address.replace(/[.,]/g, '').toLowerCase()
          if (pageText.includes(ac)) count++
        }
        pageAddrCounts[pt.page] = count
      }
      // Pages with more than half the buildings are likely TOC/map overview pages
      const overviewThreshold = Math.max(Math.ceil(buildings.length * 0.5), 5)

      // For each building, find which page contains its street address
      for (const b of buildings) {
        if (!b.address) continue
        const addrClean = b.address.replace(/[.,]/g, '').toLowerCase()
        const addrWords = addrClean.split(/\s+/)
        const streetNum = addrWords[0] || ''

        // Collect all pages that mention this address
        const matchingPages: number[] = []
        for (const pt of pageTexts) {
          const pageText = pt.text.toLowerCase().replace(/[.,]/g, '')
          if (pageText.includes(addrClean)) {
            matchingPages.push(pt.page)
          }
        }

        // Prefer non-overview pages (content pages vs TOC/map)
        let bestPage = -1
        const contentPages = matchingPages.filter(p => (pageAddrCounts[p] || 0) < overviewThreshold)
        if (contentPages.length > 0) {
          // Use the FIRST content page (the building's listing page)
          bestPage = contentPages[0]
        } else if (matchingPages.length > 0) {
          // All matching pages are overview pages - use the last one
          bestPage = matchingPages[matchingPages.length - 1]
        }

        // Fallback: match street number + next word (handles "401 W" vs "401 W.")
        if (bestPage === -1 && addrWords.length >= 2) {
          const partial = streetNum + ' ' + addrWords[1].replace(/\./g, '')
          const fallbackPages: number[] = []
          for (const pt of pageTexts) {
            const pageText = pt.text.toLowerCase().replace(/[.,]/g, '')
            if (pageText.includes(partial)) {
              fallbackPages.push(pt.page)
            }
          }
          const fbContent = fallbackPages.filter(p => (pageAddrCounts[p] || 0) < overviewThreshold)
          if (fbContent.length > 0) {
            bestPage = fbContent[0]
          } else if (fallbackPages.length > 0) {
            bestPage = fallbackPages[fallbackPages.length - 1]
          }
        }

        if (bestPage > 0) {
          console.log('Page match:', b.address, '-> page', bestPage, '(was', b.estimatedPage, ')')
          b.estimatedPage = bestPage
        }
      }
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

    // ============================================================
    // Extract embedded hyperlinks from the PDF and map to buildings
    // (virtual tours, brochures, floorplans)
    // ============================================================
    if (pdfUrl) {
      try {
        console.log('Extracting PDF links from:', pdfUrl)
        const pageData = await extractPdfLinks(pdfUrl)
        if (pageData.length > 0) {
          mapLinksToBuildings(buildings, pageData)
          const withLinks = buildings.filter((b: any) => b.links && b.links.length > 0)
          console.log(`Link extraction complete: ${withLinks.length}/${buildings.length} buildings have links`)
        }
      } catch (linkErr) {
        console.warn('Link extraction skipped (non-fatal):', linkErr)
      }
    }

    return NextResponse.json({
      buildings,
      count: buildings.length,
      geocoded_count: buildings.filter((b: any) => b.lat && b.lng).length,
      links_count: buildings.filter((b: any) => b.links && b.links.length > 0).length,
    })
  } catch (err) {
    console.error('Survey parse error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
