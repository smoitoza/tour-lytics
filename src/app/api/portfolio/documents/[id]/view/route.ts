import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient, PORTFOLIO_BUCKET } from '@/lib/portfolio/admin'

export const maxDuration = 30

// GET /api/portfolio/documents/[id]/view
// Streams the document inline from same origin so browser PDF viewers render
// reliably inside <object>/<iframe> (avoids cross-origin embed quirks against
// the Supabase storage host).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: docId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getPortfolioAdminClient()
    const { data: doc, error: docErr } = await admin
      .from('portfolio_documents')
      .select('id, company_id, storage_path, original_filename, mime_type')
      .eq('id', docId)
      .single()
    if (docErr || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('status')
      .eq('company_id', doc.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    if (!doc.storage_path) {
      return NextResponse.json({ error: 'No storage path for document' }, { status: 404 })
    }

    const { data: blob, error: dlErr } = await admin.storage
      .from(PORTFOLIO_BUCKET)
      .download(doc.storage_path)
    if (dlErr || !blob) {
      return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 })
    }

    const buf = await blob.arrayBuffer()
    const mime = doc.mime_type || 'application/pdf'
    const safeName = doc.original_filename?.replace(/"/g, '') || 'document'
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
