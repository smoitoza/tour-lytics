import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildRedlineDocx } from '@/lib/lease-docx'
import { LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'
import { buildDiff, type RawClause } from '@/lib/lease-compare'

export const maxDuration = 60

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ============================================================
// POST /api/lease/export-redline
// Body: { v1Id, v2Id }
// Returns: DOCX file with v1->v2 changes as native Word track changes
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { v1Id, v2Id } = body
    if (!v1Id || !v2Id) {
      return NextResponse.json({ error: 'v1Id and v2Id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Pull both docs + the cached compare (for AI summary)
    const [{ data: docs }, { data: compare }] = await Promise.all([
      supabase
        .from('lease_documents')
        .select('id, version_label, version_number, doc_type, building_address, extraction_json')
        .in('id', [v1Id, v2Id]),
      supabase
        .from('lease_compares')
        .select('diff_json, ai_summary')
        .eq('v1_id', v1Id)
        .eq('v2_id', v2Id)
        .maybeSingle(),
    ])

    if (!docs || docs.length !== 2) {
      return NextResponse.json({ error: 'Both lease documents must exist' }, { status: 404 })
    }
    const v1 = docs.find(d => d.id === v1Id)!
    const v2 = docs.find(d => d.id === v2Id)!

    // Use the cached diff if available, otherwise build fresh
    let diff: any
    if (compare && compare.diff_json) {
      diff = compare.diff_json
    } else {
      const v1Clauses: RawClause[] = (v1.extraction_json && v1.extraction_json.clauses) || []
      const v2Clauses: RawClause[] = (v2.extraction_json && v2.extraction_json.clauses) || []
      diff = buildDiff({ id: v1Id, clauses: v1Clauses }, { id: v2Id, clauses: v2Clauses })
    }

    const clauseDiffsForDocx = (diff.clauseDiffs || []).map((cd: any) => {
      const meta = LEASE_CLAUSE_TYPES.find(t => t.type === cd.type)
      return {
        type: cd.type,
        typeLabel: meta?.label || cd.type,
        status: cd.status,
        v1Section: cd.v1?.section,
        v2Section: cd.v2?.section,
        v1Heading: cd.v1?.heading,
        v2Heading: cd.v2?.heading,
        v1Summary: cd.v1?.summary,
        v2Summary: cd.v2?.summary,
        v1Excerpt: cd.v1?.original_excerpt,
        v2Excerpt: cd.v2?.original_excerpt,
        summaryOps: cd.summaryOps || [],
        excerptOps: cd.excerptOps || [],
        v1Risk: cd.v1?.risk_level,
        v2Risk: cd.v2?.risk_level,
        riskDelta: cd.riskDelta || 0,
      }
    })

    const buffer = await buildRedlineDocx({
      buildingAddress: v2.building_address,
      v1Label: v1.version_label || ('v' + v1.version_number),
      v2Label: v2.version_label || ('v' + v2.version_number),
      v1DocType: (v1.doc_type || '').replace('_', ' '),
      v2DocType: (v2.doc_type || '').replace('_', ' '),
      generatedAt: new Date().toISOString(),
      aiSummary: compare?.ai_summary || null,
      clauseDiffs: clauseDiffsForDocx,
    })

    const fileName = `Lease Redline - ${v1.version_label || 'v1'} vs ${v2.version_label || 'v2'} - ${new Date().toISOString().slice(0, 10)}.docx`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (err) {
    console.error('export-redline error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
