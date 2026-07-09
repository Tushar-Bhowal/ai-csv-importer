import { format as formatDate, isValid, parse as parseWithFormat, parseISO } from 'date-fns'

import { isBlank } from './extract.js'

export const CRM_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss'

// Days since 1899-12-30 — Excel's epoch, offset by its 1900 leap-year bug.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const DAY_MS = 86_400_000
const EXCEL_SERIAL_MIN = 20_000 // ~1954
const EXCEL_SERIAL_MAX = 60_000 // ~2064

// The serial carries no timezone, so the UTC arithmetic is rebuilt as local
// parts. Otherwise the date shifts for anyone east or west of UTC.
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

// Returns a string `new Date()` always parses, or ''. Never a half-parsed date.
// `sourceFormat` is a parameter because 13/05 and 05/13 are indistinguishable
// from one row; only a reader of many rows knows which the file uses.
export function coerceDate(raw: string, sourceFormat?: string): string {
  if (isBlank(raw)) return ''
  const text = raw.trim()

  // A bare number is an Excel serial or nothing. `new Date("2026")` silently
  // returns 1 January.
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
