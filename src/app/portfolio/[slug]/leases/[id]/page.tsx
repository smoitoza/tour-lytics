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
  landlord_entity: string | null
  currency: string
  lease_type: string | null
  status: string
  commencement_date: string | null
  rent_commencement_date: string | null
  expiration_date: string | null
  term_months: number | null
  notes: string | null
  abstracted_at: string | null
  approved_at: string | null
}

type AbstractionSummary = {
  id: string
  status: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info'
  confidence_score: number | null
  created_at: string
  reviewed_at: string | null
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

  // Abstraction status
  const [abstraction, setAbstraction] = useState<AbstractionSummary | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState<string | null>(null)

  // Inline edit of basics
  const [editingBasics, setEditingBasics] = useState(false)
  const [editName, setEditName] = useState('')
  const [editLandlord, setEditLandlord] = useState('')
  const [editLeaseType, setEditLeaseType] = useState('')
  const [editCommencement, setEditCommencement] = useState('')
  const [editRentCommencement, setEditRentCommencement] = useState('')
  const [editExpiration, setEditExpiration] = useState('')
  const [editTermMonths, setEditTermMonths] = useState('')
  const [editStatus, setEditStatus] = useState('draft')
  const [editNotes, setEditNotes] = useState('')
  const [savingBasics, setSavingBasics] = useState(false)

  const startEditBasics = () => {
    if (!lease) return
    setEditName(lease.name)
    setEditLandlord(lease.landlord_name || '')
    setEditLeaseType(lease.lease_type || '')
    setEditCommencement(lease.commencement_date || '')
    setEditRentCommencement(lease.rent_commencement_date || '')
    setEditExpiration(lease.expiration_date || '')
    setEditTermMonths(lease.term_months ? String(lease.term_months) : '')
    setEditStatus(lease.status)
    setEditNotes(lease.notes || '')
    setEditingBasics(true)
  }

  const saveBasics = async () => {
    if (!lease) return
    setSavingBasics(true)
    try {
      const res = await fetch(`/api/portfolio/leases/${lease.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          landlord_name: editLandlord || null,
          lease_type: editLeaseType || null,
          commencement_date: editCommencement || null,
          rent_commencement_date: editRentCommencement || null,
          expiration_date: editExpiration || null,
          term_months: editTermMonths ? parseInt(editTermMonths, 10) : null,
          status: editStatus,
          notes: editNotes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Save failed: ' + (data.error || 'unknown'))
        return
      }
      setEditingBasics(false)
      await loadAll()
    } catch (e) {
      alert('Save failed: ' + String(e))
    } finally {
      setSavingBasics(false)
    }
  }

  const runExtraction = async () => {
    if (!lease) return
    setExtracting(true)
    setExtractMsg('Reading lease bundle with AI… this may take 30-90 seconds.')
    try {
      const res = await fetch(`/api/portfolio/leases/${lease.id}/extract`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setExtractMsg('Extraction failed: ' + (data.error || 'unknown'))
        setExtracting(false)
        return
      }
      setExtractMsg(null)
      window.location.href = `/portfolio/${params.slug}/leases/${lease.id}/review`
    } catch (e) {
      setExtractMsg('Extraction failed: ' + String(e))
      setExtracting(false)
    }
  }

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

      // Lightly probe for an existing abstraction so we can render status + actions.
      try {
        const aRes = await fetch(`/api/portfolio/leases/${params.id}/abstraction`)
        if (aRes.ok) {
          const aData = await aRes.json()
          if (aData.abstraction) {
            setAbstraction({
              id: aData.abstraction.id,
              status: aData.abstraction.status,
              confidence_score: aData.abstraction.confidence_score,
              created_at: aData.abstraction.created_at,
              reviewed_at: aData.abstraction.reviewed_at,
            })
          } else {
            setAbstraction(null)
          }
        }
      } catch {
        // Non-fatal; just means no status banner.
      }
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!editingBasics && (
            <button
              onClick={startEditBasics}
              style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
            >
              Edit lease details
            </button>
          )}
          <Link
            href={`/portfolio/${company.slug}/leases`}
            style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14 }}
          >
            ← All leases
          </Link>
        </div>
      </div>

      {/* Abstraction status banner */}
      <div style={{
        background: abstraction?.status === 'approved' ? '#ecfdf5' : abstraction?.status === 'pending_review' ? '#fef3c7' : '#eff6ff',
        border: '1px solid',
        borderColor: abstraction?.status === 'approved' ? '#a7f3d0' : abstraction?.status === 'pending_review' ? '#fde68a' : '#bfdbfe',
        borderRadius: 10, padding: 14, marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 13, color: '#1f2937' }}>
          {!abstraction && documents.length === 0 && (
            <span>No documents yet. Upload the executed lease and any amendments below, then run AI extraction.</span>
          )}
          {!abstraction && documents.length > 0 && (
            <span><strong>Ready to extract.</strong> {documents.length} document{documents.length === 1 ? '' : 's'} attached. AI will read them in chronological order and propose a current-state abstraction for your review.</span>
          )}
          {abstraction?.status === 'pending_review' && (
            <span><strong>Abstraction ready for review.</strong> {abstraction.confidence_score !== null ? `Confidence ${Math.round(abstraction.confidence_score * 100)}%. ` : ''}Open the review screen to check the fields and approve.</span>
          )}
          {abstraction?.status === 'approved' && (
            <span><strong>Abstraction approved</strong> and published to portfolio tables{abstraction.reviewed_at ? ` on ${new Date(abstraction.reviewed_at).toLocaleDateString()}` : ''}. You can re-run extraction or edit fields directly.</span>
          )}
          {abstraction?.status === 'rejected' && <span>Abstraction was rejected. Re-run extraction or upload corrected documents.</span>}
          {extractMsg && <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>{extractMsg}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {abstraction && (
            <Link
              href={`/portfolio/${company.slug}/leases/${lease.id}/review`}
              style={{ padding: '8px 14px', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}
            >
              {abstraction.status === 'pending_review' ? 'Review & approve' : 'Edit extracted fields'}
            </Link>
          )}
          {documents.length > 0 && (
            <button
              onClick={runExtraction}
              disabled={extracting}
              style={{ padding: '8px 14px', background: extracting ? '#9ca3af' : (abstraction ? '#f3f4f6' : '#059669'), color: abstraction ? '#374151' : 'white', border: abstraction ? '1px solid #d1d5db' : 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: extracting ? 'wait' : 'pointer' }}
            >
              {extracting ? 'Extracting…' : abstraction ? 'Re-extract' : 'Run AI extraction'}
            </button>
          )}
        </div>
      </div>

      {/* Inline edit of basics */}
      {editingBasics && (
        <section style={{ background: '#fff', border: '1px solid #c7d2fe', borderLeft: '4px solid #4f46e5', borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Edit lease basics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Lease name</label>
              <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Landlord</label>
              <input style={inputStyle} value={editLandlord} onChange={(e) => setEditLandlord(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Lease type</label>
              <select style={inputStyle} value={editLeaseType} onChange={(e) => setEditLeaseType(e.target.value)}>
                <option value="">—</option>
                <option value="NNN">NNN</option>
                <option value="gross">Gross</option>
                <option value="modified_gross">Modified gross</option>
                <option value="full_service">Full service</option>
                <option value="ground">Ground</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</label>
              <select style={inputStyle} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Commencement</label>
              <input type="date" style={inputStyle} value={editCommencement} onChange={(e) => setEditCommencement(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rent commencement</label>
              <input type="date" style={inputStyle} value={editRentCommencement} onChange={(e) => setEditRentCommencement(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expiration</label>
              <input type="date" style={inputStyle} value={editExpiration} onChange={(e) => setEditExpiration(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Term (months)</label>
              <input type="number" style={inputStyle} value={editTermMonths} onChange={(e) => setEditTermMonths(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setEditingBasics(false)}
              disabled={savingBasics}
              style={{ padding: '8px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={saveBasics}
              disabled={savingBasics || !editName.trim()}
              style={{ padding: '8px 14px', background: '#0070f3', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: savingBasics ? 'wait' : 'pointer' }}
            >
              {savingBasics ? 'Saving…' : 'Save basics'}
            </button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280' }}>
            For rent schedule, OPEX terms, critical dates, locations, and security instruments, use the <Link href={`/portfolio/${company.slug}/leases/${lease.id}/review`} style={{ color: '#0070f3' }}>review screen</Link>.
          </p>
        </section>
      )}

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

    </div>
  )
}
