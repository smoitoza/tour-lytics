'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import {
  DOCUMENT_TYPE_OPTIONS,
  guessDocumentType,
  guessEffectiveDate,
  type PortfolioDocumentType,
} from '@/lib/portfolio/document-helpers'

type Company = {
  id: string
  name: string
  slug: string
  storage_used_bytes: number
  storage_quota_bytes: number
}

type Lease = {
  id: string
  company_id: string
  name: string
  landlord_name: string | null
  currency: string
  lease_type: string | null
  status: string
  commencement_date: string | null
  expiration_date: string | null
  notes: string | null
}

type Location = {
  id: string
  address_line1: string
  address_line2: string | null
  city: string
  state_province: string | null
  postal_code: string | null
  country: string
  use_type: string | null
  rentable_sqft: number | null
  is_primary: boolean
}

type Document = {
  id: string
  original_filename: string
  document_type: string | null
  effective_date: string | null
  size_bytes: number | null
  uploaded_at: string
  storage_path: string
}

type StagedFile = {
  file: File
  documentType: PortfolioDocumentType
  effectiveDate: string | null
  status: 'pending' | 'signing' | 'uploading' | 'saving' | 'done' | 'error'
  errorMsg?: string
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const DOC_TYPE_LABELS: Record<string, string> = {
  lease: 'Executed Lease',
  amendment: 'Amendment',
  snda: 'SNDA',
  estoppel: 'Estoppel',
  exhibit: 'Exhibit',
  side_letter: 'Side Letter / Consent',
  work_letter: 'Work Letter',
  guaranty: 'Guaranty',
  other: 'Other',
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#f4f4f5', fg: '#52525b' },
  pending_review: { bg: '#fef3c7', fg: '#92400e' },
  active: { bg: '#dcfce7', fg: '#166534' },
  expired: { bg: '#fee2e2', fg: '#991b1b' },
  terminated: { bg: '#e5e7eb', fg: '#374151' },
}

export default function LeaseDetailPage() {
  const params = useParams<{ slug: string; id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [lease, setLease] = useState<Lease | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Scoped uploader
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const cRes = await fetch('/api/portfolio/companies')
      const cData = await cRes.json()
      if (cData.error) { setError(cData.error); return }
      const co = (cData.companies || []).find((c: Company) => c.slug === params.slug)
      if (!co) { setError('Company not found.'); return }
      setCompany(co)

      const lRes = await fetch(`/api/portfolio/leases/${params.id}`)
      const lData = await lRes.json()
      if (lData.error) { setError(lData.error); return }
      setLease(lData.lease)
      setLocations(lData.locations || [])
      setDocuments(lData.documents || [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [params.slug, params.id])

  useEffect(() => { loadAll() }, [loadAll])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const additions: StagedFile[] = Array.from(files).map((f) => ({
      file: f,
      documentType: guessDocumentType(f.name),
      effectiveDate: guessEffectiveDate(f.name),
      status: 'pending',
    }))
    setStaged((prev) => [...prev, ...additions])
  }, [])

  const updateStaged = (idx: number, patch: Partial<StagedFile>) => {
    setStaged((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }
  const removeStaged = (idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx))
  }

  const uploadOne = async (idx: number) => {
    if (!company || !lease) return
    const item = staged[idx]
    if (!item) return
    const setStatus = (patch: Partial<StagedFile>) => {
      setStaged((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
    }
    try {
      setStatus({ status: 'signing' })
      const signRes = await fetch('/api/portfolio/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          lease_id: lease.id,
          filename: item.file.name,
          content_type: item.file.type,
          size_bytes: item.file.size,
        }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) {
        setStatus({ status: 'error', errorMsg: signData.error })
        return
      }
      setStatus({ status: 'uploading' })
      const supabase = createClient()
      const { error: upError } = await supabase.storage
        .from('portfolio-documents')
        .uploadToSignedUrl(signData.storagePath, signData.token, item.file, {
          contentType: item.file.type,
          upsert: false,
        })
      if (upError) {
        setStatus({ status: 'error', errorMsg: upError.message })
        return
      }
      setStatus({ status: 'saving' })
      const saveRes = await fetch('/api/portfolio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          lease_id: lease.id,
          storage_path: signData.storagePath,
          original_filename: item.file.name,
          size_bytes: item.file.size,
          mime_type: item.file.type,
          document_type: item.documentType,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) {
        setStatus({ status: 'error', errorMsg: saveData.error })
        return
      }
      setStatus({ status: 'done' })
    } catch (err) {
      setStatus({ status: 'error', errorMsg: String(err) })
    }
  }

  const uploadAll = async () => {
    setUploading(true)
    for (let i = 0; i < staged.length; i++) {
      if (staged[i].status === 'done') continue
      await uploadOne(i)
    }
    await loadAll()
    // Clear successful uploads from the staged list
    setStaged((prev) => prev.filter((s) => s.status !== 'done'))
    setUploading(false)
  }

  // Group documents by type for display
  const grouped: Record<string, Document[]> = {}
  for (const d of documents) {
    const key = d.document_type || 'other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(d)
  }
  const TYPE_ORDER: PortfolioDocumentType[] = [
    'lease', 'amendment', 'side_letter', 'snda', 'estoppel', 'work_letter', 'guaranty', 'exhibit', 'other',
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
  }

  if (loading) {
    return <p style={{ padding: 40, fontFamily: 'system-ui' }}>Loading lease…</p>
  }

  if (error || !lease || !company) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui' }}>
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 12, borderRadius: 8, color: '#900' }}>
          {error || 'Lease not found.'}
        </div>
        <Link href="/portfolio" style={{ color: '#0070f3', textDecoration: 'none', marginTop: 16, display: 'inline-block' }}>
          ← Back to portfolio
        </Link>
      </div>
    )
  }

  const sc = STATUS_COLORS[lease.status] || STATUS_COLORS.draft

  return (
    <div style={{ maxWidth: 1080, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
        <Link href="/portfolio" style={{ color: '#0070f3', textDecoration: 'none' }}>Portfolio</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link href={`/portfolio/${company.slug}/leases`} style={{ color: '#0070f3', textDecoration: 'none' }}>
          {company.name}
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>{lease.name}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{lease.name}</h1>
            <span style={{
              background: sc.bg, color: sc.fg, padding: '4px 10px', borderRadius: 999,
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{lease.status.replace('_', ' ')}</span>
          </div>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
            {lease.landlord_name ? `Landlord: ${lease.landlord_name} · ` : ''}
            {lease.lease_type || 'No lease type'} · {lease.currency}
          </p>
        </div>
        <Link
          href={`/portfolio/${company.slug}/leases`}
          style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14 }}
        >
          ← All leases
        </Link>
      </div>

      {/* Key facts */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Commencement</div>
          <div style={{ fontSize: 14 }}>{formatDate(lease.commencement_date)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Expiration</div>
          <div style={{ fontSize: 14 }}>{formatDate(lease.expiration_date)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Documents</div>
          <div style={{ fontSize: 14 }}>{documents.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Locations</div>
          <div style={{ fontSize: 14 }}>{locations.length}</div>
        </div>
      </div>

      {/* Locations */}
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Locations</h2>
        {locations.length === 0 ? (
          <p style={{ color: '#888', margin: 0, fontSize: 14 }}>
            No locations yet. You can add them once the lease is abstracted, or edit the lease to add a primary location.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {locations.map((loc) => (
              <div key={loc.id} style={{
                padding: 12, border: '1px solid #f0f0f0', borderRadius: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {loc.address_line1}{loc.address_line2 ? `, ${loc.address_line2}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {loc.city}{loc.state_province ? `, ${loc.state_province}` : ''} {loc.postal_code || ''} · {loc.country}
                    {loc.use_type ? ` · ${loc.use_type}` : ''}
                    {loc.rentable_sqft ? ` · ${loc.rentable_sqft.toLocaleString()} sqft` : ''}
                  </div>
                </div>
                {loc.is_primary && (
                  <span style={{
                    background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>Primary</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents grouped */}
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Documents</h2>
        {documents.length === 0 ? (
          <p style={{ color: '#888', margin: 0, fontSize: 14 }}>
            No documents attached yet. Drop them below to add the executed lease and any amendments.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {TYPE_ORDER.map((type) => {
              const docs = grouped[type]
              if (!docs || docs.length === 0) return null
              return (
                <div key={type}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    {DOC_TYPE_LABELS[type] || type} ({docs.length})
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {docs.map((d) => (
                      <div key={d.id} style={{
                        padding: '10px 12px', border: '1px solid #f0f0f0', borderRadius: 6,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.original_filename}
                          </div>
                          <div style={{ fontSize: 11, color: '#888' }}>
                            {formatBytes(d.size_bytes)}
                            {d.effective_date ? ` · effective ${formatDate(d.effective_date)}` : ''}
                            {' · uploaded '}{new Date(d.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Scoped uploader */}
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Add more documents to this lease</h2>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
          Anything you drop here gets attached to <strong>{lease.name}</strong>.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          style={{
            border: `2px dashed ${dragging ? '#0070f3' : '#d1d5db'}`,
            background: dragging ? '#f0f7ff' : '#fafafa',
            borderRadius: 10,
            padding: '20px 16px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('lease-detail-file-input')?.click()}
        >
          <p style={{ margin: 0, fontSize: 14 }}>Drag and drop documents, or click to browse</p>
          <input
            id="lease-detail-file-input"
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.png,.jpg,.jpeg,application/pdf,image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {staged.length > 0 && (
          <>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {staged.map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #e5e7eb',
                    background: s.status === 'error' ? '#fff5f5' : s.status === 'done' ? '#f0fff4' : '#fff',
                    padding: 10,
                    borderRadius: 8,
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px 140px 80px 28px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.file.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>{formatBytes(s.file.size)}</div>
                  </div>
                  <select
                    style={inputStyle}
                    value={s.documentType}
                    onChange={(e) => updateStaged(i, { documentType: e.target.value as PortfolioDocumentType })}
                    disabled={uploading}
                  >
                    {DOCUMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    style={inputStyle}
                    value={s.effectiveDate || ''}
                    onChange={(e) => updateStaged(i, { effectiveDate: e.target.value || null })}
                    disabled={uploading}
                  />
                  <div style={{ fontSize: 11, color: s.status === 'error' ? '#c00' : '#666', textAlign: 'right' }}>
                    {s.status === 'pending' && 'Ready'}
                    {s.status === 'signing' && 'Signing…'}
                    {s.status === 'uploading' && 'Up…'}
                    {s.status === 'saving' && 'Save…'}
                    {s.status === 'done' && <span style={{ color: '#0a7' }}>✓</span>}
                    {s.status === 'error' && <span title={s.errorMsg}>Err</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStaged(i)}
                    disabled={uploading || s.status === 'done'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#999', fontSize: 16 }}
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button
                type="button"
                onClick={uploadAll}
                disabled={uploading || staged.every((s) => s.status === 'done')}
                style={{
                  background: uploading ? '#999' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: uploading ? 'wait' : 'pointer',
                }}
              >
                {uploading ? 'Uploading…' : `Upload ${staged.length} document${staged.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Phase 3 placeholder */}
      <div style={{ background: '#fafafa', border: '1px dashed #ddd', padding: 16, borderRadius: 8, fontSize: 13, color: '#666' }}>
        <strong>Coming next:</strong> AI abstraction will read every document above in order (executed lease first, then amendments by effective date) and extract rent schedule, OPEX terms, critical dates, security deposits, and notice windows. You&apos;ll review side-by-side before publishing.
      </div>
    </div>
  )
}
