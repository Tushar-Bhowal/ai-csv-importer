import type { CrmRecord } from '../schema/crm.js'
import { isBlank } from './extract.js'

export function isContactable(record: CrmRecord): boolean {
  return !isBlank(record.email) || !isBlank(record.mobile_without_country_code)
}
