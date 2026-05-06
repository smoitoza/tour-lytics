import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidNegotiationStatus, LEASE_CLAUSE_TYPES } from '@/lib/lease-clause-taxonomy'

export const maxDuration = 30

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

const VALID_CLAUSE_TYPES = new Set(LEASE_CLAUSE_TYPES.map(t => t.type))

// ============================================================
// GET /api/lease/negotiation?projectId=...&buildingAddress=...
// Returns all negotiation statuses for a building, keyed by clause_type.
// Front-end uses this map to populate pills + notes per clause row.
// ============================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const buildingAddress = searchParams.get('buildingAddress')

    if (!projectId || !buildingAddress) {
      return NextResponse.json({ error: 'projectId and buildingAddress required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('lease_clause_negotiations')
      .select('*')
      .eq('project_id', projectId)
      .ilike('building_address', buildingAddress)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return as a map keyed by clause_type for fast lookup
    const map: Record<string, any> = {}
    ;(data || []).forEach((row) => {
      map[row.clause_type] = row
    })
    return NextResponse.json(map)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// POST /api/lease/negotiation
// Upsert a negotiation row. Used for both setting status and saving notes.
// Body: { projectId, buildingAddress, clauseType, status?, notes?, lastCompareId?, userEmail? }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      projectId, buildingAddress, clauseType,
      status, notes, lastCompareId, userEmail,
    } = body

    if (!projectId || !buildingAddress || !clauseType) {
      return NextResponse.json({ error: 'projectId, buildingAddress, clauseType required' }, { status: 400 })
    }

    if (!VALID_CLAUSE_TYPES.has(clauseType)) {
      return NextResponse.json({ error: 'Invalid clauseType' }, { status: 400 })
    }

    if (status !== undefined && !isValidNegotiationStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Look up existing row
    const { data: existing } = await supabase
      .from('lease_clause_negotiations')
      .select('*')
      .eq('project_id', projectId)
      .ilike('building_address', buildingAddress)
      .eq('clause_type', clauseType)
      .maybeSingle()

    if (existing) {
      // Update only the fields that were sent
      const updates: Record<string, any> = { last_updated_by: userEmail || null }
      if (status !== undefined) updates.status = status
      if (notes !== undefined) updates.notes = notes
      if (lastCompareId !== undefined) updates.last_compare_id = lastCompareId

      const { data, error } = await supabase
        .from('lease_clause_negotiations')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    } else {
      // Insert new row
      const insertRow: Record<string, any> = {
        project_id: projectId,
        building_address: buildingAddress,
        clause_type: clauseType,
        status: status || 'open_issue',
        notes: notes || '',
        last_compare_id: lastCompareId || null,
        created_by: userEmail || null,
        last_updated_by: userEmail || null,
      }
      const { data, error } = await supabase
        .from('lease_clause_negotiations')
        .insert(insertRow)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/lease/negotiation?id=<uuid>
// Removes a negotiation entry (rare - usually you'd just set status='not_applicable')
// ============================================================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getAdminClient()
    const { error } = await supabase
      .from('lease_clause_negotiations')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
