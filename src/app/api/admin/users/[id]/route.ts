import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateTempPassword(): string {
  const adjectives = ['Swift', 'Bright', 'Clever', 'Bold', 'Cool', 'Fast', 'Sharp', 'Quick']
  const nouns = ['Falcon', 'Tower', 'River', 'Storm', 'Cloud', 'Ocean', 'Peak', 'Forest']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 900 + 100)
  return `${adj}${noun}${num}!`
}

// POST /api/admin/users/[id]
// Body: { adminEmail, action: 'credit' | 'debit' | 'reset_password' | 'delete', amount?, note? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const adminEmail = (body.adminEmail || '').toLowerCase().trim()
    const action = body.action

    if (!isAdminEmail(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
    }
    if (!id) {
      return NextResponse.json({ error: 'User ID required.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify user exists
    const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(id)
    if (getErr || !authUser?.user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    const userEmail = authUser.user.email || ''

    // --- Credit tokens ---
    if (action === 'credit') {
      const amount = parseInt(body.amount, 10)
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Positive amount required.' }, { status: 400 })
      }

      // Upsert user-level balance
      const { data: existing } = await supabase
        .from('token_balances')
        .select('balance, total_purchased')
        .eq('user_id', id)
        .is('project_id', null)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('token_balances')
          .update({
            balance: (existing.balance || 0) + amount,
            total_purchased: (existing.total_purchased || 0) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', id)
          .is('project_id', null)
      } else {
        await supabase.from('token_balances').insert({
          user_id: id,
          project_id: null,
          balance: amount,
          total_purchased: amount,
          total_consumed: 0,
          low_balance_threshold: 10,
        })
      }

      const newBalance = (existing?.balance || 0) + amount
      await supabase.from('token_transactions').insert({
        user_id: id,
        project_id: null,
        action_type: 'credit',
        amount: amount,
        balance_after: newBalance,
        user_email: userEmail,
        note: body.note || `Admin credit by ${adminEmail}`,
      })

      return NextResponse.json({ success: true, action: 'credit', amount, new_balance: newBalance })
    }

    // --- Debit tokens (manual deduction) ---
    if (action === 'debit') {
      const amount = parseInt(body.amount, 10)
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Positive amount required.' }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from('token_balances')
        .select('balance, total_consumed')
        .eq('user_id', id)
        .is('project_id', null)
        .maybeSingle()

      if (!existing) {
        return NextResponse.json({ error: 'User has no token balance.' }, { status: 400 })
      }

      const newBalance = Math.max(0, (existing.balance || 0) - amount)
      const actualDebit = (existing.balance || 0) - newBalance

      await supabase
        .from('token_balances')
        .update({
          balance: newBalance,
          total_consumed: (existing.total_consumed || 0) + actualDebit,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', id)
        .is('project_id', null)

      await supabase.from('token_transactions').insert({
        user_id: id,
        project_id: null,
        action_type: 'admin_debit',
        amount: -actualDebit,
        balance_after: newBalance,
        user_email: userEmail,
        note: body.note || `Admin debit by ${adminEmail}`,
      })

      return NextResponse.json({ success: true, action: 'debit', amount: actualDebit, new_balance: newBalance })
    }

    // --- Reset password ---
    if (action === 'reset_password') {
      const newPassword = generateTempPassword()
      const { error: updateErr } = await admin.auth.admin.updateUserById(id, {
        password: newPassword,
        email_confirm: true,
      })
      if (updateErr) {
        return NextResponse.json({ error: `Failed to reset password: ${updateErr.message}` }, { status: 500 })
      }
      return NextResponse.json({ success: true, action: 'reset_password', email: userEmail, temp_password: newPassword })
    }

    // --- Delete user (revoke access) ---
    if (action === 'delete') {
      // Safety: never delete an admin
      if (isAdminEmail(userEmail)) {
        return NextResponse.json({ error: 'Cannot delete an admin user.' }, { status: 403 })
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(id)
      if (delErr) {
        return NextResponse.json({ error: `Failed to delete user: ${delErr.message}` }, { status: 500 })
      }
      // Clean up related data
      await supabase.from('token_balances').delete().eq('user_id', id)
      await supabase.from('project_members').delete().eq('email', userEmail.toLowerCase())
      return NextResponse.json({ success: true, action: 'delete', email: userEmail })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err: any) {
    console.error('Admin user action error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
