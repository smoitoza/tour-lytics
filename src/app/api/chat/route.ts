import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import buildingContext from '@/data/building_context.json'
import financialContext from '@/data/financial_context.json'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Fetch live RFP/financial submissions for chatbot context
async function getRFPContext(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('rfp_submissions')
      .select('*')
      .eq('project_id', 'sf-office-search')
      .neq('status', 'archived')
      .order('submitted_at', { ascending: false })

    if (error || !data || data.length === 0) {
      return ''
    }

    let context = '\n\nLIVE RFP/LOI FINANCIAL SUBMISSIONS (from the Financials tab - these are REAL uploaded proposals with AI-generated analysis):\n'
    context += 'IMPORTANT: When a user asks about financial terms, straight-line rent, cash flow, GAAP, or P&L for any building that has an RFP submission below, ALWAYS use the data from these live submissions. These supersede any static financial models in the FINANCIAL MODELS section above.\n\n'

    data.forEach(sub => {
      const terms = sub.deal_terms || {}
      const analysis = sub.analysis || {}
      const summary = analysis.summary || {}
      const slTotals = analysis.straight_line_pl?.totals || {}
      const gaapSummary = analysis.gaap?.summary || {}

      context += `--- ${sub.building_address || 'Unknown'} (${(sub.doc_type || '').toUpperCase()}) ---\n`
      context += `  Submitted: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Unknown'}\n`
      if (sub.doc_source) context += `  Source: ${sub.doc_source}\n`

      context += '  Deal Terms:\n'
      if (terms.rsf) context += `    RSF: ${terms.rsf.toLocaleString()}\n`
      if (terms.lease_term_months) context += `    Lease Term: ${terms.lease_term_months} months\n`
      if (terms.commencement_date) context += `    Commencement: ${terms.commencement_date}\n`
      if (terms.base_rent_rsf) context += `    Base Rent: $${terms.base_rent_rsf}/RSF/yr\n`
      if (terms.rent_basis) context += `    Rent Basis: ${terms.rent_basis}\n`
      if (terms.annual_escalation_pct) context += `    Annual Escalation: ${terms.annual_escalation_pct}%\n`
      if (terms.free_rent_months) context += `    Free Rent: ${terms.free_rent_months} months\n`
      if (terms.ti_allowance_rsf) context += `    TI Allowance: $${terms.ti_allowance_rsf}/RSF\n`
      if (terms.ti_allowance_total) context += `    TI Allowance Total: $${terms.ti_allowance_total.toLocaleString()}\n`
      if (terms.opex_monthly) context += `    OpEx (monthly): $${terms.opex_monthly.toLocaleString()}\n`
      if (terms.parking_spots) context += `    Parking: ${terms.parking_spots} spots at $${terms.parking_rate_monthly || 0}/spot/mo\n`
      if (terms.structure) context += `    Structure: ${terms.structure}\n`
      if (terms.landlord) context += `    Landlord: ${terms.landlord}\n`
      if (terms.notes) context += `    Notes: ${terms.notes}\n`

      if (summary.rsf) {
        context += '  Analysis Summary:\n'
        context += `    Effective Rent/RSF: $${summary.effectiveRentRSF}/yr\n`
        context += `    Total All-In Cost: $${summary.totalAllInCost?.toLocaleString()}\n`
        context += `    SL Monthly Rent (net of TI): $${slTotals.straightLineMonthlyRent?.toLocaleString()}\n`
        context += `    SL Annual Rent (net of TI): $${slTotals.straightLineAnnualRent?.toLocaleString()}\n`
        context += `    SL Annual Expense (incl OpEx): $${summary.straightLineAnnualExpense?.toLocaleString()}\n`
        context += `    Free Rent Value: $${summary.freeRentValue?.toLocaleString()}\n`
        if (summary.tiValue) context += `    TI Allowance Value: $${summary.tiValue.toLocaleString()}\n`
        context += `    Total Concessions: $${summary.totalConcessions?.toLocaleString()}\n`
        if (slTotals.tiAllowanceTotal) context += `    Monthly TI Amortization: $${slTotals.monthlyTIAmortization?.toLocaleString()}/mo (reduces SL expense)\n`
      }

      if (gaapSummary.leaseLiability) {
        context += '  GAAP / ASC 842:\n'
        context += `    Lease Liability (Day 1): $${gaapSummary.leaseLiability?.toLocaleString()}\n`
        context += `    ROU Asset (Day 1): $${gaapSummary.rouAsset?.toLocaleString()}\n`
        context += `    Discount Rate: ${(gaapSummary.discountRate * 100)}%\n`
        if (gaapSummary.tiAllowance) context += `    TI Offset on ROU: $${gaapSummary.tiAllowance.toLocaleString()}\n`
      }

      context += '\n'
    })

    return context
  } catch (e) {
    console.error('Failed to fetch RFP context:', e)
    return ''
  }
}

