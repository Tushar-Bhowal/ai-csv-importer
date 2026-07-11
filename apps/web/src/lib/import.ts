import type { CrmRecord, ImportSummary, MappingPlan, SkippedRow } from '@groweasy/core'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const IMPORT_TIMEOUT_MS = 60_000

export interface ImportOutcome {
  headers: string[]
  plan: MappingPlan
  records: CrmRecord[]
  skipped: SkippedRow[]
  summary: ImportSummary
  csv: string
}

export type ImportState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; fileName: string; outcome: ImportOutcome }

interface ErrorEnvelope {
  error?: { message?: string }
}

/**
 * Only *types* cross from `@groweasy/core` into this module, and types erase. A value
 * import would pull the barrel — and with it the AI SDK, papaparse, libphonenumber-js
 * and date-fns — into the browser bundle.
 */
export async function importCsv(file: File): Promise<ImportOutcome> {
  const response = await fetch(`${API_URL}/api/v1/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: file,
    signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
  })

  if (!response.ok) {
    // The API answers every failure with { error: { code, message, requestId } }.
    const body = (await response.json().catch(() => null)) as ErrorEnvelope | null
    throw new Error(body?.error?.message ?? `The import failed (HTTP ${response.status}).`)
  }

  return (await response.json()) as ImportOutcome
}
