import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST - change password (requires current password verification)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, currentPassword, newPassword } = body

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Email, current password, and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const cleanEmail = email.toLowerCase().trim()

    // Step 1: Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Step 2: Update password using admin client
    try {
      const admin = createAdminClient()

      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      )

      if (!existingUser) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        )
      }

      await admin.auth.admin.updateUserById(existingUser.id, {
        password: newPassword,
      })

      return NextResponse.json({ message: 'Password updated successfully' })
    } catch (err) {
      console.error('Admin client error:', err)
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error('Change password error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
