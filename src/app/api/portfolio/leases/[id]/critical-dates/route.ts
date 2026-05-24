import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 15

// GET /api/portfolio/leases/[id]/critical-dates?window=365
// Returns critical dates for the lease, ordered by trigger_date ascending.
// Each row is annotated with days_until and urgency for the detail-page UI.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params
    const url = new URL(req.url)
    const windowDays = Math.max(1, Math.min(3650, parseInt(url.searchParams.get('window') || '365', 10) || 365))

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getPortfolioAdminClient()
    const { data: lease, error: leaseErr } = await admin
      .from('portfolio_leases')
      .select('id, company_id')
      .eq('id', leaseId)
      .single()
    if (leaseErr || !lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('status')
      .eq('company_id', lease.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { data: rows, error: cdErr } = await admin
      .from('portfolio_critical_dates')
      .select('id, date_type, trigger_date, trigger_date_end, description, reminder_days_before, status, notes')
      .eq('lease_id', leaseId)
      .order('trigger_date', { ascending: true })

    if (cdErr) {
      return NextResponse.json({ error: cdErr.message }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + windowDays)

    const annotated = (rows || []).map((r) => {
      const trigger = new Date(r.trigger_date + 'T00:00:00')
      const triggerEnd = r.trigger_date_end ? new Date(r.trigger_date_end + 'T00:00:00') : null
      const daysUntil = Math.round((trigger.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const daysUntilEnd = triggerEnd
        ? Math.round((triggerEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null

      let urgency: 'overdue' | 'imminent' | 'soon' | 'upcoming' | 'future'
      if (daysUntil < 0 && (daysUntilEnd == null || daysUntilEnd < 0)) urgency = 'overdue'
      else if (daysUntil <= 30) urgency = 'imminent'
      else if (daysUntil <= 90) urgency = 'soon'
      else if (daysUntil <= windowDays) urgency = 'upcoming'
      else urgency = 'future'

      return {
        ...r,
        days_until: daysUntil,
        days_until_end: daysUntilEnd,
        urgency,
      }
    })

    const upcoming = annotated.filter((r) => {
      const triggerEnd = r.trigger_date_end ? new Date(r.trigger_date_end + 'T00:00:00') : null
      const end = triggerEnd || new Date(r.trigger_date + 'T00:00:00')
      return end.getTime() >= today.getTime() && new Date(r.trigger_date + 'T00:00:00').getTime() <= horizon.getTime() && r.status !== 'completed' && r.status !== 'n_a'
    })

    return NextResponse.json({
      all: annotated,
      upcoming,
      window_days: windowDays,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
