import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient, PORTFOLIO_BUCKET } from '@/lib/portfolio/admin'

export const maxDuration = 30

async function authorizeLease(leaseId: string, userId: string) {
  const admin = getPortfolioAdminClient()
  const { data: lease, error } = await admin
    .from('portfolio_leases')
    .select('id, company_id, name, currency, status')
    .eq('id', leaseId)
    .single()
  if (error || !lease) return { ok: false as const, status: 404, error: 'Lease not found' }

  const { data: membership } = await admin
    .from('portfolio_company_members')
    .select('role, status')
    .eq('company_id', lease.company_id)
    .eq('user_id', userId)
    .single()
  if (!membership || membership.status !== 'active') {
    return { ok: false as const, status: 403, error: 'Not authorized' }
  }
  const canEdit = ['owner', 'admin'].includes(membership.role)
  return { ok: true as const, lease, admin, canEdit }
}

// GET /api/portfolio/leases/[id]/abstraction
// Returns the latest abstraction for this lease + signed URLs for the source documents
// so the review screen can render the PDFs side-by-side.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await authorizeLease(leaseId, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const { data: abstraction } = await result.admin
      .from('portfolio_abstractions')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!abstraction) {
      return NextResponse.json({ lease: result.lease, abstraction: null, documents: [] })
    }

    // Pull all related documents (extracted ones referenced by id) and sign their URLs.
    const extractedFields = (abstraction.extracted_fields || {}) as Record<string, unknown>
    const sourceDocIds: string[] = Array.isArray(extractedFields.source_document_ids)
      ? (extractedFields.source_document_ids as string[])
      : []

    const { data: docs } = await result.admin
      .from('portfolio_documents')
      .select('id, original_filename, storage_path, document_type, effective_date, mime_type')
      .eq('lease_id', leaseId)

    const docList = docs || []
    const ordered = sourceDocIds.length
      ? [...docList].sort((a, b) => {
          const ia = sourceDocIds.indexOf(a.id)
          const ib = sourceDocIds.indexOf(b.id)
          if (ia === -1 && ib === -1) return 0
          if (ia === -1) return 1
          if (ib === -1) return -1
          return ia - ib
        })
      : docList

    const signed = await Promise.all(ordered.map(async (d) => {
      if (!d.storage_path) return { ...d, signed_url: null }
      const { data: s } = await result.admin.storage
        .from(PORTFOLIO_BUCKET)
        .createSignedUrl(d.storage_path, 60 * 60)
      return { ...d, signed_url: s?.signedUrl || null }
    }))

    return NextResponse.json({
      lease: result.lease,
      abstraction,
      documents: signed,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/portfolio/leases/[id]/abstraction
// Body: { extracted_fields, status?, reviewer_notes? }
// Used by the review screen to save edits before publishing.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await authorizeLease(leaseId, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    if (!result.canEdit) {
      return NextResponse.json({ error: 'You must be an admin or owner to edit abstractions' }, { status: 403 })
    }

    const { data: abstraction } = await result.admin
      .from('portfolio_abstractions')
      .select('id, status')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!abstraction) {
      return NextResponse.json({ error: 'No abstraction to update. Run extraction first.' }, { status: 404 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if ('extracted_fields' in body && body.extracted_fields && typeof body.extracted_fields === 'object') {
      updates.extracted_fields = body.extracted_fields
    }
    if ('status' in body) {
      const s = body.status
      if (!['pending_review', 'approved', 'rejected', 'needs_more_info'].includes(s)) {
        return NextResponse.json({ error: `Invalid status: ${s}` }, { status: 400 })
      }
      updates.status = s
      if (s === 'approved' || s === 'rejected') {
        updates.reviewer_id = user.id
        updates.reviewed_at = new Date().toISOString()
      }
    }
    if ('reviewer_notes' in body) {
      updates.reviewer_notes = body.reviewer_notes
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await result.admin
      .from('portfolio_abstractions')
      .update(updates)
      .eq('id', abstraction.id)
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ abstraction: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
