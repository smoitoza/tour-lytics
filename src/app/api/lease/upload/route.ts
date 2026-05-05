import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Generate a signed upload URL for direct browser-to-Storage upload of a lease file.
// Browser uploads the actual PDF/DOCX, then calls POST /api/lease to create the row.
export const maxDuration = 10

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// POST /api/lease/upload
// Body: { projectId, buildingAddress, filename, contentType }
// Returns: { signedUrl, token, publicUrl, storagePath }
export async function POST(req: Request) {
  try {
    const { projectId, buildingAddress, filename, contentType } = await req.json()

    if (!projectId || !filename) {
      return NextResponse.json({ error: 'projectId and filename required' }, { status: 400 })
    }

    // Whitelist mime types we know how to extract
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // legacy .doc
    ]
    if (contentType && !allowed.includes(contentType)) {
      return NextResponse.json({ error: 'Only PDF or Word documents are supported' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const timestamp = Date.now()
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const safeBuilding = (buildingAddress || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
    const storagePath = `leases/${projectId}/${safeBuilding}/${timestamp}-${safeName}`

    // Reuse the tour-photos bucket - already exists, public-readable, configured for direct uploads
    const { data, error } = await supabase.storage
      .from('tour-photos')
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('Signed URL error (lease):', error)
      return NextResponse.json({
        error: 'Could not create signed upload URL: ' + error.message,
      }, { status: 500 })
    }

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
    console.error('Lease upload endpoint error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
