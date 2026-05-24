import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 30

// POST /api/portfolio/leases/[id]/publish
// Approves the most recent abstraction and writes its fields to the operational portfolio_* tables.
// Body: { reviewer_notes?: string }
//
// We delete+insert child rows rather than diff to keep the contract simple. The abstraction stays
// as the canonical source of truth; the operational tables are derived.
export async function POST(
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

    const admin = getPortfolioAdminClient()

    const { data: lease, error: leaseErr } = await admin
      .from('portfolio_leases')
      .select('id, company_id, status')
      .eq('id', leaseId)
      .single()
    if (leaseErr || !lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', lease.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins or owners can publish' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const reviewerNotes: string | null = typeof body.reviewer_notes === 'string' ? body.reviewer_notes : null

    const { data: abstraction } = await admin
      .from('portfolio_abstractions')
      .select('id, extracted_fields, status')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!abstraction) {
      return NextResponse.json({ error: 'No abstraction to publish. Run extraction first.' }, { status: 404 })
    }

    const fields = (abstraction.extracted_fields || {}) as Record<string, unknown>
    const leaseMeta = (fields.lease_meta || {}) as Record<string, unknown>
    const locations = Array.isArray(fields.locations) ? (fields.locations as Record<string, unknown>[]) : []
    const rentSchedule = Array.isArray(fields.rent_schedule) ? (fields.rent_schedule as Record<string, unknown>[]) : []
    const opex = (fields.opex_terms || {}) as Record<string, unknown>
    const criticalDates = Array.isArray(fields.critical_dates) ? (fields.critical_dates as Record<string, unknown>[]) : []
    const security = Array.isArray(fields.security_instruments) ? (fields.security_instruments as Record<string, unknown>[]) : []

    const leaseCurrency = (leaseMeta.currency as string) || 'USD'

    // ---- 1) Update portfolio_leases ----
    const leaseUpdates: Record<string, unknown> = {}
    if (leaseMeta.landlord_name) leaseUpdates.landlord_name = leaseMeta.landlord_name
    if (leaseMeta.landlord_entity) leaseUpdates.landlord_entity = leaseMeta.landlord_entity
    if (leaseMeta.lease_type) leaseUpdates.lease_type = leaseMeta.lease_type
    if (leaseMeta.currency) leaseUpdates.currency = leaseMeta.currency
    if (leaseMeta.commencement_date) leaseUpdates.commencement_date = leaseMeta.commencement_date
    if (leaseMeta.rent_commencement_date) leaseUpdates.rent_commencement_date = leaseMeta.rent_commencement_date
    if (leaseMeta.expiration_date) leaseUpdates.expiration_date = leaseMeta.expiration_date
    if (leaseMeta.term_months) leaseUpdates.term_months = leaseMeta.term_months
    if (leaseMeta.notes) leaseUpdates.notes = leaseMeta.notes
    if (lease.status === 'draft') leaseUpdates.status = 'active'
    leaseUpdates.abstracted_at = new Date().toISOString()
    leaseUpdates.approved_at = new Date().toISOString()
    leaseUpdates.approved_by = user.id

    if (Object.keys(leaseUpdates).length > 0) {
      const { error: updErr } = await admin
        .from('portfolio_leases')
        .update(leaseUpdates)
        .eq('id', leaseId)
      if (updErr) {
        return NextResponse.json({ error: 'Failed updating lease: ' + updErr.message }, { status: 500 })
      }
    }

    // ---- 2) Replace locations ----
    if (locations.length > 0) {
      await admin.from('portfolio_lease_locations').delete().eq('lease_id', leaseId)
      const hasPrimary = locations.some((x) => x.is_primary === true)
      const locRows = locations
        .filter((l) => l.address_line1 && l.city)
        .map((l, i) => ({
          lease_id: leaseId,
          label: l.label || null,
          address_line1: String(l.address_line1),
          address_line2: l.address_line2 || null,
          city: String(l.city),
          state_province: l.state_province || null,
          postal_code: l.postal_code || null,
          country: l.country || 'US',
          use_type: l.use_type || null,
          rentable_sqft: l.rentable_sqft ?? null,
          floor_count: l.floor_count ?? null,
          is_primary: l.is_primary === true || (!hasPrimary && i === 0),
        }))
      if (locRows.length > 0) {
        const { error: locErr } = await admin.from('portfolio_lease_locations').insert(locRows)
        if (locErr) {
          return NextResponse.json({ error: 'Failed writing locations: ' + locErr.message }, { status: 500 })
        }
      }
    }

    // ---- 3) Replace rent schedule ----
    if (rentSchedule.length > 0) {
      await admin.from('portfolio_rent_schedule').delete().eq('lease_id', leaseId)
      const rentRows = rentSchedule
        .filter((r) => r.period_start && r.period_end)
        .map((r) => ({
          lease_id: leaseId,
          period_start: r.period_start,
          period_end: r.period_end,
          monthly_rent: r.monthly_rent ?? 0,
          rent_psf_annual: r.rent_psf_annual ?? null,
          is_free_rent: r.is_free_rent === true,
          escalation_type: r.escalation_type || null,
        }))
      if (rentRows.length > 0) {
        const { error: rentErr } = await admin.from('portfolio_rent_schedule').insert(rentRows)
        if (rentErr) {
          return NextResponse.json({ error: 'Failed writing rent schedule: ' + rentErr.message }, { status: 500 })
        }
      }
    }

    // ---- 4) Replace opex terms (one row per lease) ----
    if (opex && Object.keys(opex).length > 0) {
      await admin.from('portfolio_opex_terms').delete().eq('lease_id', leaseId)
      const opexRow = {
        lease_id: leaseId,
        starting_opex_psf_annual: opex.starting_opex_psf_annual ?? null,
        escalation_pct: opex.escalation_pct ?? null,
        escalation_type: opex.escalation_type || null,
        cap_pct: opex.cap_pct ?? null,
        free_opex_months: opex.free_opex_months ?? 0,
        free_opex_start: opex.free_opex_start || null,
        base_year: opex.base_year ?? null,
        notes: opex.notes || null,
      }
      const { error: opexErr } = await admin.from('portfolio_opex_terms').insert([opexRow])
      if (opexErr) {
        return NextResponse.json({ error: 'Failed writing opex terms: ' + opexErr.message }, { status: 500 })
      }
    }

    // ---- 5) Replace critical dates ----
    if (criticalDates.length > 0) {
      await admin.from('portfolio_critical_dates').delete().eq('lease_id', leaseId)
      const cdRows = criticalDates
        .filter((c) => c.trigger_date)
        .map((c) => ({
          lease_id: leaseId,
          date_type: c.date_type || 'other',
          trigger_date: c.trigger_date,
          trigger_date_end: c.trigger_date_end || null,
          description: c.description || null,
          reminder_days_before: c.reminder_days_before ?? 90,
          status: 'upcoming',
          notes: c.notes || null,
        }))
      if (cdRows.length > 0) {
        const { error: cdErr } = await admin.from('portfolio_critical_dates').insert(cdRows)
        if (cdErr) {
          return NextResponse.json({ error: 'Failed writing critical dates: ' + cdErr.message }, { status: 500 })
        }
      }
    }

    // ---- 6) Replace security instruments ----
    if (security.length > 0) {
      await admin.from('portfolio_security_instruments').delete().eq('lease_id', leaseId)
      const secRows = security
        .filter((s) => s.amount !== null && s.amount !== undefined)
        .map((s) => ({
          lease_id: leaseId,
          instrument_type: s.instrument_type || 'cash_deposit',
          amount: s.amount,
          currency: s.currency || leaseCurrency,
          issuer: s.issuer || null,
          expiration_date: s.expiration_date || null,
          burndown_schedule: s.burndown_schedule ?? null,
          notes: s.notes || null,
        }))
      if (secRows.length > 0) {
        const { error: secErr } = await admin.from('portfolio_security_instruments').insert(secRows)
        if (secErr) {
          return NextResponse.json({ error: 'Failed writing security instruments: ' + secErr.message }, { status: 500 })
        }
      }
    }

    // ---- 7) Mark abstraction approved ----
    const { error: absErr } = await admin
      .from('portfolio_abstractions')
      .update({
        status: 'approved',
        reviewer_id: user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: reviewerNotes,
      })
      .eq('id', abstraction.id)
    if (absErr) {
      return NextResponse.json({ error: 'Failed marking abstraction approved: ' + absErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      lease_id: leaseId,
      published: {
        locations: locations.length,
        rent_schedule: rentSchedule.length,
        opex_terms: opex && Object.keys(opex).length > 0 ? 1 : 0,
        critical_dates: criticalDates.length,
        security_instruments: security.length,
      },
    })
  } catch (err) {
    console.error('Portfolio publish error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
