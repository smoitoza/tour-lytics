import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import buildingContext from '@/data/building_context.json'
import financialContext from '@/data/financial_context.json'

const client = new Anthropic()

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
const conversations = new Map<string, Array<{ role: string; content: string }>>()
const MAX_HISTORY = 20

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, visitor_id, tour_list, scores, schedule } = body
    const visitorId = visitor_id || request.headers.get('x-visitor-id') || 'default'

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

    // Stream response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: history as Array<{ role: 'user' | 'assistant'; content: string }>,
          })

          let fullResponse = ''

          anthropicStream.on('text', (text) => {
            fullResponse += text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            )
          })

          anthropicStream.on('end', () => {
            history.push({ role: 'assistant', content: fullResponse })
            conversations.set(visitorId, history)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
            )
            controller.close()
          })

          anthropicStream.on('error', (err) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
            )
            controller.close()
          })
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
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
