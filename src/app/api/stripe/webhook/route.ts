import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { creditTokens } from '@/lib/tokens'

// Disable Next.js body parsing so we can verify the raw Stripe signature
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const projectId = session.metadata?.projectId
      const userEmail = session.metadata?.userEmail
      const tokenAmount = parseInt(session.metadata?.tokenAmount || '0')

      if (!projectId || !tokenAmount) {
        console.error('Missing metadata in Stripe session:', session.id)
        return NextResponse.json({ received: true })
      }

      // Check if already processed (idempotency)
      const { data: existing } = await supabase
        .from('stripe_payments')
        .select('status')
        .eq('stripe_session_id', session.id)
        .single()

      if (existing?.status === 'completed') {
        console.log('Payment already processed:', session.id)
        return NextResponse.json({ received: true })
      }

      // Credit the tokens
      try {
        await creditTokens({
          projectId,
          amount: tokenAmount,
          userEmail: userEmail || undefined,
          note: `Stripe purchase: ${tokenAmount} tokens (${session.metadata?.packId || 'custom'})`,
        })

        // Update payment record
        await supabase
          .from('stripe_payments')
          .update({
            status: 'completed',
            stripe_payment_intent: session.payment_intent as string,
            stripe_customer_id: session.customer as string,
            completed_at: new Date().toISOString(),
          })
          .eq('stripe_session_id', session.id)

        console.log(`Credited ${tokenAmount} tokens to project ${projectId}`)
      } catch (creditErr) {
        console.error('Failed to credit tokens:', creditErr)

        // Mark payment as needing manual review
        await supabase
          .from('stripe_payments')
          .update({
            status: 'failed',
            metadata: {
              error: String(creditErr),
              needs_manual_review: true,
            },
          })
          .eq('stripe_session_id', session.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
