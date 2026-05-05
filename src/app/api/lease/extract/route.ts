import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { LEASE_CLAUSE_TYPES, type LeaseClauseType } from '@/lib/lease-clause-taxonomy'

// Lease extraction can be heavy (50-150 page docs). Allow up to 5 minutes.
export const maxDuration = 300

const anthropic = new Anthropic()

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Build the JSON Schema portion of the prompt from the clause taxonomy
function buildClauseTypeMenu(): string {
  return LEASE_CLAUSE_TYPES.map(t => `  - "${t.type}" (${t.label}): ${t.description}`).join('\n')
}

const EXTRACTION_PROMPT = `You are a senior commercial real estate attorney reviewing a lease for a tenant. Your job is to read the entire document and produce a structured summary that highlights the deal economics, term, options, and the most material risk-allocation clauses.

CLAUSE TYPE MENU (you must classify each extracted clause as exactly one of these types):
${buildClauseTypeMenu()}

OUTPUT FORMAT - return ONLY valid JSON with this exact structure (no markdown, no explanations):

{
  "document_meta": {
    "tenant_name": "<string or null>",
    "landlord_name": "<string or null>",
    "premises_address": "<string or null>",
    "rsf": <number or null>,
    "lease_term_months": <number or null>,
    "commencement_date": "<YYYY-MM-DD or null>",
    "expiration_date": "<YYYY-MM-DD or null>",
    "rent_basis": "<NNN | Modified Gross | Full Service Gross | Industrial Gross | unknown>",
    "base_rent_rsf_yr": <number or null - annual $/RSF first paid period>,
    "free_rent_months": <number or null>,
    "ti_allowance_rsf": <number or null>,
    "security_deposit": <number or null>,
    "renewal_options_summary": "<string - e.g. '2 x 5 years at FMR' or null>",
    "termination_rights_summary": "<string - e.g. 'None' or 'Tenant kick-out at month 60 with 12 mo notice' or null>"
  },
  "clauses": [
    {
      "type": "<one of the menu keys above>",
      "section": "<string - section number/path as it appears, e.g. '4.2(b)' or 'Article 12 - Defaults'>",
      "heading": "<string - the section heading, max 80 chars>",
      "summary": "<string - 1-3 sentence plain-English summary of what this clause says, max 400 chars>",
      "key_terms": {
        "<flexible map of meaningful values>": "<value>"
      },
      "original_excerpt": "<string - 1-3 sentences quoted verbatim from the lease, max 600 chars. Pick the language that BEST captures the operative obligation. This will be shown to the user.>",
      "risk_level": "<low | medium | high | unknown>",
      "risk_rationale": "<string - 1-2 sentences explaining the risk score from a tenant perspective, max 250 chars. If 'unknown', say why.>"
    }
  ]
}

GUIDELINES:

1) COVERAGE: Extract one clause entry per major lease provision. Aim for 20-40 entries depending on lease length. Combine micro-subsections that belong to the same logical provision (e.g. all of Section 4.2(a)-(d) on operating expenses can be ONE 'opex_passthrough' entry unless they have meaningfully different terms).

2) ORDER: Return clauses in the order they appear in the document. Do not re-sort.

3) KEY TERMS: For each clause, populate 'key_terms' with the 2-6 most important quantitative or factual values. Examples:
   - rent_base: { "year_1_rsf_yr": 56.40, "escalation": "3% annual", "rent_commencement": "2026-08-01" }
   - holdover: { "first_3_months_pct": 150, "thereafter_pct": 200, "consent_required": true }
   - security_deposit: { "amount": 250000, "form": "LOC", "burn_down": "50% after 24 mo of timely payment" }
   - renewal_options: { "count": 2, "length_months": 60, "rent_method": "95% of FMR", "notice_window": "12-9 months prior" }
   Only include keys with real values. Do NOT invent.

4) RISK LEVEL: Score from a TENANT perspective.
   - low: market or tenant-favorable
   - medium: slightly unfavorable but typical / negotiable
   - high: unusual, aggressive, or contains traps (uncapped pass-throughs, broad indemnity, restrictive assignment, bad holdover, etc.)
   - unknown: not enough information in the document to evaluate
   Be generous with 'medium' - reserve 'high' for items that genuinely warrant attention.

5) ORIGINAL_EXCERPT: Must be quoted verbatim. Do not paraphrase. Trim with [...] if you must shorten.

6) MISSING PROVISIONS: If a major provision is absent (no renewal option, no termination right, no opex cap), do NOT fabricate a clause entry. Reflect the absence in document_meta summary fields instead.

7) CONFIDENCE: If you cannot find a value with confidence, return null rather than guessing. The user will see the document_meta on every clause - integrity matters more than completeness.

Return the JSON now.`

