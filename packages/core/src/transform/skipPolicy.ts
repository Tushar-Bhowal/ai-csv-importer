import type { CrmRecord } from '../schema/crm.js'
import { isBlank } from './extract.js'

/**
 * The brief's one hard rule: a record with neither an email nor a mobile number
 * is not a lead, because nobody can contact it. Everything else is kept.
 */
export function isContactable(record: CrmRecord): boolean {
  return !isBlank(record.email) || !isBlank(record.mobile_without_country_code)
}
