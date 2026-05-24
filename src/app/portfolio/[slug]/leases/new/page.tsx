'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  reporting_currency: string
}

type StagedFile = {
  file: File
  documentType: PortfolioDocumentType
  effectiveDate: string | null
  status: 'pending' | 'signing' | 'uploading' | 'saving' | 'done' | 'error'
  errorMsg?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const COUNTRIES = ['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'DE', 'FR', 'NL', 'ES', 'IT', 'JP', 'SG', 'IN', 'MX', 'BR', 'Other']
const CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'JPY', 'SGD', 'INR', 'MXN', 'BRL']
const LEASE_TYPES = [
  { value: '', label: '— Select —' },
  { value: 'NNN', label: 'Triple Net (NNN)' },
  { value: 'gross', label: 'Gross' },
  { value: 'modified_gross', label: 'Modified Gross' },
  { value: 'full_service', label: 'Full Service' },
  { value: 'ground', label: 'Ground' },
  { value: 'other', label: 'Other' },
]
const USE_TYPES = [
  { value: '', label: '— Select —' },
  { value: 'office', label: 'Office' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'flex', label: 'Flex' },
  { value: 'retail', label: 'Retail' },
  { value: 'lab', label: 'Lab' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'data_center', label: 'Data Center' },
  { value: 'other', label: 'Other' },
]

export default function NewLeasePage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Lease form
  const [name, setName] = useState('')
  const [landlordName, setLandlordName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [leaseType, setLeaseType] = useState('')
  const [commencementDate, setCommencementDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes] = useState('')

  // Primary location
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [stateProv, setStateProv] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('US')
  const [useType, setUseType] = useState('')
  const [rentableSqft, setRentableSqft] = useState('')

  // Staged docs
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    fetch('/api/portfolio/companies')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return }
        const co = (data.companies || []).find((c: Company) => c.slug === params.slug)
        if (!co) { setError('Company not found or you are not a member.'); return }
        setCompany(co)
        setCurrency(co.reporting_currency || 'USD')
      })
      .catch((e) => setError(String(e)))
  }, [params.slug])

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

  const removeStaged = (idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateStaged = (idx: number, patch: Partial<StagedFile>) => {
    setStaged((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  const uploadSingleDoc = async (leaseId: string, idx: number) => {
    if (!company) return
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
          lease_id: leaseId,
          filename: item.file.name,
          content_type: item.file.type,
          size_bytes: item.file.size,
        }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) {
        setStatus({ status: 'error', errorMsg: signData.error || 'Failed to sign URL' })
        return false
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
        setStatus({ status: 'error', errorMsg: 'Upload failed: ' + upError.message })
        return false
      }

      setStatus({ status: 'saving' })
      const saveRes = await fetch('/api/portfolio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          lease_id: leaseId,
          storage_path: signData.storagePath,
          original_filename: item.file.name,
          size_bytes: item.file.size,
          mime_type: item.file.type,
          document_type: item.documentType,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) {
        setStatus({ status: 'error', errorMsg: saveData.error || 'Failed to save metadata' })
        return false
      }

      setStatus({ status: 'done' })
      return true
    } catch (err) {
      setStatus({ status: 'error', errorMsg: String(err) })
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return
    if (!name.trim()) {
      setError('Lease name is required.')
      return
    }
    setError(null)
    setSubmitting(true)

    try {
      const hasAddress = addressLine1.trim() && city.trim()
      const body: Record<string, unknown> = {
        company_id: company.id,
        name: name.trim(),
        landlord_name: landlordName.trim() || null,
        currency,
        lease_type: leaseType || null,
        commencement_date: commencementDate || null,
        expiration_date: expirationDate || null,
        notes: notes.trim() || null,
      }
      if (hasAddress) {
        body.primary_location = {
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || null,
          city: city.trim(),
          state_province: stateProv.trim() || null,
          postal_code: postalCode.trim() || null,
          country,
          use_type: useType || null,
          rentable_sqft: rentableSqft ? parseInt(rentableSqft, 10) : null,
        }
      }

      const res = await fetch('/api/portfolio/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.lease) {
        setError(data.error || 'Failed to create lease')
        setSubmitting(false)
        return
      }

      const leaseId = data.lease.id

      // Upload all staged docs in parallel-ish (sequential to keep UI calm)
      for (let i = 0; i < staged.length; i++) {
        await uploadSingleDoc(leaseId, i)
      }

      // Navigate to the lease detail page
      router.push(`/portfolio/${company.slug}/leases/${leaseId}`)
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
  const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  }

  return (
    <div style={{ maxWidth: 880, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
        <Link href="/portfolio" style={{ color: '#0070f3', textDecoration: 'none' }}>Portfolio</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        {company && (
          <>
            <Link href={`/portfolio/${company.slug}/leases`} style={{ color: '#0070f3', textDecoration: 'none' }}>
              {company.name}
            </Link>
            <span style={{ margin: '0 8px' }}>/</span>
          </>
        )}
        <span>New lease</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>New lease</h1>
      <p style={{ color: '#666', margin: '0 0 24px' }}>
        Enter the basics, drop in all of the lease&apos;s documents (executed lease + amendments + side letters), then save. Documents stay grouped under this lease for abstraction.
      </p>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 12, borderRadius: 8, color: '#900', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Lease basics */}
        <div style={sectionStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>Lease basics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Lease name *</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 6309 Bardin Road — Carpinteria HQ"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Landlord</label>
              <input
                style={inputStyle}
                value={landlordName}
                onChange={(e) => setLandlordName(e.target.value)}
                placeholder="Optional — fill in if you know it"
              />
            </div>
            <div>
              <label style={labelStyle}>Lease type</label>
              <select style={inputStyle} value={leaseType} onChange={(e) => setLeaseType(e.target.value)}>
                {LEASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Commencement</label>
              <input type="date" style={inputStyle} value={commencementDate} onChange={(e) => setCommencementDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Expiration</label>
              <input type="date" style={inputStyle} value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#888', margin: '12px 0 0' }}>
            Dates are optional. If left blank, the abstraction pipeline will fill them in from the lease PDF and you&apos;ll approve before publishing.
          </p>
        </div>

        {/* Primary location */}
        <div style={sectionStyle}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Primary location</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
            Optional. If this lease covers multiple addresses, add the primary one here. Additional locations can be added on the lease detail page.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address line 1</label>
            <input style={inputStyle} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="6309 Carpinteria Avenue" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address line 2</label>
            <input style={inputStyle} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Suite, floor, etc." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Carpinteria" />
            </div>
            <div>
              <label style={labelStyle}>State / Province</label>
              <input style={inputStyle} value={stateProv} onChange={(e) => setStateProv(e.target.value)} placeholder="CA" />
            </div>
            <div>
              <label style={labelStyle}>Postal code</label>
              <input style={inputStyle} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="93013" />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <select style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Use type</label>
              <select style={inputStyle} value={useType} onChange={(e) => setUseType(e.target.value)}>
                {USE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Rentable sqft</label>
              <input type="number" style={inputStyle} value={rentableSqft} onChange={(e) => setRentableSqft(e.target.value)} placeholder="25,000" />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div style={sectionStyle}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Documents for this lease</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
            Drop in the executed lease and every amendment, side letter, SNDA, or consent that belongs to it. Each file&apos;s type is auto-detected from the filename — you can override it before saving.
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
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onClick={() => document.getElementById('new-lease-file-input')?.click()}
          >
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
              Drag and drop documents here, or click to browse
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              PDF, DOCX, XLSX, PNG, JPG · up to 100 MB per file
            </p>
            <input
              id="new-lease-file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.png,.jpg,.jpeg,application/pdf,image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {staged.length > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              {staged.map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #e5e7eb',
                    background:
                      s.status === 'error' ? '#fff5f5' :
                      s.status === 'done' ? '#f0fff4' : '#fff',
                    padding: 12,
                    borderRadius: 8,
                    display: 'grid',
                    gridTemplateColumns: '1fr 180px 140px 100px 32px',
                    gap: 10,
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
                    style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                    value={s.documentType}
                    onChange={(e) => updateStaged(i, { documentType: e.target.value as PortfolioDocumentType })}
                    disabled={submitting}
                  >
                    {DOCUMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                    value={s.effectiveDate || ''}
                    onChange={(e) => updateStaged(i, { effectiveDate: e.target.value || null })}
                    disabled={submitting}
                  />
                  <div style={{ fontSize: 12, color: s.status === 'error' ? '#c00' : '#666', textAlign: 'right' }}>
                    {s.status === 'pending' && 'Ready'}
                    {s.status === 'signing' && 'Signing…'}
                    {s.status === 'uploading' && 'Uploading…'}
                    {s.status === 'saving' && 'Saving…'}
                    {s.status === 'done' && <span style={{ color: '#0a7' }}>✓ Done</span>}
                    {s.status === 'error' && <span title={s.errorMsg}>Error</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStaged(i)}
                    disabled={submitting || s.status === 'done'}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#999', fontSize: 16,
                    }}
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {company && (
            <Link
              href={`/portfolio/${company.slug}/leases`}
              style={{ color: '#666', textDecoration: 'none', fontSize: 14 }}
            >
              ← Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            style={{
              background: submitting ? '#999' : '#0070f3',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting
              ? `Creating lease… ${staged.filter((s) => s.status === 'done').length}/${staged.length} docs uploaded`
              : staged.length > 0
                ? `Create lease and upload ${staged.length} document${staged.length === 1 ? '' : 's'}`
                : 'Create lease'
            }
          </button>
        </div>
      </form>
    </div>
  )
}
