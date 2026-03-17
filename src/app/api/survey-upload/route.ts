import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Allow up to 30s for large PDF uploads to Supabase storage
export const maxDuration = 30

// POST /api/survey-upload - Upload a survey PDF to Supabase storage
// Returns the public URL of the stored file
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Generate storage path: surveys/{projectId}/{timestamp}-{filename}
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${projectId}/${timestamp}-${safeName}`

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to tour-photos bucket (surveys subfolder) since bucket already exists
    // We use a 'surveys/' prefix in the path to separate from photos
    const { error: uploadError } = await supabase.storage
      .from('tour-photos')
      .upload(`surveys/${storagePath}`, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Survey upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('tour-photos')
      .getPublicUrl(`surveys/${storagePath}`)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: `surveys/${storagePath}`,
      filename: file.name,
    })
  } catch (err) {
    console.error('Survey upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
