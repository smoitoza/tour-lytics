import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient } from '@/lib/portfolio/admin'

export const maxDuration = 30

// GET /api/portfolio/companies
// Returns all portfolio companies the current user is a member of.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use admin client to read across RLS for the membership lookup,
    // but filter to only companies the user belongs to.
    const admin = getPortfolioAdminClient()
    const { data: memberships, error: memberError } = await admin
      .from('portfolio_company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }
    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ companies: [] })
    }

    const companyIds = memberships.map((m) => m.company_id)
    const { data: companies, error: coError } = await admin
      .from('portfolio_companies')
      .select(`
        id, name, slug, reporting_currency, logo_url,
        storage_quota_bytes, storage_used_bytes,
        created_at, updated_at
      `)
      .in('id', companyIds)
      .order('name')

    if (coError) {
      return NextResponse.json({ error: coError.message }, { status: 500 })
    }

    const roleMap = new Map(memberships.map((m) => [m.company_id, m.role]))
    const enriched = (companies || []).map((c) => ({
      ...c,
      my_role: roleMap.get(c.id),
    }))

    return NextResponse.json({ companies: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/portfolio/companies
// Body: { name, slug?, reporting_currency? }
// Creates a new company with the current user as owner.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

    const admin = getPortfolioAdminClient()
    const { data: company, error: coError } = await admin
      .from('portfolio_companies')
      .insert({
        name: body.name,
        slug,
        reporting_currency: body.reporting_currency || 'USD',
        created_by: user.id,
      })
      .select()
      .single()

    if (coError) {
      return NextResponse.json({ error: coError.message }, { status: 400 })
    }

    const { error: memberError } = await admin
      .from('portfolio_company_members')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        invited_by: user.id,
      })

    if (memberError) {
      // Best-effort cleanup
      await admin.from('portfolio_companies').delete().eq('id', company.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json({ company })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
