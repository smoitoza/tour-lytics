// ============================================================
// LEASE DOCX BUILDER
// ============================================================
// Hand-rolled OOXML for proper Microsoft Word track changes.
// Why not the `docx` npm library? It doesn't expose custom <w:ins>/<w:del>
// runs cleanly and we need full control over revision IDs and authoring.
//
// All three export types share this builder:
//   - buildRedlineDocx()    -> v1->v2 track changes (LL as author)
//   - buildCounterDocx()    -> tenant counter proposals as track changes (tenant as author)
//   - buildMemoDocx()       -> negotiation memo (no track changes, regular doc)
// ============================================================

import JSZip from 'jszip'
import type { DiffOp } from './lease-compare'

export type DocxAuthor = 'tenant' | 'landlord' | 'system'

const AUTHOR_DISPLAY: Record<DocxAuthor, string> = {
  tenant: 'Tenant',
  landlord: 'Landlord',
  system: 'TourLytics',
}

// ============================================================
// XML escaping
// ============================================================
function xml(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Preserve consecutive whitespace inside a w:t element by adding xml:space="preserve"
function wText(s: string): string {
  if (!s) return ''
  return `<w:t xml:space="preserve">${xml(s)}</w:t>`
}

// ============================================================
// CORE BUILDING BLOCKS
// ============================================================

interface RunOpts {
  bold?: boolean
  italic?: boolean
  size?: number          // half-points (e.g. 22 = 11pt)
  color?: string         // hex without #
  highlight?: 'yellow' | 'green' | 'red' | 'cyan' | 'magenta' | null
}

function runProps(opts: RunOpts = {}): string {
  const parts: string[] = []
  if (opts.bold) parts.push('<w:b/>')
  if (opts.italic) parts.push('<w:i/>')
  if (opts.size) parts.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`)
  if (opts.color) parts.push(`<w:color w:val="${opts.color}"/>`)
  if (opts.highlight) parts.push(`<w:highlight w:val="${opts.highlight}"/>`)
  return parts.length ? `<w:rPr>${parts.join('')}</w:rPr>` : ''
}

// Plain text run (no track changes)
function plainRun(text: string, opts: RunOpts = {}): string {
  if (!text) return ''
  return `<w:r>${runProps(opts)}${wText(text)}</w:r>`
}

// Insertion run (track changes - shows as inserted text)
let revisionCounter = 1000
function nextRevId(): number {
  return revisionCounter++
}

function insRun(text: string, author: DocxAuthor, dateIso: string, opts: RunOpts = {}): string {
  if (!text) return ''
  const id = nextRevId()
  const authorAttr = xml(AUTHOR_DISPLAY[author])
  return `<w:ins w:id="${id}" w:author="${authorAttr}" w:date="${xml(dateIso)}"><w:r>${runProps(opts)}${wText(text)}</w:r></w:ins>`
}

// Deletion run (track changes - shows as deleted text)
function delRun(text: string, author: DocxAuthor, dateIso: string, opts: RunOpts = {}): string {
  if (!text) return ''
  const id = nextRevId()
  const authorAttr = xml(AUTHOR_DISPLAY[author])
  // <w:del> wraps a run that uses <w:delText> instead of <w:t>
  const delText = `<w:delText xml:space="preserve">${xml(text)}</w:delText>`
  return `<w:del w:id="${id}" w:author="${authorAttr}" w:date="${xml(dateIso)}"><w:r>${runProps(opts)}${delText}</w:r></w:del>`
}

// Convert a diff-op stream into runs (eq -> plain, ins -> ins, del -> del)
function opsToRuns(ops: DiffOp[], author: DocxAuthor, dateIso: string): string {
  return ops.map(op => {
    if (op.op === 'eq') return plainRun(op.text)
    if (op.op === 'ins') return insRun(op.text, author, dateIso)
    return delRun(op.text, author, dateIso)
  }).join('')
}

// Paragraph helpers
function para(content: string, opts: { style?: string; align?: 'left' | 'center' | 'right'; indent?: number; spacingAfter?: number } = {}): string {
  const props: string[] = []
  if (opts.style) props.push(`<w:pStyle w:val="${opts.style}"/>`)
  if (opts.align) props.push(`<w:jc w:val="${opts.align}"/>`)
  if (opts.indent) props.push(`<w:ind w:left="${opts.indent}"/>`)
  if (opts.spacingAfter !== undefined) props.push(`<w:spacing w:after="${opts.spacingAfter}"/>`)
  const pPr = props.length ? `<w:pPr>${props.join('')}</w:pPr>` : ''
  return `<w:p>${pPr}${content}</w:p>`
}

function heading(text: string, level: 1 | 2 | 3): string {
  const sizes = { 1: 36, 2: 28, 3: 24 }   // half-points
  return para(plainRun(text, { bold: true, size: sizes[level] }), { spacingAfter: 120 })
}

function divider(): string {
  // Empty paragraph with bottom border
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr></w:pPr></w:p>`
}

// Emit a single paragraph that contains a sequence of mixed runs (use for inline diff lines)
function paraWithRuns(...runs: string[]): string {
  return `<w:p>${runs.join('')}</w:p>`
}

// ============================================================
// DOCX SHELL ASSEMBLY
// ============================================================
// A DOCX is a ZIP with this structure (minimum viable):
//   [Content_Types].xml
//   _rels/.rels
//   word/document.xml
//   word/styles.xml
//   word/_rels/document.xml.rels
// ============================================================

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
</w:styles>`

// settings.xml turns on the track-changes display (so reviewers see redlines on open)
const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:trackRevisions/>
  <w:rsids><w:rsidRoot w:val="00000000"/></w:rsids>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`

function documentXml(bodyContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

async function assembleDocx(bodyContent: string): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
  zip.file('_rels/.rels', RELS_XML)
  zip.file('word/document.xml', documentXml(bodyContent))
  zip.file('word/styles.xml', STYLES_XML)
  zip.file('word/settings.xml', SETTINGS_XML)
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS_XML)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

// ============================================================
// PUBLIC: REDLINE DOCX (v1 -> v2 with landlord-style track changes)
// ============================================================
// For each modified clause, we emit:
//   - heading + section badge
//   - summary diff as track-changed runs
//   - original_excerpt diff (the lease language) as track-changed runs
//
// For added/removed clauses, we emit a full insertion or deletion block.

interface ClauseDiffForDocx {
  type: string
  typeLabel: string
  status: 'unchanged' | 'modified' | 'added' | 'removed'
  v1Section?: string
  v2Section?: string
  v1Heading?: string
  v2Heading?: string
  v1Summary?: string
  v2Summary?: string
  v1Excerpt?: string
  v2Excerpt?: string
  summaryOps?: DiffOp[]
  excerptOps?: DiffOp[]
  v1Risk?: string
  v2Risk?: string
  riskDelta?: number
}

export interface RedlineDocxInput {
  buildingAddress: string
  v1Label: string
  v2Label: string
  v1DocType: string
  v2DocType: string
  generatedAt: string  // ISO
  aiSummary?: string | null
  clauseDiffs: ClauseDiffForDocx[]
}

export async function buildRedlineDocx(input: RedlineDocxInput): Promise<Buffer> {
  const dateIso = input.generatedAt
  const author: DocxAuthor = 'landlord' // these are LL changes against the prior draft
  const blocks: string[] = []

  blocks.push(heading('Lease Redline: Tracked Changes', 1))
  blocks.push(para(plainRun(`${input.buildingAddress}`, { size: 22, color: '475569' })))
  blocks.push(para(plainRun(`${input.v1Label} (${input.v1DocType}) → ${input.v2Label} (${input.v2DocType})`, { size: 20, color: '64748b' })))
  blocks.push(para(plainRun(`Generated ${new Date(input.generatedAt).toLocaleString()}`, { size: 18, color: '94a3b8', italic: true })))
  blocks.push(divider())

  if (input.aiSummary) {
    blocks.push(heading('AI Change Summary', 2))
    input.aiSummary.split(/\n\n+/).forEach(p => {
      blocks.push(para(plainRun(p)))
    })
    blocks.push(divider())
  }

  blocks.push(heading('Clause-by-Clause Redline', 2))

  for (const cd of input.clauseDiffs) {
    if (cd.status === 'unchanged') continue

    // Clause heading
    const sectionLabel = cd.v2Section || cd.v1Section
    const titleText = sectionLabel ? `${cd.typeLabel} - ${sectionLabel}` : cd.typeLabel
    blocks.push(heading(titleText, 3))

    if (cd.status === 'added') {
      blocks.push(paraWithRuns(insRun(`[ADDED] `, author, dateIso, { bold: true })))
      if (cd.v2Heading) blocks.push(paraWithRuns(insRun(cd.v2Heading, author, dateIso, { bold: true })))
      if (cd.v2Summary) blocks.push(paraWithRuns(insRun(cd.v2Summary, author, dateIso)))
      if (cd.v2Excerpt) {
        blocks.push(para(plainRun('Source language:', { italic: true, color: '64748b' })))
        blocks.push(paraWithRuns(insRun(cd.v2Excerpt, author, dateIso, { italic: true })))
      }
    } else if (cd.status === 'removed') {
      blocks.push(paraWithRuns(delRun(`[REMOVED] `, author, dateIso, { bold: true })))
      if (cd.v1Heading) blocks.push(paraWithRuns(delRun(cd.v1Heading, author, dateIso, { bold: true })))
      if (cd.v1Summary) blocks.push(paraWithRuns(delRun(cd.v1Summary, author, dateIso)))
      if (cd.v1Excerpt) {
        blocks.push(para(plainRun('Original source language:', { italic: true, color: '64748b' })))
        blocks.push(paraWithRuns(delRun(cd.v1Excerpt, author, dateIso, { italic: true })))
      }
    } else {
      // Modified
      if (cd.v1Heading || cd.v2Heading) {
        if ((cd.v1Heading || '') === (cd.v2Heading || '')) {
          blocks.push(paraWithRuns(plainRun(cd.v2Heading || '', { bold: true })))
        } else {
          blocks.push(paraWithRuns(
            delRun(cd.v1Heading || '', author, dateIso, { bold: true }),
            insRun(cd.v2Heading || '', author, dateIso, { bold: true }),
          ))
        }
      }
      // Summary diff
      if (cd.summaryOps && cd.summaryOps.length > 0) {
        blocks.push(para(plainRun('Summary:', { italic: true, color: '64748b', size: 18 })))
        blocks.push(`<w:p>${opsToRuns(cd.summaryOps, author, dateIso)}</w:p>`)
      }
      // Excerpt diff (the actual lease language)
      if (cd.excerptOps && cd.excerptOps.length > 0) {
        blocks.push(para(plainRun('Source language:', { italic: true, color: '64748b', size: 18 })))
        blocks.push(`<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/></w:pPr></w:pPr>${opsToRuns(cd.excerptOps, author, dateIso)}</w:p>`)
      }
      // Risk movement note (plain text, not redlined)
      if (cd.riskDelta && cd.riskDelta !== 0) {
        const verb = cd.riskDelta > 0 ? 'increased' : 'decreased'
        const color = cd.riskDelta > 0 ? 'B91C1C' : '15803D'
        blocks.push(para(plainRun(`Risk ${verb}: ${cd.v1Risk || '-'} -> ${cd.v2Risk || '-'}`, { italic: true, color, size: 18 })))
      }
    }

    blocks.push(divider())
  }

  return assembleDocx(blocks.join('\n'))
}

// ============================================================
// PUBLIC: COUNTER PROPOSAL DOCX (tenant counters as track changes vs v2)
// ============================================================
// For each clause where we have a counter proposal, emit a track-changed
// edit replacing v2 language with the proposed counter, marked as TENANT.

export interface CounterProposalForDocx {
  type: string
  typeLabel: string
  v2Section?: string
  v2Heading?: string
  v2Excerpt: string                  // current language
  proposed_excerpt: string           // tenant counter
  rationale?: string                 // why we're countering
  ai_generated: boolean              // whether AI wrote this
}

export interface CounterDocxInput {
  buildingAddress: string
  v2Label: string
  v2DocType: string
  generatedAt: string
  proposals: CounterProposalForDocx[]
}

import { wordDiff } from './lease-compare'

export async function buildCounterDocx(input: CounterDocxInput): Promise<Buffer> {
  const dateIso = input.generatedAt
  const author: DocxAuthor = 'tenant'
  const blocks: string[] = []

  blocks.push(heading('Tenant Counter Proposal', 1))
  blocks.push(para(plainRun(input.buildingAddress, { size: 22, color: '475569' })))
  blocks.push(para(plainRun(`Counters against ${input.v2Label} (${input.v2DocType})`, { size: 20, color: '64748b' })))
  blocks.push(para(plainRun(`Generated ${new Date(input.generatedAt).toLocaleString()}`, { size: 18, color: '94a3b8', italic: true })))
  blocks.push(divider())

  blocks.push(heading('Proposed Changes', 2))
  blocks.push(para(plainRun('Each clause below shows the current landlord language with our proposed edits as tracked changes. Open in Word to accept or reject individual changes.', { italic: true, color: '475569', size: 20 })))

  for (const p of input.proposals) {
    blocks.push(heading(`${p.typeLabel}${p.v2Section ? ' - ' + p.v2Section : ''}`, 3))
    if (p.v2Heading) blocks.push(paraWithRuns(plainRun(p.v2Heading, { bold: true })))

    if (p.rationale) {
      blocks.push(para(plainRun('Reasoning:', { italic: true, color: '64748b', size: 18 })))
      blocks.push(para(plainRun(p.rationale, { italic: true, color: '475569' })))
    }

    blocks.push(para(plainRun(p.ai_generated ? 'Counter language (AI-generated, please review):' : 'Counter language:', { italic: true, color: '64748b', size: 18 })))

    // Diff current excerpt -> proposed excerpt
    const ops = wordDiff(p.v2Excerpt, p.proposed_excerpt)
    blocks.push(`<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="6" w:space="4" w:color="2563EB"/></w:pBdr></w:pPr>${opsToRuns(ops, author, dateIso)}</w:p>`)

    blocks.push(divider())
  }

  return assembleDocx(blocks.join('\n'))
}

// ============================================================
// PUBLIC: NEGOTIATION MEMO DOCX (no track changes, executive summary)
// ============================================================
// For execs who don't want to scroll through redlines. Pure plain text,
// grouped by negotiation status, with notes and AI rationale.

export interface MemoClauseForDocx {
  type: string
  typeLabel: string
  v2Section?: string
  v2Heading?: string
  v2Summary?: string
  v2KeyTerms?: Record<string, any>
  v2Excerpt?: string
  v2Risk?: string
  riskDelta?: number
  v1Risk?: string
  status: string                  // negotiation status (open_issue / counter_pending / etc.)
  statusLabel: string
  notes?: string
}

export interface MemoDocxInput {
  buildingAddress: string
  v1Label: string
  v2Label: string
  v1DocType: string
  v2DocType: string
  generatedAt: string
  aiSummary?: string | null
  counts?: { modified: number; added: number; removed: number; unchanged: number }
  riskDelta?: { worse: number; better: number; net_high_risk_change: number }
  clauses: MemoClauseForDocx[]
}

const STATUS_ORDER = ['open_issue', 'counter_pending', 'accepted', 'wont_address', 'not_applicable']

export async function buildMemoDocx(input: MemoDocxInput): Promise<Buffer> {
  const blocks: string[] = []
  blocks.push(heading('Lease Negotiation Memo', 1))
  blocks.push(para(plainRun(input.buildingAddress, { size: 22, color: '475569' })))
  blocks.push(para(plainRun(`Comparing ${input.v1Label} (${input.v1DocType}) → ${input.v2Label} (${input.v2DocType})`, { size: 20, color: '64748b' })))
  blocks.push(para(plainRun(`Generated ${new Date(input.generatedAt).toLocaleString()}`, { size: 18, color: '94a3b8', italic: true })))
  blocks.push(divider())

  if (input.aiSummary) {
    blocks.push(heading('Executive Summary', 2))
    input.aiSummary.split(/\n\n+/).forEach(p => {
      blocks.push(para(plainRun(p)))
    })
    blocks.push(divider())
  }

  if (input.counts || input.riskDelta) {
    blocks.push(heading('At a Glance', 2))
    if (input.counts) {
      const c = input.counts
      blocks.push(para(plainRun(`${c.modified} modified · ${c.added} added · ${c.removed} removed · ${c.unchanged} unchanged`, { size: 22, bold: true })))
    }
    if (input.riskDelta) {
      const r = input.riskDelta
      const netLabel = r.net_high_risk_change > 0
        ? `${r.net_high_risk_change} new high-risk clause${r.net_high_risk_change > 1 ? 's' : ''}`
        : (r.net_high_risk_change < 0 ? `${Math.abs(r.net_high_risk_change)} high-risk resolved` : 'No net change in high-risk count')
      blocks.push(para(plainRun(`Risk movement: ${r.worse} worsened · ${r.better} improved · ${netLabel}`, { color: r.net_high_risk_change > 0 ? 'B91C1C' : (r.net_high_risk_change < 0 ? '15803D' : '475569') })))
    }
    blocks.push(divider())
  }

  // Group clauses by negotiation status
  const byStatus: Record<string, MemoClauseForDocx[]> = {}
  for (const c of input.clauses) {
    const key = c.status || 'open_issue'
    if (!byStatus[key]) byStatus[key] = []
    byStatus[key].push(c)
  }

  for (const sk of STATUS_ORDER) {
    const list = byStatus[sk] || []
    if (list.length === 0) continue
    const sectionTitle = list[0].statusLabel + ` (${list.length})`
    blocks.push(heading(sectionTitle, 2))

    for (const c of list) {
      const sectionLabel = c.v2Section ? ` - ${c.v2Section}` : ''
      blocks.push(heading(`${c.typeLabel}${sectionLabel}`, 3))
      if (c.v2Heading) blocks.push(para(plainRun(c.v2Heading, { bold: true })))
      if (c.v2Summary) blocks.push(para(plainRun(c.v2Summary)))
      if (c.v2KeyTerms && Object.keys(c.v2KeyTerms).length > 0) {
        blocks.push(para(plainRun('Key Terms:', { italic: true, color: '64748b', size: 18 })))
        const ktLines = Object.entries(c.v2KeyTerms)
          .filter(([_, v]) => v != null && v !== '')
          .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        ktLines.forEach(line => blocks.push(para(plainRun(line, { size: 20 }))))
      }
      // Risk
      if (c.v2Risk) {
        const riskColor = c.v2Risk === 'high' ? 'B91C1C' : (c.v2Risk === 'medium' ? 'B45309' : (c.v2Risk === 'low' ? '15803D' : '64748b'))
        blocks.push(para(plainRun(`Risk: ${c.v2Risk}` + (c.v1Risk && c.v1Risk !== c.v2Risk ? ` (was ${c.v1Risk})` : ''), { color: riskColor, size: 20, italic: true })))
      }
      // Notes
      if (c.notes) {
        blocks.push(para(plainRun('Negotiation Notes:', { italic: true, color: '64748b', size: 18 })))
        blocks.push(para(plainRun(c.notes, { italic: false })))
      }
      blocks.push(para(plainRun('')))
    }
    blocks.push(divider())
  }

  return assembleDocx(blocks.join('\n'))
}
