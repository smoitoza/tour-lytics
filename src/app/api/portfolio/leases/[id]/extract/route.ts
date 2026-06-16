import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient, PORTFOLIO_BUCKET } from '@/lib/portfolio/admin'

// Portfolio extraction is multi-doc (executed lease + amendments) and can be heavy.
// Allow up to 5 minutes so a 100-150 page lease bundle finishes in one call.
export const maxDuration = 300

const anthropic = new Anthropic()

const PORTFOLIO_EXTRACTION_PROMPT = `You are a senior commercial real estate analyst building an operational record for a tenant's portfolio system. You are given the FULL document set for a single lease — the executed lease first, followed by any amendments, side letters, SNDAs, estoppels, or other ancillary documents in chronological order.

Your job is to produce a CURRENT-STATE structured abstraction of the lease as it stands today, after all amendments. When an amendment modifies a term (e.g. extends the term, changes rent, adds a renewal option, releases a portion of premises), the amendment WINS — reflect the most recent value, not the original.

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no commentary. Use exactly these field names:

{
  "lease_meta": {
    "tenant_name": "<string or null>",
    "landlord_name": "<string or null>",
    "landlord_entity": "<full legal entity name as it appears, or null>",
    "lease_type": "<NNN | gross | modified_gross | full_service | ground | other | null>",
    "currency": "<USD | CAD | GBP | EUR | other ISO code, default USD>",
    "commencement_date": "<YYYY-MM-DD or null>",
    "rent_commencement_date": "<YYYY-MM-DD or null — date rent actually starts being paid, after any abatement>",
    "expiration_date": "<YYYY-MM-DD or null — current expiration after any extensions>",
    "term_months": <integer or null>,
    "notes": "<string or null — 1-2 sentences of history worth surfacing, e.g. 'Originally 60 months; extended 36 months by Second Amendment'>"
  },
  "locations": [
    {
      "label": "<string or null — e.g. 'HQ', 'Building A, Suite 200'>",
      "address_line1": "<string>",
      "address_line2": "<string or null>",
      "city": "<string>",
      "state_province": "<string or null>",
      "postal_code": "<string or null>",
      "country": "<ISO-2, default US>",
      "use_type": "<office | industrial | flex | retail | lab | warehouse | data_center | other | null>",
      "rentable_sqft": <integer or null>,
      "floor_count": <integer or null>,
      "is_primary": <true | false — exactly one location should be primary>
    }
  ],
  "rent_schedule": [
    {
      "period_start": "<YYYY-MM-DD>",
      "period_end": "<YYYY-MM-DD>",
      "monthly_rent": <number — gross monthly base rent in the lease currency>,
      "rent_psf_annual": <number or null — annual base rent per rentable square foot if calculable>,
      "is_free_rent": <true | false — true if this period is free/abated rent>,
      "escalation_type": "<fixed | cpi | fmv | none | null>  // use 'fixed' for any fixed/stepped/flat increase, 'cpi' for CPI-tied, 'fmv' for fair-market-value resets, 'none' for flat (no increase)>",
      "escalation_note": "<string or null — e.g. '3% annual on anniversary' or 'CPI capped 4%'>"
    }
  ],
  "opex_terms": {
    "starting_opex_psf_annual": <number or null — first-year opex / CAM passthrough in $/RSF/year>,
    "escalation_pct": <number or null — annual opex escalation %, e.g. 3 for 3%>,
    "escalation_type": "<fixed | cpi | capped | uncapped | null>  // use 'fixed' for fixed % escalator, 'cpi' for CPI-tied, 'capped' if expense growth is capped, 'uncapped' if pure passthrough>",
    "cap_pct": <number or null — cap on controllable opex growth, e.g. 5 for 5%>,
    "free_opex_months": <integer or null — number of months of free/abated opex>,
    "free_opex_start": "<YYYY-MM-DD or null>",
    "base_year": <integer or null — calendar year for base-year stops>,
    "notes": "<string or null — anything notable about exclusions, gross-up, audit rights, tenant pro-rata share, expense stop, etc.>"
  },
  "critical_dates": [
    {
      "date_type": "<notice_to_renew | option_to_extend | notice_to_terminate | option_to_terminate | rofr | rofo | rent_review | cap_review | expiration | cam_reconciliation | loc_renewal | other>  // use notice_to_renew/notice_to_terminate for the deadline to give notice; use option_to_extend/option_to_terminate for the substantive right itself>",
      "trigger_date": "<YYYY-MM-DD — the date or earliest date the right matures / notice may begin>",
      "trigger_date_end": "<YYYY-MM-DD or null — latest date in a notice window>",
      "description": "<string — concise description, e.g. '5-year renewal at 95% FMR; notice 12-9 months prior'>",
      "reminder_days_before": <integer or null — suggested reminder lead time, default 90>,
      "notes": "<string or null — source section reference + any caveats>"
    }
  ],
  "security_instruments": [
    {
      "instrument_type": "<cash_deposit | letter_of_credit | corporate_guaranty | personal_guaranty | surety_bond | other>",
      "amount": <number>,
      "currency": "<ISO-3 currency, defaults to lease currency>",
      "issuer": "<string or null — bank or guarantor name>",
      "expiration_date": "<YYYY-MM-DD or null>",
      "burndown_schedule": <null | array of {"effective_date": "YYYY-MM-DD", "reduced_amount": number, "condition": "string"}>,
      "notes": "<string or null — raw burn-down language if structured form not extractable>"
    }
  ],
  "confidence": {
    "score": <number 0..1 — your overall confidence in the extraction>,
    "notes": "<string or null — anything ambiguous or that requires human review>"
  },
  "source_documents": [
    { "filename": "<string>", "document_type": "<string>", "role": "<primary_lease | amendment | side_letter | snda | estoppel | guaranty | exhibit | other>" }
  ]
}

GUIDELINES:

1) CURRENT STATE: When the executed lease says one thing and an amendment changes it, return the amended value. Use lease_meta.notes to call out the change history briefly.

2) RENT SCHEDULE: Return a contiguous schedule from rent_commencement_date through expiration_date. Free/abated months should appear as rows with is_free_rent=true and monthly_rent=0. Combine consecutive periods that share the same monthly rate into one row.

3) LOCATIONS: If the lease covers multiple suites or buildings, list each. Mark exactly one as is_primary=true (usually the largest or the headquarters address).

4) CRITICAL DATES: Be aggressive about capturing renewal options, termination rights, expansion/contraction options, and notice deadlines. These are the most operationally valuable items. trigger_date is the START of the notice window (or single date); trigger_date_end is the END of the window. Compute from the lease term where possible (e.g. "tenant must give notice 12-9 months prior to expiration" → trigger_date = expiration - 12 months, trigger_date_end = expiration - 9 months).

5) SECURITY: Include any cash deposit, LOC, guaranty, or surety bond. If burn-down language exists and is structurable, populate burndown_schedule as an array. Otherwise put the verbatim language in notes.

6) MISSING DATA: Return null rather than guessing. The user reviews this before it's published, so integrity matters more than coverage. If a section is entirely absent from the lease, return an empty array. NEVER include a critical_dates entry without a trigger_date — if you can't pin one down, skip the entry and mention it in confidence.notes.

7) CONFIDENCE: Be honest. If the lease is poorly scanned or amendments are missing, score lower and call it out in confidence.notes.

8) SOURCE DOCUMENTS: List each document I gave you in the order I provided, with the role you inferred for each.

9) ENUM VALUES ARE STRICT: The enumerated values above are exact. Do NOT invent variants like 'stepped', 'flat', 'percentage', 'annual', 'fixed_percentage', 'fmr', 'renewal_option', 'termination_right', 'guaranty'. If unsure between two enums, pick the closest match or use null/other.

Return the JSON now.`

