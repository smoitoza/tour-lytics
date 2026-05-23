import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 15

// GET /api/portfolio/documents?company_id=...&lease_id=...
// List documents for a company (optionally filtered by lease).
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('company_id')
    const leaseId = searchParams.get('lease_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id required' }, { status: 400 })
    }

    const admin = getPortfolioAdminClient()
    // Verify membership
    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    let query = admin
      .from('portfolio_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })

    if (leaseId) query = query.eq('lease_id', leaseId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ documents: data || [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/portfolio/documents
// Body: { company_id, lease_id?, storage_path, original_filename,
//         document_type?, size_bytes, mime_type? }
// Creates the document row AFTER the file has been uploaded to Storage.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const {
      company_id, lease_id, storage_path, original_filename,
      document_type, size_bytes, mime_type,
    } = body || {}

    if (!company_id || !storage_path || !original_filename) {
      return NextResponse.json({ error: 'company_id, storage_path, original_filename are required' }, { status: 400 })
    }

    const admin = getPortfolioAdminClient()
    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Belt-and-suspenders: enforce storage path begins with companies/{company_id}/
    const expectedPrefix = `companies/${company_id}/`
    if (!storage_path.startsWith(expectedPrefix)) {
      return NextResponse.json({
        error: `storage_path must begin with ${expectedPrefix}`,
      }, { status: 400 })
    }

    const { data, error } = await admin
      .from('portfolio_documents')
      .insert({
        company_id,
        lease_id: lease_id || null,
        storage_path,
        original_filename,
        document_type: document_type || 'lease',
        size_bytes: size_bytes || null,
        mime_type: mime_type || null,
        uploaded_by: user.id,
      })
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
