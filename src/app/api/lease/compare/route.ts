import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'
import { buildDiff, type CompareResult, type RawClause } from '@/lib/lease-compare'
import { LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'

export const maxDuration = 90

const anthropic = new Anthropic()

// Bumping these forces all cached compares to regenerate
const AI_MODEL_VERSION = 'claude-sonnet-4-20250514'
const AI_PROMPT_VERSION = 'v1'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// SHA-256 of the canonical JSON form of extraction_json. Used for cache invalidation:
// if a lease is re-extracted, its hash changes and any compare touching it becomes stale.
function hashExtraction(extraction: any): string {
  if (!extraction) return 'empty'
  // Stable JSON: sort keys recursively so the hash is order-independent
  const stable = JSON.stringify(extraction, Object.keys(extraction).sort())
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 32)
}

// ============================================================
// POST /api/lease/compare
// Body: { v1Id, v2Id, regenerateAi?, userEmail? }
// Returns: CompareResult { ..., ai_summary, cached_at, from_cache, is_stale, ... }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { v1Id, v2Id, regenerateAi, userEmail } = body
    if (!v1Id || !v2Id) {
      return NextResponse.json({ error: 'v1Id and v2Id required' }, { status: 400 })
    }
    if (v1Id === v2Id) {
      return NextResponse.json({ error: 'v1Id and v2Id must be different' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Load both lease documents
    const { data: docs, error: fetchErr } = await supabase
      .from('lease_documents')
      .select('id, version_label, version_number, doc_type, project_id, building_address, extraction_json')
      .in('id', [v1Id, v2Id])

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
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

    if (v1.project_id !== v2.project_id) {
      return NextResponse.json({ error: 'Both versions must belong to the same project' }, { status: 400 })
    }

    // Compute current extraction hashes for cache invalidation
    const v1Hash = hashExtraction(v1.extraction_json)
    const v2Hash = hashExtraction(v2.extraction_json)

    // ---- Cache lookup ----
    const { data: existing } = await supabase
      .from('lease_compares')
      .select('*')
      .eq('v1_id', v1Id)
      .eq('v2_id', v2Id)
      .maybeSingle()

    const isStale = existing && (
      existing.v1_extraction_hash !== v1Hash ||
      existing.v2_extraction_hash !== v2Hash ||
      existing.ai_prompt_version !== AI_PROMPT_VERSION
    )

    // CACHE HIT: return existing if not stale and not forcing regen
    if (existing && !isStale && !regenerateAi && existing.diff_json && existing.ai_summary) {
      return NextResponse.json({
        ...(existing.diff_json as object),
        ai_summary: existing.ai_summary,
        v1_label: v1.version_label || ('v' + v1.version_number),
        v2_label: v2.version_label || ('v' + v2.version_number),
        v1_doc_type: v1.doc_type,
        v2_doc_type: v2.doc_type,
        cached_at: existing.last_regenerated_at || existing.generated_at,
        from_cache: true,
        is_stale: false,
        generation_count: existing.generation_count,
        ai_model_version: existing.ai_model_version,
      })
    }

    // ---- Build the structural diff fresh ----
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

    // ---- Persist to lease_compares ----
    try {
      const now = new Date().toISOString()

      if (existing) {
        // Update existing row (regeneration or stale-refresh)
        const { error: updErr } = await supabase
          .from('lease_compares')
          .update({
            diff_json: diff,
            ai_summary: aiSummary,
            v1_extraction_hash: v1Hash,
            v2_extraction_hash: v2Hash,
            last_regenerated_by: userEmail || null,
            last_regenerated_at: now,
            generation_count: (existing.generation_count || 1) + 1,
            ai_model_version: AI_MODEL_VERSION,
            ai_prompt_version: AI_PROMPT_VERSION,
          })
          .eq('id', existing.id)
        if (updErr) console.warn('lease_compares update failed:', updErr)

        ;(diff as any).cached_at = now
        ;(diff as any).from_cache = false
        ;(diff as any).is_stale = false
        ;(diff as any).generation_count = (existing.generation_count || 1) + 1
        ;(diff as any).was_stale = isStale
      } else {
        // Insert new row
        const { error: insErr } = await supabase
          .from('lease_compares')
          .insert({
            v1_id: v1Id,
            v2_id: v2Id,
            project_id: v1.project_id,
            building_address: v1.building_address,
            diff_json: diff,
            ai_summary: aiSummary,
            v1_extraction_hash: v1Hash,
            v2_extraction_hash: v2Hash,
            generated_by: userEmail || null,
            generation_count: 1,
            ai_model_version: AI_MODEL_VERSION,
            ai_prompt_version: AI_PROMPT_VERSION,
          })
        if (insErr) console.warn('lease_compares insert failed:', insErr)

        ;(diff as any).cached_at = now
        ;(diff as any).from_cache = false
        ;(diff as any).is_stale = false
        ;(diff as any).generation_count = 1
      }
      ;(diff as any).ai_model_version = AI_MODEL_VERSION
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
// GET /api/lease/compare?projectId=...&buildingAddress=...
// Returns the recent compares for a building, lightweight (no diff_json).
// Powers a future "Recent comparisons" sidebar.
// ============================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const buildingAddress = searchParams.get('buildingAddress')
    const v1Id = searchParams.get('v1Id')
    const v2Id = searchParams.get('v2Id')

    const supabase = getAdminClient()

    // Single-pair existence check (lightweight, no diff payload)
    if (v1Id && v2Id) {
      const { data, error } = await supabase
        .from('lease_compares')
        .select('id, generated_at, last_regenerated_at, generation_count, ai_model_version, generated_by, last_regenerated_by, v1_extraction_hash, v2_extraction_hash')
        .eq('v1_id', v1Id)
        .eq('v2_id', v2Id)
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || null)
    }

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    let q = supabase
      .from('lease_compares')
      .select('id, v1_id, v2_id, project_id, building_address, generated_at, last_regenerated_at, generation_count, ai_model_version, generated_by, last_regenerated_by')
      .eq('project_id', projectId)
      .order('generated_at', { ascending: false })
      .limit(50)

    if (buildingAddress) q = q.ilike('building_address', buildingAddress)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// AI CHANGE SUMMARY
// ============================================================
async function generateAiSummary(diff: CompareResult, v1Doc: any, v2Doc: any): Promise<string> {
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
    model: AI_MODEL_VERSION,
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
