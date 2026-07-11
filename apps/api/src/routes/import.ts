import {
  applyPlan,
  AppError,
  CRM_FIELDS,
  csvSafe,
  MAX_UPLOAD_BYTES,
  parseCsv,
  refinePlan,
  type CrmRecord,
  type ImportResult,
  type LlmFailure,
} from '@groweasy/core'
import express, { Router } from 'express'

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

export const importRouter = Router()

importRouter.post(
  '/import',
  express.raw({ type: 'text/csv', limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    // express.raw only fills req.body for a Content-Type it was told to parse.
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(
        'UNSUPPORTED_MEDIA_TYPE',
        'Send the CSV as the raw request body with Content-Type: text/csv.',
      )
    }
    if (req.body.length === 0) {
      throw new AppError('BAD_REQUEST', 'That file is empty.')
    }

    const startedAt = performance.now()
    const parsed = parseCsv(req.body)

    if (parsed.rows.length === 0) {
      throw new AppError('UNPROCESSABLE_ENTITY', 'That file has a header row but no data rows.')
    }

    // Nobody will read the answer once the browser is gone, so stop paying for it.
    const disconnected = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) disconnected.abort()
    })

    // A visitor's own Gemini key, for this request only: read from the header,
    // handed to the provider, never stored and never logged.
    const userKey = req.get('x-llm-api-key')?.trim() || undefined

    let failure: LlmFailure | undefined
    const plan = await refinePlan(parsed.headers, parsed.rows, {
      headerRowIndex: parsed.headerRowIndex,
      signal: disconnected.signal,
      ...(userKey ? { apiKey: userKey } : {}),
      onDegraded: (f) => {
        failure = f
      },
    })

    // refinePlan degrades rather than throws, so an abort lands here as a heuristic
    // plan. Transforming every row for a socket that is gone is pure waste.
    if (disconnected.signal.aborted) return

    const { records, skipped } = applyPlan(parsed.rows, plan, crmDateTime(new Date()))

    const result: ImportResult = {
      headers: parsed.headers,
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
        ...(failure ? { degradedReason: failure.reason, degradedDetail: failure.detail } : {}),
      },
      csv: toCsv(records),
    }

    res.json(result)
  },
)