// Fetch photo descriptions for chatbot context
async function getPhotoContext(): Promise<string> {
  try {
    // Fetch ALL photos (both analyzed and un-analyzed) so the chatbot can show images
    const { data, error } = await supabase
      .from('building_photos')
      .select('building_name, building_address, area_tag, ai_description, ai_tags, ai_area_suggestion, uploaded_by, created_at, file_url, ai_analyzed_at')
      .eq('project_id', 'sf-office-search')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !data || data.length === 0) {
      return ''
    }

    // Group by building
    const byBuilding: Record<string, typeof data> = {}
    data.forEach(p => {
      const key = p.building_name
      if (!byBuilding[key]) byBuilding[key] = []
      byBuilding[key].push(p)
    })

    let context = '\n\nTOUR PHOTOS (photos taken during building tours):\n'
    for (const [building, photos] of Object.entries(byBuilding)) {
      const analyzed = photos.filter(p => p.ai_analyzed_at)
      const pending = photos.filter(p => !p.ai_analyzed_at)
      context += `\n${building} (${photos.length} photos${pending.length > 0 ? `, ${pending.length} pending AI analysis` : ''}):\n`
      photos.forEach(p => {
        const area = p.ai_area_suggestion || p.area_tag || 'general'
        if (p.ai_description) {
          const tags = p.ai_tags?.join(', ') || ''
          context += `  - [${area}] ${p.ai_description}${tags ? ' (tags: ' + tags + ')' : ''} | image: ${p.file_url}\n`
        } else {
          // Photo uploaded but not yet AI-analyzed; still include it with area tag so chatbot can show it
          context += `  - [${area}] (photo not yet analyzed) | image: ${p.file_url}\n`
        }
      })
    }
    return context
  } catch (e) {
    console.error('Failed to fetch photo context:', e)
    return ''
  }
}

// Initialize client inside handler to pick up env vars after redeploy
function getClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

// ---- Google Directions helper ----
async function getDirections(
  origin: string,
  destination: string,
  mode: 'walking' | 'driving' | 'transit' | 'bicycling' = 'walking'
): Promise<string> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return 'Google Maps API key is not configured. Unable to get directions.'
  }

  try {
    const params = new URLSearchParams({
      origin,
      destination,
      mode,
      key: apiKey,
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Directions API error:', response.status, errorText)
      return `Google Directions API returned an error (status ${response.status}). Unable to get directions at this time.`
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return `No ${mode} route found between these locations.`
      }
      console.error('Directions API status:', data.status, data.error_message)
      return `Directions API error: ${data.status}. ${data.error_message || ''}`
    }

    const route = data.routes[0]
    const leg = route.legs[0]

    const result = {
      origin: leg.start_address,
      destination: leg.end_address,
      mode,
      distance: leg.distance.text,
      duration: leg.duration.text,
      steps: leg.steps.map((step: { html_instructions: string; distance: { text: string }; duration: { text: string }; travel_mode: string; transit_details?: { line?: { short_name?: string; name?: string; vehicle?: { type?: string } }; departure_stop?: { name?: string }; arrival_stop?: { name?: string }; num_stops?: number } }) => {
        const info: Record<string, unknown> = {
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance.text,
          duration: step.duration.text,
        }
        if (step.travel_mode === 'TRANSIT' && step.transit_details) {
          info.transit_line = step.transit_details.line?.short_name || step.transit_details.line?.name
          info.transit_type = step.transit_details.line?.vehicle?.type
          info.departure_stop = step.transit_details.departure_stop?.name
          info.arrival_stop = step.transit_details.arrival_stop?.name
          info.num_stops = step.transit_details.num_stops
        }
        return info
      }),
    }

    return JSON.stringify(result, null, 2)
  } catch (err) {
    console.error('Directions error:', err)
    return `Error getting directions: ${String(err)}`
  }
}

