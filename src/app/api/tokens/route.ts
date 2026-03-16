import { NextResponse } from 'next/server'
import {
  getTokenBalance,
  getTokenTransactions,
  getUsageSummary,
  getTokenPricing,
  creditTokens,
} from '@/lib/tokens'

// GET /api/tokens?projectId=...&view=balance|transactions|summary|pricing
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const view = searchParams.get('view') || 'balance'

  try {
    switch (view) {
      case 'balance': {
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
        const transactions = await getTokenTransactions({ projectId, limit, offset, actionType, userEmail })
        return NextResponse.json(transactions)
      }

      case 'summary': {
        const summary = await getUsageSummary(projectId)
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

// POST /api/tokens - credit tokens (admin only, for now)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { projectId = 'sf-office-search', amount, userEmail, note } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive integer' }, { status: 400 })
    }

    const result = await creditTokens({ projectId, amount, userEmail, note })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
