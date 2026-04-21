import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Generate a memorable temporary password
function generateTempPassword(): string {
  const adjectives = ['Swift', 'Bright', 'Clever', 'Bold', 'Cool', 'Fast', 'Sharp', 'Quick']
  const nouns = ['Falcon', 'Tower', 'River', 'Storm', 'Cloud', 'Ocean', 'Peak', 'Forest']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 900 + 100)
  return `${adj}${noun}${num}!`
}

// POST /api/admin/create-user
// Body: { adminEmail, email, displayName?, tokenBalance?, projectId?, role?, persona? }
// Creates a new beta user account with seeded tokens (and optionally adds to a project)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const adminEmail = (body.adminEmail || '').toLowerCase().trim()
    const email = (body.email || '').toLowerCase().trim()
    const displayName = (body.displayName || '').trim()
    const tokenBalance = typeof body.tokenBalance === 'number' ? Math.max(0, Math.floor(body.tokenBalance)) : 100
    const projectId = body.projectId ? String(body.projectId).trim() : null
    const role = body.role || 'member'
    const persona = body.persona || 'team'

    // Authorization: caller must be an admin
    if (!isAdminEmail(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email)

    if (existingUser) {
      return NextResponse.json({
        error: 'A user with this email already exists. Use the team invite flow to add them to a project.',
        existingUserId: existingUser.id,
      }, { status: 409 })
    }

    // Generate temp password
    const tempPassword = generateTempPassword()

    // Create auth user with confirmed email
    const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        beta_created_by: adminEmail,
        beta_created_at: new Date().toISOString(),
      },
    })

    if (createError || !newAuthUser?.user) {
      console.error('Create user error:', createError)
      return NextResponse.json({ error: `Failed to create account: ${createError?.message || 'unknown'}` }, { status: 500 })
    }

    const newUserId = newAuthUser.user.id

    // Seed token balance (the signup trigger creates 100 automatically).
    // If the admin requested a different amount, adjust.
    if (tokenBalance !== 100) {
      await supabase.from('token_balances').upsert({
        user_id: newUserId,
        project_id: null,
        balance: tokenBalance,
        total_purchased: tokenBalance,
        total_consumed: 0,
        low_balance_threshold: 10,
      }, { onConflict: 'user_id' })

      await supabase.from('token_transactions').insert({
        user_id: newUserId,
        project_id: null,
        action_type: 'credit',
        amount: tokenBalance,
        balance_after: tokenBalance,
        user_email: email,
        note: `Beta account setup by ${adminEmail} (${tokenBalance} tokens)`,
      })
    }

    // Optionally add to a project as team member
    let projectAdded = false
    if (projectId) {
      const { error: memberErr } = await supabase.from('project_members').insert({
        project_id: projectId,
        email,
        display_name: displayName || null,
        role,
        persona,
      })
      if (!memberErr) projectAdded = true
    }

    return NextResponse.json({
      success: true,
      email,
      displayName,
      userId: newUserId,
      tempPassword,
      tokenBalance,
      projectAdded,
      projectId: projectAdded ? projectId : null,
    })
  } catch (err: any) {
    console.error('Admin create-user error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
