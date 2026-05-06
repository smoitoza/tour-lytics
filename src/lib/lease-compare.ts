// ============================================================
// LEASE COMPARE
// ============================================================
// Pure functions for diffing two lease versions:
//   - matchClauses(): pair v1 clauses with v2 clauses
//   - wordDiff():     inline word-level diff (returns ops)
//   - clauseDiff():   per-clause diff with status + value deltas
//   - buildDiff():    top-level entry point producing the full compare object
// No external deps - uses an inline LCS implementation for word diffing.
// ============================================================

import { LEASE_CLAUSE_TYPES, type LeaseClauseType, type LeaseRiskLevel } from './lease-clause-taxonomy'

// ---- Types ----
export interface RawClause {
  type: LeaseClauseType
  section?: string
  heading?: string
  summary?: string
  key_terms?: Record<string, any>
  original_excerpt?: string
  risk_level?: LeaseRiskLevel
  risk_rationale?: string
  // synthetic - not from extraction
  __idx?: number
}

export type ClauseStatus = 'unchanged' | 'modified' | 'added' | 'removed'

export interface DiffOp { op: 'eq' | 'ins' | 'del'; text: string }

export interface KeyTermDiff {
  key: string
  v1: any
  v2: any
  changed: boolean
}

export interface ClauseDiff {
  status: ClauseStatus
  type: LeaseClauseType
  // Either side may be null when status = added/removed
  v1: RawClause | null
  v2: RawClause | null
  // Per-field diffs (only present when both sides exist)
  summaryOps?: DiffOp[]
  excerptOps?: DiffOp[]
  keyTermsDiff?: KeyTermDiff[]
  // Risk movement: -1 (improved), 0 (unchanged), +1 (worse)
  riskDelta?: number
  // Stable matching score (debug)
  matchScore?: number
}

export interface RiskDelta {
  worse: number     // count of clauses whose risk went up
  better: number    // count whose risk went down
  unchanged: number
  net_high_risk_change: number  // signed count of net high-risk clauses introduced
}

export interface CompareResult {
  v1_id: string
  v2_id: string
  generated_at: string
  clauseDiffs: ClauseDiff[]   // ordered by taxonomy group, then v1 order, then v2 order
  riskDelta: RiskDelta
  counts: {
    unchanged: number
    modified: number
    added: number
    removed: number
  }
  // Optional - filled in by Claude in a separate step
  ai_summary?: string
}

// ============================================================
// Word-level diff - LCS based, returns sequence of ops
// ============================================================
export function wordDiff(a: string, b: string): DiffOp[] {
  const aTokens = tokenize(a || '')
  const bTokens = tokenize(b || '')
  if (aTokens.length === 0 && bTokens.length === 0) return []

  // LCS table
  const n = aTokens.length, m = bTokens.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aTokens[i].toLowerCase() === bTokens[j].toLowerCase()) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const ops: DiffOp[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (aTokens[i].toLowerCase() === bTokens[j].toLowerCase()) {
      pushOp(ops, 'eq', aTokens[i])
      i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushOp(ops, 'del', aTokens[i])
      i++
    } else {
      pushOp(ops, 'ins', bTokens[j])
      j++
    }
  }
  while (i < n) { pushOp(ops, 'del', aTokens[i++]) }
  while (j < m) { pushOp(ops, 'ins', bTokens[j++]) }
  return ops
}

function tokenize(s: string): string[] {
  // Keep whitespace as-is for stitching back, split on word boundaries
  const out: string[] = []
  const re = /(\s+|[^\s\w]+|\w+)/g
  let m
  while ((m = re.exec(s)) !== null) out.push(m[0])
  return out
}

function pushOp(ops: DiffOp[], op: DiffOp['op'], text: string) {
  const last = ops[ops.length - 1]
  if (last && last.op === op) last.text += text
  else ops.push({ op, text })
}

// ============================================================
// Heading similarity (Jaccard on lowercase words)
// ============================================================
function headingSimilarity(a: string, b: string): number {
  const tokA = new Set((a || '').toLowerCase().match(/\w+/g) || [])
  const tokB = new Set((b || '').toLowerCase().match(/\w+/g) || [])
  if (tokA.size === 0 && tokB.size === 0) return 0
  let inter = 0
  for (const t of tokA) if (tokB.has(t)) inter++
  const union = new Set([...tokA, ...tokB]).size
  return union === 0 ? 0 : inter / union
}