// POST /api/lease/extract?id=<lease_doc_id>
// Reads source_url from lease_documents, runs Claude extraction, writes back extraction_json/summary_json.
// Body (optional): { documentText: string }   // for cases where we already have the text
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userEmail = searchParams.get('userEmail') || ''
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getAdminClient()

    // Fetch the lease record
    const { data: leaseDoc, error: fetchErr } = await supabase
      .from('lease_documents')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !leaseDoc) {
      return NextResponse.json({ error: fetchErr?.message || 'Lease not found' }, { status: 404 })
    }

    // Mark as extracting
    await supabase.from('lease_documents').update({ extraction_status: 'extracting', extraction_error: null }).eq('id', id)

    // ---- Source acquisition ----
    let sourceContent: { type: string; data: any } | null = null
    let rawTextForStorage: string | null = null

    const body = await req.json().catch(() => ({}))
    const providedText: string = body.documentText || body.text || ''

    if (providedText && providedText.trim().length > 200) {
      // Path A: text was extracted client-side (e.g. via mammoth for DOCX)
      rawTextForStorage = providedText
      sourceContent = {
        type: 'text',
        data: providedText,
      }
    } else if (leaseDoc.source_url && leaseDoc.source_mime === 'application/pdf') {
      // Path B: PDF in storage - send directly to Claude (Sonnet 4 reads PDFs natively)
      try {
        const pdfRes = await fetch(leaseDoc.source_url)
        if (!pdfRes.ok) throw new Error(`Source URL fetch failed: ${pdfRes.status}`)
        const arrBuf = await pdfRes.arrayBuffer()
        const b64 = Buffer.from(arrBuf).toString('base64')
        sourceContent = {
          type: 'pdf',
          data: b64,
        }
      } catch (e) {
        await supabase.from('lease_documents').update({
          extraction_status: 'error',
          extraction_error: 'Could not fetch source PDF: ' + String(e),
        }).eq('id', id)
        return NextResponse.json({ error: 'Could not fetch source PDF' }, { status: 500 })
      }
    } else {
      await supabase.from('lease_documents').update({
        extraction_status: 'error',
        extraction_error: 'No PDF source URL and no documentText provided. For DOCX, extract text in browser first and pass via documentText.',
      }).eq('id', id)
      return NextResponse.json({ error: 'No source available - upload a PDF or pass documentText' }, { status: 400 })
    }

    // NOTE: Token billing for lease_extract is intentionally omitted in v1.
    // We'll add pricing after we observe real Sonnet 4 cost on production-size leases.
    void userEmail

    // ---- Build the Claude request ----
    const userContent: any[] = []
    if (sourceContent.type === 'pdf') {
      userContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: sourceContent.data,
        },
      })
    } else {
      userContent.push({
        type: 'text',
        text: 'LEASE DOCUMENT TEXT:\n\n' + sourceContent.data,
      })
    }
    userContent.push({ type: 'text', text: EXTRACTION_PROMPT })

    let aiText = ''
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: userContent }],
      })
      aiText = message.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      await supabase.from('lease_documents').update({
        extraction_status: 'error',
        extraction_error: 'AI extraction failed: ' + errMsg,
      }).eq('id', id)
      return NextResponse.json({ error: 'AI extraction failed: ' + errMsg }, { status: 500 })
    }

    // ---- Parse AI output ----
    let parsed: any = null
    try {
      // Strip code fences if present
      const cleaned = aiText.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (e) {
      // Try to find first { ... } block
      const m = aiText.match(/\{[\s\S]*\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { /* fall through */ }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      await supabase.from('lease_documents').update({
        extraction_status: 'error',
        extraction_error: 'Could not parse AI response as JSON',
      }).eq('id', id)
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: aiText.slice(0, 1000) }, { status: 500 })
    }

    // ---- Validate clause type tags ----
    const validTypes = new Set<LeaseClauseType>(LEASE_CLAUSE_TYPES.map(t => t.type))
    const clauses = Array.isArray(parsed.clauses) ? parsed.clauses : []
    for (const c of clauses) {
      if (!c.type || !validTypes.has(c.type)) c.type = 'other'
      if (!['low', 'medium', 'high', 'unknown'].includes(c.risk_level)) c.risk_level = 'unknown'
    }

    // ---- Build summary rollup ----
    const byGroup: Record<string, any> = {}
    for (const c of clauses) {
      const meta = LEASE_CLAUSE_TYPES.find(t => t.type === c.type)
      const group = meta?.group || 'misc'
      if (!byGroup[group]) byGroup[group] = { clauses: [], risk_high_count: 0, risk_medium_count: 0 }
      byGroup[group].clauses.push({ type: c.type, label: meta?.label, section: c.section, risk_level: c.risk_level })
      if (c.risk_level === 'high') byGroup[group].risk_high_count++
      if (c.risk_level === 'medium') byGroup[group].risk_medium_count++
    }
    const topRisks = clauses
      .filter((c: any) => c.risk_level === 'high')
      .map((c: any) => ({
        type: c.type,
        label: LEASE_CLAUSE_TYPES.find(t => t.type === c.type)?.label,
        section: c.section,
        rationale: c.risk_rationale,
      }))

    const summary = {
      by_group: byGroup,
      top_risks: topRisks,
      counts: {
        total_clauses: clauses.length,
        high_risk: clauses.filter((c: any) => c.risk_level === 'high').length,
        medium_risk: clauses.filter((c: any) => c.risk_level === 'medium').length,
        low_risk: clauses.filter((c: any) => c.risk_level === 'low').length,
      },
    }

    // ---- Persist ----
    const { error: updateErr } = await supabase.from('lease_documents').update({
      extraction_json: parsed,
      summary_json: summary,
      raw_text: rawTextForStorage,
      extraction_status: 'done',
      extraction_error: null,
    }).eq('id', id)

    if (updateErr) {
      console.error('Lease extract persist error:', updateErr)
      return NextResponse.json({ error: 'Could not save extraction: ' + updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      lease_doc_id: id,
      document_meta: parsed.document_meta || {},
      clause_count: clauses.length,
      summary,
    })
  } catch (err) {
    console.error('Lease extract handler error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
