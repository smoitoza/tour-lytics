'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['scott@tourlytics.ai', 'samoitoza@gmail.com']

interface AdminUser {
  id: string
  email: string
  display_name: string | null
  created_at: string
  last_sign_in_at: string | null
  is_admin: boolean
  balance: number
  total_purchased: number
  total_consumed: number
  owned_projects: number
  shared_projects: number
  actions_30d: number
  tokens_30d: number
}

type ActionType = 'credit' | 'debit' | 'reset_password' | 'delete'

export default function AdminUsersPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'last_sign_in' | 'balance' | 'tokens_30d' | 'email'>('last_sign_in')

  // Action state
  const [actionUser, setActionUser] = useState<AdminUser | null>(null)
  const [actionType, setActionType] = useState<ActionType | null>(null)
  const [actionAmount, setActionAmount] = useState(100)
  const [actionNote, setActionNote] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionResult, setActionResult] = useState<any>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /* Auth check */
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      const email = (user.email || '').toLowerCase()
      if (!ADMIN_EMAILS.includes(email)) {
        router.push('/dashboard')
        return
      }
      setAuthUser(user)
      setLoading(false)
    })
  }, [router])

  /* Load users */
  const loadUsers = async () => {
    if (!authUser?.email) return
    try {
      const res = await fetch(`/api/admin/users?adminEmail=${encodeURIComponent(authUser.email)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Failed to load users')
        return
      }
      setUsers(data.users || [])
      setError(null)
    } catch (err) {
      setError('Network error loading users')
    }
  }

  useEffect(() => {
    if (authUser) loadUsers()
  }, [authUser])

  /* Filtered + sorted */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q
      ? users.filter(u => u.email.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q))
      : users.slice()

    list.sort((a, b) => {
      if (sortBy === 'email') return a.email.localeCompare(b.email)
      if (sortBy === 'balance') return b.balance - a.balance
      if (sortBy === 'tokens_30d') return b.tokens_30d - a.tokens_30d
      // last_sign_in
      if (!a.last_sign_in_at && !b.last_sign_in_at) return 0
      if (!a.last_sign_in_at) return 1
      if (!b.last_sign_in_at) return -1
      return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime()
    })
    return list
  }, [users, search, sortBy])

  /* Perform action */
  const performAction = async () => {
    if (!actionUser || !actionType || !authUser?.email) return
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${actionUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: authUser.email,
          action: actionType,
          amount: actionAmount,
          note: actionNote || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data?.error || 'Action failed')
      } else {
        setActionResult(data)
        await loadUsers()
      }
    } catch (err) {
      setActionError('Network error')
    } finally {
      setActionBusy(false)
    }
  }

  const closeActionModal = () => {
    setActionUser(null)
    setActionType(null)
    setActionAmount(100)
    setActionNote('')
    setActionResult(null)
    setActionError(null)
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem' }}>
            &larr; Dashboard
          </Link>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Admin &middot; Users</h1>
          <span style={{
            padding: '0.25rem 0.625rem',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#fff',
          }}>Admin</span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{users.length} users</div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '1.5rem 2rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 300px',
            padding: '0.5rem 0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem', background: '#fff' }}
        >
          <option value="last_sign_in">Sort: Last Sign-In</option>
          <option value="balance">Sort: Token Balance</option>
          <option value="tokens_30d">Sort: Active (30d)</option>
          <option value="email">Sort: Email (A-Z)</option>
        </select>
        <button
          onClick={loadUsers}
          style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem', background: '#fff', cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ margin: '0 2rem 1rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ padding: '0 2rem 2rem' }}>
        <div style={{ background: '#fff', borderRadius: '0.5rem', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Balance</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>30d Usage</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Projects</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Joined</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Last Active</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td></tr>
                )}
                {visible.map(u => (
                  <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.display_name || u.email.split('@')[0]}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{u.email}</div>
                        </div>
                        {u.is_admin && (
                          <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.625rem', fontWeight: 700, background: '#ede9fe', color: '#6d28d9' }}>ADMIN</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: u.balance < 10 ? '#dc2626' : '#0f172a' }}>
                      {u.balance.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                      {u.tokens_30d > 0 ? (
                        <span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{u.tokens_30d}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> &middot; {u.actions_30d} actions</span>
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                      {u.owned_projects > 0 && <span style={{ color: '#0f172a', fontWeight: 600 }}>{u.owned_projects}</span>}
                      {u.owned_projects > 0 && u.shared_projects > 0 && <span>{' '}/{' '}</span>}
                      {u.shared_projects > 0 && <span>{u.shared_projects}</span>}
                      {u.owned_projects === 0 && u.shared_projects === 0 && <span style={{ color: '#cbd5e1' }}>&mdash;</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{fmtDate(u.created_at)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{fmtDate(u.last_sign_in_at)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => { setActionUser(u); setActionType('credit'); setActionAmount(100); setActionNote('') }}
                          title="Add tokens"
                          style={{ padding: '0.25rem 0.5rem', border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >+ Tokens</button>
                        <button
                          onClick={() => { setActionUser(u); setActionType('reset_password'); setActionNote('') }}
                          title="Reset password"
                          style={{ padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >Reset PW</button>
                        {!u.is_admin && (
                          <button
                            onClick={() => { setActionUser(u); setActionType('delete'); setActionNote('') }}
                            title="Delete user"
                            style={{ padding: '0.25rem 0.5rem', border: '1px solid #fecaca', background: '#fff', color: '#dc2626', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {actionUser && actionType && (
        <div
          onClick={closeActionModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '460px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {actionType === 'credit' && 'Add Tokens'}
                {actionType === 'debit' && 'Deduct Tokens'}
                {actionType === 'reset_password' && 'Reset Password'}
                {actionType === 'delete' && 'Delete User'}
              </h2>
              <button onClick={closeActionModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.25rem' }}>×</button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>
              <strong>{actionUser.display_name || actionUser.email.split('@')[0]}</strong>
              <span style={{ color: '#94a3b8' }}> &middot; {actionUser.email}</span>
              <span style={{ color: '#94a3b8' }}> &middot; Balance: {actionUser.balance.toLocaleString()}</span>
            </p>

            {!actionResult ? (
              <>
                {(actionType === 'credit' || actionType === 'debit') && (
                  <>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>Amount</label>
                      <input
                        type="number"
                        min={1}
                        value={actionAmount}
                        onChange={(e) => setActionAmount(parseInt(e.target.value) || 0)}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>Note (optional)</label>
                      <input
                        type="text"
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        placeholder="e.g. Beta top-up, split from Jason, etc."
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                  </>
                )}

                {actionType === 'reset_password' && (
                  <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem', padding: '0.75rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.5rem' }}>
                    A new temporary password will be generated. The user will need to sign in with this new password.
                  </p>
                )}

                {actionType === 'delete' && (
                  <p style={{ fontSize: '0.8125rem', color: '#b91c1c', marginBottom: '1rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem' }}>
                    <strong>This is permanent.</strong> The user account, token balance, and project memberships will be deleted. Projects they own will remain but become orphaned. Type their email to confirm: <br />
                    <input
                      type="text"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder={actionUser.email}
                      style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid #fca5a5', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  </p>
                )}

                {actionError && (
                  <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                    {actionError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button onClick={closeActionModal} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={performAction}
                    disabled={actionBusy || (actionType === 'delete' && actionNote.trim().toLowerCase() !== actionUser.email.toLowerCase())}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: actionType === 'delete' ? '#dc2626' : '#7c3aed',
                      color: '#fff',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: actionBusy ? 'not-allowed' : 'pointer',
                      opacity: actionBusy || (actionType === 'delete' && actionNote.trim().toLowerCase() !== actionUser.email.toLowerCase()) ? 0.5 : 1,
                    }}
                  >
                    {actionBusy ? 'Working...' : (
                      actionType === 'credit' ? 'Add Tokens' :
                      actionType === 'debit' ? 'Deduct Tokens' :
                      actionType === 'reset_password' ? 'Reset Password' :
                      'Delete Permanently'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#166534', margin: '0 0 0.25rem' }}>Success</p>
                  {actionType === 'credit' && <p style={{ fontSize: '0.8125rem', color: '#166534', margin: 0 }}>Added {actionResult.amount} tokens. New balance: {actionResult.new_balance.toLocaleString()}</p>}
                  {actionType === 'debit' && <p style={{ fontSize: '0.8125rem', color: '#166534', margin: 0 }}>Deducted {actionResult.amount} tokens. New balance: {actionResult.new_balance.toLocaleString()}</p>}
                  {actionType === 'reset_password' && (
                    <>
                      <p style={{ fontSize: '0.8125rem', color: '#166534', margin: '0 0 0.5rem' }}>Password reset for {actionResult.email}. Share this new password with them:</p>
                      <div style={{ padding: '0.5rem 0.75rem', background: '#fff', border: '1px solid #86efac', borderRadius: '0.5rem', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {actionResult.temp_password}
                      </div>
                    </>
                  )}
                  {actionType === 'delete' && <p style={{ fontSize: '0.8125rem', color: '#166534', margin: 0 }}>Deleted {actionResult.email}.</p>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={closeActionModal} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#7c3aed', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
