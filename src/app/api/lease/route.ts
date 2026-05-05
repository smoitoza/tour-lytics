import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 60s ceiling for any long-running ops (e.g. status updates that touch summary refresh)
export const maxDuration = 60

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service config')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ============================================================
// GET /api/lease
//   ?projectId=...           -> all lease docs for project
//   &buildingNum=...         -> filter by building num
//   &buildingAddress=...     -> filter by address (case-insensitive)
//   &id=<uuid>               -> single record
// ============================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const projectId = searchParams.get('projectId')
    const buildingNum = searchParams.get('buildingNum')
    const buildingAddress = searchParams.get('buildingAddress')

    const supabase = getAdminClient()

    if (id) {
      const { data, error } = await supabase
        .from('lease_documents')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json(data)
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    let query = supabase
      .from('lease_documents')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'archived')
      .order('version_number', { ascending: false })

    if (buildingNum) query = query.eq('building_num', parseInt(buildingNum))
    if (buildingAddress) query = query.ilike('building_address', buildingAddress)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// POST /api/lease
// Create a new lease_documents record after the file has been uploaded
// to storage. Allocates the next version_number for this building.
//
// Body:
// {
//   projectId, buildingNum, buildingAddress,
//   docType, docName, versionLabel,
//   sourceUrl, sourcePath, sourceFilename, sourceMime,
//   uploadedBy, parentVersionId?
// }
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      projectId,
      buildingNum,
      buildingAddress,
      docType = 'initial_draft',
      docName,
      versionLabel,
      sourceUrl,
      sourcePath,
      sourceFilename,
      sourceMime,
      uploadedBy,
      parentVersionId,
      notes = '',
    } = body

    if (!projectId || !buildingAddress || !uploadedBy) {
      return NextResponse.json({ error: 'projectId, buildingAddress, and uploadedBy are required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Allocate next version number for this building
    const { data: versionData, error: versionErr } = await supabase
      .rpc('lease_next_version_number', {
        p_project_id: projectId,
        p_building_address: buildingAddress,
      })

    if (versionErr) {
      console.error('lease_next_version_number error:', versionErr)
    }
    const nextVersion = versionData ?? 1

    const finalVersionLabel = versionLabel || `v${nextVersion}`
    const finalDocName = docName || `Lease ${finalVersionLabel} - ${buildingAddress}`

    const { data, error } = await supabase
      .from('lease_documents')
      .insert({
        project_id: projectId,
        building_num: buildingNum ?? null,
        building_address: buildingAddress,
        version_number: nextVersion,
        version_label: finalVersionLabel,
        parent_version_id: parentVersionId ?? null,
        doc_type: docType,
        doc_name: finalDocName,
        source_url: sourceUrl ?? null,
        source_path: sourcePath ?? null,
        source_filename: sourceFilename ?? null,
        source_mime: sourceMime ?? null,
        uploaded_by: uploadedBy,
        notes,
        status: 'draft',
        extraction_status: 'pending',
      })
      .select('*')
      .single()

    if (error) {
      console.error('lease insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Touch project so it sorts to top of dashboard
    try {
      await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
    } catch { /* non-critical */ }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// PATCH /api/lease?id=<uuid>
// Update mutable fields (label, doc_type, status, notes, extraction_json/summary_json)
// ============================================================
export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const allowed: Record<string, any> = {}
    const updatable = [
      'version_label', 'doc_type', 'doc_name', 'status', 'notes',
      'extraction_json', 'summary_json', 'extraction_status', 'extraction_error',
      'raw_text',
    ]
    for (const key of updatable) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('lease_documents')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/lease?id=<uuid>
// Soft-delete (status = 'archived'). Optionally hard-delete the storage file.
// ============================================================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getAdminClient()
    const { error } = await supabase
      .from('lease_documents')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
