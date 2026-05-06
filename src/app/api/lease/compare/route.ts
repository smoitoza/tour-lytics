import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { buildDiff, type CompareResult, type RawClause } from '@/lib/lease-compare'
import { LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'

export const maxDuration = 90

const anthropic = new Anthropic()

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ============================================================
// POST /api/lease/compare
// Body: { v1Id, v2Id, regenerateAi?: boolean }
// Returns: CompareResult { ..., ai_summary }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { v1Id, v2Id, regenerateAi } = body
    if (!v1Id || !v2Id) {
      return NextResponse.json({ error: 'v1Id and v2Id required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data: docs, error } = await supabase
      .from('lease_documents')
      .select('id, version_label, version_number, doc_type, building_address, extraction_json, summary_json')
      .in('id', [v1Id, v2Id])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!docs || docs.length !== 2) {
      return NextResponse.json({ error: 'Both lease documents must exist' }, { status: 404 })
    }

    const v1 = docs.find(d => d.id === v1Id)!
    const v2 = docs.find(d => d.id === v2Id)!
    const v1Clauses: RawClause[] = (v1.extraction_json && v1.extraction_json.clauses) || []
    const v2Clauses: RawClause[] = (v2.extraction_json && v2.extraction_json.clauses) || []

    if (v1Clauses.length === 0 || v2Clauses.length === 0) {
      return NextResponse.json({ error: 'Both versions must have completed extraction before comparison' }, { status: 400 })
    }

    // ---- Cache check: full diff (structural + AI summary) ----
    // Cache key: v2.summary_json.compare_cache[v1Id] = { diff, summary, generated_at }
    const cache = (v2.summary_json && v2.summary_json.compare_cache) || {}
    const cached = cache[v1Id]

    if (!regenerateAi && cached && cached.diff && cached.summary) {
      // Cache hit - return immediately with version metadata stitched in
      const out = { ...cached.diff }
      out.ai_summary = cached.summary
      out.v1_label = v1.version_label || ('v' + v1.version_number)
      out.v2_label = v2.version_label || ('v' + v2.version_number)
      out.v1_doc_type = v1.doc_type
      out.v2_doc_type = v2.doc_type
      out.cached_at = cached.generated_at
      out.from_cache = true
      return NextResponse.json(out)
    }

    // ---- Build the structural diff (fresh) ----
    const diff: CompareResult = buildDiff(
      { id: v1Id, clauses: v1Clauses },
      { id: v2Id, clauses: v2Clauses },
    )

    // Attach version labels for the UI
    ;(diff as any).v1_label = v1.version_label || ('v' + v1.version_number)
    ;(diff as any).v2_label = v2.version_label || ('v' + v2.version_number)
    ;(diff as any).v1_doc_type = v1.doc_type
    ;(diff as any).v2_doc_type = v2.doc_type

    // ---- AI change summary ----
    let aiSummary: string | null = null
    try {
      aiSummary = await generateAiSummary(diff, v1, v2)
    } catch (e) {
      console.warn('AI summary generation failed:', e)
      aiSummary = null
    }

    if (aiSummary) (diff as any).ai_summary = aiSummary

    // ---- Persist full cache (diff + summary) ----
    try {
      const generatedAt = new Date().toISOString()
      const newCache = {
        ...cache,
        [v1Id]: {
          diff: diff,                     // full structural diff
          summary: aiSummary,             // AI text (may be null on failure)
          generated_at: generatedAt,
        },
      }
      const newSummaryJson = { ...(v2.summary_json || {}), compare_cache: newCache }
      await supabase.from('lease_documents').update({ summary_json: newSummaryJson }).eq('id', v2Id)
      ;(diff as any).cached_at = generatedAt
      ;(diff as any).from_cache = false
    } catch (e) {
      console.warn('Cache persist failed:', e)
    }

    return NextResponse.json(diff)
  } catch (err) {
    console.error('Lease compare error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// AI CHANGE SUMMARY
// ============================================================
async function generateAiSummary(diff: CompareResult, v1Doc: any, v2Doc: any): Promise<string> {
  // Build a compact, structured payload to send to Claude
  const changedClauses = diff.clauseDiffs.filter(d => d.status !== 'unchanged').map(d => {
    const meta = LEASE_CLAUSE_TYPES.find(t => t.type === d.type)
    return {
      status: d.status,
      type: d.type,
      label: meta?.label,
      section: d.v1?.section || d.v2?.section || null,
      risk_v1: d.v1?.risk_level || null,
      risk_v2: d.v2?.risk_level || null,
      risk_delta_signed: d.riskDelta || 0,
      v1_summary: d.v1?.summary || null,
      v2_summary: d.v2?.summary || null,
      v1_excerpt: d.v1?.original_excerpt || null,
      v2_excerpt: d.v2?.original_excerpt || null,
      key_term_changes: (d.keyTermsDiff || []).filter(k => k.changed).map(k => ({
        key: k.key, v1: k.v1, v2: k.v2,
      })),
    }
  })

  const v1Label = v1Doc.version_label || ('v' + v1Doc.version_number)
  const v2Label = v2Doc.version_label || ('v' + v2Doc.version_number)
  const v1Type = (v1Doc.doc_type || '').replace('_', ' ')
  const v2Type = (v2Doc.doc_type || '').replace('_', ' ')

  const prompt = `You are a senior commercial real estate attorney. The user is comparing two versions of the same lease for the same premises. Write a concise executive summary of what changed FROM the tenant's perspective.

VERSIONS:
- ${v1Label} (${v1Type}) is the EARLIER version
- ${v2Label} (${v2Type}) is the LATER version

STRUCTURED DIFF (only clauses that changed):
${JSON.stringify(changedClauses, null, 2)}

RISK DELTA:
- Modified clauses where risk got WORSE (higher): ${diff.riskDelta.worse}
- Modified clauses where risk IMPROVED: ${diff.riskDelta.better}
- Net change in number of high-risk clauses: ${diff.riskDelta.net_high_risk_change > 0 ? '+' : ''}${diff.riskDelta.net_high_risk_change}

WRITE the summary as 2-3 short paragraphs of plain English (max ~250 words total). Lead with the headline (did the deal get better, worse, or mixed for the tenant?). Then specifics on the most material changes (use dollar amounts and percentages where the diff has them). Close with the single most important issue to negotiate next.

DO NOT use markdown headers or bullet points. Use natural prose. Reference specific clause types by their label (e.g. "Holdover", "Free Rent / Abatement"). Keep it crisp and executive-ready.

Return ONLY the summary text - no preamble, no JSON.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim()

  return text
}
