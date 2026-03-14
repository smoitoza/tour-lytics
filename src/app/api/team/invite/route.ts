import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Generate a readable temporary password
function generateTempPassword(): string {
  // Format: Word + 4 digits + special char (e.g., "Tour4829!")
  const words = ['Tour', 'Office', 'Space', 'View', 'Floor', 'Desk', 'Light', 'Build']
  const word = words[Math.floor(Math.random() * words.length)]
  const digits = crypto.randomInt(1000, 9999)
  const specials = ['!', '@', '#', '$']
  const special = specials[Math.floor(Math.random() * specials.length)]
  return `${word}${digits}${special}`
}

// POST - create a Supabase auth account and add to project_members in one step
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, displayName, persona, projectId = 'sf-office-search', addedBy } = body

    if (!email || !persona) {
      return NextResponse.json({ error: 'Email and persona are required' }, { status: 400 })
    }

    if (!['admin', 'broker', 'touree'].includes(persona)) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()
    const tempPassword = generateTempPassword()

    // Step 1: Create the Supabase auth account (or check if it exists)
    let authCreated = false
    let authExisted = false
    try {
      const admin = createAdminClient()

      // Check if user already exists in auth
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      )

      if (existingUser) {
        authExisted = true
        // Update their password to the new temp password so the invite email works
        await admin.auth.admin.updateUserById(existingUser.id, {
          password: tempPassword,
          email_confirm: true,
        })
      } else {
        // Create new user with auto-confirmed email
        const { error: createError } = await admin.auth.admin.createUser({
          email: cleanEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            display_name: displayName || '',
            persona: persona,
          },
        })

        if (createError) {
          console.error('Auth create error:', createError)
          return NextResponse.json(
            { error: `Failed to create account: ${createError.message}` },
            { status: 500 }
          )
        }
        authCreated = true
      }
    } catch (err) {
      console.error('Admin client error:', err)
      return NextResponse.json(
        { error: 'Service role key not configured. Please add SUPABASE_SERVICE_ROLE_KEY to Vercel.' },
        { status: 500 }
      )
    }

    // Step 2: Add to project_members (upsert)
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .upsert(
        {
          email: cleanEmail,
          display_name: displayName || null,
          persona,
          project_id: projectId,
          added_by: addedBy || null,
        },
        { onConflict: 'email,project_id' }
      )
      .select()
      .single()

    if (memberError) {
      console.error('Member upsert error:', memberError)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json({
      member,
      tempPassword,
      authCreated,
      authExisted,
      message: authExisted
        ? 'Account already existed. Password has been reset.'
        : 'Account created successfully.',
    })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