// ---- Google Places helper ----
async function searchNearbyPlaces(query: string, maxResults = 5): Promise<string> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return 'Google Places API key is not configured. Unable to search for nearby places.'
  }

  try {
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
      const errorText = await response.text()
      console.error('Google Places API error:', response.status, errorText)
      return `Google Places API returned an error (status ${response.status}). Unable to search for nearby places at this time.`
    }

    const data = await response.json()
    const places = (data.places || []).map((place: Record<string, unknown>) => {
      const openingHours = (place.currentOpeningHours || place.regularOpeningHours) as Record<string, unknown> | undefined
      const weekday = openingHours?.weekdayDescriptions as string[] | undefined
      const displayName = place.displayName as Record<string, string> | undefined
      const priceMap: Record<string, string> = {
        PRICE_LEVEL_FREE: 'Free',
        PRICE_LEVEL_INEXPENSIVE: '$',
        PRICE_LEVEL_MODERATE: '$$',
        PRICE_LEVEL_EXPENSIVE: '$$$',
        PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
      }

      return {
        name: displayName?.text || 'Unknown',
        address: place.formattedAddress || '',
        rating: place.rating || null,
        reviewCount: place.userRatingCount || null,
        price: priceMap[place.priceLevel as string] || null,
        type: place.primaryType || null,
        website: place.websiteUri || null,
        googleMapsUrl: place.googleMapsUri || null,
        todayHours: weekday ? weekday[new Date().getDay()] : null,
      }
    })

    if (places.length === 0) {
      return 'No places found matching that search.'
    }

    return JSON.stringify(places, null, 2)
  } catch (err) {
    console.error('Places search error:', err)
    return `Error searching for places: ${String(err)}`
  }
}

// ---- Claude tool definitions ----
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_nearby_places',
    description:
      'Search for nearby places (restaurants, coffee shops, parking, bars, gyms, etc.) near a specific address or building location. Use this whenever a user asks about places to eat, drink, park, or visit near any of the tour buildings. Always include "San Francisco" in the query for accurate results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'A natural language search query including the place type and location, e.g. "coffee shops near 250 Brannan Street, San Francisco" or "parking garages near 300 Mission Street, San Francisco"',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (1-10, default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_directions',
    description:
      'Get walking, driving, transit, or bicycling directions between two locations. Returns travel time, distance, and step-by-step directions. Use this when a user asks how far apart two buildings are, how long it takes to walk/drive between locations, or asks for directions between any two addresses or buildings. Always use full street addresses with "San Francisco, CA" for best results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        origin: {
          type: 'string',
          description:
            'Starting address, e.g. "250 Brannan Street, San Francisco, CA"',
        },
        destination: {
          type: 'string',
          description:
            'Destination address, e.g. "505 Howard Street, San Francisco, CA"',
        },
        mode: {
          type: 'string',
          enum: ['walking', 'driving', 'transit', 'bicycling'],
          description:
            'Travel mode. Default is walking. Use "transit" for public transportation (Muni, BART, bus).',
        },
      },
      required: ['origin', 'destination'],
    },
  },
]

