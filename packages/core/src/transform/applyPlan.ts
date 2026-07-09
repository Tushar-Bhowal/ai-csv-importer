import type { SkippedRow } from '../schema/api.js'
import { CRM_FIELDS, EMPTY_RECORD, type CrmField, type CrmRecord } from '../schema/crm.js'
import type { ColumnMapping, MappingPlan } from '../schema/plan.js'
import type { CsvRow } from '../parse/parseCsv.js'
import { coerceDate } from './coerceDate.js'
import { coerceDataSource, coerceStatus } from './coerceEnum.js'
import { csvSafe } from './csvSafe.js'
import { findEmails, findPhones, isBlank } from './extract.js'
import { normalizePhone } from './normalizePhone.js'
import { buildNote } from './notes.js'
import { isContactable } from './skipPolicy.js'

export interface ApplyPlanResult {
  records: CrmRecord[]
  skipped: SkippedRow[]
}

// crm_status and data_source are closed sets, not free text. The type system
// enforces that only their coercers may write them; everything else is a string.
type TextField = Exclude<CrmField, 'crm_status' | 'data_source'>

const isEnumField = (field: CrmField): field is 'crm_status' | 'data_source' =>
  field === 'crm_status' || field === 'data_source'

const TEXT_FIELDS = CRM_FIELDS.filter((f): f is TextField => !isEnumField(f))

function setText(record: CrmRecord, field: CrmField, value: string): void {
  if (isEnumField(field)) return
  record[field] = value
}

const cell = (row: CsvRow, column: string) => row.cells[column] ?? ''

const joinSources = (row: CsvRow, mapping: ColumnMapping) =>
  mapping.sourceColumns
    .map((c) => cell(row, c))
    .filter((v) => !isBlank(v))
    .join(' ')
    .trim()

function applyRow(row: CsvRow, plan: MappingPlan, importedAt: string): CrmRecord {
  const record: CrmRecord = { ...EMPTY_RECORD }
  const extraEmails: string[] = []
  const extraPhones: string[] = []
  let noteBase = ''

  for (const mapping of plan.columns) {
    const raw = joinSources(row, mapping)
    if (isBlank(raw)) continue

    switch (mapping.strategy) {
      case 'phone_split': {
        const phones = findPhones(raw)
        const [first, ...rest] = phones.length > 0 ? phones : [raw]
        const parts = normalizePhone(first as string, plan.defaultCountryCode)
        if (parts) {
          record.country_code = parts.countryCode
          record.mobile_without_country_code = parts.mobile
        }
        extraPhones.push(...rest)
        break
      }

      case 'date_parse':
        setText(record, mapping.target, coerceDate(raw, mapping.dateFormat))
        break

      case 'enum_map':
        if (mapping.target === 'crm_status') record.crm_status = coerceStatus(raw, mapping.valueMap)
        else if (mapping.target === 'data_source')
          record.data_source = coerceDataSource(raw, mapping.valueMap)
        else setText(record, mapping.target, raw)
        break

      case 'direct':
      case 'concat':
      default: {
        if (mapping.target === 'email') {
          const emails = findEmails(raw)
          record.email = emails[0] ?? ''
          extraEmails.push(...emails.slice(1))
        } else if (mapping.target === 'crm_note') {
          noteBase = raw
        } else if (mapping.target === 'crm_status') {
          record.crm_status = coerceStatus(raw, mapping.valueMap)
        } else if (mapping.target === 'data_source') {
          record.data_source = coerceDataSource(raw, mapping.valueMap)
        } else if (mapping.target === 'created_at') {
          record.created_at = coerceDate(raw, mapping.dateFormat)
        } else {
          setText(record, mapping.target, raw)
        }
        break
      }
    }
  }

  const unmapped: Record<string, string> = {}
  for (const column of plan.noteColumns) unmapped[column] = cell(row, column)

  record.crm_note = buildNote({ base: noteBase, extraEmails, extraPhones, unmapped })

  // A lead without a timestamp is still a lead; the brief demands only that
  // created_at survives new Date().
  if (isBlank(record.created_at)) record.created_at = importedAt

  // Make the two phone fields honour their own names, even if a plan pointed a
  // free-text column at them.
  const ccDigits = record.country_code.replace(/\D/g, '')
  record.country_code = ccDigits ? `+${ccDigits}` : ''
  record.mobile_without_country_code = record.mobile_without_country_code.replace(/\D/g, '')

  // Enum fields hold a closed set of values and cannot carry a newline or a
  // formula. country_code is '+' followed by digits, per the brief's sample
  // file — the one field whose leading '+' is meaningful, and already
  // constrained above. Everything else is free text and gets the full guard.
  for (const field of TEXT_FIELDS) {
    if (field === 'country_code') continue
    record[field] = csvSafe(record[field])
  }
  return record
}

/**
 * Pure: same rows and plan in, same records out. No network, no AI, no clock
 * beyond the caller-supplied `importedAt`. This is what makes the test suite
 * mean something — and it is the entire reason the LLM maps the schema once
 * instead of transforming every row.
 *
 * Invariant: records.length + skipped.length === rows.length. No row is ever
 * silently dropped.
 */
export function applyPlan(
  rows: readonly CsvRow[],
  plan: MappingPlan,
  importedAt: string,
): ApplyPlanResult {
  const records: CrmRecord[] = []
  const skipped: SkippedRow[] = []

  for (const row of rows) {
    const record = applyRow(row, plan, importedAt)
    if (isContactable(record)) records.push(record)
    else skipped.push({ rowNumber: row.rowNumber, reason: 'no_contact', original: row.cells })
  }

  return { records, skipped }
}
