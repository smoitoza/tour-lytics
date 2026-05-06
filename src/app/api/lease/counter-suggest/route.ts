import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'

export const maxDuration = 60

const anthropic = new Anthropic()
const COUNTER_AI_MODEL = 'claude-sonnet-4-20250514'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ============================================================
// POST /api/lease/counter-suggest
// Body: { v2Id, clauseType, userEmail? }
// Returns: { counter_language, counter_rationale, counter_source: 'ai_generated' }
//
// Pulls the v2 clause from extraction_json, sends it to Claude with
// negotiation guidance, returns proposed counter text + rationale.
// Persists the counter on lease_clause_negotiations.
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { v2Id, clauseType, userEmail } = body
    if (!v2Id || !clauseType) {
      return NextResponse.json({ error: 'v2Id and clauseType required' }, { status: 400 })
    }

    const validTypes = new Set(LEASE_CLAUSE_TYPES.map(t => t.type))
    if (!validTypes.has(clauseType)) {
      return NextResponse.json({ error: 'Invalid clauseType' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Load v2 doc
    const { data: doc, error: docErr } = await supabase
      .from('lease_documents')
      .select('id, project_id, building_address, version_label, version_number, doc_type, extraction_json')
      .eq('id', v2Id)
      .single()
    if (docErr || !doc) {
      return NextResponse.json({ error: 'Lease document not found' }, { status: 404 })
    }

    // Find the relevant clause in the extraction
    const clauses = (doc.extraction_json && doc.extraction_json.clauses) || []
    const clause = clauses.find((c: any) => c.type === clauseType)
    if (!clause) {
      return NextResponse.json({ error: `No clause of type "${clauseType}" found in v2 extraction` }, { status: 400 })
    }

    const meta = LEASE_CLAUSE_TYPES.find(t => t.type === clauseType)
    const clauseLabel = meta?.label || clauseType
    const v2Excerpt = clause.original_excerpt || clause.summary || ''
    if (v2Excerpt.length < 30) {
      return NextResponse.json({ error: 'Clause excerpt too short to counter; manual edit required.' }, { status: 400 })
    }

    // ---- Build the prompt ----
    const prompt = `You are a senior commercial real estate attorney representing the TENANT. Given the landlord's current language for the "${clauseLabel}" clause, propose tenant-favorable counter-language that is realistic, market-standard, and likely to be accepted.

CLAUSE: ${clauseLabel}
DESCRIPTION: ${meta?.description || ''}
CURRENT RISK LEVEL FROM TENANT PERSPECTIVE: ${clause.risk_level || 'unknown'}
CURRENT RISK RATIONALE: ${clause.risk_rationale || 'n/a'}
CURRENT KEY TERMS: ${JSON.stringify(clause.key_terms || {})}

LANDLORD'S CURRENT LANGUAGE:
"""
${v2Excerpt}
"""

INSTRUCTIONS:
1. Write a tenant-friendly counter that addresses the specific risk noted above.
2. Use realistic market positions - aggressive but not absurd. Aim for what an experienced tenant rep would actually propose.
3. Keep the structure and length similar to the landlord version. Make targeted edits, not a rewrite from scratch.
4. Use the same defined-term capitalization style as the landlord (e.g. "Tenant", "Landlord", "Premises").
5. If the clause is genuinely market and unobjectionable, return null for counter_language with a brief rationale explaining no counter is needed.

OUTPUT - return ONLY valid JSON with this exact shape:
{
  "counter_language": "<full proposed clause text - or null if no counter needed>",
  "counter_rationale": "<1-3 sentence explanation of WHY we're proposing this change. Reference the specific risk and the tenant-favorable position.>"
}`

    // ---- Call Claude ----
    let aiText = ''
    try {
      const message = await anthropic.messages.create({
        model: COUNTER_AI_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
      aiText = message.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim()
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: 'AI generation failed: ' + errMsg }, { status: 500 })
    }

    // ---- Parse ----
    let parsed: { counter_language: string | null; counter_rationale: string } | null = null
    try {
      const cleaned = aiText.replace(/^```(?:json)?\s*/i, '').replace(/```$/m, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (e) {
      const m = aiText.match(/\{[\s\S]*\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { /* fall through */ }
      }
    }
    if (!parsed) {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: aiText.slice(0, 500) }, { status: 500 })
    }

    if (!parsed.counter_language) {
      return NextResponse.json({
        no_counter_needed: true,
        rationale: parsed.counter_rationale || 'AI did not recommend a counter for this clause.',
      })
    }

    // ---- Persist on lease_clause_negotiations (upsert) ----
    const now = new Date().toISOString()
    const { data: existing } = await supabase
      .from('lease_clause_negotiations')
      .select('id, status')
      .eq('project_id', doc.project_id)
      .ilike('building_address', doc.building_address)
      .eq('clause_type', clauseType)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase
        .from('lease_clause_negotiations')
        .update({
          counter_language: parsed.counter_language,
          counter_rationale: parsed.counter_rationale,
          counter_source: 'ai_generated',
          counter_against_v2_id: v2Id,
          counter_against_excerpt: v2Excerpt,
          counter_generated_at: now,
          counter_generated_by: userEmail || null,
          counter_ai_model: COUNTER_AI_MODEL,
          // If still on default 'open_issue', auto-advance to 'counter_pending'
          status: existing.status === 'open_issue' ? 'counter_pending' : existing.status,
          last_updated_by: userEmail || null,
        })
        .eq('id', existing.id)
      if (updErr) console.warn('counter persist update failed:', updErr)
    } else {
      const { error: insErr } = await supabase
        .from('lease_clause_negotiations')
        .insert({
          project_id: doc.project_id,
          building_address: doc.building_address,
          clause_type: clauseType,
          status: 'counter_pending',
          notes: '',
          counter_language: parsed.counter_language,
          counter_rationale: parsed.counter_rationale,
          counter_source: 'ai_generated',
          counter_against_v2_id: v2Id,
          counter_against_excerpt: v2Excerpt,
          counter_generated_at: now,
          counter_generated_by: userEmail || null,
          counter_ai_model: COUNTER_AI_MODEL,
          created_by: userEmail || null,
          last_updated_by: userEmail || null,
        })
      if (insErr) console.warn('counter persist insert failed:', insErr)
    }

    return NextResponse.json({
      counter_language: parsed.counter_language,
      counter_rationale: parsed.counter_rationale,
      counter_source: 'ai_generated',
      counter_ai_model: COUNTER_AI_MODEL,
      counter_generated_at: now,
    })
  } catch (err) {
    console.error('counter-suggest handler error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