const SYSTEM_PROMPT = `You are the Tour-Lytics Tour Book Assistant -- an AI concierge for a commercial real estate office search in San Francisco.

You have detailed knowledge of 33 survey buildings plus 4 buildings in active deal negotiations. Your job is to answer questions about these properties clearly and helpfully, like a knowledgeable broker assistant.

BUILDING DATA:
${JSON.stringify(buildingContext, null, 2)}

FINANCIAL MODELS:
${JSON.stringify(financialContext, null, 2)}

SCORING CATEGORIES (1-10 scale, used by the client to rate buildings during tours):
- Location: Proximity to transit, restaurants, walkability
- Price: Rental rate competitiveness
- Parking: Availability and cost of parking
- Security: Building security features
- Interior Fit Out: Quality of the existing space buildout
- Furniture/Vibe: Existing furniture quality and office atmosphere
- Natural Light: Window lines, floor-to-ceiling glass, exposure
- Amenities: On-site amenities (gym, cafe, rooftop, etc.)
- Overall Feel: General impression of the building
- The Davis Effect: Named after Steve Davis who has a very high bar for office quality

FINANCIAL DATA PRIORITY:
1. FIRST check the LIVE RFP/LOI FINANCIAL SUBMISSIONS section (injected at the end of this prompt). These are real proposals uploaded to the Financials tab with AI-generated analysis including Cash Flow, Straight-Line P&L (with TI amortization), and GAAP/ASC 842 schedules. ALWAYS use these when answering financial questions about buildings that have submissions.
2. ONLY fall back to the static FINANCIAL MODELS section above if a building has NO live RFP submission.
3. The static financial models above may be outdated. Live RFP data is always more current and accurate.

OPERATIONAL EXPENSES CONTEXT (applies on top of lease costs for internal budgeting):
- The company's internal OpEx is $50,000/mo: $30,000 F&B + $10,000 Workplace Experience + $10,000 Maintenance/Security.
- In 2026 (partial year), OpEx is prorated to $42,857/mo.
- When discussing "all-in" or "total occupancy cost", add OpEx on top of the straight-line lease expense from the RFP data.
- NEVER say financial figures are "lease-only" or "rent-only" without clarifying whether OpEx is included.

TI ALLOWANCE IN STRAIGHT-LINE:
- When a deal includes a TI (Tenant Improvement) allowance, it is amortized over the lease term and REDUCES the straight-line rent expense.
- The SL Monthly Rent and SL Annual Rent in the live RFP data already reflect this TI amortization.
- For example, if a deal has $460,620 TI over 65 months, that is a $7,087/mo credit reducing the straight-line expense.

LIVE TOUR CONTEXT:
Each message may include [LIVE TOUR LIST], [LIVE SCORES], and [LIVE TOUR SCHEDULE] data. This reflects what the user currently has on their Tour Book tab in real time.
- When the user asks about "my tour book", "my tour list", "buildings on my tour", or similar, ONLY reference the buildings in the LIVE TOUR LIST, not all 33 survey buildings.
- The Tour Book is the user's shortlist of buildings they are actively evaluating or touring. It is NOT the full 33-building survey.
- If scores are provided, reference them when relevant.
- If schedule data is provided, reference tour dates and times when relevant.

NEARBY PLACES CAPABILITY:
You have access to a tool called search_nearby_places that uses Google Places to find coffee shops, restaurants, bars, parking, gyms, and any other type of place near the tour buildings. When a user asks about places near a building:
1. Identify the building address from your data
2. Call search_nearby_places with a query like "coffee shops near [address], San Francisco"
3. Present the results in a clean, helpful format with name, rating, distance context, and Google Maps link if available
4. If the user asks about their "first tour" or "next tour", check the LIVE TOUR SCHEDULE data to identify which building, then search near that address

DIRECTIONS & TRAVEL TIME CAPABILITY:
You have access to a tool called get_directions that uses Google Maps to calculate travel time and step-by-step directions between any two locations. Use this when a user asks:
- How far apart two buildings are (walking, driving, transit, or biking)
- How long it takes to get between tours or buildings
- Directions from one building to another, or from a building to a nearby place
- Whether they can walk between tours, or if they should drive/take transit
- How to get to a building from a landmark, hotel, or other location

When using get_directions:
1. Look up the full street addresses of both locations from your building data
2. Always include "San Francisco, CA" in the addresses
3. Default to walking mode unless the user specifies driving, transit, or biking
4. Present the results conversationally: lead with the travel time and distance, then offer key directions if helpful
5. If the user asks about travel between consecutive tours on their schedule, check the LIVE TOUR SCHEDULE to identify the buildings and times, then calculate the route
6. For transit directions, mention specific bus/train lines and stops from the step data

GUIDELINES:
- Be concise but thorough. Use specific numbers (rates, SF, etc.) when available.
- If comparing buildings, use a structured format.
- When a building detail is "TBD" or "Negotiable", say so honestly.
- Reference building numbers (#1-33) and addresses together for clarity.
- If asked about something not in the data, say you don't have that information.
- Do not use em dashes in your responses. Use commas, periods, or semicolons instead.
- Be conversational and professional, like a sharp real estate analyst.
- Keep responses focused. Don't dump all data unless asked for a full comparison.
- When asked about costs, always distinguish between lease-only P&L and all-in occupancy cost (which includes OpEx).

TOUR PHOTOS CAPABILITY:
Team members can upload photos during building tours. Photos may be AI-analyzed (Gemini Vision) which provides:
- A description of what's in the photo (finishes, natural light, condition, etc.)
- Area tags (lobby, kitchen, open floor, etc.)
- Feature tags (natural_light, modern_finishes, high_ceilings, etc.)
- A direct image URL you can display

Some photos may say "(photo not yet analyzed)" which means AI hasn't processed them yet, but they still have an area tag and image URL. You can still show these photos to the user.

When a user asks about photos, what spaces looked like, or visual aspects of buildings, reference the TOUR PHOTOS data. You can answer questions like:
- "What did the lobby look like at 250 Brannan?"
- "Which buildings had the best natural light?"
- "Compare the kitchens across our tour list"
- "What condition was the flooring at 301 Brannan?"
- "Show me pictures of the kitchen"

DISPLAYING PHOTOS:
Each photo in the TOUR PHOTOS data includes an image URL after "image:". When the user asks to see a photo or asks about a building with photos, show the photos using markdown image syntax: ![description](url)
Show up to 3-4 relevant photos at a time. Always include a brief description with each image. For un-analyzed photos, use the area tag as the description.
Example: Here is the kitchen at 250 Brannan:\n![Kitchen at 250 Brannan](https://...url...)

If no photos have been uploaded for a building, let the user know photos haven't been added yet.`

