import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import buildingContext from '@/data/building_context.json'
import financialContext from '@/data/financial_context.json'

// Initialize client inside handler to pick up env vars after redeploy
function getClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
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

FINANCIAL MODELS CRITICAL FACTS:
- The Monthly P&L of $106,594 for 250 Brannan IS the ALL-IN number. It ALREADY INCLUDES OpEx. Breakdown: $56,594 rent + $50,000 Procore internal OpEx = $106,594 total.
- The $50,000/mo OpEx breaks down as: $30,000 F&B + $10,000 Workplace Experience + $10,000 Maintenance/Security.
- In 2026 (partial year, 7 months), OpEx is prorated to $42,857/mo, so total monthly P&L is $99,451. In full years (2027+), it's $106,594.
- For 123 Townsend, monthly rent is $168,147 and with the same $50,000/mo OpEx the all-in monthly P&L would be ~$218,147.
- The annual summary shows: Straight-Line Rent + F&B + Workplace Experience + Maintenance/Security = Total Occupancy Cost.
- Per RSF breakdown for 250 Brannan: Rent $42/RSF/yr + OpEx $38/RSF/yr = Total $80/RSF/yr (full years).
- NEVER say the Monthly P&L figures are "lease-only" or "rent-only" for 250 Brannan. They include OpEx.

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

GUIDELINES:
- Be concise but thorough. Use specific numbers (rates, SF, etc.) when available.
- If comparing buildings, use a structured format.
- When a building detail is "TBD" or "Negotiable", say so honestly.
- Reference building numbers (#1-33) and addresses together for clarity.
- If asked about something not in the data, say you don't have that information.
- Do not use em dashes in your responses. Use commas, periods, or semicolons instead.
- Be conversational and professional, like a sharp real estate analyst.
- Keep responses focused. Don't dump all data unless asked for a full comparison.
- When asked about costs, always distinguish between lease-only P&L and all-in occupancy cost (which includes OpEx).`

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
              system: SYSTEM_PROMPT,
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
