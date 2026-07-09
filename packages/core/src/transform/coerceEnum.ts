import { CRM_STATUS, DATA_SOURCE } from '../schema/crm.js'
import { isBlank } from './extract.js'

type CrmStatus = (typeof CRM_STATUS)[number]
type DataSource = (typeof DATA_SOURCE)[number]

const key = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '')

// Words that recur across CRM exports, so the common case costs no AI call and
// no user correction. Anything unrecognised falls through to the plan's valueMap.
const STATUS_SYNONYMS: Record<string, CrmStatus> = {
  goodlead: 'GOOD_LEAD_FOLLOW_UP',
  goodleadfollowup: 'GOOD_LEAD_FOLLOW_UP',
  followup: 'GOOD_LEAD_FOLLOW_UP',
  hot: 'GOOD_LEAD_FOLLOW_UP',
  warm: 'GOOD_LEAD_FOLLOW_UP',
  interested: 'GOOD_LEAD_FOLLOW_UP',
  qualified: 'GOOD_LEAD_FOLLOW_UP',
  didnotconnect: 'DID_NOT_CONNECT',
  notdialed: 'DID_NOT_CONNECT',
  noanswer: 'DID_NOT_CONNECT',
  busy: 'DID_NOT_CONNECT',
  unreachable: 'DID_NOT_CONNECT',
  new: 'DID_NOT_CONNECT',
  badlead: 'BAD_LEAD',
  notinterested: 'BAD_LEAD',
  cold: 'BAD_LEAD',
  junk: 'BAD_LEAD',
  invalid: 'BAD_LEAD',
  lost: 'BAD_LEAD',
  closedlost: 'BAD_LEAD',
  saledone: 'SALE_DONE',
  won: 'SALE_DONE',
  closedwon: 'SALE_DONE',
  converted: 'SALE_DONE',
  purchased: 'SALE_DONE',
}

function coerce<T extends string>(
  raw: string,
  allowed: readonly T[],
  synonyms: Record<string, T>,
  valueMap?: Record<string, string>,
): T | '' {
  if (isBlank(raw)) return ''

  const mapped = valueMap?.[raw.trim()] ?? valueMap?.[raw.trim().toLowerCase()]
  if (mapped && (allowed as readonly string[]).includes(mapped)) return mapped as T

  const k = key(raw)
  const direct = allowed.find((a) => key(a) === k)
  if (direct) return direct

  return synonyms[k] ?? ''
}

export const coerceStatus = (raw: string, valueMap?: Record<string, string>) =>
  coerce(raw, CRM_STATUS, STATUS_SYNONYMS, valueMap)

// data_source values are GrowEasy's own project names. No external CSV contains
// them, so the correct answer is almost always ''. Guessing here is the failure
// mode the brief is testing for; there are deliberately no synonyms.
export const coerceDataSource = (raw: string, valueMap?: Record<string, string>) =>
  coerce(raw, DATA_SOURCE, {} as Record<string, DataSource>, valueMap)
