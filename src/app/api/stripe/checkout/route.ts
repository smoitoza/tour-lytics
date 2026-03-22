import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Lazy-initialize Stripe to avoid build-time errors when env vars aren't set
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Token pack definitions
// Note: No specific dollar pricing exposed to user per instructions
// These are internal Stripe amounts
const TOKEN_PACKS: Record<string, { tokens: number; priceCents: number; label: string }> = {
  starter: { tokens: 100, priceCents: 9900, label: 'Starter Pack' },
  professional: { tokens: 500, priceCents: 39900, label: 'Professional Pack' },
  enterprise: { tokens: 2000, priceCents: 129900, label: 'Enterprise Pack' },
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const { packId, projectId, userEmail } = await request.json()

    if (!packId || !projectId || !userEmail) {
      return NextResponse.json(
        { error: 'packId, projectId, and userEmail are required' },
        { status: 400 }
      )
    }

    const pack = TOKEN_PACKS[packId]
    if (!pack) {
      return NextResponse.json(
        { error: 'Invalid token pack' },
        { status: 400 }
      )
    }

    // Determine the base URL for redirects
    const origin = request.headers.get('origin') || 'https://tourlytics.ai'

    // Create Stripe Checkout Session
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `TourLytics ${pack.label} - ${pack.tokens} Tokens`,
              description: `${pack.tokens} AI tokens for your TourLytics project`,
            },
            unit_amount: pack.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        projectId,
        userEmail,
        packId,
        tokenAmount: pack.tokens.toString(),
      },
      success_url: `${origin}/app/?payment=success&tokens=${pack.tokens}`,
      cancel_url: `${origin}/app/?payment=cancelled`,
    })

    // Record pending payment
    const supabase = getSupabase()
    await supabase.from('stripe_payments').insert({
      project_id: projectId,
      stripe_session_id: session.id,
      user_email: userEmail,
      token_amount: pack.tokens,
      amount_cents: pack.priceCents,
      currency: 'usd',
      status: 'pending',
      metadata: { packId },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
