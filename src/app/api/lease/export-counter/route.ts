import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildCounterDocx, type CounterProposalForDocx } from '@/lib/lease-docx'
import { LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'

export const maxDuration = 30

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ============================================================
// POST /api/lease/export-counter
// Body: { v2Id }
// Pulls ALL clauses with counter_language for the same building from
// lease_clause_negotiations and emits a track-changes DOCX with each
// counter as a tenant proposal against v2's current language.
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { v2Id } = body
    if (!v2Id) return NextResponse.json({ error: 'v2Id required' }, { status: 400 })

    const supabase = getAdminClient()

    const { data: doc, error: docErr } = await supabase
      .from('lease_documents')
      .select('id, project_id, building_address, version_label, version_number, doc_type, extraction_json')
      .eq('id', v2Id)
      .single()
    if (docErr || !doc) {
      return NextResponse.json({ error: 'Lease document not found' }, { status: 404 })
    }

    const { data: negotiations, error: negErr } = await supabase
      .from('lease_clause_negotiations')
      .select('*')
      .eq('project_id', doc.project_id)
      .ilike('building_address', doc.building_address)
      .not('counter_language', 'is', null)

    if (negErr) {
      return NextResponse.json({ error: negErr.message }, { status: 500 })
    }

    if (!negotiations || negotiations.length === 0) {
      return NextResponse.json({ error: 'No counter proposals exist for this building. Click "Suggest Counter" on a clause first.' }, { status: 400 })
    }

    const clauses = (doc.extraction_json && doc.extraction_json.clauses) || []

    const proposals: CounterProposalForDocx[] = negotiations
      .map((n: any) => {
        const meta = LEASE_CLAUSE_TYPES.find(t => t.type === n.clause_type)
        const clause = clauses.find((c: any) => c.type === n.clause_type)
        // Prefer the snapshot we took when generating the counter (handles re-extraction)
        const v2Excerpt = n.counter_against_excerpt || (clause && clause.original_excerpt) || ''
        if (!v2Excerpt || !n.counter_language) return null
        return {
          type: n.clause_type,
          typeLabel: meta?.label || n.clause_type,
          v2Section: clause?.section,
          v2Heading: clause?.heading,
          v2Excerpt: v2Excerpt,
          proposed_excerpt: n.counter_language,
          rationale: n.counter_rationale || '',
          ai_generated: n.counter_source === 'ai_generated' || n.counter_source === 'ai_edited',
        }
      })
      .filter(Boolean) as CounterProposalForDocx[]

    if (proposals.length === 0) {
      return NextResponse.json({ error: 'No actionable counter proposals found.' }, { status: 400 })
    }

    const buffer = await buildCounterDocx({
      buildingAddress: doc.building_address,
      v2Label: doc.version_label || ('v' + doc.version_number),
      v2DocType: (doc.doc_type || '').replace('_', ' '),
      generatedAt: new Date().toISOString(),
      proposals,
    })

    const fileName = `Tenant Counter - ${doc.version_label || 'v' + doc.version_number} - ${new Date().toISOString().slice(0, 10)}.docx`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (err) {
    console.error('export-counter error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
