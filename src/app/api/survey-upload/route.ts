import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lightweight endpoint - just generates a signed upload URL
// The actual file upload goes directly from the browser to Supabase Storage
export const maxDuration = 10

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// POST /api/survey-upload - Generate a signed upload URL for direct browser upload
// Body: { projectId, filename, contentType }
// Returns: { signedUrl, publicUrl, storagePath }
export async function POST(req: Request) {
  try {
    const { projectId, filename, contentType } = await req.json()

    if (!projectId || !filename) {
      return NextResponse.json({ error: 'projectId and filename required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const timestamp = Date.now()
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `surveys/${projectId}/${timestamp}-${safeName}`

    // Create a signed upload URL (valid for 5 minutes)
    const { data, error } = await supabase.storage
      .from('tour-photos')
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('Signed URL error:', error)
      // Fallback: try direct upload via service role if signed URLs aren't supported
      return NextResponse.json({
        error: 'Could not create signed upload URL: ' + error.message,
        fallback: true,
      }, { status: 500 })
    }

    // Build the public URL for this file
    const { data: urlData } = supabase.storage
      .from('tour-photos')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      publicUrl: urlData.publicUrl,
      storagePath,
    })
  } catch (err) {
    console.error('Survey upload endpoint error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
