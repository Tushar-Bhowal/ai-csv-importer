import { format as formatDate, isValid, parse as parseWithFormat, parseISO } from 'date-fns'

import { isBlank } from './extract.js'

export const CRM_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss'

// Excel stores dates as days since 1899-12-30 (its leap-year bug included).
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const DAY_MS = 86_400_000
const EXCEL_SERIAL_MIN = 20_000 // ~1954
const EXCEL_SERIAL_MAX = 60_000 // ~2064

// The serial encodes a wall-clock time with no timezone. Read the arithmetic in
// UTC, then rebuild it as local parts, so the output does not shift by timezone.
function fromExcelSerial(text: string): Date | null {
  if (!/^\d{5}(\.\d+)?$/.test(text)) return null
  const serial = Number(text)
  if (serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) return null

  const utc = new Date(EXCEL_EPOCH_MS + serial * DAY_MS)
  return new Date(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes(),
    utc.getUTCSeconds(),
  )
}

const inRange = (d: Date) => isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2200

/**
 * The assignment's hard contract: `new Date(created_at)` must work. So this
 * returns either a string that always parses, or '' — never a half-parsed date.
 *
 * `13/05/2026` and `05/13/2026` are the same characters and different dates.
 * No amount of code can tell them apart from one row. Whoever read many rows —
 * the LLM, or the user in the mapping panel — passes that knowledge in as
 * `sourceFormat`, and this function merely executes it.
 */
export function coerceDate(raw: string, sourceFormat?: string): string {
  if (isBlank(raw)) return ''
  const text = raw.trim()

  // A bare number is an Excel serial or it is not a date at all. Never hand it
  // to `new Date`, which reads "2026" as a year and a phone number as garbage.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = fromExcelSerial(text)
    return serial && inRange(serial) ? formatDate(serial, CRM_DATE_FORMAT) : ''
  }

  const candidates: Date[] = []
  if (sourceFormat) candidates.push(parseWithFormat(text, sourceFormat, new Date()))
  candidates.push(parseISO(text))
  candidates.push(new Date(text))

  const valid = candidates.find(inRange)
  return valid ? formatDate(valid, CRM_DATE_FORMAT) : ''
}
