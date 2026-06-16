import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'

export const maxDuration = 60

const anthropic = new Anthropic()
const COUNTER_AI_MODEL = 'claude-sonnet-4-6'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

type CounterMode = 'auto' | 'with_instructions' | 'legal_drafter' | 'ai_edit'
const VALID_MODES: CounterMode[] = ['auto', 'with_instructions', 'legal_drafter', 'ai_edit']

// ============================================================
// POST /api/lease/counter-suggest
// Body: {
//   v2Id, clauseType,
//   mode?: 'auto' | 'with_instructions' | 'legal_drafter' | 'ai_edit',
//   instructions?: string,    // user's plain-English directive (required for non-auto modes)
//   currentCounter?: string,  // for ai_edit mode: existing counter to refine
//   userEmail?: string,
// }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      v2Id, clauseType,
      mode = 'auto',
      instructions = '',
      currentCounter = '',
      userEmail,
    } = body

    if (!v2Id || !clauseType) {
      return NextResponse.json({ error: 'v2Id and clauseType required' }, { status: 400 })
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }
    if ((mode === 'with_instructions' || mode === 'legal_drafter' || mode === 'ai_edit') && !instructions.trim()) {
      return NextResponse.json({ error: 'Instructions required for this mode' }, { status: 400 })
    }
    if (mode === 'ai_edit' && !currentCounter.trim()) {
      return NextResponse.json({ error: 'currentCounter required for ai_edit mode' }, { status: 400 })
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

    const clauses = (doc.extraction_json && doc.extraction_json.clauses) || []
    const clause = clauses.find((c: any) => c.type === clauseType)
    if (!clause) {
      return NextResponse.json({ error: `No clause of type "${clauseType}" found in v2 extraction` }, { status: 400 })
    }

    const meta = LEASE_CLAUSE_TYPES.find(t => t.type === clauseType)
    const clauseLabel = meta?.label || clauseType
    const v2Excerpt = clause.original_excerpt || clause.summary || ''
    if (v2Excerpt.length < 30 && mode !== 'ai_edit') {
      return NextResponse.json({ error: 'Clause excerpt too short to counter; manual edit required.' }, { status: 400 })
    }

    // Pull existing notes from negotiations - feeds into AI as additional context
    const { data: existingNeg } = await supabase
      .from('lease_clause_negotiations')
      .select('id, status, notes, counter_language, counter_instructions')
      .eq('project_id', doc.project_id)
      .ilike('building_address', doc.building_address)
      .eq('clause_type', clauseType)
      .maybeSingle()

    const userNotes = (existingNeg && existingNeg.notes) || ''

    // ---- Build the prompt based on mode ----
    const prompt = buildPrompt(mode, {
      clauseLabel,
      clauseDescription: meta?.description || '',
      riskLevel: clause.risk_level || 'unknown',
      riskRationale: clause.risk_rationale || '',
      keyTerms: clause.key_terms || {},
      v2Excerpt,
      instructions: instructions.trim(),
      currentCounter: currentCounter.trim(),
      userNotes: userNotes.trim(),
    })

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

    // ---- Persist ----
    const now = new Date().toISOString()
    const counterSource = mode === 'ai_edit' ? 'ai_edited' : 'ai_generated'

    if (existingNeg) {
      const { error: updErr } = await supabase
        .from('lease_clause_negotiations')
        .update({
          counter_language: parsed.counter_language,
          counter_rationale: parsed.counter_rationale,
          counter_source: counterSource,
          counter_mode: mode,
          counter_instructions: instructions.trim() || null,
          counter_against_v2_id: v2Id,
          counter_against_excerpt: v2Excerpt,
          counter_generated_at: now,
          counter_generated_by: userEmail || null,
          counter_ai_model: COUNTER_AI_MODEL,
          status: existingNeg.status === 'open_issue' ? 'counter_pending' : existingNeg.status,
          last_updated_by: userEmail || null,
        })
        .eq('id', existingNeg.id)
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
          counter_source: counterSource,
          counter_mode: mode,
          counter_instructions: instructions.trim() || null,
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
      counter_source: counterSource,
      counter_mode: mode,
      counter_instructions: instructions.trim() || null,
      counter_ai_model: COUNTER_AI_MODEL,
      counter_generated_at: now,
    })
  } catch (err) {
    console.error('counter-suggest handler error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// PROMPT BUILDERS - one per mode
// ============================================================
interface PromptArgs {
  clauseLabel: string
  clauseDescription: string
  riskLevel: string
  riskRationale: string
  keyTerms: Record<string, any>
  v2Excerpt: string
  instructions: string
  currentCounter: string
  userNotes: string
}

function buildPrompt(mode: CounterMode, a: PromptArgs): string {
  const sharedContext = `CLAUSE: ${a.clauseLabel}
DESCRIPTION: ${a.clauseDescription}
CURRENT RISK LEVEL FROM TENANT PERSPECTIVE: ${a.riskLevel}
CURRENT RISK RATIONALE: ${a.riskRationale}
CURRENT KEY TERMS: ${JSON.stringify(a.keyTerms)}

LANDLORD'S CURRENT LANGUAGE:
"""
${a.v2Excerpt}
"""${a.userNotes ? `

EXISTING NEGOTIATION NOTES FROM THE TENANT TEAM:
"""
${a.userNotes}
"""` : ''}`

  const outputFormat = `\n\nOUTPUT - return ONLY valid JSON with this exact shape:
{
  "counter_language": "<full proposed clause text - or null if no counter needed>",
  "counter_rationale": "<1-3 sentence explanation in plain English. Reference the specific risk and the tenant-favorable position.>"
}`

  if (mode === 'auto') {
    return `You are a senior commercial real estate attorney representing the TENANT. Given the landlord's current language for the "${a.clauseLabel}" clause, propose tenant-favorable counter-language that is realistic, market-standard, and likely to be accepted.

${sharedContext}

INSTRUCTIONS:
1. Write a tenant-friendly counter that addresses the specific risk noted above.
2. Use realistic market positions - aggressive but not absurd. Aim for what an experienced tenant rep would actually propose.
3. Keep the structure and length similar to the landlord version. Make targeted edits, not a rewrite from scratch.
4. Use the same defined-term capitalization style as the landlord (e.g. "Tenant", "Landlord", "Premises").
5. If the clause is genuinely market and unobjectionable, return null for counter_language with a brief rationale explaining no counter is needed.${outputFormat}`
  }

  if (mode === 'with_instructions') {
    return `You are a senior commercial real estate attorney representing the TENANT. The user has specific negotiation goals for the "${a.clauseLabel}" clause. Draft counter language that achieves those goals while remaining realistic and market-defensible.

${sharedContext}

USER'S NEGOTIATION INSTRUCTIONS (FOLLOW THESE):
"""
${a.instructions}
"""

INSTRUCTIONS:
1. PRIMARY: implement the user's directive above. This is what you MUST achieve.
2. Use realistic market positions in the surrounding language - don't break the rest of the clause to chase the user's goal.
3. Keep the structure similar to the landlord version where possible. Make targeted edits.
4. Use the same defined-term capitalization style as the landlord (e.g. "Tenant", "Landlord", "Premises").
5. If the user's directive is impossible without a complete rewrite, do the rewrite - but flag this in counter_rationale.
6. If the user's directive is non-market or could backfire (e.g. "delete this entire clause" when it's protective), still draft what they asked for, but note the concern in counter_rationale.${outputFormat}`
  }

  if (mode === 'legal_drafter') {
    return `You are a senior commercial real estate attorney. The TENANT has plain-English negotiation goals for the "${a.clauseLabel}" clause. Translate those goals into proper legal lease drafting.

${sharedContext}

PLAIN-ENGLISH GOALS FROM THE TENANT:
"""
${a.instructions}
"""

INSTRUCTIONS:
1. Translate the plain-English goals into proper lease language with:
   - Defined terms capitalized (Tenant, Landlord, Premises, Term, etc.) matching the landlord's style
   - Lease-style sentence construction ("Tenant shall..." not "We will...")
   - Cross-references where appropriate ("as set forth in Section X.Y")
   - Conditional language where appropriate ("provided that...", "subject to...")
   - Numerical specifics with both word and digit forms where standard ("six (6) months")
2. Match the structural format of the landlord's clause (numbered sub-sections, defined terms, etc.).
3. The output should look like it was drafted by a real estate attorney, not generated by AI.
4. counter_rationale should explain the legal-drafting choices you made (e.g. "I added 'subject to Tenant's compliance with Section 12' to address the cure period concern").${outputFormat}`
  }

  if (mode === 'ai_edit') {
    return `You are a senior commercial real estate attorney. The TENANT has an existing counter proposal for the "${a.clauseLabel}" clause and wants you to refine it based on new instructions.

${sharedContext}

EXISTING COUNTER PROPOSAL:
"""
${a.currentCounter}
"""

REFINEMENT INSTRUCTIONS:
"""
${a.instructions}
"""

INSTRUCTIONS:
1. Refine the EXISTING counter according to the new instructions. Don't start from scratch.
2. Preserve any tenant-favorable provisions in the existing counter unless explicitly told to remove them.
3. If the refinement instruction conflicts with the existing counter, follow the new instruction but call out the change in counter_rationale.
4. Use the same defined-term style and structure.${outputFormat}`
  }

  // Fallback (shouldn't reach here due to validation)
  return ''
}

// ============================================================
// PATCH /api/lease/counter-suggest
// Body: { project_id, building_address, clause_type, counter_language, counter_rationale?, user_email? }
// Use this for MANUAL edits to existing counter language (no AI involved).
// ============================================================
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const {
      projectId, buildingAddress, clauseType,
      counter_language, counter_rationale, userEmail,
    } = body

    if (!projectId || !buildingAddress || !clauseType) {
      return NextResponse.json({ error: 'projectId, buildingAddress, clauseType required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data: existing } = await supabase
      .from('lease_clause_negotiations')
      .select('id, counter_source, status')
      .eq('project_id', projectId)
      .ilike('building_address', buildingAddress)
      .eq('clause_type', clauseType)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'No existing negotiation row for this clause' }, { status: 404 })
    }

    // If the existing counter was AI-generated and the user is editing it, mark as ai_edited
    // If it was manual, keep manual
    const newSource = existing.counter_source === 'ai_generated' ? 'ai_edited'
      : (existing.counter_source || 'manual')
    const newMode = newSource === 'ai_edited' ? 'manual' : 'manual'  // user has now manually edited

    const updates: Record<string, any> = {
      counter_language: counter_language ?? null,
      counter_source: newSource,
      counter_mode: newMode,
      last_updated_by: userEmail || null,
    }
    if (counter_rationale !== undefined) updates.counter_rationale = counter_rationale

    const { data, error } = await supabase
      .from('lease_clause_negotiations')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/lease/counter-suggest
// Body: { projectId, buildingAddress, clauseType }
// Wipe an existing counter (so the Suggest button shows again).
// ============================================================
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { projectId, buildingAddress, clauseType, userEmail } = body
    if (!projectId || !buildingAddress || !clauseType) {
      return NextResponse.json({ error: 'projectId, buildingAddress, clauseType required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase
      .from('lease_clause_negotiations')
      .update({
        counter_language: null,
        counter_rationale: null,
        counter_source: 'manual',
        counter_mode: null,
        counter_instructions: null,
        counter_against_v2_id: null,
        counter_against_excerpt: null,
        counter_generated_at: null,
        counter_generated_by: null,
        counter_ai_model: null,
        last_updated_by: userEmail || null,
      })
      .eq('project_id', projectId)
      .ilike('building_address', buildingAddress)
      .eq('clause_type', clauseType)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
