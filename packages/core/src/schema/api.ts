import { z } from 'zod'

import { CrmRecordSchema } from './crm.js'
import { MappingPlanSchema } from './plan.js'

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

export const UsageSchema = z.object({
  model: z.string(),
  tokens: z.number().int().min(0),
  costInr: z.number().min(0),
  ms: z.number().min(0),
})

export type Usage = z.infer<typeof UsageSchema>

export const AnalyzeResponseSchema = z.object({
  totalRows: z.number().int().min(0),
  headers: z.array(z.string()),
  previewRows: z.array(z.record(z.string(), z.string())),
  plan: MappingPlanSchema,
  usage: UsageSchema.optional(), // absent when the heuristic fallback produced the plan
})

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>

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
  records: z.array(CrmRecordSchema),
  skipped: z.array(SkippedRowSchema),
  summary: ImportSummarySchema,
})

export type ImportResult = z.infer<typeof ImportResultSchema>