function sectionEquivalent(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const norm = (s: string) => s.toLowerCase().replace(/[^\w.]/g, '').replace(/^section/, '').replace(/^article/, '')
  return norm(a) === norm(b)
}

// ============================================================
// MATCH CLAUSES across versions
// Returns a list of [v1Clause | null, v2Clause | null] pairs.
// ============================================================
export function matchClauses(v1Clauses: RawClause[], v2Clauses: RawClause[]): Array<[RawClause | null, RawClause | null, number]> {
  const a = v1Clauses.map((c, i) => ({ ...c, __idx: i }))
  const b = v2Clauses.map((c, i) => ({ ...c, __idx: i }))

  const matched: Array<[RawClause | null, RawClause | null, number]> = []
  const usedB = new Set<number>()

  // Pass 1: same type + same section number
  for (const c of a) {
    const j = b.findIndex((x, idx) => !usedB.has(idx) && x.type === c.type && sectionEquivalent(c.section, x.section))
    if (j >= 0) {
      usedB.add(j)
      matched.push([c, b[j], 1.0])
      ;(c as any).__matched = true
    }
  }

  // Pass 2: same type + heading similarity > 0.6
  for (const c of a) {
    if ((c as any).__matched) continue
    let bestJ = -1, bestSim = 0.6
    for (let j = 0; j < b.length; j++) {
      if (usedB.has(j)) continue
      if (b[j].type !== c.type) continue
      const sim = headingSimilarity(c.heading || '', b[j].heading || '')
      if (sim > bestSim) { bestSim = sim; bestJ = j }
    }
    if (bestJ >= 0) {
      usedB.add(bestJ)
      matched.push([c, b[bestJ], bestSim])
      ;(c as any).__matched = true
    }
  }

  // Pass 3: same type, only one of each in respective version
  const remainingA = a.filter(c => !(c as any).__matched)
  const remainingB = b.filter((_, j) => !usedB.has(j))
  const countByTypeA: Record<string, RawClause[]> = {}
  const countByTypeB: Record<string, RawClause[]> = {}
  remainingA.forEach(c => { (countByTypeA[c.type] = countByTypeA[c.type] || []).push(c) })
  remainingB.forEach(c => { (countByTypeB[c.type] = countByTypeB[c.type] || []).push(c) })
  for (const t of Object.keys(countByTypeA)) {
    if (countByTypeA[t].length === 1 && countByTypeB[t] && countByTypeB[t].length === 1) {
      const cA = countByTypeA[t][0]
      const cB = countByTypeB[t][0]
      matched.push([cA, cB, 0.5])
      ;(cA as any).__matched = true
      // Mark cB used
      const jIdx = b.findIndex(x => x.__idx === cB.__idx)
      if (jIdx >= 0) usedB.add(jIdx)
    }
  }

  // Unmatched A -> removed
  for (const c of a) {
    if (!(c as any).__matched) matched.push([c, null, 0])
  }
  // Unmatched B -> added
  for (let j = 0; j < b.length; j++) {
    if (!usedB.has(j)) matched.push([null, b[j], 0])
  }

  return matched
}

// ============================================================
// CLAUSE DIFF (single pair)
// ============================================================
function compareKeyTerms(v1: Record<string, any> | undefined, v2: Record<string, any> | undefined): KeyTermDiff[] {
  const a = v1 || {}
  const b = v2 || {}
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  const out: KeyTermDiff[] = []
  for (const k of keys) {
    const va = a[k]
    const vb = b[k]
    const changed = !valuesEqual(va, vb)
    out.push({ key: k, v1: va ?? null, v2: vb ?? null, changed })
  }
  // Show changed keys first
  out.sort((x, y) => Number(y.changed) - Number(x.changed))
  return out
}

function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
  }
  return String(a).trim() === String(b).trim()
}

