import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient, PORTFOLIO_BUCKET } from '@/lib/portfolio/admin'

export const maxDuration = 15

// GET /api/portfolio/documents/[id]/sign
// Returns a fresh signed URL for a portfolio document. Used by the review screen
// to re-sign URLs when the user switches between source-document tabs so the
// embed never goes stale during long review sessions.
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

    const { data: signed, error: signErr } = await admin.storage
      .from(PORTFOLIO_BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 60)
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: signErr?.message || 'Failed to sign URL' }, { status: 500 })
    }

    return NextResponse.json({
      id: doc.id,
      signed_url: signed.signedUrl,
      mime_type: doc.mime_type,
      original_filename: doc.original_filename,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
