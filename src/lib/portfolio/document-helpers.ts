// Filename-based heuristics for document type and effective date.
// Used to pre-populate the per-file selectors on the upload UI so the user
// usually doesn't need to change anything.

export type PortfolioDocumentType =
  | 'lease'
  | 'amendment'
  | 'snda'
  | 'estoppel'
  | 'exhibit'
  | 'side_letter'
  | 'work_letter'
  | 'guaranty'
  | 'other'

export const DOCUMENT_TYPE_OPTIONS: { value: PortfolioDocumentType; label: string }[] = [
  { value: 'lease', label: 'Executed Lease' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'snda', label: 'SNDA' },
  { value: 'estoppel', label: 'Estoppel' },
  { value: 'exhibit', label: 'Exhibit' },
  { value: 'side_letter', label: 'Side Letter / Consent' },
  { value: 'work_letter', label: 'Work Letter' },
  { value: 'guaranty', label: 'Guaranty' },
  { value: 'other', label: 'Other' },
]

/**
 * Heuristic mapping of filename -> document_type.
 * Returns the best guess based on common naming patterns.
 */
export function guessDocumentType(filename: string): PortfolioDocumentType {
  const lower = filename.toLowerCase()
  if (/\bamend(ment)?\b|\b1st\s*amend|\b2nd\s*amend|\b3rd\s*amend|first amend|second amend|third amend|fourth amend|fifth amend/.test(lower)) {
    return 'amendment'
  }
  if (/\bsnda\b|subordination/.test(lower)) return 'snda'
  if (/\bestoppel\b/.test(lower)) return 'estoppel'
  if (/\bguaranty\b|guarantee/.test(lower)) return 'guaranty'
  if (/work\s*letter/.test(lower)) return 'work_letter'
  if (/\bconsent\b|side\s*letter|landlord\s*consent/.test(lower)) return 'side_letter'
  if (/\bexhibit\b/.test(lower)) return 'exhibit'
  if (/\blease\b|executed|fully\s*executed/.test(lower)) return 'lease'
  return 'other'
}

// Parse "(Jun-16)", "(Jan-2014)", "2014-01-15" patterns to YYYY-MM-DD.
// Falls back to null if no usable date is found.
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
}

export function guessEffectiveDate(filename: string): string | null {
  const lower = filename.toLowerCase()

  // Pattern: (mon-yy) or (mon-yyyy)
  const monYr = lower.match(/\(([a-z]{3,4})[\s\-_]+(\d{2,4})\)/)
  if (monYr) {
    const mm = MONTHS[monYr[1]]
    if (mm) {
      let yyyy = monYr[2]
      if (yyyy.length === 2) {
        const n = parseInt(yyyy, 10)
        yyyy = n > 50 ? `19${yyyy}` : `20${yyyy}`
      }
      return `${yyyy}-${mm}-01`
    }
  }

  // Pattern: yyyy-mm or yyyy_mm at the start of the file
  const yrMon = lower.match(/(?:^|[^\d])(20\d{2}|19\d{2})[\-_\s](\d{1,2})\b/)
  if (yrMon) {
    const yyyy = yrMon[1]
    const mm = yrMon[2].padStart(2, '0')
    if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12) {
      return `${yyyy}-${mm}-01`
    }
  }

  // Pattern: full ISO yyyy-mm-dd
  const iso = lower.match(/(20\d{2}|19\d{2})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  return null
}

// Suggest amendment ordinal text for display in the docs list (e.g. "1st Amendment").
export function amendmentOrdinalFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase()
  if (/first\s*amend|\b1st\s*amend/.test(lower)) return '1st Amendment'
  if (/second\s*amend|\b2nd\s*amend/.test(lower)) return '2nd Amendment'
  if (/third\s*amend|\b3rd\s*amend/.test(lower)) return '3rd Amendment'
  if (/fourth\s*amend|\b4th\s*amend/.test(lower)) return '4th Amendment'
  if (/fifth\s*amend|\b5th\s*amend/.test(lower)) return '5th Amendment'
  return null
}
