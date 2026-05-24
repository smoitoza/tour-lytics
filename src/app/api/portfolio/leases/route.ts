import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 15

// GET /api/portfolio/leases?company_id=...
// Returns leases for a company with primary location + document counts.
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id required' }, { status: 400 })
    }

    const admin = getPortfolioAdminClient()
    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Pull leases for the company
    const { data: leases, error: leasesErr } = await admin
      .from('portfolio_leases')
      .select(`
        id, name, landlord_name, currency, lease_type, status,
        commencement_date, expiration_date, term_months,
        created_at, updated_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (leasesErr) {
      return NextResponse.json({ error: leasesErr.message }, { status: 500 })
    }

    const leaseIds = (leases || []).map((l) => l.id)

    // Pull primary locations for those leases
    type LocRow = {
      lease_id: string
      address_line1: string
      city: string
      state_province: string | null
      country: string
      is_primary: boolean
    }
    const locsByLease: Record<string, LocRow> = {}
    if (leaseIds.length > 0) {
      const { data: locs } = await admin
        .from('portfolio_lease_locations')
        .select('lease_id, address_line1, city, state_province, country, is_primary')
        .in('lease_id', leaseIds)
      if (locs) {
        // pick primary; fall back to first
        for (const loc of locs as LocRow[]) {
          const existing = locsByLease[loc.lease_id]
          if (!existing || (loc.is_primary && !existing.is_primary)) {
            locsByLease[loc.lease_id] = loc
          }
        }
      }
    }

    // Document counts per lease
    const docCounts: Record<string, number> = {}
    if (leaseIds.length > 0) {
      const { data: docs } = await admin
        .from('portfolio_documents')
        .select('lease_id')
        .in('lease_id', leaseIds)
      if (docs) {
        for (const d of docs as { lease_id: string | null }[]) {
          if (d.lease_id) docCounts[d.lease_id] = (docCounts[d.lease_id] || 0) + 1
        }
      }
    }

    // Unassigned document count
    const { count: unassignedCount } = await admin
      .from('portfolio_documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('lease_id', null)

    const enriched = (leases || []).map((l) => ({
      ...l,
      primary_location: locsByLease[l.id] || null,
      document_count: docCounts[l.id] || 0,
    }))

    return NextResponse.json({
      leases: enriched,
      unassigned_document_count: unassignedCount || 0,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/portfolio/leases
// Body: {
//   company_id, name, landlord_name?, currency?, lease_type?,
//   commencement_date?, expiration_date?, term_months?, status?, notes?,
//   primary_location?: { address_line1, address_line2?, city, state_province?,
//                        postal_code?, country, use_type?, rentable_sqft? }
// }
// Creates a lease (status defaults to 'draft') and optionally a primary location.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const {
      company_id, name, landlord_name, currency, lease_type,
      commencement_date, expiration_date, term_months, status, notes,
      primary_location,
    } = body || {}

    if (!company_id || !name) {
      return NextResponse.json({ error: 'company_id and name are required' }, { status: 400 })
    }

    const admin = getPortfolioAdminClient()
    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized to create leases for this company' }, { status: 403 })
    }

    const { data: lease, error: leaseErr } = await admin
      .from('portfolio_leases')
      .insert({
        company_id,
        name,
        landlord_name: landlord_name || null,
        currency: currency || 'USD',
        lease_type: lease_type || null,
        commencement_date: commencement_date || null,
        expiration_date: expiration_date || null,
        term_months: term_months || null,
        status: status || 'draft',
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (leaseErr || !lease) {
      return NextResponse.json({ error: leaseErr?.message || 'Failed to create lease' }, { status: 500 })
    }

    // Optional primary location
    let locationRow = null
    if (primary_location && primary_location.address_line1 && primary_location.city && primary_location.country) {
      const { data: loc, error: locErr } = await admin
        .from('portfolio_lease_locations')
        .insert({
          lease_id: lease.id,
          address_line1: primary_location.address_line1,
          address_line2: primary_location.address_line2 || null,
          city: primary_location.city,
          state_province: primary_location.state_province || null,
          postal_code: primary_location.postal_code || null,
          country: primary_location.country,
          use_type: primary_location.use_type || null,
          rentable_sqft: primary_location.rentable_sqft || null,
          is_primary: true,
        })
        .select()
        .single()
      if (locErr) {
        // Lease was created; surface the location error but keep the lease.
        return NextResponse.json({
          lease,
          location_error: locErr.message,
          warning: 'Lease created but primary location failed to save.',
        })
      }
      locationRow = loc
    }

    return NextResponse.json({ lease, primary_location: locationRow })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
