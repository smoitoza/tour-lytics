import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'
import { getPortfolioAdminClient, PORTFOLIO_BUCKET } from '@/lib/portfolio/admin'

export const maxDuration = 180

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ASK_PROMPT = `You are an expert commercial real estate lease analyst. The user is reviewing a lease and is asking a question about it. You have been given the full source documents (the executed lease and any amendments) plus a structured abstraction (already-extracted key terms).

GUIDELINES:
1) Answer ONLY from the provided documents and abstraction. Do not invent facts.
2) When you cite something specific, reference the source document by its filename and (if you can see it) the section or paragraph number.
3) If the answer requires interpreting amendments overriding the original lease, walk through the change history briefly.
4) If the documents do not contain the answer, say so plainly. Do not guess.
5) Keep answers concise and practical — bullets where useful, plain prose otherwise. Maximum 400 words unless the question demands depth.
6) When the user asks about money/dates/amounts, prefer the value from the latest amendment over the original lease.

Format your response as plain text (no markdown headers, no JSON). Inline citations are fine, e.g. "(Third Amendment §3.2)".`

type DocRow = {
  id: string
  storage_path: string | null
  original_filename: string
  mime_type: string | null
  document_type: string | null
  effective_date: string | null
}

function sortDocs(docs: DocRow[]): DocRow[] {
  return [...docs].sort((a, b) => {
    if (a.document_type === 'lease' && b.document_type !== 'lease') return -1
    if (b.document_type === 'lease' && a.document_type !== 'lease') return 1
    const da = a.effective_date || ''
    const db = b.effective_date || ''
    return da.localeCompare(db)
  })
}

// POST /api/portfolio/leases/[id]/ask
// Body: { question: string }
// Returns: { answer: string, sources: string[] }
//
// Sends the question to Claude along with all source PDFs and the structured
// abstraction so the model can cite exact lease language.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const question: string = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }
    if (question.length > 1000) {
      return NextResponse.json({ error: 'Question is too long (max 1000 chars)' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const admin = getPortfolioAdminClient()
    const { data: lease, error: leaseErr } = await admin
      .from('portfolio_leases')
      .select('id, company_id, name, currency')
      .eq('id', leaseId)
      .single()
    if (leaseErr || !lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('portfolio_company_members')
      .select('status')
      .eq('company_id', lease.company_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Latest abstraction (optional context — may not exist)
    const { data: abstraction } = await admin
      .from('portfolio_abstractions')
      .select('extracted_fields, confidence_score, status')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Pull PDFs
    const { data: docsRaw } = await admin
      .from('portfolio_documents')
      .select('id, storage_path, original_filename, mime_type, document_type, effective_date')
      .eq('lease_id', leaseId)

    if (!docsRaw || docsRaw.length === 0) {
      return NextResponse.json({ error: 'No documents attached to this lease.' }, { status: 400 })
    }

    const docs = sortDocs(docsRaw as DocRow[])

    type DocPayload = { doc: DocRow; b64: string }
    const docBlocks: DocPayload[] = []
    const skipped: string[] = []

    for (const doc of docs) {
      if (!doc.storage_path || doc.mime_type !== 'application/pdf') {
        skipped.push(doc.original_filename)
        continue
      }
      try {
        const { data: signed } = await admin.storage
          .from(PORTFOLIO_BUCKET)
          .createSignedUrl(doc.storage_path, 300)
        if (!signed?.signedUrl) {
          skipped.push(doc.original_filename)
          continue
        }
        const res = await fetch(signed.signedUrl)
        if (!res.ok) {
          skipped.push(doc.original_filename)
          continue
        }
        const buf = await res.arrayBuffer()
        const b64 = Buffer.from(buf).toString('base64')
        docBlocks.push({ doc, b64 })
      } catch {
        skipped.push(doc.original_filename)
      }
    }

    if (docBlocks.length === 0) {
      return NextResponse.json({ error: 'No PDF documents could be loaded for this question.' }, { status: 400 })
    }

    const userContent: Anthropic.MessageParam['content'] = []
    for (const { b64 } of docBlocks) {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: b64 },
      })
    }

    const manifest = docBlocks
      .map((b, i) => `  ${i + 1}. ${b.doc.original_filename} (${b.doc.document_type || 'unknown'}${b.doc.effective_date ? `, effective ${b.doc.effective_date}` : ''})`)
      .join('\n')

    const abstractionSummary = abstraction?.extracted_fields
      ? JSON.stringify(abstraction.extracted_fields, null, 2).slice(0, 12000)
      : '(no abstraction available yet)'

    userContent.push({
      type: 'text',
      text: `LEASE: ${lease.name}\nCURRENCY: ${lease.currency || 'USD'}\n\nDOCUMENT BUNDLE:\n${manifest}\n\nSTRUCTURED ABSTRACTION (already extracted):\n${abstractionSummary}\n\nUSER QUESTION:\n${question}\n\n${ASK_PROMPT}`,
    })

    let answerText = ''
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: userContent }],
      })
      answerText = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: 'AI query failed: ' + errMsg }, { status: 500 })
    }

    return NextResponse.json({
      answer: answerText.trim(),
      sources: docBlocks.map((b) => ({
        id: b.doc.id,
        filename: b.doc.original_filename,
        type: b.doc.document_type,
      })),
      skipped,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
