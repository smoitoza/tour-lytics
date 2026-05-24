import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 15

// GET /api/portfolio/leases/[id]
// Returns the lease with locations and documents.
export async function GET(
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

    const admin = getPortfolioAdminClient()

    const { data: lease, error: leaseErr } = await admin
      .from('portfolio_leases')
      .select('*')
      .eq('id', id)
      .single()

    if (leaseErr || !lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    // Verify membership in the lease's company
    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', lease.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const [{ data: locations }, { data: documents }] = await Promise.all([
      admin
        .from('portfolio_lease_locations')
        .select('*')
        .eq('lease_id', id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),
      admin
        .from('portfolio_documents')
        .select('*')
        .eq('lease_id', id)
        .order('effective_date', { ascending: true, nullsFirst: false })
        .order('uploaded_at', { ascending: true }),
    ])

    return NextResponse.json({
      lease,
      locations: locations || [],
      documents: documents || [],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/portfolio/leases/[id]
// Body: partial lease fields to update.
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

    const admin = getPortfolioAdminClient()
    const { data: lease } = await admin
      .from('portfolio_leases')
      .select('company_id')
      .eq('id', id)
      .single()
    if (!lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', lease.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await req.json()
    // Only allow specific fields
    const allowed = [
      'name', 'landlord_name', 'landlord_entity', 'currency', 'lease_type',
      'commencement_date', 'rent_commencement_date', 'expiration_date',
      'term_months', 'status', 'notes',
    ]
    const updates: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in body) updates[k] = body[k]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('portfolio_leases')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ lease: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
