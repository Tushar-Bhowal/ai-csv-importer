import { z } from 'zod'

import { CrmRecordSchema } from './crm.js'
import { MappingPlanSchema } from './plan.js'

// Vercel answers a 5 MB request body with 413 FUNCTION_PAYLOAD_TOO_LARGE before the
// function ever runs, so our own ceiling has to sit under it. Probed in Phase 0.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export const SKIP_REASONS = [
  'no_contact',
  'ai_extraction_failed', // every retry of the per-row LLM fallback failed
] as const

export const SkippedRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  reason: z.enum(SKIP_REASONS),
  original: z.record(z.string(), z.string()),
})

export type SkippedRow = z.infer<typeof SkippedRowSchema>

export const DEGRADED_REASONS = [
  'no_key', // nobody configured one; the app is meant to work anyway
  'call_failed', // a key exists but the model refused, timed out, or was rejected
] as const

export const ImportSummarySchema = z.object({
  totalRows: z.number().int().min(0),
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  durationMs: z.number().min(0),
  llmCalls: z.number().int().min(0),
  degraded: z.boolean(),
  /** Present only when `degraded`. The UI must not guess which it was. */
  degradedReason: z.enum(DEGRADED_REASONS).optional(),
})

export type ImportSummary = z.infer<typeof ImportSummarySchema>

export const ImportResultSchema = z.object({
  headers: z.array(z.string()),
  previewRows: z.array(z.record(z.string(), z.string())),
  plan: MappingPlanSchema,
  records: z.array(CrmRecordSchema),
  skipped: z.array(SkippedRowSchema),
  summary: ImportSummarySchema,
  // Built on the server: csvSafe must run where a record is written out as CSV,
  // and the browser must not have to import core to get it.
  csv: z.string(),
})

export type ImportResult = z.infer<typeof ImportResultSchema>
