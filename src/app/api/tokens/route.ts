import { NextResponse } from 'next/server'
import {
  getUserTokenBalance,
  getTokenBalance,
  getTokenTransactions,
  getUsageSummary,
  getTokenPricing,
  getUserProjectBreakdown,
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
        // If userId is provided, return user's account balance + per-project breakdown
        if (userId) {
          const balance = await getUserTokenBalance(userId)
          const breakdown = await getUserProjectBreakdown(userId)
          return NextResponse.json({
            ...(balance || { balance: 0, total_purchased: 0, total_consumed: 0 }),
            project_breakdown: breakdown,
          })
        }
        // Fallback: project-level balance (backward compatible)
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
