'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

/* -- SVG Logo -- */
function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="TourLytics logo">
      <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="10" r="2" fill="#2563eb" />
      <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface BalanceData {
  balance: number
  total_purchased: number
  total_consumed: number
}

interface Transaction {
  id: string
  project_id: string | null
  action_type: string
  amount: number
  balance_after: number
  user_email: string
  note: string
  created_at: string
}

interface PricingItem {
  action_type: string
  display_name: string
  token_cost: number
  description: string
  category: string
}

interface Project {
  id: string
  name: string
  status?: string
  updated_at?: string
}

const PACKS = [
  { id: 'starter', label: 'Starter Pack', tokens: 100, price: 100, desc: 'Great for getting started. Covers AI chat, photo analysis, and basic usage.' },
  { id: 'professional', label: 'Professional Pack', tokens: 500, price: 450, desc: 'Best for active projects. Full financial analysis, survey uploads, and AI features.', popular: true },
  { id: 'enterprise', label: 'Enterprise Pack', tokens: 2000, price: 1700, desc: 'For teams managing multiple projects with heavy AI usage and analytics.' },
]

export default function BillingPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pricing, setPricing] = useState<PricingItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectUsage, setProjectUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/login'); return }
      setUser(u)

      try {
        const [balRes, txRes, priceRes, projRes] = await Promise.all([
          fetch(`/api/tokens?userId=${u.id}&view=balance`),
          fetch(`/api/tokens?userId=${u.id}&view=transactions&limit=20`),
          fetch(`/api/tokens?view=pricing`),
          supabase.from('projects').select('id, name, status, updated_at').eq('owner_id', u.email),
        ])

        const balJson = await balRes.json()
        const txJson = await txRes.json()
        const priceJson = await priceRes.json()

        if (balRes.ok) setBalance({ balance: balJson.balance ?? 0, total_purchased: balJson.total_purchased ?? 0, total_consumed: balJson.total_consumed ?? 0 })
        else setBalance({ balance: 0, total_purchased: 0, total_consumed: 0 })

        if (txRes.ok && Array.isArray(txJson)) {
          setTransactions(txJson)
          // Aggregate usage per project from transactions
          const usage: Record<string, number> = {}
          txJson.forEach((tx: Transaction) => {
            if (tx.amount < 0 && tx.project_id) {
              usage[tx.project_id] = (usage[tx.project_id] || 0) + Math.abs(tx.amount)
            }
          })
          setProjectUsage(usage)
        }
        if (priceRes.ok && Array.isArray(priceJson)) setPricing(priceJson.filter((p: PricingItem) => p.token_cost > 0))
        if (projRes.data) setProjects(projRes.data)
      } catch (err) {
        console.warn('Billing page fetch error:', err)
        setBalance({ balance: 0, total_purchased: 0, total_consumed: 0 })
      }
      setLoading(false)
    })
  }, [router])

  const handleBuy = async (packId: string) => {
    if (!user) return
    setBuying(packId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, userId: user.id, userEmail: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else console.error('No checkout URL returned:', data)
    } catch (err) {
      console.error('Checkout error:', err)
    }
    setBuying(null)
  }

  const handleExport = () => {
    if (!balance || !user) return
    const lines = [
      'TourLytics Account Usage Report',
      `User: ${user.email}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      'Account Summary',
      `Balance,${balance.balance}`,
      `Total Purchased,${balance.total_purchased}`,
      `Total Consumed,${balance.total_consumed}`,
      '',
      'Project Breakdown',
      'Project,Tokens Used',
      ...projects.map(p => `${p.name},${projectUsage[p.id] || 0}`),
      '',
      'Transaction History',
      'Date,Description,Project,Type,Amount,Balance After',
      ...transactions.map(tx => `${new Date(tx.created_at).toLocaleDateString()},${(tx.note || tx.action_type).replace(/,/g, ';')},${tx.project_id || '—'},${tx.amount > 0 ? 'Purchase' : 'Consumption'},${tx.amount > 0 ? '+' : ''}${tx.amount},${tx.balance_after}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tourlytics-billing-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const displayName = user?.email?.split('@')[0] || 'there'
  const totalUsed = Object.values(projectUsage).reduce((a, b) => a + b, 0) || balance?.total_consumed || 0

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a', textDecoration: 'none' }}>
            <Logo size={28} />
            <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              Tour<span style={{ color: '#2563eb' }}>Lytics</span>
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>{user?.email}</span>
            </div>
            <Link href="/billing" style={{ fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none', fontWeight: 500, padding: '0.25rem 0.5rem' }}>
              Manage Billing
            </Link>
            <Link href="/dashboard" style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'none', fontWeight: 400, padding: '0.25rem 0.5rem' }}>
              Dashboard
            </Link>
            <button onClick={signOut} style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, padding: '0.375rem 0.75rem' }}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px 64px' }}>
        {/* Breadcrumb + Title */}
        <div style={{ marginBottom: '8px' }}>
          <Link href="/dashboard" style={{ fontSize: '13px', color: '#94a3b8', textDecoration: 'none' }}>← Dashboard</Link>
          <span style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 8px' }}>/</span>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Account Usage &amp; Billing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', margin: 0 }}>Account Usage &amp; Billing</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', padding: '9px 16px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', fontFamily: 'inherit' }}>
              ↓ Export CSV
            </button>
            <button onClick={() => document.getElementById('purchase-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ fontSize: '13px', fontWeight: 600, color: '#fff', padding: '9px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Buy Tokens
            </button>
          </div>
        </div>

        {/* Balance Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', borderRadius: '12px', padding: '20px 24px', color: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>Account Balance</div>
            <div style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.1 }}>{balance?.balance.toLocaleString()}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>tokens remaining</div>
          </div>
          {[
            { label: 'Total Purchased', value: balance?.total_purchased ?? 0, sub: 'all-time tokens' },
            { label: 'Total Consumed', value: balance?.total_consumed ?? 0, sub: 'across all projects' },
            { label: 'Active Projects', value: projects.length, sub: 'using tokens' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '6px' }}>{card.label}</div>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{card.value.toLocaleString()}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Project Usage Breakdown */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>Project Usage Breakdown</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Project', 'Tokens Used', 'Usage', 'Status', 'Last Activity'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 12px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const used = projectUsage[p.id] || 0
                const pct = totalUsed > 0 ? (used / totalUsed) * 100 : 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '14px 12px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed', marginRight: '10px' }} />
                      {p.name}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#475569' }}>{used}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ display: 'inline-block', width: '80px', height: '7px', background: '#e8e5f0', borderRadius: '99px', overflow: 'hidden', verticalAlign: 'middle', marginRight: '8px' }}>
                        <span style={{ display: 'block', height: '100%', background: '#7c3aed', borderRadius: '99px', width: `${Math.min(pct, 100)}%`, minWidth: used > 0 ? '4px' : '0' }} />
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{Math.round(pct)}%</span>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '6px', background: p.status === 'on_hold' ? '#fff7ed' : '#f0fdf4', color: p.status === 'on_hold' ? '#ea580c' : '#16a34a' }}>
                        {p.status === 'on_hold' ? 'On Hold' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13px', color: '#94a3b8' }}>
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                )
              })}
              {projects.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No projects yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Purchase Tokens */}
        <div id="purchase-section" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>Purchase Tokens</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {PACKS.map(pack => (
              <div key={pack.id} style={{ border: pack.popular ? '2px solid #7c3aed' : '1px solid #e2e8f0', borderRadius: '12px', padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
                {pack.popular && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 14px', borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Most Popular</div>
                )}
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>{pack.tokens.toLocaleString()}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>{pack.label}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>{pack.desc}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed', marginBottom: '16px' }}>${pack.price}</div>
                <button
                  onClick={() => handleBuy(pack.id)}
                  disabled={buying !== null}
                  style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: '8px', cursor: buying ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: buying === pack.id ? 0.7 : 1 }}
                >
                  {buying === pack.id ? 'Redirecting...' : 'Buy Tokens'}
                </button>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#94a3b8', marginTop: '16px', marginBottom: 0 }}>Secure checkout powered by Stripe. Tokens are added instantly after purchase.</p>
        </div>

        {/* Transaction History */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>Transaction History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Description', 'Project', 'Type', 'Amount', 'Balance'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Amount' || h === 'Balance' ? 'right' : 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 12px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const isCredit = tx.amount > 0
                const projectName = projects.find(p => p.id === tx.project_id)?.name || tx.project_id || '—'
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#94a3b8' }}>
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#475569' }}>{tx.note || tx.action_type}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#475569' }}>{projectName}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '6px', background: isCredit ? '#f0fdf4' : '#fef2f2', color: isCredit ? '#16a34a' : '#ef4444' }}>
                        {isCredit ? 'Purchase' : 'Consumption'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600, textAlign: 'right', color: isCredit ? '#16a34a' : '#ef4444' }}>
                      {isCredit ? '+' : ''}{tx.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#475569', textAlign: 'right' }}>{tx.balance_after.toLocaleString()}</td>
                  </tr>
                )
              })}
              {transactions.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Token Pricing Reference */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>Token Pricing Reference</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 12px', borderBottom: '1px solid #f1f5f9' }}>Action</th>
                <th style={{ textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 12px', borderBottom: '1px solid #f1f5f9' }}>Description</th>
                <th style={{ textAlign: 'right', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 12px', borderBottom: '1px solid #f1f5f9' }}>Token Cost</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map(p => (
                <tr key={p.action_type} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{p.display_name}</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#475569' }}>{p.description}</td>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{p.token_cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Coming Soon */}
        <div style={{ background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Coming Soon: Team &amp; Organization Billing</h3>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Manage tokens across team members, set per-user limits, and get consolidated invoicing for your organization.</p>
        </div>
      </main>
    </div>
  )
}
