import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient, PORTFOLIO_BUCKET } from '@/lib/portfolio/admin'

export const maxDuration = 15

const ALLOWED_DOCUMENT_TYPES = [
  'lease', 'amendment', 'snda', 'estoppel', 'exhibit',
  'side_letter', 'work_letter', 'guaranty', 'other',
] as const

type AuthorizeResult =
  | { ok: true; doc: { id: string; company_id: string; lease_id: string | null; storage_path: string | null }; admin: ReturnType<typeof getPortfolioAdminClient> }
  | { ok: false; status: number; error: string }

async function authorize(docId: string, userId: string): Promise<AuthorizeResult> {
  const admin = getPortfolioAdminClient()
  const { data: doc, error } = await admin
    .from('portfolio_documents')
    .select('id, company_id, lease_id, storage_path')
    .eq('id', docId)
    .single()
  if (error || !doc) return { ok: false, status: 404, error: 'Document not found' }

  const { data: membership } = await admin
    .from('portfolio_company_members')
    .select('role, status')
    .eq('company_id', doc.company_id)
    .eq('user_id', userId)
    .single()
  if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
    return { ok: false, status: 403, error: 'Not authorized' }
  }
  return { ok: true, doc, admin }
}

// PATCH /api/portfolio/documents/[id]
// Body: { document_type?, effective_date? (YYYY-MM-DD or null), lease_id? (uuid or null) }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await authorize(id, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if ('document_type' in body) {
      const t = body.document_type
      if (t !== null && !ALLOWED_DOCUMENT_TYPES.includes(t)) {
        return NextResponse.json({ error: `Invalid document_type: ${t}` }, { status: 400 })
      }
      updates.document_type = t
    }

    if ('effective_date' in body) {
      const d = body.effective_date
      if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(d))) {
        return NextResponse.json({ error: 'effective_date must be YYYY-MM-DD or null' }, { status: 400 })
      }
      updates.effective_date = d
    }

    if ('lease_id' in body) {
      const lid = body.lease_id
      if (lid !== null) {
        // Verify the target lease exists and belongs to the same company
        const { data: lease } = await result.admin
          .from('portfolio_leases')
          .select('id, company_id')
          .eq('id', lid)
          .single()
        if (!lease || lease.company_id !== result.doc.company_id) {
          return NextResponse.json({ error: 'Target lease not found or belongs to a different company' }, { status: 400 })
        }
      }
      updates.lease_id = lid
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await result.admin
      .from('portfolio_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ document: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/portfolio/documents/[id]
// Removes the storage object and the row. Storage trigger reconciles quota.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await authorize(id, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    // Remove storage object first (best-effort — if it's already gone, keep going)
    if (result.doc.storage_path) {
      const { error: storageErr } = await result.admin.storage
        .from(PORTFOLIO_BUCKET)
        .remove([result.doc.storage_path])
      if (storageErr) {
        // Log but don't block deletion of the row — a phantom file is recoverable;
        // a phantom row is much worse for the user.
        console.warn('portfolio_documents storage delete warning:', storageErr.message)
      }
    }

    const { error: dbErr } = await result.admin
      .from('portfolio_documents')
      .delete()
      .eq('id', id)
    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
