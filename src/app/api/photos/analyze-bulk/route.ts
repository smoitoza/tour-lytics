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

// POST - analyze all un-analyzed photos (batch)
// Vercel functions have 60s timeout on Pro, so we process a limited batch each call
export async function POST(req: Request) {
  const startTime = Date.now()
  const MAX_RUNTIME_MS = 55000 // 55s safety margin for 60s Vercel timeout

  try {
    const body = await req.json().catch(() => ({}))
    const limit = Math.min(body.limit || 10, 20) // max 20 per call
    const adminKey = body.adminKey

    // Simple auth check
    if (adminKey !== 'sre-tour-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_AI_API_KEY not configured' }, { status: 500 })
    }

    // Get un-analyzed photos
    const { data: photos, error } = await supabase
      .from('building_photos')
      .select('*')
      .eq('project_id', 'sf-office-search')
      .is('ai_analyzed_at', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: 'All photos already analyzed', analyzed: 0, remaining: 0 })
    }

    const ai = new GoogleGenAI({ apiKey })

    const results: { id: string; status: string; area?: string }[] = []

    for (const photo of photos) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        results.push({ id: photo.id, status: 'skipped-timeout' })
        continue
      }

      try {
        // Download image
        const imageResponse = await fetch(photo.file_url)
        if (!imageResponse.ok) {
          results.push({ id: photo.id, status: 'error-fetch' })
          continue
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')
        const mimeType = photo.mime_type || 'image/jpeg'

        // Gemini Vision analysis
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
        let analysis: { description: string; area_suggestion: string; tags: string[] }

        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (!jsonMatch) throw new Error('No JSON found')
          analysis = JSON.parse(jsonMatch[0])
        } catch {
          analysis = {
            description: responseText.substring(0, 500),
            area_suggestion: photo.area_tag,
            tags: [],
          }
        }

        // Generate embedding
        let embedding: number[] | null = null
        try {
          const embeddingResult = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: `Photo of ${photo.building_name} ${photo.area_tag} area: ${analysis.description}. Tags: ${analysis.tags.join(', ')}`,
            config: { outputDimensionality: 768 },
          })
          embedding = embeddingResult.embeddings?.[0]?.values || null
        } catch (embErr) {
          console.error('Embedding failed for', photo.id, embErr)
        }

        // Update record
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

        await supabase
          .from('building_photos')
          .update(updateData)
          .eq('id', photo.id)

        results.push({ id: photo.id, status: 'analyzed', area: analysis.area_suggestion })
      } catch (err) {
        console.error('Analysis failed for', photo.id, err)
        results.push({ id: photo.id, status: 'error: ' + String(err).substring(0, 100) })
      }
    }

    // Check how many remain
    const { count } = await supabase
      .from('building_photos')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', 'sf-office-search')
      .is('ai_analyzed_at', null)

    return NextResponse.json({
      analyzed: results.filter(r => r.status === 'analyzed').length,
      failed: results.filter(r => r.status.startsWith('error')).length,
      skipped: results.filter(r => r.status === 'skipped-timeout').length,
      remaining: count || 0,
      results,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (err) {
    console.error('Bulk analyze error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
