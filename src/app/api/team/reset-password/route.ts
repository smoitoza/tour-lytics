import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Generate a readable temporary password
function generateTempPassword(): string {
  const words = ['Tour', 'Office', 'Space', 'View', 'Floor', 'Desk', 'Light', 'Build']
  const word = words[Math.floor(Math.random() * words.length)]
  const digits = crypto.randomInt(1000, 9999)
  const specials = ['!', '@', '#', '$']
  const special = specials[Math.floor(Math.random() * specials.length)]
  return `${word}${digits}${special}`
}

// POST - reset a team member's password
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()
    const tempPassword = generateTempPassword()

    try {
      const admin = createAdminClient()

      // Find the user in Supabase auth
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      )

      if (!existingUser) {
        return NextResponse.json(
          { error: 'No auth account found for this email. Try re-inviting them.' },
          { status: 404 }
        )
      }

      // Reset their password
      await admin.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        email_confirm: true,
      })

      return NextResponse.json({
        tempPassword,
        message: 'Password has been reset.',
      })
    } catch (err) {
      console.error('Admin client error:', err)
      return NextResponse.json(
        { error: 'Service role key not configured. Please add SUPABASE_SERVICE_ROLE_KEY to Vercel.' },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
