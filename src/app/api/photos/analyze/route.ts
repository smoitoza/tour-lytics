import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const AREA_OPTIONS = [
  'lobby', 'reception', 'open_floor', 'private_office', 'conference_room',
  'kitchen', 'break_room', 'restroom', 'hallway', 'elevator',
  'stairwell', 'exterior', 'entrance', 'parking', 'rooftop',
  'balcony', 'view', 'amenity', 'gym', 'mail_room', 'general'
]

// POST - analyze a photo with Gemini Vision and store results
export async function POST(req: Request) {
  try {
    const { photoId } = await req.json()

    if (!photoId) {
      return NextResponse.json({ error: 'photoId required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      console.error('GOOGLE_AI_API_KEY not configured')
      return NextResponse.json({ error: 'AI analysis not configured' }, { status: 500 })
    }

    // Fetch the photo record
    const { data: photo, error: fetchErr } = await supabase
      .from('building_photos')
      .select('*')
      .eq('id', photoId)
      .single()

    if (fetchErr || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Download the image
    const imageResponse = await fetch(photo.file_url)
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const mimeType = photo.mime_type || 'image/jpeg'

    // Initialize Gemini (new SDK)
    const ai = new GoogleGenAI({ apiKey })

    // Analyze the image
    const prompt = `You are analyzing a photo taken during a commercial office space tour in San Francisco. 
The photo is from a building called "${photo.building_name}" at "${photo.building_address}".
The user tagged it as "${photo.area_tag}" area.

Please provide:

1. DESCRIPTION: A detailed but concise description (2-3 sentences) of what you see in this photo, focusing on aspects relevant to evaluating commercial office space. Mention specific features like natural light quality, ceiling height, flooring type, furniture condition, view quality, finishes, etc.

2. AREA_SUGGESTION: Which area of the building does this photo most likely show? Choose ONE from: ${AREA_OPTIONS.join(', ')}

3. TAGS: Generate 3-8 relevant tags from this list (only use tags that clearly apply):
natural_light, low_light, open_plan, private_offices, modern_finishes, dated_finishes, 
high_ceilings, low_ceilings, hardwood_floors, carpet, concrete_floors, 
floor_to_ceiling_windows, city_view, bay_view, street_view, no_view,
furnished, unfurnished, standing_desks, cubicles, 
kitchen_appliances, coffee_bar, break_area,
exposed_brick, exposed_ducts, drop_ceiling, 
good_condition, needs_renovation, move_in_ready,
spacious, compact, collaborative_space, quiet_zone,
accessible, bike_storage, ev_charging, outdoor_space

Respond in this exact JSON format:
{
  "description": "...",
  "area_suggestion": "...",
  "tags": ["...", "..."]
}`

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } },
        ]
      }],
    })

    const responseText = result.text || ''

    // Parse the JSON response
    let analysis: { description: string; area_suggestion: string; tags: string[] }
    try {
      // Extract JSON from response (Gemini sometimes wraps in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      analysis = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', responseText)
      // Fallback: use the raw text as description
      analysis = {
        description: responseText.substring(0, 500),
        area_suggestion: photo.area_tag,
        tags: [],
      }
    }

    // Generate embedding for the description (for RAG search)
    let embedding: number[] | null = null
    try {
      const embeddingResult = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: `Photo of ${photo.building_name} ${photo.area_tag} area: ${analysis.description}. Tags: ${analysis.tags.join(', ')}`,
        config: { outputDimensionality: 768 },
      })
      embedding = embeddingResult.embeddings?.[0]?.values || null
    } catch (embErr) {
      console.error('Embedding generation failed:', embErr)
    }

    // Update the photo record with AI analysis
    const updateData: Record<string, unknown> = {
      ai_description: analysis.description,
      ai_tags: analysis.tags,
      ai_area_suggestion: analysis.area_suggestion,
      ai_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (embedding) {
      updateData.description_embedding = JSON.stringify(embedding)
    }

    const { error: updateErr } = await supabase
      .from('building_photos')
      .update(updateData)
      .eq('id', photoId)

    if (updateErr) {
      console.error('Failed to update photo with analysis:', updateErr)
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      analysis: {
        description: analysis.description,
        area_suggestion: analysis.area_suggestion,
        tags: analysis.tags,
        has_embedding: !!embedding,
      },
    })
  } catch (err) {
    console.error('Photo analysis error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET - get analysis status for a photo
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const photoId = searchParams.get('photoId')

  if (!photoId) {
    return NextResponse.json({ error: 'photoId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('building_photos')
    .select('id, ai_description, ai_tags, ai_area_suggestion, ai_analyzed_at')
    .eq('id', photoId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
