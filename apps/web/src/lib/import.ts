import {
  applyPlan,
  CRM_FIELDS,
  csvSafe,
  hasLlmKey,
  parseCsv,
  refinePlan,
  type CrmRecord,
  type ImportSummary,
  type MappingPlan,
  type SkippedRow,
} from '@groweasy/core'

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const PREVIEW_ROWS = 5

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
 * The whole product, server-side. Phase 3 moves this behind the Express API and
 * this function becomes a `fetch`. Nothing above it needs to change.
 */
export async function importCsv(
  bytes: Uint8Array,
  importedAt = crmDateTime(new Date()),
): Promise<ImportOutcome> {
  const startedAt = performance.now()

  const parsed = parseCsv(bytes)

  const plan = await refinePlan(parsed.headers, parsed.rows, {
    headerRowIndex: parsed.headerRowIndex,
  })

  const { records, skipped } = applyPlan(parsed.rows, plan, importedAt)

  return {
    headers: parsed.headers,
    previewRows: parsed.rows.slice(0, PREVIEW_ROWS).map((r) => r.cells),
    plan,
    records,
    skipped,
    summary: {
      totalRows: parsed.rows.length,
      imported: records.length,
      skipped: skipped.length,
      durationMs: performance.now() - startedAt,
      llmCalls: plan.degraded ? 0 : 1,
      degraded: plan.degraded,
      // refinePlan degrades for exactly two reasons, and only it knows the key.
      ...(plan.degraded ? { degradedReason: hasLlmKey() ? 'call_failed' : 'no_key' } : {}),
    },
    csv: toCsv(records),
  }
}
