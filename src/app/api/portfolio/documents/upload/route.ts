import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  getPortfolioAdminClient,
  buildPortfolioStoragePath,
  checkQuota,
  PORTFOLIO_BUCKET,
} from '@/lib/portfolio/admin'

export const maxDuration = 15

// POST /api/portfolio/documents/upload
// Body: { company_id, lease_id?, filename, content_type, size_bytes }
// Returns: { signedUrl, token, storagePath, expiresIn }
//
// Flow:
//   1) Verify caller is a member of the company (and admin role for write)
//   2) Quota check (fail fast before signing URL)
//   3) Generate signed upload URL with the canonical path
//   4) Caller PUTs the file directly to Storage
//   5) Caller then POSTs to /api/portfolio/documents (separate endpoint) to
//      create the portfolio_documents row. The DB row insert is what bumps
//      storage_used_bytes via trigger.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { company_id, lease_id, filename, content_type, size_bytes } = body || {}

    if (!company_id || !filename) {
      return NextResponse.json({ error: 'company_id and filename are required' }, { status: 400 })
    }

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ]
    if (content_type && !allowed.includes(content_type)) {
      return NextResponse.json({ error: 'Unsupported file type: ' + content_type }, { status: 400 })
    }

    // Auth check: must be active admin of the company
    const admin = getPortfolioAdminClient()
    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', company_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized to upload documents for this company' }, { status: 403 })
    }

    // Quota check
    const declaredBytes = Number(size_bytes) || 0
    if (declaredBytes > 0) {
      const quota = await checkQuota(company_id, declaredBytes)
      if (!quota.ok) {
        return NextResponse.json({ error: quota.error }, { status: 413 })
      }
    }

    const storagePath = buildPortfolioStoragePath({
      companyId: company_id,
      leaseId: lease_id || null,
      filename,
    })

    const { data, error } = await admin.storage
      .from(PORTFOLIO_BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error) {
      return NextResponse.json({ error: 'Failed to create signed URL: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      expiresIn: 3600, // Supabase signed upload URLs default to 1 hour
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