const RISK_RANK: Record<string, number> = { unknown: 0, low: 1, medium: 2, high: 3 }
function riskNum(r?: string): number { return RISK_RANK[r || 'unknown'] ?? 0 }

function clauseDiff(c1: RawClause | null, c2: RawClause | null, matchScore: number): ClauseDiff {
  const type: LeaseClauseType = (c1?.type || c2?.type || 'other') as LeaseClauseType
  if (!c1 && c2) return { status: 'added', type, v1: null, v2: c2, matchScore }
  if (c1 && !c2) return { status: 'removed', type, v1: c1, v2: null, matchScore }
  if (!c1 || !c2) return { status: 'unchanged', type, v1: c1, v2: c2, matchScore } // unreachable

  const summaryOps = wordDiff(c1.summary || '', c2.summary || '')
  const excerptOps = wordDiff(c1.original_excerpt || '', c2.original_excerpt || '')
  const keyTermsDiff = compareKeyTerms(c1.key_terms, c2.key_terms)

  const summaryChanged = summaryOps.some(o => o.op !== 'eq')
  const excerptChanged = excerptOps.some(o => o.op !== 'eq')
  const keyTermsChanged = keyTermsDiff.some(k => k.changed)
  const riskChanged = (c1.risk_level || 'unknown') !== (c2.risk_level || 'unknown')

  const status: ClauseStatus = (summaryChanged || excerptChanged || keyTermsChanged || riskChanged) ? 'modified' : 'unchanged'
  const riskDelta = riskNum(c2.risk_level) - riskNum(c1.risk_level)

  return {
    status, type,
    v1: c1, v2: c2,
    summaryOps, excerptOps, keyTermsDiff,
    riskDelta,
    matchScore,
  }
}

// ============================================================
// TOP-LEVEL: build diff
// ============================================================
const TYPE_ORDER: LeaseClauseType[] = LEASE_CLAUSE_TYPES.map(t => t.type)
function typeOrderIndex(t: LeaseClauseType): number {
  const i = TYPE_ORDER.indexOf(t)
  return i < 0 ? 999 : i
}

export function buildDiff(v1Doc: { id: string; clauses: RawClause[] }, v2Doc: { id: string; clauses: RawClause[] }): CompareResult {
  const pairs = matchClauses(v1Doc.clauses || [], v2Doc.clauses || [])
  const clauseDiffs = pairs.map(([a, b, score]) => clauseDiff(a, b, score))

  // Sort: taxonomy order, then by section
  clauseDiffs.sort((a, b) => {
    const ai = typeOrderIndex(a.type)
    const bi = typeOrderIndex(b.type)
    if (ai !== bi) return ai - bi
    const sa = a.v1?.section || a.v2?.section || ''
    const sb = b.v1?.section || b.v2?.section || ''
    return sa.localeCompare(sb)
  })

  // Risk delta + counts
  let worse = 0, better = 0, unchangedRisk = 0
  let netHigh = 0
  let cntUnchanged = 0, cntModified = 0, cntAdded = 0, cntRemoved = 0
  for (const cd of clauseDiffs) {
    if (cd.status === 'added') {
      cntAdded++
      if (cd.v2?.risk_level === 'high') netHigh++
    } else if (cd.status === 'removed') {
      cntRemoved++
      if (cd.v1?.risk_level === 'high') netHigh--
    } else if (cd.status === 'modified') {
      cntModified++
      if ((cd.riskDelta || 0) > 0) worse++
      else if ((cd.riskDelta || 0) < 0) better++
      else unchangedRisk++
      const wasHigh = cd.v1?.risk_level === 'high'
      const nowHigh = cd.v2?.risk_level === 'high'
      if (!wasHigh && nowHigh) netHigh++
      if (wasHigh && !nowHigh) netHigh--
    } else {
      cntUnchanged++
      unchangedRisk++
    }
  }

  return {
    v1_id: v1Doc.id,
    v2_id: v2Doc.id,
    generated_at: new Date().toISOString(),
    clauseDiffs,
    riskDelta: { worse, better, unchanged: unchangedRisk, net_high_risk_change: netHigh },
    counts: { unchanged: cntUnchanged, modified: cntModified, added: cntAdded, removed: cntRemoved },
  }
}
