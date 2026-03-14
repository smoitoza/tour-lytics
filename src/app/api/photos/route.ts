import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - list photos for a building (or all photos for a project)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'sf-office-search'
  const buildingType = searchParams.get('buildingType')
  const buildingId = searchParams.get('buildingId')

  let query = supabase
    .from('building_photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (buildingType && buildingId) {
    query = query
      .eq('building_type', buildingType)
      .eq('building_id', parseInt(buildingId))
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST - upload a photo
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const projectId = (formData.get('projectId') as string) || 'sf-office-search'
    const buildingType = formData.get('buildingType') as string
    const buildingId = formData.get('buildingId') as string
    const buildingName = formData.get('buildingName') as string
    const buildingAddress = (formData.get('buildingAddress') as string) || ''
    const areaTag = (formData.get('areaTag') as string) || 'general'
    const uploadedBy = formData.get('uploadedBy') as string

    if (!file || !buildingType || !buildingId || !buildingName || !uploadedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: file, buildingType, buildingId, buildingName, uploadedBy' },
        { status: 400 }
      )
    }

    // Generate unique file path
    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${projectId}/${buildingType}-${buildingId}/${timestamp}-${safeName}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('tour-photos')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('tour-photos')
      .getPublicUrl(storagePath)

    const fileUrl = urlData.publicUrl

    // Insert record into building_photos table
    const { data: photoRecord, error: dbError } = await supabase
      .from('building_photos')
      .insert({
        project_id: projectId,
        building_type: buildingType,
        building_id: parseInt(buildingId),
        building_name: buildingName,
        building_address: buildingAddress,
        area_tag: areaTag,
        uploaded_by: uploadedBy,
        file_name: file.name,
        file_path: storagePath,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type || 'image/jpeg',
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      // Try to clean up the uploaded file
      await supabase.storage.from('tour-photos').remove([storagePath])
      return NextResponse.json({ error: 'Database error: ' + dbError.message }, { status: 500 })
    }

    // Trigger async AI analysis (fire and forget)
    try {
      const analyzeUrl = new URL('/api/photos/analyze', req.url)
      fetch(analyzeUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photoRecord.id }),
      }).catch(err => console.error('Analyze trigger failed:', err))
    } catch (e) {
      console.error('Failed to trigger analysis:', e)
    }

    return NextResponse.json(photoRecord, { status: 201 })
  } catch (err) {
    console.error('Photo upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE - remove a photo
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const photoId = searchParams.get('photoId')
  const uploadedBy = searchParams.get('uploadedBy')

  if (!photoId) {
    return NextResponse.json({ error: 'photoId required' }, { status: 400 })
  }

  // Get the photo record first
  const { data: photo, error: fetchErr } = await supabase
    .from('building_photos')
    .select('*')
    .eq('id', photoId)
    .single()

  if (fetchErr || !photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  // Only the uploader or admin can delete
  const ADMIN_EMAIL = 'samoitoza@gmail.com'
  if (photo.uploaded_by !== uploadedBy && uploadedBy !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized to delete this photo' }, { status: 403 })
  }

  // Delete from storage
  await supabase.storage.from('tour-photos').remove([photo.file_path])

  // Delete from database
  const { error: deleteErr } = await supabase
    .from('building_photos')
    .delete()
    .eq('id', photoId)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
