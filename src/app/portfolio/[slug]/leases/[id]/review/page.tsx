'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type LeaseMeta = {
  tenant_name?: string | null
  landlord_name?: string | null
  landlord_entity?: string | null
  lease_type?: string | null
  currency?: string | null
  commencement_date?: string | null
  rent_commencement_date?: string | null
  expiration_date?: string | null
  term_months?: number | null
  notes?: string | null
}

type Location = {
  label?: string | null
  address_line1?: string
  address_line2?: string | null
  city?: string
  state_province?: string | null
  postal_code?: string | null
  country?: string
  use_type?: string | null
  rentable_sqft?: number | null
  floor_count?: number | null
  is_primary?: boolean
}

type RentRow = {
  period_start?: string
  period_end?: string
  monthly_rent?: number
  rent_psf_annual?: number | null
  is_free_rent?: boolean
  escalation_type?: string | null
  escalation_note?: string | null
}

type OpexTerms = {
  starting_opex_psf_annual?: number | null
  escalation_pct?: number | null
  escalation_type?: string | null
  cap_pct?: number | null
  free_opex_months?: number | null
  free_opex_start?: string | null
  base_year?: number | null
  notes?: string | null
}

type CriticalDate = {
  date_type?: string
  trigger_date?: string
  trigger_date_end?: string | null
  description?: string
  reminder_days_before?: number | null
  notes?: string | null
}

type SecurityInstrument = {
  instrument_type?: string
  amount?: number
  currency?: string
  issuer?: string | null
  expiration_date?: string | null
  burndown_schedule?: unknown
  notes?: string | null
}

type ExtractedFields = {
  lease_meta?: LeaseMeta
  locations?: Location[]
  rent_schedule?: RentRow[]
  opex_terms?: OpexTerms
  critical_dates?: CriticalDate[]
  security_instruments?: SecurityInstrument[]
  confidence?: { score?: number | null; notes?: string | null }
  source_document_ids?: string[]
  skipped_documents?: Array<{ filename: string; reason: string }>
}

type Abstraction = {
  id: string
  status: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info'
  extraction_version: string
  confidence_score: number | null
  extracted_fields: ExtractedFields
  reviewer_notes: string | null
  created_at: string
}

type Doc = {
  id: string
  original_filename: string
  document_type: string | null
  effective_date: string | null
  mime_type: string | null
  signed_url: string | null
}

type Lease = {
  id: string
  name: string
  currency: string
  status: string
}

const DATE_TYPES = [
  'renewal_option', 'termination_right', 'rofo', 'rofr',
  'expansion_option', 'contraction_option', 'notice_deadline',
  'rent_review', 'expiration', 'other',
]
const INSTRUMENT_TYPES = ['cash_deposit', 'letter_of_credit', 'guaranty', 'surety_bond', 'other']
const USE_TYPES = ['office', 'industrial', 'flex', 'retail', 'lab', 'warehouse', 'data_center', 'other']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 13, fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280',
  marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4,
}
const sectionStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb',
  borderRadius: 8, padding: 16, marginBottom: 12,
}

