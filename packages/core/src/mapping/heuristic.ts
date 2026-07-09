import type { CrmField } from '../schema/crm.js'
import type { ColumnMapping, MappingPlan } from '../schema/plan.js'
import { findEmails, findPhones } from '../transform/extract.js'

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

// Earlier entries win a tie.
const SYNONYMS: Record<CrmField, string[]> = {
  created_at: ['createdat', 'createdtime', 'createdon', 'date', 'datecreated', 'timestamp', 'leaddate', 'submittedon'],
  name: ['name', 'fullname', 'leadname', 'customername', 'contactname', 'clientname', 'firstname'],
  email: ['email', 'emailaddress', 'mail', 'primaryemail', 'workemail', 'contactemail'],
  country_code: ['countrycode', 'dialcode', 'isdcode', 'phonecode'],
  mobile_without_country_code: ['mobile', 'phone', 'phonenumber', 'mobilenumber', 'contact', 'contactnumber', 'cell', 'whatsapp', 'tel'],
  company: ['company', 'companyname', 'organisation', 'organization', 'business', 'firm', 'employer'],
  city: ['city', 'town', 'location', 'district'],
  state: ['state', 'province', 'region'],
  country: ['country', 'nation'],
  lead_owner: ['leadowner', 'owner', 'assignedto', 'salesrep', 'agent', 'accountmanager'],
  crm_status: ['crmstatus', 'status', 'leadstatus', 'leadstage', 'stage', 'disposition', 'quality'],
  crm_note: ['crmnote', 'note', 'notes', 'remark', 'remarks', 'comment', 'comments', 'feedback'],
  data_source: ['datasource', 'source', 'leadsource', 'campaign', 'project'],
  possession_time: ['possessiontime', 'possession', 'possessiondate', 'handover'],
  description: ['description', 'details', 'message', 'enquiry', 'requirement'],
}

// data_source holds GrowEasy's own project names, which no external header
// carries. A blind match on "Source" would be wrong every time.
const NEVER_HEURISTIC: ReadonlySet<CrmField> = new Set(['data_source'])

// Best match across all synonyms, not the first: "company_name" starts with
// "company" (0.8) and equals "companyname" (0.94), and stopping at the first hit
// would let `name` steal it on a suffix match.
function scoreHeader(header: string, field: CrmField): number {
  const h = norm(header)
  if (h === '') return 0

  let best = 0
  const candidates = SYNONYMS[field]
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i] as string
    let score = 0
    if (h === c) score = 0.95 - i * 0.01
    else if (h.startsWith(c) || h.endsWith(c)) score = 0.8 - i * 0.01
    else if (h.includes(c) && c.length >= 4) score = 0.7 - i * 0.01
    if (score > best) best = score
  }
  return best
}

function strategyFor(field: CrmField): ColumnMapping['strategy'] {
  if (field === 'mobile_without_country_code') return 'phone_split'
  if (field === 'created_at') return 'date_parse'
  if (field === 'crm_status' || field === 'data_source') return 'enum_map'
  return 'direct'
}

// Free baseline. Primes the LLM, and stands in for it when it is unreachable.
export function heuristicPlan(
  headers: readonly string[],
  options: { headerRowIndex?: number; sampleRows?: readonly Record<string, string>[] } = {},
): MappingPlan {
  const claimed = new Map<CrmField, { header: string; score: number }>()

  for (const header of headers) {
    let bestField: CrmField | null = null
    let bestScore = 0.6 // below this, a match is noise

    for (const field of Object.keys(SYNONYMS) as CrmField[]) {
      if (NEVER_HEURISTIC.has(field)) continue
      const score = scoreHeader(header, field)
      if (score > bestScore) {
        bestScore = score
        bestField = field
      }
    }

    if (!bestField) continue
    const held = claimed.get(bestField)
    if (!held || bestScore > held.score) claimed.set(bestField, { header, score: bestScore })
  }

  // A column named "Contact" may hold emails; the values settle it.
  const sample = options.sampleRows ?? []
  if (!claimed.has('email')) {
    const emailish = headers.find((h) => sample.some((r) => findEmails(r[h] ?? '').length > 0))
    if (emailish) claimed.set('email', { header: emailish, score: 0.7 })
  }
  if (!claimed.has('mobile_without_country_code')) {
    const phoneish = headers.find(
      (h) => claimed.get('email')?.header !== h && sample.some((r) => findPhones(r[h] ?? '').length > 0),
    )
    if (phoneish) claimed.set('mobile_without_country_code', { header: phoneish, score: 0.7 })
  }

  const columns: ColumnMapping[] = [...claimed.entries()].map(([field, { header, score }]) => ({
    target: field,
    sourceColumns: [header],
    strategy: strategyFor(field),
    confidence: score,
    reasoning: `header "${header}" matches ${field}`,
  }))

  const used = new Set(columns.flatMap((c) => c.sourceColumns))

  return {
    columns,
    noteColumns: headers.filter((h) => !used.has(h)),
    ignoreColumns: [],
    headerRowIndex: options.headerRowIndex ?? 0,
    defaultCountryCode: '+91',
    degraded: true,
  }
}
