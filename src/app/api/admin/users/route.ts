import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface EnrichedUser {
  id: string
  email: string
  display_name: string | null
  created_at: string
  last_sign_in_at: string | null
  is_admin: boolean
  balance: number
  total_purchased: number
  total_consumed: number
  owned_projects: number
  shared_projects: number
  actions_30d: number
  tokens_30d: number
}

// GET /api/admin/users?adminEmail=scott@tourlytics.ai
// Returns all users with aggregated stats
export async function GET(req: NextRequest) {
  const adminEmail = req.nextUrl.searchParams.get('adminEmail') || ''
  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()

    // Get all auth users
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) throw authErr
    const authUsers = authData?.users || []

    // Get all user-level token balances in one query
    const { data: balances } = await supabase
      .from('token_balances')
      .select('user_id, balance, total_purchased, total_consumed')
      .is('project_id', null)

    const balanceMap = new Map<string, { balance: number; total_purchased: number; total_consumed: number }>()
    for (const b of balances || []) {
      balanceMap.set(b.user_id, {
        balance: b.balance || 0,
        total_purchased: b.total_purchased || 0,
        total_consumed: b.total_consumed || 0,
      })
    }

    // Count owned projects per user (projects.owner_id = email)
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, owner_id')
      .neq('status', 'deleted')
    const ownedCounts = new Map<string, number>()
    for (const p of allProjects || []) {
      const ownerEmail = (p.owner_id || '').toLowerCase().trim()
      if (ownerEmail) ownedCounts.set(ownerEmail, (ownedCounts.get(ownerEmail) || 0) + 1)
    }

    // Count shared projects per user (project_members, minus owner role)
    const { data: allMembers } = await supabase
      .from('project_members')
      .select('email, role')
    const sharedCounts = new Map<string, number>()
    for (const m of allMembers || []) {
      const memberEmail = (m.email || '').toLowerCase().trim()
      if (!memberEmail || m.role === 'owner') continue
      sharedCounts.set(memberEmail, (sharedCounts.get(memberEmail) || 0) + 1)
    }

    // Get 30-day activity per user from token_transactions
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: recentTxs } = await supabase
      .from('token_transactions')
      .select('user_id, amount')
      .lt('amount', 0) // consumption only (debits)
      .gte('created_at', thirtyDaysAgo.toISOString())

    const activityMap = new Map<string, { actions: number; tokens: number }>()
    for (const tx of recentTxs || []) {
      if (!tx.user_id) continue
      const prev = activityMap.get(tx.user_id) || { actions: 0, tokens: 0 }
      activityMap.set(tx.user_id, {
        actions: prev.actions + 1,
        tokens: prev.tokens + Math.abs(tx.amount || 0),
      })
    }

    // Build enriched list
    const enriched: EnrichedUser[] = authUsers.map(u => {
      const email = (u.email || '').toLowerCase()
      const balance = balanceMap.get(u.id) || { balance: 0, total_purchased: 0, total_consumed: 0 }
      const activity = activityMap.get(u.id) || { actions: 0, tokens: 0 }
      return {
        id: u.id,
        email: u.email || '',
        display_name: (u.user_metadata as any)?.display_name || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
        is_admin: isAdminEmail(email),
        balance: balance.balance,
        total_purchased: balance.total_purchased,
        total_consumed: balance.total_consumed,
        owned_projects: ownedCounts.get(email) || 0,
        shared_projects: sharedCounts.get(email) || 0,
        actions_30d: activity.actions,
        tokens_30d: activity.tokens,
      }
    })

    // Sort: most recent sign-in first, nulls last
    enriched.sort((a, b) => {
      if (!a.last_sign_in_at && !b.last_sign_in_at) return a.email.localeCompare(b.email)
      if (!a.last_sign_in_at) return 1
      if (!b.last_sign_in_at) return -1
      return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime()
    })

    return NextResponse.json({ users: enriched, count: enriched.length })
  } catch (err: any) {
    console.error('Admin users list error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
