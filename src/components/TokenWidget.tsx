'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

interface TokenData {
  balance: number
  total_purchased: number
  total_consumed: number
  project_breakdown: { project_id: string }[]
}

export default function TokenWidget() {
  const [data, setData] = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      try {
        const res = await fetch(`/api/tokens?userId=${user.id}&view=balance`)
        const json = await res.json()
        if (res.ok) {
          setData({
            balance: json.balance ?? 0,
            total_purchased: json.total_purchased ?? 0,
            total_consumed: json.total_consumed ?? 0,
            project_breakdown: json.project_breakdown ?? [],
          })
        } else {
          console.warn('TokenWidget API error:', json)
          // Show widget with zeros rather than hiding it
          setData({ balance: 0, total_purchased: 0, total_consumed: 0, project_breakdown: [] })
        }
      } catch (err) {
        console.warn('TokenWidget fetch error:', err)
        setData({ balance: 0, total_purchased: 0, total_consumed: 0, project_breakdown: [] })
      }
      setLoading(false)
    })
  }, [])

  if (loading || !data) return null

  const { balance, total_purchased, total_consumed, project_breakdown } = data
  const activeProjects = project_breakdown?.length ?? 0
  const consumedPct = total_purchased > 0 ? (total_consumed / total_purchased) * 100 : 0

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderLeft: '4px solid #7c3aed',
      borderRadius: '10px',
      padding: '14px 20px',
      marginBottom: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '24px',
      flexWrap: 'wrap',
    }}>
      {/* Left: balance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Account Balance
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>
            {balance.toLocaleString()}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
            tokens remaining
          </span>
        </div>
        <div style={{
          width: '140px',
          height: '5px',
          background: '#f1f5f9',
          borderRadius: '99px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: '#7c3aed',
            borderRadius: '99px',
            width: `${Math.min(consumedPct, 100)}%`,
          }} />
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          {total_consumed.toLocaleString()} of {total_purchased.toLocaleString()} consumed
        </div>
      </div>

      {/* Middle: inline stats */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { value: total_purchased, label: 'purchased' },
          { value: total_consumed, label: 'consumed' },
          { value: activeProjects, label: 'projects active' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
              {stat.value.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Right: manage billing link */}
      <div>
        <Link
          href="/billing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#7c3aed',
            textDecoration: 'none',
            padding: '7px 16px',
            borderRadius: '8px',
            background: '#f5f3ff',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.color = '#6d28d9' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#7c3aed' }}
        >
          Manage Billing &rarr;
        </Link>
      </div>

    </div>
  )
}
