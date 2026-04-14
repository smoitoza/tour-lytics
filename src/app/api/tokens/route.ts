import { NextResponse } from 'next/server'
import {
  getUserTokenBalance,
  getTokenBalance,
  getTokenTransactions,
  getUsageSummary,
  getTokenPricing,
  getUserProjectBreakdown,
  resolveUserIdFromProject,
  creditTokens,
} from '@/lib/tokens'

// GET /api/tokens?userId=...&projectId=...&view=balance|transactions|summary|pricing
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const view = searchParams.get('view') || 'balance'

  try {
    switch (view) {
      case 'balance': {
        // Resolve userId: use provided, or look up from project's backfilled user_id
        let resolvedUserId = userId
        if (!resolvedUserId && projectId) {
          resolvedUserId = await resolveUserIdFromProject(projectId)
        }

        if (resolvedUserId) {
          const balance = await getUserTokenBalance(resolvedUserId)
          const breakdown = await getUserProjectBreakdown(resolvedUserId)
          return NextResponse.json({
            ...(balance || { balance: 0, total_purchased: 0, total_consumed: 0 }),
            project_breakdown: breakdown,
          })
        }
        // Final fallback: project-level balance
        const balance = await getTokenBalance(projectId)
        if (!balance) {
          return NextResponse.json({ balance: 0, total_purchased: 0, total_consumed: 0 })
        }
        return NextResponse.json(balance)
      }

      case 'transactions': {
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')
        const actionType = searchParams.get('actionType') || undefined
        const userEmail = searchParams.get('userEmail') || undefined

        // When querying by userId, include transactions from ALL projects the user owns
        // (team members' actions on your projects should appear in your billing)
        if (userId && !searchParams.get('projectId')) {
          const { getAdminClient } = await import('@/lib/tokens')
          const adminSupa = getAdminClient()
          // Get user's email to find owned projects
          const { data: authUser } = await adminSupa.auth.admin.getUserById(userId)
          const ownerEmail = authUser?.user?.email
          let ownedProjectIds: string[] = []
          if (ownerEmail) {
            const { data: projects } = await adminSupa.from('projects').select('id').eq('owner_id', ownerEmail)
            ownedProjectIds = (projects || []).map((p: any) => p.id)
          }

          // Query: user_id matches OR project_id is in owned projects
          let query = adminSupa
            .from('token_transactions')
            .select('*')
            .order('created_at', { ascending: false })
          if (ownedProjectIds.length > 0) {
            query = query.or(`user_id.eq.${userId},project_id.in.(${ownedProjectIds.join(',')})`)
          } else {
            query = query.eq('user_id', userId)
          }
          if (actionType) query = query.eq('action_type', actionType)
          if (limit) query = query.limit(limit)
          if (offset) query = query.range(offset, offset + limit - 1)

          const { data, error } = await query
          if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)
          return NextResponse.json(data || [])
        }

        const transactions = await getTokenTransactions({
          userId: userId || undefined,
          projectId: userId ? (searchParams.get('projectId') || undefined) : projectId,
          limit,
          offset,
          actionType,
          userEmail,
        })
        return NextResponse.json(transactions)
      }

      case 'summary': {
        const summary = await getUsageSummary({
          userId: userId || undefined,
          projectId: userId ? (searchParams.get('projectId') || undefined) : projectId,
        })
        return NextResponse.json(summary)
      }

      case 'pricing': {
        const pricing = await getTokenPricing()
        return NextResponse.json(pricing)
      }

      default:
        return NextResponse.json({ error: 'Invalid view. Use: balance, transactions, summary, pricing' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/tokens - credit tokens to a user's account
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, projectId, amount, userEmail, note } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive integer' }, { status: 400 })
    }

    if (!userId && !userEmail) {
      return NextResponse.json({ error: 'userId or userEmail is required' }, { status: 400 })
    }

    const result = await creditTokens({
      userId,
      projectId,
      amount,
      userEmail,
      note,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
