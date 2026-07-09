import { z } from 'zod'

import { CRM_FIELDS } from './crm.js'

export const MAPPING_STRATEGIES = [
  'direct', // copy the cell as-is
  'concat', // join several columns: First Name + Last Name → name
  'phone_split', // one phone column → country_code + mobile_without_country_code
  'date_parse', // parse using dateFormat, emit 'YYYY-MM-DD HH:mm:ss'
  'enum_map', // map source words onto a closed set via valueMap
] as const

export const ColumnMappingSchema = z.object({
  target: z.enum(CRM_FIELDS),
  sourceColumns: z.array(z.string()).min(1),
  strategy: z.enum(MAPPING_STRATEGIES),
  // 'dd/MM/yyyy' etc. Resolves 13/05 vs 05/13 — only a reader of many sample
  // rows (the LLM, or a human) can know which one a file uses.
  dateFormat: z.string().optional(),
  // enum_map only: {'Hot':'GOOD_LEAD_FOLLOW_UP', 'Closed':'SALE_DONE'}
  valueMap: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
})

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>

export const MappingPlanSchema = z.object({
  columns: z.array(ColumnMappingSchema),
  // Unmapped-but-informative columns; their values are appended to crm_note so
  // nothing the user uploaded is silently lost.
  noteColumns: z.array(z.string()),
  ignoreColumns: z.array(z.string()),
  // Excel exports often carry title/preamble rows above the real header.
  headerRowIndex: z.number().int().min(0),
  defaultCountryCode: z.string().default('+91'),
  // true ⇒ the LLM was unavailable and this plan came from heuristics alone.
  degraded: z.boolean().default(false),
})

export type MappingPlan = z.infer<typeof MappingPlanSchema>

// A plan is only trustworthy relative to the file it was made for: every
// column it names must exist in the real header row. Anything else — a model
// hallucination or a hostile client — is dropped, not obeyed.
export function sanitizePlan(plan: MappingPlan, headers: readonly string[]): MappingPlan {
  const known = new Set(headers)
  return {
    ...plan,
    columns: plan.columns.filter((c) => c.sourceColumns.every((s) => known.has(s))),
    noteColumns: plan.noteColumns.filter((c) => known.has(c)),
    ignoreColumns: plan.ignoreColumns.filter((c) => known.has(c)),
  }
}
