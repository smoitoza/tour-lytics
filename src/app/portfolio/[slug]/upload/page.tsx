'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

type Company = {
  id: string
  name: string
  slug: string
  storage_used_bytes: number
  storage_quota_bytes: number
}

type DocRow = {
  id: string
  original_filename: string
  size_bytes: number
  document_type: string
  uploaded_at: string
}

type UploadStatus = 'idle' | 'signing' | 'uploading' | 'saving' | 'done' | 'error'

type Upload = {
  file: File
  status: UploadStatus
  progressPct: number
  errorMsg?: string
  docId?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function PortfolioUploadPage() {
  const params = useParams<{ slug: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)

  // Find the company by slug from the list
  useEffect(() => {
    fetch('/api/portfolio/companies')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return }
        const co = (data.companies || []).find((c: Company) => c.slug === params.slug)
        if (!co) { setError('Company not found or you are not a member.'); return }
        setCompany(co)
      })
      .catch((e) => setError(String(e)))
  }, [params.slug])

  const loadDocuments = useCallback(async (companyId: string) => {
    const res = await fetch(`/api/portfolio/documents?company_id=${companyId}`)
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setDocuments(data.documents || [])
  }, [])

  useEffect(() => {
    if (company?.id) loadDocuments(company.id)
  }, [company?.id, loadDocuments])

  const uploadOne = useCallback(async (file: File, idx: number) => {
    if (!company) return
    const updateOne = (patch: Partial<Upload>) => {
      setUploads((prev) => prev.map((u, i) => i === idx ? { ...u, ...patch } : u))
    }

    try {
      // 1. Get signed upload URL
      updateOne({ status: 'signing' })
      const signRes = await fetch('/api/portfolio/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
        }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) {
        updateOne({ status: 'error', errorMsg: signData.error || 'Failed to sign URL' })
        return
      }

      // 2. PUT the file directly to Storage using Supabase JS (handles auth header)
      updateOne({ status: 'uploading', progressPct: 10 })
      const supabase = createClient()
      const { error: upError } = await supabase.storage
        .from('portfolio-documents')
        .uploadToSignedUrl(signData.storagePath, signData.token, file, {
          contentType: file.type,
          upsert: false,
        })

      if (upError) {
        updateOne({ status: 'error', errorMsg: 'Upload failed: ' + upError.message })
        return
      }

      // 3. Create the portfolio_documents row
      updateOne({ status: 'saving', progressPct: 90 })
      const saveRes = await fetch('/api/portfolio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          storage_path: signData.storagePath,
          original_filename: file.name,
          size_bytes: file.size,
          mime_type: file.type,
          document_type: 'lease',
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) {
        updateOne({ status: 'error', errorMsg: saveData.error || 'Failed to save metadata' })
        return
      }

      updateOne({ status: 'done', progressPct: 100, docId: saveData.document?.id })
      if (company?.id) loadDocuments(company.id)
    } catch (err) {
      updateOne({ status: 'error', errorMsg: String(err) })
    }
  }, [company, loadDocuments])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const newUploads: Upload[] = Array.from(files).map((file) => ({
      file,
      status: 'idle',
      progressPct: 0,
    }))
    setUploads((prev) => {
      const combined = [...prev, ...newUploads]
      // Kick off uploads for the new entries based on their absolute index
      newUploads.forEach((_, j) => {
        const absIdx = prev.length + j
        setTimeout(() => uploadOne(newUploads[j].file, absIdx), 0)
      })
      return combined
    })
  }, [uploadOne])

  return (
    <div style={{ maxWidth: 880, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/portfolio" style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14 }}>
          ← Back to portfolio
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>
          {company?.name || 'Upload documents'}
        </h1>
        {company && (
          <p style={{ color: '#666', margin: 0 }}>
            Storage: {formatBytes(company.storage_used_bytes)} of {formatBytes(company.storage_quota_bytes)} used
          </p>
        )}
      </div>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #fcc', padding: 12, borderRadius: 8, color: '#900', marginBottom: 16 }}>
          {error}
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
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onClick={() => document.getElementById('portfolio-file-input')?.click()}
          >
            <p style={{ fontSize: 16, margin: '0 0 8px' }}>
              Drag and drop lease PDFs here, or click to browse
            </p>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              PDF, DOCX, XLSX, PNG, JPG · up to 100 MB per file
            </p>
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
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                This session
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {uploads.map((u, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #eee',
                      background: u.status === 'error' ? '#fff5f5' : u.status === 'done' ? '#f0fff4' : '#fff',
                      padding: 12,
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>
                      <strong>{u.file.name}</strong>
                      <div style={{ fontSize: 12, color: '#666' }}>{formatBytes(u.file.size)}</div>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {u.status === 'idle' && 'Queued'}
                      {u.status === 'signing' && 'Signing…'}
                      {u.status === 'uploading' && 'Uploading…'}
                      {u.status === 'saving' && 'Saving…'}
                      {u.status === 'done' && <span style={{ color: '#0a7' }}>✓ Uploaded</span>}
                      {u.status === 'error' && <span style={{ color: '#c00' }} title={u.errorMsg}>Error: {u.errorMsg}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              All documents ({documents.length})
            </h3>
            {documents.length === 0 ? (
              <p style={{ color: '#999', fontSize: 14 }}>No documents uploaded yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '8px 4px' }}>Filename</th>
                    <th style={{ padding: '8px 4px' }}>Type</th>
                    <th style={{ padding: '8px 4px' }}>Size</th>
                    <th style={{ padding: '8px 4px' }}>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '8px 4px' }}>{d.original_filename}</td>
                      <td style={{ padding: '8px 4px', color: '#666' }}>{d.document_type}</td>
                      <td style={{ padding: '8px 4px', color: '#666' }}>{formatBytes(d.size_bytes || 0)}</td>
                      <td style={{ padding: '8px 4px', color: '#666' }}>
                        {new Date(d.uploaded_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
