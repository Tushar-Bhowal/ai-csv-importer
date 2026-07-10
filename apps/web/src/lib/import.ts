import {
  applyPlan,
  CRM_FIELDS,
  csvSafe,
  heuristicPlan,
  parseCsv,
  sanitizePlan,
  type CrmRecord,
  type ImportSummary,
  type MappingPlan,
  type SkippedRow,
} from '@groweasy/core'

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const SAMPLE_ROWS = 30

export interface ImportOutcome {
  headers: string[]
  previewRows: Record<string, string>[]
  plan: MappingPlan
  records: CrmRecord[]
  skipped: SkippedRow[]
  summary: ImportSummary
  csv: string
}

const crmDateTime = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes(),
  ).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`

// csvSafe escapes newlines and neutralises formula triggers; quoting is this
// layer's job, because only here is a record being written out as CSV.
const cell = (value: string): string => `"${csvSafe(value).replace(/"/g, '""')}"`

function toCsv(records: readonly CrmRecord[]): string {
  const lines = [CRM_FIELDS.map(cell).join(',')]
  for (const record of records) lines.push(CRM_FIELDS.map((f) => cell(record[f])).join(','))
  return lines.join('\r\n')
}

/**
 * The whole product, server-side. Phase 2 replaces `heuristicPlan` with the
 * single AI mapping call; Phase 3 moves this behind the Express API and this
 * function becomes a `fetch`. Nothing above it needs to change either time.
 */
export function importCsv(bytes: Uint8Array, importedAt = crmDateTime(new Date())): ImportOutcome {
  const startedAt = performance.now()

  const parsed = parseCsv(bytes)
  const previewRows = parsed.rows.slice(0, SAMPLE_ROWS).map((r) => r.cells)

  const plan = sanitizePlan(
    heuristicPlan(parsed.headers, {
      headerRowIndex: parsed.headerRowIndex,
      sampleRows: previewRows,
    }),
    parsed.headers,
  )

  const { records, skipped } = applyPlan(parsed.rows, plan, importedAt)

  return {
    headers: parsed.headers,
    previewRows: previewRows.slice(0, 5),
    plan,
    records,
    skipped,
    summary: {
      totalRows: parsed.rows.length,
      imported: records.length,
      skipped: skipped.length,
      durationMs: performance.now() - startedAt,
      llmCalls: 0,
      degraded: plan.degraded,
    },
    csv: toCsv(records),
  }
}