export default function ReviewPage() {
  const params = useParams<{ slug: string; id: string }>()
  const router = useRouter()

  const [lease, setLease] = useState<Lease | null>(null)
  const [abstraction, setAbstraction] = useState<Abstraction | null>(null)
  const [fields, setFields] = useState<ExtractedFields>({})
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeDocIdx, setActiveDocIdx] = useState(0)

  // Re-sign a document's URL (used for the "Open in new tab" link) so the user
  // can always pop the PDF out into a separate tab during a long review session.
  const refreshDocUrl = async (idx: number) => {
    const d = docs[idx]
    if (!d) return
    try {
      const res = await fetch(`/api/portfolio/documents/${d.id}/sign`)
      if (!res.ok) return
      const json = await res.json()
      if (json.signed_url) {
        setDocs(prev => prev.map((x, i) => (i === idx ? { ...x, signed_url: json.signed_url } : x)))
      }
    } catch {
      // best-effort refresh; existing URL still in state
    }
  }

  const selectDoc = (i: number) => {
    setActiveDocIdx(i)
    void refreshDocUrl(i)
  }
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [rentView, setRentView] = useState<'annual' | 'monthly'>('annual')
  const [dirty, setDirty] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch(`/api/portfolio/leases/${params.id}/abstraction`)
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data.error || 'Failed to load abstraction')
        return
      }
      setLease(data.lease)
      setAbstraction(data.abstraction)
      setDocs(data.documents || [])
      if (data.abstraction?.extracted_fields) {
        setFields(data.abstraction.extracted_fields)
      }
      if (data.abstraction?.reviewer_notes) {
        setReviewerNotes(data.abstraction.reviewer_notes)
      }
    } catch (e) {
      setLoadError(String(e))
    }
  }, [params.id])

  useEffect(() => { load() }, [load])

  const updateMeta = (patch: Partial<LeaseMeta>) => {
    setFields((f) => ({ ...f, lease_meta: { ...(f.lease_meta || {}), ...patch } }))
    setDirty(true)
  }

  const updateLocation = (i: number, patch: Partial<Location>) => {
    setFields((f) => ({
      ...f,
      locations: (f.locations || []).map((l, idx) => idx === i ? { ...l, ...patch } : l),
    }))
    setDirty(true)
  }

  const addLocation = () => {
    setFields((f) => ({
      ...f,
      locations: [...(f.locations || []), { country: 'US', is_primary: (f.locations || []).length === 0 }],
    }))
    setDirty(true)
  }

  const removeLocation = (i: number) => {
    setFields((f) => ({
      ...f,
      locations: (f.locations || []).filter((_, idx) => idx !== i),
    }))
    setDirty(true)
  }

  const updateRent = (i: number, patch: Partial<RentRow>) => {
    setFields((f) => ({
      ...f,
      rent_schedule: (f.rent_schedule || []).map((r, idx) => idx === i ? { ...r, ...patch } : r),
    }))
    setDirty(true)
  }
  const addRent = () => {
    setFields((f) => ({ ...f, rent_schedule: [...(f.rent_schedule || []), { is_free_rent: false }] }))
    setDirty(true)
  }
  const removeRent = (i: number) => {
    setFields((f) => ({ ...f, rent_schedule: (f.rent_schedule || []).filter((_, idx) => idx !== i) }))
    setDirty(true)
  }

  const updateOpex = (patch: Partial<OpexTerms>) => {
    setFields((f) => ({ ...f, opex_terms: { ...(f.opex_terms || {}), ...patch } }))
    setDirty(true)
  }

  const updateCD = (i: number, patch: Partial<CriticalDate>) => {
    setFields((f) => ({
      ...f,
      critical_dates: (f.critical_dates || []).map((d, idx) => idx === i ? { ...d, ...patch } : d),
    }))
    setDirty(true)
  }
  const addCD = () => {
    setFields((f) => ({ ...f, critical_dates: [...(f.critical_dates || []), { date_type: 'other', reminder_days_before: 90 }] }))
    setDirty(true)
  }
  const removeCD = (i: number) => {
    setFields((f) => ({ ...f, critical_dates: (f.critical_dates || []).filter((_, idx) => idx !== i) }))
    setDirty(true)
  }

  const updateSec = (i: number, patch: Partial<SecurityInstrument>) => {
    setFields((f) => ({
      ...f,
      security_instruments: (f.security_instruments || []).map((s, idx) => idx === i ? { ...s, ...patch } : s),
    }))
    setDirty(true)
  }
  const addSec = () => {
    setFields((f) => ({ ...f, security_instruments: [...(f.security_instruments || []), { instrument_type: 'cash_deposit', currency: lease?.currency || 'USD' }] }))
    setDirty(true)
  }
  const removeSec = (i: number) => {
    setFields((f) => ({ ...f, security_instruments: (f.security_instruments || []).filter((_, idx) => idx !== i) }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setStatusMsg(null)
    try {
      const res = await fetch(`/api/portfolio/leases/${params.id}/abstraction`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted_fields: fields,
          reviewer_notes: reviewerNotes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg('Save failed: ' + (data.error || 'unknown'))
        setSaving(false)
        return
      }
      setDirty(false)
      setStatusMsg('Saved')
      setTimeout(() => setStatusMsg(null), 2000)
    } catch (e) {
      setStatusMsg('Save failed: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (dirty) {
      await handleSave()
    }
    if (!confirm('Publish this abstraction? This will write the approved values to the operational portfolio tables and mark the lease active.')) {
      return
    }
    setPublishing(true)
    setStatusMsg(null)
    try {
      const res = await fetch(`/api/portfolio/leases/${params.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_notes: reviewerNotes || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg('Publish failed: ' + (data.error || 'unknown'))
        setPublishing(false)
        return
      }
      router.push(`/portfolio/${params.slug}/leases/${params.id}`)
    } catch (e) {
      setStatusMsg('Publish failed: ' + String(e))
      setPublishing(false)
    }
  }

  const handleReExtract = async () => {
    if (!confirm('Re-run extraction? This will replace any unsaved edits with a fresh AI pass.')) return
    setStatusMsg('Re-running extraction…')
    try {
      const res = await fetch(`/api/portfolio/leases/${params.id}/extract`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg('Re-extract failed: ' + (data.error || 'unknown'))
        return
      }
      setStatusMsg(null)
      setDirty(false)
      await load()
    } catch (e) {
      setStatusMsg('Re-extract failed: ' + String(e))
    }
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 720, margin: '60px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 16, borderRadius: 8, color: '#900' }}>
          {loadError}
        </div>
        <Link href={`/portfolio/${params.slug}/leases`} style={{ color: '#0070f3', marginTop: 16, display: 'inline-block' }}>
          ← Back to leases
        </Link>
      </div>
    )
  }

  if (!abstraction) {
    return (
      <div style={{ maxWidth: 720, margin: '60px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>No abstraction yet</h1>
        <p style={{ color: '#666' }}>This lease doesn’t have an AI extraction yet. Upload the executed lease and any amendments, then run extraction.</p>
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <Link href={`/portfolio/${params.slug}/leases/${params.id}`} style={{ color: '#0070f3' }}>
            ← Lease detail
          </Link>
          <button
            onClick={handleReExtract}
            style={{ padding: '8px 14px', background: '#0070f3', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Run extraction now
          </button>
        </div>
      </div>
    )
  }

  const meta = fields.lease_meta || {}
  const locs = fields.locations || []
  const rent = fields.rent_schedule || []
  const opex = fields.opex_terms || {}
  const cds = fields.critical_dates || []
  const secs = fields.security_instruments || []
  const conf = fields.confidence
  const skipped = fields.skipped_documents || []

  const activeDoc = docs[activeDocIdx]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f6f7f9', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>
              <Link href="/portfolio" style={{ color: '#0070f3', textDecoration: 'none' }}>Portfolio</Link>
              <span style={{ margin: '0 6px' }}>/</span>
              <Link href={`/portfolio/${params.slug}/leases`} style={{ color: '#0070f3', textDecoration: 'none' }}>Leases</Link>
              <span style={{ margin: '0 6px' }}>/</span>
              <Link href={`/portfolio/${params.slug}/leases/${params.id}`} style={{ color: '#0070f3', textDecoration: 'none' }}>{lease?.name || 'Lease'}</Link>
              <span style={{ margin: '0 6px' }}>/</span>
              <span>Review</span>
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>
              Review AI extraction
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, padding: '2px 8px', background: abstraction.status === 'pending_review' ? '#fef3c7' : '#d1fae5', color: abstraction.status === 'pending_review' ? '#92400e' : '#065f46', borderRadius: 4 }}>
                {abstraction.status}
              </span>
              {abstraction.confidence_score !== null && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
                  confidence {Math.round(abstraction.confidence_score * 100)}%
                </span>
              )}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {statusMsg && <span style={{ fontSize: 12, color: '#6b7280' }}>{statusMsg}</span>}
            {dirty && <span style={{ fontSize: 12, color: '#dc2626' }}>● Unsaved</span>}
            <button
              onClick={handleReExtract}
              disabled={publishing}
              style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
            >
              Re-extract
            </button>
            <button
              onClick={handleSave}
              disabled={saving || publishing || !dirty}
              style={{ padding: '8px 12px', background: dirty ? '#0070f3' : '#9ca3af', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{ padding: '8px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {publishing ? 'Publishing…' : 'Approve & publish'}
            </button>
          </div>
        </div>
      </div>

      {conf?.notes && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 16px', margin: '12px 24px 0', borderRadius: 6, fontSize: 13, color: '#92400e' }}>
          <strong>AI notes:</strong> {conf.notes}
        </div>
      )}
      {skipped.length > 0 && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', padding: '8px 16px', margin: '12px 24px 0', borderRadius: 6, fontSize: 13, color: '#991b1b' }}>
          <strong>Skipped documents:</strong> {skipped.map((s) => `${s.filename} (${s.reason})`).join('; ')}
        </div>
      )}

      {/* Side-by-side: PDF viewer + editable fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, padding: 16 }}>
        {/* Left: PDF viewer */}
        <div style={{ position: 'sticky', top: 70, height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Source documents ({docs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {docs.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => selectDoc(i)}
                  style={{
                    padding: '4px 10px', fontSize: 12,
                    background: i === activeDocIdx ? '#0070f3' : '#f3f4f6',
                    color: i === activeDocIdx ? 'white' : '#374151',
                    border: '1px solid', borderColor: i === activeDocIdx ? '#0070f3' : '#d1d5db',
                    borderRadius: 4, cursor: 'pointer',
                  }}
                  title={d.original_filename}
                >
                  {i + 1}. {d.document_type || 'doc'}
                </button>
              ))}
            </div>
            {activeDoc && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {activeDoc.original_filename}
                  {activeDoc.effective_date && ` · effective ${activeDoc.effective_date}`}
                </div>
                {activeDoc.signed_url && (
                  <a
                    href={activeDoc.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: '#0070f3', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Open in new tab ↗
                  </a>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
            {activeDoc && activeDoc.mime_type === 'application/pdf' ? (
              <object
                key={activeDoc.id}
                data={`/api/portfolio/documents/${activeDoc.id}/view#view=FitH&toolbar=1`}
                type="application/pdf"
                style={{ width: '100%', height: '100%' }}
                aria-label={activeDoc.original_filename}
              >
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <p style={{ marginBottom: 12, color: '#6b7280' }}>
                    Your browser cannot display this PDF inline.
                  </p>
                  {activeDoc.signed_url && (
                    <a
                      href={activeDoc.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block', padding: '8px 16px',
                        background: '#0070f3', color: 'white',
                        borderRadius: 4, textDecoration: 'none', fontSize: 13,
                      }}
                    >
                      Open {activeDoc.original_filename} in new tab
                    </a>
                  )}
                </div>
              </object>
            ) : activeDoc?.signed_url ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <p style={{ marginBottom: 12, color: '#6b7280' }}>Preview not available for this file type.</p>
                <a href={activeDoc.signed_url} target="_blank" rel="noreferrer" style={{ color: '#0070f3' }}>
                  Open {activeDoc.original_filename}
                </a>
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                No document to preview.
              </div>
            )}
          </div>
        </div>

        {/* Right: Editable fields */}
        <div style={{ minWidth: 0 }}>
          {/* Lease basics */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Lease basics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Tenant</label>
                <input style={inputStyle} value={meta.tenant_name || ''} onChange={(e) => updateMeta({ tenant_name: e.target.value || null })} />
              </div>
              <div>
                <label style={labelStyle}>Landlord</label>
                <input style={inputStyle} value={meta.landlord_name || ''} onChange={(e) => updateMeta({ landlord_name: e.target.value || null })} />
              </div>
              <div>
                <label style={labelStyle}>Landlord entity</label>
                <input style={inputStyle} value={meta.landlord_entity || ''} onChange={(e) => updateMeta({ landlord_entity: e.target.value || null })} />
              </div>
              <div>
                <label style={labelStyle}>Lease type</label>
                <select style={inputStyle} value={meta.lease_type || ''} onChange={(e) => updateMeta({ lease_type: e.target.value || null })}>
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
                <label style={labelStyle}>Currency</label>
                <input style={inputStyle} value={meta.currency || ''} onChange={(e) => updateMeta({ currency: e.target.value || null })} />
              </div>
              <div>
                <label style={labelStyle}>Term (months)</label>
                <input type="number" style={inputStyle} value={meta.term_months ?? ''} onChange={(e) => updateMeta({ term_months: e.target.value ? parseInt(e.target.value, 10) : null })} />
              </div>
              <div>
                <label style={labelStyle}>Commencement</label>
                <input type="date" style={inputStyle} value={meta.commencement_date || ''} onChange={(e) => updateMeta({ commencement_date: e.target.value || null })} />
              </div>
              <div>
                <label style={labelStyle}>Rent commencement</label>
                <input type="date" style={inputStyle} value={meta.rent_commencement_date || ''} onChange={(e) => updateMeta({ rent_commencement_date: e.target.value || null })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Expiration</label>
                <input type="date" style={inputStyle} value={meta.expiration_date || ''} onChange={(e) => updateMeta({ expiration_date: e.target.value || null })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  value={meta.notes || ''}
                  onChange={(e) => updateMeta({ notes: e.target.value || null })}
                />
              </div>
            </div>
          </div>

          {/* Locations */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Locations ({locs.length})</h3>
              <button onClick={addLocation} style={{ fontSize: 12, padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>+ Add</button>
            </div>
            {locs.map((l, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={l.is_primary === true} onChange={(e) => updateLocation(i, { is_primary: e.target.checked })} />
                    Primary
                  </label>
                  <button onClick={() => removeLocation(i)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Address line 1</label>
                    <input style={inputStyle} value={l.address_line1 || ''} onChange={(e) => updateLocation(i, { address_line1: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Address line 2</label>
                    <input style={inputStyle} value={l.address_line2 || ''} onChange={(e) => updateLocation(i, { address_line2: e.target.value || null })} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input style={inputStyle} value={l.city || ''} onChange={(e) => updateLocation(i, { city: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>State/Prov</label>
                    <input style={inputStyle} value={l.state_province || ''} onChange={(e) => updateLocation(i, { state_province: e.target.value || null })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Postal code</label>
                    <input style={inputStyle} value={l.postal_code || ''} onChange={(e) => updateLocation(i, { postal_code: e.target.value || null })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input style={inputStyle} value={l.country || ''} onChange={(e) => updateLocation(i, { country: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Use type</label>
                    <select style={inputStyle} value={l.use_type || ''} onChange={(e) => updateLocation(i, { use_type: e.target.value || null })}>
                      <option value="">—</option>
                      {USE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Rentable sqft</label>
                    <input type="number" style={inputStyle} value={l.rentable_sqft ?? ''} onChange={(e) => updateLocation(i, { rentable_sqft: e.target.value ? parseInt(e.target.value, 10) : null })} />
                  </div>
                </div>
              </div>
            ))}
            {locs.length === 0 && <p style={{ fontSize: 12, color: '#888', margin: 0 }}>No locations.</p>}
          </div>

          {/* Rent schedule */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Rent schedule ({rent.length} period{rent.length === 1 ? '' : 's'})</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
                  <button
                    onClick={() => setRentView('annual')}
                    style={{
                      fontSize: 11, padding: '3px 10px', cursor: 'pointer',
                      background: rentView === 'annual' ? '#0070f3' : '#fff',
                      color: rentView === 'annual' ? '#fff' : '#374151',
                      border: 'none',
                    }}
                    title="Show rent as annual amount (monthly × 12)"
                  >
                    Annual
                  </button>
                  <button
                    onClick={() => setRentView('monthly')}
                    style={{
                      fontSize: 11, padding: '3px 10px', cursor: 'pointer',
                      background: rentView === 'monthly' ? '#0070f3' : '#fff',
                      color: rentView === 'monthly' ? '#fff' : '#374151',
                      border: 'none', borderLeft: '1px solid #d1d5db',
                    }}
                    title="Show rent as monthly amount (stored value)"
                  >
                    Monthly
                  </button>
                </div>
                <button onClick={addRent} style={{ fontSize: 12, padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>+ Add</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Start</th>
                    <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>End</th>
                    <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                      {rentView === 'annual' ? 'Annual rent' : 'Monthly rent'}
                    </th>
                    <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>$/RSF/yr</th>
                    <th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Free</th>
                    <th style={{ padding: 6, borderBottom: '1px solid #e5e7eb' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rent.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 4 }}>
                        <input type="date" style={{ ...inputStyle, padding: 4 }} value={r.period_start || ''} onChange={(e) => updateRent(i, { period_start: e.target.value })} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input type="date" style={{ ...inputStyle, padding: 4 }} value={r.period_end || ''} onChange={(e) => updateRent(i, { period_end: e.target.value })} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input
                          type="number"
                          step="0.01"
                          style={{ ...inputStyle, padding: 4, textAlign: 'right' }}
                          value={
                            r.monthly_rent == null
                              ? ''
                              : rentView === 'annual'
                              ? Number((r.monthly_rent * 12).toFixed(2))
                              : r.monthly_rent
                          }
                          onChange={(e) => {
                            const v = e.target.value ? parseFloat(e.target.value) : 0
                            const monthly = rentView === 'annual' ? Number((v / 12).toFixed(2)) : v
                            updateRent(i, { monthly_rent: monthly })
                          }}
                        />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input type="number" step="0.01" style={{ ...inputStyle, padding: 4, textAlign: 'right' }} value={r.rent_psf_annual ?? ''} onChange={(e) => updateRent(i, { rent_psf_annual: e.target.value ? parseFloat(e.target.value) : null })} />
                      </td>
                      <td style={{ padding: 4, textAlign: 'center' }}>
                        <input type="checkbox" checked={r.is_free_rent === true} onChange={(e) => updateRent(i, { is_free_rent: e.target.checked })} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <button onClick={() => removeRent(i)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rent.length === 0 && <p style={{ fontSize: 12, color: '#888', margin: 0 }}>No rent schedule.</p>}
          </div>

          {/* Opex */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>OPEX / passthroughs</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Starting opex ($/RSF/yr)</label>
                <input type="number" step="0.01" style={inputStyle} value={opex.starting_opex_psf_annual ?? ''} onChange={(e) => updateOpex({ starting_opex_psf_annual: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label style={labelStyle}>Escalation %</label>
                <input type="number" step="0.01" style={inputStyle} value={opex.escalation_pct ?? ''} onChange={(e) => updateOpex({ escalation_pct: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label style={labelStyle}>Escalation type</label>
                <input style={inputStyle} value={opex.escalation_type || ''} onChange={(e) => updateOpex({ escalation_type: e.target.value || null })} />
              </div>
              <div>
                <label style={labelStyle}>Cap %</label>
                <input type="number" step="0.01" style={inputStyle} value={opex.cap_pct ?? ''} onChange={(e) => updateOpex({ cap_pct: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label style={labelStyle}>Free months</label>
                <input type="number" style={inputStyle} value={opex.free_opex_months ?? ''} onChange={(e) => updateOpex({ free_opex_months: e.target.value ? parseInt(e.target.value, 10) : null })} />
              </div>
              <div>
                <label style={labelStyle}>Base year</label>
                <input type="number" style={inputStyle} value={opex.base_year ?? ''} onChange={(e) => updateOpex({ base_year: e.target.value ? parseInt(e.target.value, 10) : null })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={opex.notes || ''} onChange={(e) => updateOpex({ notes: e.target.value || null })} />
              </div>
            </div>
          </div>

          {/* Critical dates */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Critical dates ({cds.length})</h3>
              <button onClick={addCD} style={{ fontSize: 12, padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>+ Add</button>
            </div>
            {cds.map((c, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <button onClick={() => removeCD(i)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select style={inputStyle} value={c.date_type || 'other'} onChange={(e) => updateCD(i, { date_type: e.target.value })}>
                      {DATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Reminder (days before)</label>
                    <input type="number" style={inputStyle} value={c.reminder_days_before ?? 90} onChange={(e) => updateCD(i, { reminder_days_before: e.target.value ? parseInt(e.target.value, 10) : null })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Trigger date</label>
                    <input type="date" style={inputStyle} value={c.trigger_date || ''} onChange={(e) => updateCD(i, { trigger_date: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Window end (optional)</label>
                    <input type="date" style={inputStyle} value={c.trigger_date_end || ''} onChange={(e) => updateCD(i, { trigger_date_end: e.target.value || null })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Description</label>
                    <input style={inputStyle} value={c.description || ''} onChange={(e) => updateCD(i, { description: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Notes</label>
                    <input style={inputStyle} value={c.notes || ''} onChange={(e) => updateCD(i, { notes: e.target.value || null })} />
                  </div>
                </div>
              </div>
            ))}
            {cds.length === 0 && <p style={{ fontSize: 12, color: '#888', margin: 0 }}>No critical dates.</p>}
          </div>

          {/* Security */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Security instruments ({secs.length})</h3>
              <button onClick={addSec} style={{ fontSize: 12, padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>+ Add</button>
            </div>
            {secs.map((s, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <button onClick={() => removeSec(i)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select style={inputStyle} value={s.instrument_type || 'cash_deposit'} onChange={(e) => updateSec(i, { instrument_type: e.target.value })}>
                      {INSTRUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Amount</label>
                    <input type="number" step="0.01" style={inputStyle} value={s.amount ?? ''} onChange={(e) => updateSec(i, { amount: e.target.value ? parseFloat(e.target.value) : 0 })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Currency</label>
                    <input style={inputStyle} value={s.currency || lease?.currency || 'USD'} onChange={(e) => updateSec(i, { currency: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Issuer</label>
                    <input style={inputStyle} value={s.issuer || ''} onChange={(e) => updateSec(i, { issuer: e.target.value || null })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Expiration</label>
                    <input type="date" style={inputStyle} value={s.expiration_date || ''} onChange={(e) => updateSec(i, { expiration_date: e.target.value || null })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Notes / burn-down</label>
                    <input style={inputStyle} value={s.notes || ''} onChange={(e) => updateSec(i, { notes: e.target.value || null })} />
                  </div>
                </div>
              </div>
            ))}
            {secs.length === 0 && <p style={{ fontSize: 12, color: '#888', margin: 0 }}>No security instruments.</p>}
          </div>

          {/* Reviewer notes */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Reviewer notes</h3>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              placeholder="Optional. Will be saved with the abstraction."
              value={reviewerNotes}
              onChange={(e) => { setReviewerNotes(e.target.value); setDirty(true) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
