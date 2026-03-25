import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { full_name, email, company, message, source } = body

    if (!full_name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    // 1. Save to Supabase
    const supabase = createAdminClient()
    const { error: dbError } = await supabase
      .from('demo_requests')
      .insert({
        full_name,
        email,
        company: company || null,
        message: message || null,
        source: source || 'website',
      })

    if (dbError) {
      console.error('Demo request DB error:', dbError)
      // Don't fail the request if DB insert fails -- still try to send email
    }

    // 2. Send email notification to scott@tourlytics.ai
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="color: #f47920; margin: 0; font-size: 18px;">New Demo Request</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <table style="width: 100%; font-size: 14px; color: #1e293b;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #64748b; width: 100px;">Name</td>
                  <td style="padding: 8px 0;">${full_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Email</td>
                  <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
                </tr>
                ${company ? `<tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Company</td>
                  <td style="padding: 8px 0;">${company}</td>
                </tr>` : ''}
                ${message ? `<tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Message</td>
                  <td style="padding: 8px 0;">${message}</td>
                </tr>` : ''}
              </table>
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <a href="mailto:${email}?subject=Re: TourLytics Demo Request&body=Hi ${full_name},%0A%0AThanks for your interest in TourLytics." style="display: inline-block; background: #f47920; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Reply to ${full_name}</a>
              </div>
            </div>
          </div>
        `

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'TourLytics <notifications@tourlytics.ai>',
            to: ['scott@tourlytics.ai'],
            subject: `Demo Request: ${full_name}${company ? ` (${company})` : ''}`,
            html: emailHtml,
          }),
        })
      } catch (emailErr) {
        console.error('Demo notification email error:', emailErr)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Demo request error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