type DocRow = {
  id: string
  storage_path: string | null
  original_filename: string
  document_type: string | null
  effective_date: string | null
  uploaded_at: string
  mime_type: string | null
  size_bytes: number | null
}

// Sort docs: executed lease first (effective_date asc, then uploaded_at), then amendments by effective_date asc,
// then everything else by uploaded_at.
function sortDocsForExtraction(docs: DocRow[]): DocRow[] {
  const rank = (d: DocRow): number => {
    if (d.document_type === 'lease') return 0
    if (d.document_type === 'amendment') return 1
    if (d.document_type === 'side_letter') return 2
    if (d.document_type === 'snda') return 3
    if (d.document_type === 'estoppel') return 4
    if (d.document_type === 'work_letter') return 5
    if (d.document_type === 'guaranty') return 6
    if (d.document_type === 'exhibit') return 7
    return 8
  }
  return [...docs].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    const da = a.effective_date || ''
    const db = b.effective_date || ''
    if (da && db && da !== db) return da < db ? -1 : 1
    if (da && !db) return -1
    if (!da && db) return 1
    return a.uploaded_at < b.uploaded_at ? -1 : 1
  })
}

// POST /api/portfolio/leases/[id]/extract
// Pulls all portfolio_documents for the lease, sends them as a multi-doc bundle to Claude,
// writes the result to portfolio_abstractions with status='pending_review'.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getPortfolioAdminClient()

    // Fetch lease + verify membership
    const { data: lease, error: leaseErr } = await admin
      .from('portfolio_leases')
      .select('id, company_id, name, currency')
      .eq('id', leaseId)
      .single()
    if (leaseErr || !lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('role, status')
      .eq('company_id', lease.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Fetch all documents for this lease
    const { data: docsRaw, error: docsErr } = await admin
      .from('portfolio_documents')
      .select('id, storage_path, original_filename, document_type, effective_date, uploaded_at, mime_type, size_bytes')
      .eq('lease_id', leaseId)
    if (docsErr) {
      return NextResponse.json({ error: 'Could not load documents: ' + docsErr.message }, { status: 500 })
    }
    if (!docsRaw || docsRaw.length === 0) {
      return NextResponse.json({ error: 'No documents attached to this lease. Upload the executed lease (and any amendments) before extracting.' }, { status: 400 })
    }

    const docs = sortDocsForExtraction(docsRaw as DocRow[])

    // Pull each PDF as base64. Skip non-PDFs (we can add DOCX handling later via client-side mammoth).
    const docBlocks: Array<{ doc: DocRow; b64: string }> = []
    const skipped: Array<{ filename: string; reason: string }> = []

    for (const doc of docs) {
      if (!doc.storage_path) {
        skipped.push({ filename: doc.original_filename, reason: 'no storage path' })
        continue
      }
      if (doc.mime_type !== 'application/pdf') {
        skipped.push({ filename: doc.original_filename, reason: `unsupported mime: ${doc.mime_type || 'unknown'} (PDF only for now)` })
        continue
      }
      try {
        const { data: signed, error: signErr } = await admin.storage
          .from(PORTFOLIO_BUCKET)
          .createSignedUrl(doc.storage_path, 300)
        if (signErr || !signed?.signedUrl) {
          skipped.push({ filename: doc.original_filename, reason: 'could not sign URL' })
          continue
        }
        const res = await fetch(signed.signedUrl)
        if (!res.ok) {
          skipped.push({ filename: doc.original_filename, reason: `fetch ${res.status}` })
          continue
        }
        const buf = await res.arrayBuffer()
        const b64 = Buffer.from(buf).toString('base64')
        docBlocks.push({ doc, b64 })
      } catch (e) {
        skipped.push({ filename: doc.original_filename, reason: String(e) })
      }
    }

    if (docBlocks.length === 0) {
      return NextResponse.json({
        error: 'No PDF documents could be loaded for extraction.',
        skipped,
      }, { status: 400 })
    }

    // Build the Claude message: one document block per PDF, then a small text header
    // identifying each doc by ordinal + filename + type, then the extraction prompt.
    const userContent: Anthropic.MessageParam['content'] = []

    for (const { b64 } of docBlocks) {
      userContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: b64,
        },
      })
    }

    const docManifest = docBlocks.map((b, i) => {
      return `  ${i + 1}. ${b.doc.original_filename} — type: ${b.doc.document_type || 'unknown'}${b.doc.effective_date ? `, effective ${b.doc.effective_date}` : ''}`
    }).join('\n')

    userContent.push({
      type: 'text',
      text: `LEASE: ${lease.name}\nCURRENCY: ${lease.currency || 'USD'}\n\nDOCUMENT BUNDLE (in the order I attached them above):\n${docManifest}\n\n${PORTFOLIO_EXTRACTION_PROMPT}`,
    })

    let aiText = ''
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        messages: [{ role: 'user', content: userContent }],
      })
      aiText = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: 'AI extraction failed: ' + errMsg, skipped }, { status: 500 })
    }

    // Parse JSON
    let parsed: Record<string, unknown> | null = null
    try {
      const cleaned = aiText.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      const m = aiText.match(/\{[\s\S]*\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { /* fall through */ }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({
        error: 'AI returned invalid JSON',
        raw: aiText.slice(0, 2000),
      }, { status: 500 })
    }

    // Annotate with the source document IDs so the review screen can render the original PDFs.
    const extractedFields: Record<string, unknown> = {
      ...parsed,
      source_document_ids: docBlocks.map((b) => b.doc.id),
      skipped_documents: skipped,
    }

    const confidenceScore =
      parsed.confidence && typeof parsed.confidence === 'object' && 'score' in (parsed.confidence as Record<string, unknown>)
        ? Number((parsed.confidence as Record<string, unknown>).score)
        : null

    const primaryDocId = docBlocks[0]?.doc.id || docs[0]?.id

    // Upsert into portfolio_abstractions. One pending abstraction per lease at a time —
    // if one already exists in pending_review or needs_more_info, replace it.
    const { data: existing } = await admin
      .from('portfolio_abstractions')
      .select('id, status')
      .eq('lease_id', leaseId)
      .in('status', ['pending_review', 'needs_more_info'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const payload = {
      lease_id: leaseId,
      company_id: lease.company_id,
      source_document_id: primaryDocId,
      extracted_fields: extractedFields,
      extraction_version: 'portfolio-v1-sonnet-4-5',
      status: 'pending_review' as const,
      confidence_score: confidenceScore && !isNaN(confidenceScore) ? confidenceScore : null,
    }

    let abstractionId: string
    if (existing) {
      const { data: updated, error: updErr } = await admin
        .from('portfolio_abstractions')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single()
      if (updErr || !updated) {
        return NextResponse.json({ error: 'Could not save extraction: ' + (updErr?.message || 'unknown') }, { status: 500 })
      }
      abstractionId = updated.id
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('portfolio_abstractions')
        .insert(payload)
        .select('id')
        .single()
      if (insErr || !inserted) {
        return NextResponse.json({ error: 'Could not save extraction: ' + (insErr?.message || 'unknown') }, { status: 500 })
      }
      abstractionId = inserted.id
    }

    return NextResponse.json({
      success: true,
      abstraction_id: abstractionId,
      lease_id: leaseId,
      confidence_score: payload.confidence_score,
      document_count: docBlocks.length,
      skipped,
    })
  } catch (err) {
    console.error('Portfolio extract handler error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
