'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LeaseMap, { type GeoLease } from './_components/LeaseMap'

type Company = {
  id: string
  name: string
  slug: string
  storage_used_bytes: number
  storage_quota_bytes: number
}

type Lease = {
  id: string
  name: string
  landlord_name: string | null
  currency: string
  lease_type: string | null
  status: string
  commencement_date: string | null
  expiration_date: string | null
  term_months: number | null
  primary_location: {
    address_line1: string
    city: string
    state_province: string | null
    country: string
  } | null
  document_count: number
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#f4f4f5', fg: '#52525b' },
  pending_review: { bg: '#fef3c7', fg: '#92400e' },
  active: { bg: '#dcfce7', fg: '#166534' },
  expired: { bg: '#fee2e2', fg: '#991b1b' },
  terminated: { bg: '#e5e7eb', fg: '#374151' },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function locationLine(loc: Lease['primary_location']): string {
  if (!loc) return 'No address yet'
  const region = loc.state_province ? `, ${loc.state_province}` : ''
  return `${loc.address_line1} · ${loc.city}${region}, ${loc.country}`
}

export default function PortfolioLeasesPage() {
  const params = useParams<{ slug: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [leases, setLeases] = useState<Lease[]>([])
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [geoLeases, setGeoLeases] = useState<GeoLease[]>([])
  const [mapConfigured, setMapConfigured] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const cRes = await fetch('/api/portfolio/companies')
        const cData = await cRes.json()
        if (cData.error) { setError(cData.error); return }
        const co = (cData.companies || []).find((c: Company) => c.slug === params.slug)
        if (!co) { setError('Company not found or you are not a member.'); return }
        if (cancelled) return
        setCompany(co)

        const lRes = await fetch(`/api/portfolio/leases?company_id=${co.id}`)
        const lData = await lRes.json()
        if (lData.error) { setError(lData.error); return }
        if (cancelled) return
        setLeases(lData.leases || [])
        setUnassignedCount(lData.unassigned_document_count || 0)

        // Fetch geo data for the map (separate endpoint; lazy-geocodes on first call)
        try {
          const gRes = await fetch(`/api/portfolio/${params.slug}/leases-geo`)
          if (gRes.ok && !cancelled) {
            const gData = await gRes.json()
            setGeoLeases(gData.leases || [])
            setMapConfigured(gData.mapbox_configured !== false)
          }
        } catch {
          // Non-fatal
        }
      } catch (e) {
        setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [params.slug])

  return (
    <div style={{ maxWidth: 1080, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
        <Link href="/portfolio" style={{ color: '#0070f3', textDecoration: 'none' }}>Portfolio</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>{company?.name || '…'}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Leases
          </h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>
            {company?.name ? `${company.name} · ` : ''}{leases.length} lease{leases.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {company && (
            <Link
              href={`/portfolio/${company.slug}/upload`}
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
              Bulk upload inbox
            </Link>
          )}
          {company && (
            <Link
              href={`/portfolio/${company.slug}/leases/new`}
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
              + New lease
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 12, borderRadius: 8, color: '#900', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: '#666' }}>Loading leases…</p>}

      {!loading && !error && unassignedCount > 0 && company && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <strong>{unassignedCount} unassigned document{unassignedCount === 1 ? '' : 's'}</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#92400e' }}>
              These were uploaded without a lease. Create a lease and attach them, or open the bulk inbox to re-classify.
            </p>
          </div>
          <Link
            href={`/portfolio/${company.slug}/upload`}
            style={{ color: '#92400e', fontWeight: 600, textDecoration: 'underline' }}
          >
            Open inbox →
          </Link>
        </div>
      )}

      {!loading && !error && leases.length === 0 && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: 32, borderRadius: 12, textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>No leases yet</h3>
          <p style={{ color: '#666', margin: '8px 0 16px' }}>
            Create a lease to start grouping its documents (executed lease + amendments) for abstraction.
          </p>
          {company && (
            <Link
              href={`/portfolio/${company.slug}/leases/new`}
              style={{
                display: 'inline-block',
                background: '#0070f3',
                color: 'white',
                padding: '10px 20px',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              + Create your first lease
            </Link>
          )}
        </div>
      )}

      {leases.length > 0 && company && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Portfolio map</h2>
            <span style={{ fontSize: 12, color: '#888' }}>
              {geoLeases.filter((l) => l.location).length} of {geoLeases.length} mapped
              {!mapConfigured && ' · Google Maps key not set'}
            </span>
          </div>
          <LeaseMap slug={company.slug} leases={geoLeases} height={360} />
        </div>
      )}

      {leases.length > 0 && company && (
        <div style={{ display: 'grid', gap: 12 }}>
          {leases.map((l) => {
            const sc = STATUS_COLORS[l.status] || STATUS_COLORS.draft
            return (
              <Link
                key={l.id}
                href={`/portfolio/${company.slug}/leases/${l.id}`}
                style={{
                  display: 'block',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  padding: 18,
                  background: '#fff',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 18 }}>{l.name}</h3>
                      <span style={{
                        background: sc.bg, color: sc.fg, padding: '2px 8px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>{l.status.replace('_', ' ')}</span>
                    </div>
                    <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{locationLine(l.primary_location)}</p>
                    <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
                      {l.landlord_name ? `Landlord: ${l.landlord_name} · ` : ''}
                      {l.lease_type ? `${l.lease_type} · ` : ''}
                      {l.currency}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 180 }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Term</div>
                    <div style={{ fontSize: 14 }}>
                      {formatDate(l.commencement_date)} → {formatDate(l.expiration_date)}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                      📄 {l.document_count} document{l.document_count === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
