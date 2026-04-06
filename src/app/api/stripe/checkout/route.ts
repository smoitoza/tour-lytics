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
  starter: { tokens: 100, priceCents: 10000, label: 'Starter Pack' },          // $100 (1:1)
  professional: { tokens: 500, priceCents: 45000, label: 'Professional Pack' }, // $450 (10% off)
  enterprise: { tokens: 2000, priceCents: 170000, label: 'Enterprise Pack' },  // $1,700 (15% off)
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const { packId, userId, userEmail, projectId } = await request.json()

    if (!packId || !userEmail) {
      return NextResponse.json(
        { error: 'packId and userEmail are required' },
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

    // Build success/cancel URLs — use projectId if provided for redirect context
    const successUrl = projectId
      ? `${origin}/project/${encodeURIComponent(projectId)}?tab=ai-usage&payment=success&tokens=${pack.tokens}`
      : `${origin}/dashboard?payment=success&tokens=${pack.tokens}`
    const cancelUrl = projectId
      ? `${origin}/project/${encodeURIComponent(projectId)}?tab=ai-usage`
      : `${origin}/dashboard?tab=ai-usage`

    // Create Stripe Checkout Session — metadata uses userId for user-level crediting
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
              description: `${pack.tokens} AI tokens for your TourLytics account`,
            },
            unit_amount: pack.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId || '',
        userEmail,
        packId,
        tokenAmount: pack.tokens.toString(),
        // Keep projectId in metadata for tracking/redirect context, but it's not required
        ...(projectId ? { projectId } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // Record pending payment
    const supabase = getSupabase()
    await supabase.from('stripe_payments').insert({
      project_id: projectId || null,
      user_id: userId || null,
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
