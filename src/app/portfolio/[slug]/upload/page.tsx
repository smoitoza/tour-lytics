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
  name: string
  document_count: number
}

type DocRow = {
  id: string
  original_filename: string
  size_bytes: number
  document_type: string
  effective_date: string | null
  uploaded_at: string
  lease_id: string | null
}

type UploadStatus = 'idle' | 'signing' | 'uploading' | 'saving' | 'done' | 'error'

type Upload = {
  file: File
  documentType: PortfolioDocumentType
  effectiveDate: string | null
  leaseId: string | null
  status: UploadStatus
  errorMsg?: string
  docId?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function PortfolioBulkInboxPage() {
  const params = useParams<{ slug: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [leases, setLeases] = useState<Lease[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busyDocId, setBusyDocId] = useState<string | null>(null)
  const [bulkAssignTo, setBulkAssignTo] = useState<string>('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const reloadAll = useCallback(async (companyId: string) => {
    const [lRes, dRes, cRes] = await Promise.all([
      fetch(`/api/portfolio/leases?company_id=${companyId}`),
      fetch(`/api/portfolio/documents?company_id=${companyId}`),
      fetch(`/api/portfolio/companies`),
    ])
    const lData = await lRes.json()
    const dData = await dRes.json()
    const cData = await cRes.json()
    if (lData.error) { setError(lData.error); return }
    if (dData.error) { setError(dData.error); return }
    setLeases(lData.leases || [])
    setDocuments(dData.documents || [])
    if (cData.companies) {
      const co = cData.companies.find((c: Company) => c.id === companyId)
      if (co) setCompany(co)
    }
  }, [])

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
        await reloadAll(co.id)
      } catch (e) {
        setError(String(e))
      }
    }
    load()
    return () => { cancelled = true }
  }, [params.slug, reloadAll])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const newUploads: Upload[] = Array.from(files).map((file) => ({
      file,
      documentType: guessDocumentType(file.name),
      effectiveDate: guessEffectiveDate(file.name),
      leaseId: null,
      status: 'idle',
    }))
    setUploads((prev) => [...prev, ...newUploads])
  }, [])

  const updateUpload = (idx: number, patch: Partial<Upload>) => {
    setUploads((prev) => prev.map((u, i) => i === idx ? { ...u, ...patch } : u))
  }

  const removeUpload = (idx: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== idx))
  }

  const uploadOne = useCallback(async (idx: number) => {
    if (!company) return
    let item: Upload | undefined
    setUploads((prev) => { item = prev[idx]; return prev })
    if (!item) return

    const setStatus = (patch: Partial<Upload>) => {
      setUploads((prev) => prev.map((u, i) => i === idx ? { ...u, ...patch } : u))
    }

    try {
      setStatus({ status: 'signing' })
      const signRes = await fetch('/api/portfolio/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          lease_id: item.leaseId || undefined,
          filename: item.file.name,
          content_type: item.file.type,
          size_bytes: item.file.size,
        }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) {
        setStatus({ status: 'error', errorMsg: signData.error || 'Failed to sign URL' })
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
        setStatus({ status: 'error', errorMsg: 'Upload failed: ' + upError.message })
        return
      }

      setStatus({ status: 'saving' })
      const saveRes = await fetch('/api/portfolio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          lease_id: item.leaseId || undefined,
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
        return
      }

      setStatus({ status: 'done', docId: saveData.document?.id })
      if (company?.id) reloadAll(company.id)
    } catch (err) {
      setStatus({ status: 'error', errorMsg: String(err) })
    }
  }, [company, reloadAll])

  const uploadAll = async () => {
    for (let i = 0; i < uploads.length; i++) {
      if (uploads[i].status === 'idle') await uploadOne(i)
    }
  }

  // ---- Existing-doc actions ----
  const patchDocument = async (docId: string, patch: Record<string, unknown>) => {
    if (!company) return
    setBusyDocId(docId)
    try {
      const res = await fetch(`/api/portfolio/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Update failed')
      } else {
        await reloadAll(company.id)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setBusyDocId(null)
    }
  }

  const deleteDocument = async (docId: string) => {
    if (!company) return
    setBusyDocId(docId)
    try {
      const res = await fetch(`/api/portfolio/documents/${docId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Delete failed')
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(docId)
          return next
        })
        await reloadAll(company.id)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setBusyDocId(null)
      setConfirmDeleteId(null)
    }
  }

  const bulkAssign = async () => {
    if (!company || !bulkAssignTo || selectedIds.size === 0) return
    const leaseId = bulkAssignTo === '__unassign__' ? null : bulkAssignTo
    for (const docId of selectedIds) {
      await fetch(`/api/portfolio/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lease_id: leaseId }),
      })
    }
    setSelectedIds(new Set())
    setBulkAssignTo('')
    await reloadAll(company.id)
  }

  const bulkDelete = async () => {
    if (!company || selectedIds.size === 0) return
    for (const docId of selectedIds) {
      await fetch(`/api/portfolio/documents/${docId}`, { method: 'DELETE' })
    }
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    await reloadAll(company.id)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(documents.map((d) => d.id)))
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', width: '100%',
  }

  const hasPending = uploads.some((u) => u.status === 'idle')
  const unassignedDocs = documents.filter((d) => !d.lease_id)

  return (
    <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
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
        <span>Bulk upload inbox</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>Bulk upload inbox</h1>
          {company && (
            <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
              {company.name} · Storage: {formatBytes(company.storage_used_bytes)} of {formatBytes(company.storage_quota_bytes)} used
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {company && (
            <Link
              href={`/portfolio/${company.slug}/leases`}
              style={{
                background: '#fff', color: '#0070f3', border: '1px solid #0070f3',
                padding: '8px 16px', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}
            >
              View leases
            </Link>
          )}
          {company && (
            <Link
              href={`/portfolio/${company.slug}/leases/new`}
              style={{
                background: '#0070f3', color: 'white',
                padding: '8px 16px', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}
            >
              + New lease
            </Link>
          )}
        </div>
      </div>

      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', padding: 14, borderRadius: 8,
        fontSize: 13, color: '#1e40af', marginBottom: 20,
      }}>
        <strong>Tip:</strong> Drop documents here when you don&apos;t yet know which lease they belong to. Use the row controls below to assign type, effective date, and lease. For the standard flow that includes AI extraction, use <strong>+ New lease</strong> instead.
      </div>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 12, borderRadius: 8, color: '#900', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#900', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}

      {company && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleFiles(e.dataTransfer.files)
            }}
            style={{
              border: `2px dashed ${dragging ? '#0070f3' : '#ccc'}`,
              background: dragging ? '#f0f7ff' : '#fafafa',
              borderRadius: 12,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('portfolio-file-input')?.click()}
          >
            <p style={{ fontSize: 16, margin: '0 0 8px' }}>Drag and drop lease PDFs here, or click to browse</p>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>PDF, DOCX, XLSX, PNG, JPG · up to 100 MB per file</p>
            <input
              id="portfolio-file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.png,.jpg,.jpeg,application/pdf,image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {uploads.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
                  Staged this session ({uploads.length})
                </h3>
                {hasPending && (
                  <button
                    type="button"
                    onClick={uploadAll}
                    style={{
                      background: '#0070f3', color: 'white', border: 'none',
                      padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Upload all
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {uploads.map((u, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #eee',
                      background: u.status === 'error' ? '#fff5f5' : u.status === 'done' ? '#f0fff4' : '#fff',
                      padding: 12, borderRadius: 8,
                      display: 'grid',
                      gridTemplateColumns: '1.6fr 160px 140px 1.4fr 90px 28px',
                      gap: 10, alignItems: 'center',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.file.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>{formatBytes(u.file.size)}</div>
                    </div>
                    <select
                      style={inputStyle}
                      value={u.documentType}
                      onChange={(e) => updateUpload(i, { documentType: e.target.value as PortfolioDocumentType })}
                      disabled={u.status !== 'idle' && u.status !== 'error'}
                    >
                      {DOCUMENT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      style={inputStyle}
                      value={u.effectiveDate || ''}
                      onChange={(e) => updateUpload(i, { effectiveDate: e.target.value || null })}
                      disabled={u.status !== 'idle' && u.status !== 'error'}
                    />
                    <select
                      style={inputStyle}
                      value={u.leaseId || ''}
                      onChange={(e) => updateUpload(i, { leaseId: e.target.value || null })}
                      disabled={u.status !== 'idle' && u.status !== 'error'}
                    >
                      <option value="">— Unassigned —</option>
                      {leases.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 12, color: u.status === 'error' ? '#c00' : '#666', textAlign: 'right' }}>
                      {u.status === 'idle' && 'Ready'}
                      {u.status === 'signing' && 'Signing…'}
                      {u.status === 'uploading' && 'Uploading…'}
                      {u.status === 'saving' && 'Saving…'}
                      {u.status === 'done' && <span style={{ color: '#0a7' }}>✓ Uploaded</span>}
                      {u.status === 'error' && <span title={u.errorMsg}>Error</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUpload(i)}
                      disabled={u.status === 'signing' || u.status === 'uploading' || u.status === 'saving'}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#999', fontSize: 16 }}
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
                All documents ({documents.length}{unassignedDocs.length > 0 ? ` — ${unassignedDocs.length} unassigned` : ''})
              </h3>
              {selectedIds.size > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>{selectedIds.size} selected:</span>
                  <select
                    value={bulkAssignTo}
                    onChange={(e) => setBulkAssignTo(e.target.value)}
                    style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
                  >
                    <option value="">— Assign to lease —</option>
                    <option value="__unassign__">Unassign</option>
                    {leases.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={bulkAssign}
                    disabled={!bulkAssignTo}
                    style={{
                      background: bulkAssignTo ? '#0070f3' : '#ccc', color: '#fff', border: 'none',
                      padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: bulkAssignTo ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(true)}
                    style={{
                      background: '#fff', color: '#dc2626', border: '1px solid #fca5a5',
                      padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Delete {selectedIds.size}
                  </button>
                </div>
              )}
            </div>

            {documents.length === 0 ? (
              <p style={{ color: '#999', fontSize: 14 }}>No documents uploaded yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee', color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <th style={{ padding: '8px 4px', width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === documents.length && documents.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th style={{ padding: '8px 4px' }}>Filename</th>
                    <th style={{ padding: '8px 4px', width: 160 }}>Type</th>
                    <th style={{ padding: '8px 4px', width: 140 }}>Effective</th>
                    <th style={{ padding: '8px 4px', width: 200 }}>Lease</th>
                    <th style={{ padding: '8px 4px', width: 90 }}>Size</th>
                    <th style={{ padding: '8px 4px', width: 60, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const isBusy = busyDocId === d.id
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f5f5f5', opacity: isBusy ? 0.5 : 1 }}>
                        <td style={{ padding: '8px 4px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                          />
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <div style={{ fontWeight: 500 }}>{d.original_filename}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>
                            uploaded {new Date(d.uploaded_at).toLocaleString()}
                          </div>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <select
                            style={{ ...inputStyle, fontSize: 12 }}
                            value={d.document_type || 'other'}
                            disabled={isBusy}
                            onChange={(e) => patchDocument(d.id, { document_type: e.target.value })}
                          >
                            {DOCUMENT_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input
                            type="date"
                            style={{ ...inputStyle, fontSize: 12 }}
                            value={d.effective_date || ''}
                            disabled={isBusy}
                            onChange={(e) => patchDocument(d.id, { effective_date: e.target.value || null })}
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <select
                            style={{ ...inputStyle, fontSize: 12 }}
                            value={d.lease_id || ''}
                            disabled={isBusy}
                            onChange={(e) => patchDocument(d.id, { lease_id: e.target.value || null })}
                          >
                            <option value="">— Unassigned —</option>
                            {leases.map((l) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 4px', color: '#666' }}>{formatBytes(d.size_bytes || 0)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                          <button
                            onClick={() => setConfirmDeleteId(d.id)}
                            disabled={isBusy}
                            style={{
                              background: 'transparent', border: 'none',
                              color: '#dc2626', cursor: 'pointer', fontSize: 13,
                              padding: '4px 8px', borderRadius: 4,
                            }}
                            title="Delete document"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (() => {
        const doc = documents.find((d) => d.id === confirmDeleteId)
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }} onClick={() => setConfirmDeleteId(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 440, width: '90%' }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Delete document?</h3>
              <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 14 }}>
                This will permanently delete <strong>{doc?.original_filename || 'this document'}</strong> and remove it from storage. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={{ background: '#fff', border: '1px solid #d1d5db', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteDocument(confirmDeleteId)}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Bulk delete confirmation */}
      {confirmBulkDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setConfirmBulkDelete(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 440, width: '90%' }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Delete {selectedIds.size} documents?</h3>
            <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 14 }}>
              This will permanently delete the selected documents and remove them from storage. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmBulkDelete(false)}
                style={{ background: '#fff', border: '1px solid #d1d5db', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={bulkDelete}
                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Delete {selectedIds.size}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
