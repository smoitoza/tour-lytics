import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { buildMergedVersionDocx, getClauseGroup, type MergedClauseForDocx } from '@/lib/lease-docx'
import { LEASE_CLAUSE_TYPES, type LeaseClauseType } from '@/lib/lease-clause-taxonomy'

// 90s ceiling for AI per-clause refresh + DOCX assembly + storage upload
export const maxDuration = 120

const anthropic = new Anthropic()
const AI_REFRESH_MODEL = 'claude-sonnet-4-20250514'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface ClauseOverride {
  // Per-clause overrides from the editor UI
  clause_type: string
  use_text?: string                 // The final text to use (overrides counter or original)
  excluded?: boolean                // If true, force-use v2 original even if a counter exists
}

// ============================================================
// POST /api/lease/save-as-version
// Body:
// {
//   basedOnVersionId,           // v2 lease_documents.id
//   versionLabel,               // e.g. "Tenant Counter v3"
//   docType,                    // e.g. "tenant_redline"
//   userEmail,
//   overrides?: ClauseOverride[],  // Per-clause manual overrides from the editor
//   refreshChangedClauses?: boolean,  // If true, re-extract changed clauses with AI (default: true)
//   showRationaleAnnotations?: boolean,  // Include drafting notes in the DOCX
// }
//
// Returns: { lease_doc_id, source_url, summary }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      basedOnVersionId,
      versionLabel,
      docType = 'tenant_redline',
      userEmail,
      overrides = [],
      refreshChangedClauses = true,
      showRationaleAnnotations = false,
    } = body

    if (!basedOnVersionId) {
      return NextResponse.json({ error: 'basedOnVersionId required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // ---- Load the base version ----
    const { data: baseDoc, error: baseErr } = await supabase
      .from('lease_documents')
      .select('id, project_id, building_address, building_num, version_label, version_number, doc_type, extraction_json')
      .eq('id', basedOnVersionId)
      .single()
    if (baseErr || !baseDoc) {
      return NextResponse.json({ error: 'Base version not found' }, { status: 404 })
    }

    const baseClauses = (baseDoc.extraction_json && baseDoc.extraction_json.clauses) || []
    if (baseClauses.length === 0) {
      return NextResponse.json({ error: 'Base version has no extracted clauses' }, { status: 400 })
    }

    // ---- Load all negotiation rows for this building ----
    const { data: negotiations, error: negErr } = await supabase
      .from('lease_clause_negotiations')
      .select('*')
      .eq('project_id', baseDoc.project_id)
      .ilike('building_address', baseDoc.building_address)
    if (negErr) {
      return NextResponse.json({ error: negErr.message }, { status: 500 })
    }
    const negMap: Record<string, any> = {}
    ;(negotiations || []).forEach((n) => { negMap[n.clause_type] = n })

    const overrideMap: Record<string, ClauseOverride> = {}
    overrides.forEach((o: ClauseOverride) => { overrideMap[o.clause_type] = o })

    // ---- Decide final text per clause ----
    type ClauseDecision = {
      base: any                  // the v2 clause as-is
      finalText: string
      isCountered: boolean
      countersUsed: any | null    // the negotiation row if counter applied
      excluded: boolean           // user explicitly excluded
      overridden: boolean         // user typed custom text in the editor
    }

    const decisions: ClauseDecision[] = baseClauses.map((c: any) => {
      const ov = overrideMap[c.type]
      const neg = negMap[c.type]
      const hasCounter = neg && neg.counter_language && !ov?.excluded && !neg.excluded_from_save

      let finalText = c.original_excerpt || ''
      let isCountered = false
      let countersUsed = null
      let overridden = false

      if (ov?.use_text !== undefined && ov.use_text !== null && !ov.excluded) {
        finalText = ov.use_text
        // If user-typed text matches the counter, this is a countered clause; otherwise it's a manual override
        if (neg && neg.counter_language && ov.use_text.trim() === neg.counter_language.trim()) {
          isCountered = true
          countersUsed = neg
        } else {
          isCountered = ov.use_text.trim() !== (c.original_excerpt || '').trim()
          overridden = true
        }
      } else if (ov?.excluded) {
        finalText = c.original_excerpt || ''
      } else if (hasCounter) {
        finalText = neg.counter_language
        isCountered = true
        countersUsed = neg
      }

      return {
        base: c,
        finalText,
        isCountered,
        countersUsed,
        excluded: !!ov?.excluded,
        overridden,
      }
    })

    const counteredCount = decisions.filter(d => d.isCountered).length
    const excludedCount = decisions.filter(d => d.excluded && negMap[d.base.type]?.counter_language).length
    if (counteredCount === 0 && !overrideMap.length) {
      return NextResponse.json({ error: 'No counters or overrides to save. Generate at least one counter or edit a clause first.' }, { status: 400 })
    }

    // ---- Per-clause AI refresh (Option C) ----
    // For each countered clause, do a small Sonnet pass to update summary, key_terms, and risk_level
    // based on the new language. This keeps v3's metadata accurate without a full re-extraction.
    const aiRefreshedTypes: string[] = []
    if (refreshChangedClauses) {
      const changedDecisions = decisions.filter(d => d.isCountered)
      // Run them in parallel but with a max concurrency of 4 to stay polite to the API
      const concurrency = 4
      for (let i = 0; i < changedDecisions.length; i += concurrency) {
        const batch = changedDecisions.slice(i, i + concurrency)
        await Promise.all(batch.map(async (d) => {
          try {
            const refreshed = await refreshClauseFields(d.base, d.finalText)
            if (refreshed) {
              d.base = { ...d.base, ...refreshed, original_excerpt: d.finalText }
              aiRefreshedTypes.push(d.base.type)
            } else {
              d.base = { ...d.base, original_excerpt: d.finalText }
            }
          } catch (e) {
            // Don't fail the whole save just because one clause refresh failed
            console.warn('AI refresh failed for clause', d.base.type, e)
            d.base = { ...d.base, original_excerpt: d.finalText }
          }
        }))
      }
    } else {
      // Without refresh, just substitute the text
      for (const d of decisions) {
        if (d.isCountered) d.base = { ...d.base, original_excerpt: d.finalText }
      }
    }

    // ---- Build the merged extraction_json ----
    const mergedClauses = decisions.map(d => d.base)
    const mergedExtractionJson = {
      ...(baseDoc.extraction_json || {}),
      clauses: mergedClauses,
    }

    // ---- Compute next version_number ----
    const { data: versionData } = await supabase
      .rpc('lease_next_version_number', {
        p_project_id: baseDoc.project_id,
        p_building_address: baseDoc.building_address,
      })
    const nextVersion = versionData ?? (baseDoc.version_number || 1) + 1
    const finalVersionLabel = versionLabel || `v${nextVersion} (Tenant Counter)`
    const docName = `${finalVersionLabel} - ${baseDoc.building_address}`

    // ---- Generate the DOCX ----
    const mergedDocxClauses: MergedClauseForDocx[] = decisions.map(d => {
      const meta = getClauseGroup(d.base.type)
      return {
        type: d.base.type,
        typeLabel: meta.typeLabel,
        group: meta.group,
        groupLabel: meta.groupLabel,
        section: d.base.section,
        heading: d.base.heading,
        text: d.finalText,
        isCountered: d.isCountered,
        counter_rationale: d.countersUsed?.counter_rationale || undefined,
      }
    })

    let sourceUrl: string | null = null
    let storagePath: string | null = null
    try {
      const docxBuffer = await buildMergedVersionDocx({
        buildingAddress: baseDoc.building_address,
        versionLabel: finalVersionLabel,
        basedOnLabel: `${baseDoc.version_label || ('v' + baseDoc.version_number)} - ${baseDoc.doc_type || ''}`.trim(),
        generatedAt: new Date().toISOString(),
        clauses: mergedDocxClauses,
        showRationaleAnnotations: !!showRationaleAnnotations,
      })

      // Upload to storage
      const timestamp = Date.now()
      const safeBuilding = (baseDoc.building_address || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
      const safeName = finalVersionLabel.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
      storagePath = `leases/${baseDoc.project_id}/${safeBuilding}/${timestamp}-${safeName}.docx`

      const { error: uploadErr } = await supabase.storage
        .from('tour-photos')
        .upload(storagePath, docxBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        })
      if (uploadErr) {
        console.warn('DOCX upload failed:', uploadErr)
      } else {
        const { data: urlData } = supabase.storage.from('tour-photos').getPublicUrl(storagePath)
        sourceUrl = urlData.publicUrl
      }
    } catch (e) {
      console.warn('DOCX generation failed (proceeding without source file):', e)
    }

    // ---- Build summary_json (executive overview of v3) ----
    const summary = buildSummaryJson(mergedClauses)

    // ---- Insert v3 lease_documents row ----
    const generatedAtIso = new Date().toISOString()
    const generationMetadata = {
      based_on_version_id: basedOnVersionId,
      based_on_version_label: baseDoc.version_label,
      counter_count: counteredCount,
      excluded_count: excludedCount,
      ai_refreshed_clause_types: aiRefreshedTypes,
      generated_at: generatedAtIso,
      generated_by: userEmail || null,
      ai_refresh_model: AI_REFRESH_MODEL,
    }

    const { data: newDoc, error: insertErr } = await supabase
      .from('lease_documents')
      .insert({
        project_id: baseDoc.project_id,
        building_num: baseDoc.building_num,
        building_address: baseDoc.building_address,
        version_number: nextVersion,
        version_label: finalVersionLabel,
        parent_version_id: basedOnVersionId,
        doc_type: docType,
        doc_name: docName,
        source_url: sourceUrl,
        source_path: storagePath,
        source_filename: sourceUrl ? `${finalVersionLabel}.docx` : null,
        source_mime: sourceUrl ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null,
        raw_text: null,
        extraction_json: mergedExtractionJson,
        summary_json: summary,
        extraction_status: 'done',
        status: 'draft',
        uploaded_by: userEmail || 'system',
        notes: `Auto-generated from ${counteredCount} counter${counteredCount !== 1 ? 's' : ''}.`,
        based_on_version_id: basedOnVersionId,
        generation_method: 'merged_counters',
        merged_counter_count: counteredCount,
        merged_excluded_count: excludedCount,
        generation_metadata: generationMetadata,
      })
      .select('*')
      .single()

    if (insertErr || !newDoc) {
      console.error('Insert v3 failed:', insertErr)
      return NextResponse.json({ error: 'Could not save new version: ' + (insertErr?.message || 'unknown error') }, { status: 500 })
    }

    // ---- Mark promoted negotiations ----
    const promotedTypes = decisions.filter(d => d.isCountered && d.countersUsed).map(d => d.base.type)
    if (promotedTypes.length > 0) {
      await supabase
        .from('lease_clause_negotiations')
        .update({
          promoted_to_version_id: newDoc.id,
          promoted_at: generatedAtIso,
          promoted_by: userEmail || null,
        })
        .eq('project_id', baseDoc.project_id)
        .ilike('building_address', baseDoc.building_address)
        .in('clause_type', promotedTypes)
    }

    // Touch project so it bubbles to top of dashboard
    try {
      await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', baseDoc.project_id)
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      lease_doc_id: newDoc.id,
      source_url: sourceUrl,
      version_label: finalVersionLabel,
      version_number: nextVersion,
      counter_count: counteredCount,
      excluded_count: excludedCount,
      ai_refreshed_count: aiRefreshedTypes.length,
      summary,
    })
  } catch (err) {
    console.error('save-as-version error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// PER-CLAUSE AI REFRESH
// ============================================================
// Re-extract summary, key_terms, risk_level for ONE clause based on its
// new (countered) language. Does NOT change the type/section/heading.
async function refreshClauseFields(originalClause: any, newText: string): Promise<Partial<any> | null> {
  const prompt = `You are a senior commercial real estate attorney. The text of one lease clause has been edited (a tenant-favorable counter was substituted in). Re-evaluate the clause from a TENANT perspective and return updated metadata.

CLAUSE TYPE: ${originalClause.type}
SECTION: ${originalClause.section || ''}
HEADING: ${originalClause.heading || ''}

NEW LANGUAGE:
"""
${newText}
"""

PREVIOUSLY (for context only - do not return these as-is):
- Old summary: ${originalClause.summary || '(none)'}
- Old key_terms: ${JSON.stringify(originalClause.key_terms || {})}
- Old risk_level: ${originalClause.risk_level || 'unknown'}

OUTPUT - return ONLY valid JSON with this exact shape:
{
  "summary": "<1-3 sentence plain-English summary of the new language, max 400 chars>",
  "key_terms": { /* updated key/value map of the most important quantitative or factual values */ },
  "risk_level": "<low | medium | high | unknown>",
  "risk_rationale": "<1-2 sentences from a tenant perspective, max 250 chars>"
}`

  try {
    const message = await anthropic.messages.create({
      model: AI_REFRESH_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()

    let parsed: any = null
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/m, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (e) {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { /* fall through */ }
      }
    }
    if (!parsed) return null

    const validRisk = ['low', 'medium', 'high', 'unknown']
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : originalClause.summary,
      key_terms: typeof parsed.key_terms === 'object' && parsed.key_terms !== null ? parsed.key_terms : originalClause.key_terms,
      risk_level: validRisk.includes(parsed.risk_level) ? parsed.risk_level : originalClause.risk_level,
      risk_rationale: typeof parsed.risk_rationale === 'string' ? parsed.risk_rationale : originalClause.risk_rationale,
    }
  } catch (e) {
    return null
  }
}

// Build summary_json compatible with the existing summary view structure
function buildSummaryJson(clauses: any[]) {
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

  return {
    by_group: byGroup,
    top_risks: topRisks,
    counts: {
      total_clauses: clauses.length,
      high_risk: clauses.filter((c: any) => c.risk_level === 'high').length,
      medium_risk: clauses.filter((c: any) => c.risk_level === 'medium').length,
      low_risk: clauses.filter((c: any) => c.risk_level === 'low').length,
    },
  }
}
