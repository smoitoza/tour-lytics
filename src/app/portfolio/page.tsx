'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Company = {
  id: string
  name: string
  slug: string
  reporting_currency: string
  storage_quota_bytes: number
  storage_used_bytes: number
  my_role: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function PortfolioHome() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portfolio/companies')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setCompanies(data.companies || [])
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Portfolio</h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>Manage your leased real estate footprint.</p>
        </div>
        <Link
          href="/dashboard"
          style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14 }}
        >
          ← Back to dashboard
        </Link>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading companies…</p>}
      {error && (
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 12, borderRadius: 8, color: '#900' }}>
          {error}
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        <div style={{ background: '#f9f9f9', border: '1px solid #eee', padding: 20, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>No companies yet. Once seeded, they will appear here.</p>
        </div>
      )}

      {companies.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {companies.map((c) => {
            const pct = c.storage_quota_bytes > 0
              ? (c.storage_used_bytes / c.storage_quota_bytes) * 100
              : 0
            return (
              <div
                key={c.id}
                style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  padding: 20,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>{c.name}</h2>
                    <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>
                      {c.slug} · reporting in {c.reporting_currency} · your role: {c.my_role}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      href={`/portfolio/${c.slug}/upload`}
                      style={{
                        background: '#fff',
                        color: '#0070f3',
                        border: '1px solid #0070f3',
                        padding: '8px 16px',
                        borderRadius: 6,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      Bulk upload
                    </Link>
                    <Link
                      href={`/portfolio/${c.slug}/leases`}
                      style={{
                        background: '#0070f3',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: 6,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      View leases
                    </Link>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                    <span>Storage used</span>
                    <span>{formatBytes(c.storage_used_bytes)} / {formatBytes(c.storage_quota_bytes)}</span>
                  </div>
                  <div style={{ background: '#eee', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      background: pct > 90 ? '#e00' : pct > 75 ? '#f80' : '#0a7',
                      height: '100%',
                      width: `${Math.min(100, pct)}%`,
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 40, padding: 16, background: '#fafafa', borderRadius: 8, fontSize: 13, color: '#666' }}>
        <strong>Portfolio module — DEV build, Phase 2</strong>
        <br />
        Leases, multi-document grouping, and per-document type classification are now live on tourlytics-dev.
        Next: AI abstraction pipeline, map view, Portfolio Scout integration.
      </div>
    </div>
  )
}
