import { createClient } from '@supabase/supabase-js'

// Admin client for portfolio module — bypasses RLS where needed (e.g. quota updates,
// service-side reads). Use sparingly; default to RLS-respecting clients via supabase-server.
export function getPortfolioAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase service role not configured')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const PORTFOLIO_BUCKET = 'portfolio-documents'

// Build the canonical storage path for a portfolio document.
// Convention: companies/{company_id}/leases/{lease_id_or_unassigned}/{timestamp}-{safeName}
export function buildPortfolioStoragePath(opts: {
  companyId: string
  leaseId?: string | null
  filename: string
}): string {
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  const leasePart = opts.leaseId || 'unassigned'
  const timestamp = Date.now()
  return `companies/${opts.companyId}/leases/${leasePart}/${timestamp}-${safeName}`
}

// Helper: check if uploading additionalBytes would exceed company quota.
// Returns { ok: true, remaining } or { ok: false, error }.
export async function checkQuota(
  companyId: string,
  additionalBytes: number,
): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const admin = getPortfolioAdminClient()
  const { data, error } = await admin
    .from('portfolio_companies')
    .select('storage_quota_bytes, storage_used_bytes, name')
    .eq('id', companyId)
    .single()
  if (error || !data) {
    return { ok: false, error: 'Company not found' }
  }
  const remaining = Number(data.storage_quota_bytes) - Number(data.storage_used_bytes)
  if (additionalBytes > remaining) {
    return {
      ok: false,
      error: `Upload would exceed storage quota for ${data.name}. Remaining: ${remaining} bytes, requested: ${additionalBytes} bytes.`,
    }
  }
  return { ok: true, remaining: remaining - additionalBytes }
}