// In-memory conversation store
const conversations = new Map<string, Array<{ role: string; content: string | Anthropic.ContentBlockParam[] }>>()
const MAX_HISTORY = 20

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            'ANTHROPIC_API_KEY is not configured. Please add it in Vercel Environment Variables and redeploy.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const body = await request.json()
    const { message, visitor_id, tour_list, scores, schedule } = body
    const visitorId =
      visitor_id || request.headers.get('x-visitor-id') || 'default'

    // Get or create conversation history
    let history = conversations.get(visitorId) || []

    // Build context-enriched message
    let userContent = message
    const contextParts: string[] = []

    if (tour_list && tour_list.length > 0) {
      contextParts.push(
        `[LIVE TOUR LIST - these are the buildings currently on the user's Tour Book tab: ${JSON.stringify(tour_list)}]`
      )
    }
    if (scores && Object.keys(scores).length > 0) {
      contextParts.push(
        `[LIVE SCORES - the user's current building scores/notes from the Tour Book: ${JSON.stringify(scores)}]`
      )
    }
    if (schedule && Object.keys(schedule).length > 0) {
      contextParts.push(
        `[LIVE TOUR SCHEDULE - scheduled tour dates and times for buildings: ${JSON.stringify(schedule)}]`
      )
    }

    if (contextParts.length > 0) {
      userContent = contextParts.join('\n') + '\n\nUser question: ' + message
    }

    history.push({ role: 'user', content: userContent })

    // Trim history
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY)
    }

    // Fetch live data for RAG context
    const [photoContext, rfpContext] = await Promise.all([
      getPhotoContext(),
      getRFPContext(),
    ])
    const systemPromptWithPhotos = SYSTEM_PROMPT + rfpContext + photoContext

    // Stream response with tool use support
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First call - may return tool_use
          let apiMessages = history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content as string | Anthropic.ContentBlockParam[],
          }))

          let assistantResponse = ''
          let needsToolCall = true

          while (needsToolCall) {
            needsToolCall = false

            const response = await getClient().messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              system: systemPromptWithPhotos,
              tools: TOOLS,
              messages: apiMessages,
            })

            // Check if we need to handle tool calls
            const toolUseBlocks = response.content.filter(
              (block) => block.type === 'tool_use'
            )
            const textBlocks = response.content.filter(
              (block) => block.type === 'text'
            )

            // Stream any text that came before tool use
            for (const block of textBlocks) {
              if (block.type === 'text' && block.text) {
                assistantResponse += block.text
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: block.text })}\n\n`
                  )
                )
              }
            }

            if (toolUseBlocks.length > 0 && response.stop_reason === 'tool_use') {
              // Process each tool call
              const toolResults: Anthropic.ToolResultBlockParam[] = []

              for (const toolBlock of toolUseBlocks) {
                if (toolBlock.type === 'tool_use') {
                  const { name, id, input } = toolBlock
                  const toolInput = input as { query: string; max_results?: number }

                  if (name === 'search_nearby_places') {
                    const result = await searchNearbyPlaces(
                      toolInput.query,
                      toolInput.max_results || 5
                    )
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: id,
                      content: result,
                    })
                  } else if (name === 'get_directions') {
                    const dirInput = input as { origin: string; destination: string; mode?: string }
                    const result = await getDirections(
                      dirInput.origin,
                      dirInput.destination,
                      (dirInput.mode as 'walking' | 'driving' | 'transit' | 'bicycling') || 'walking'
                    )
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: id,
                      content: result,
                    })
                  }
                }
              }

              // Add assistant response with tool use and tool results to messages
              apiMessages = [
                ...apiMessages,
                { role: 'assistant' as const, content: response.content as Anthropic.ContentBlockParam[] },
                { role: 'user' as const, content: toolResults as Anthropic.ContentBlockParam[] },
              ]

              // We need another round to get the final text response
              needsToolCall = true
            }
          }

          // Save final response to history
          if (assistantResponse) {
            history.push({ role: 'assistant', content: assistantResponse })
            conversations.set(visitorId, history)
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          )
          controller.close()
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: String(err) })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
