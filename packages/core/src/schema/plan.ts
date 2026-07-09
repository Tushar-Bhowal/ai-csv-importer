import { z } from 'zod'

import { CRM_FIELDS } from './crm.js'

export const MAPPING_STRATEGIES = [
  'direct',
  'concat', // First Name + Last Name → name
  'phone_split', // one column → country_code + mobile_without_country_code
  'date_parse', // parse with dateFormat, emit 'YYYY-MM-DD HH:mm:ss'
  'enum_map', // map source words onto a closed set via valueMap
] as const

export const ColumnMappingSchema = z.object({
  target: z.enum(CRM_FIELDS),
  sourceColumns: z.array(z.string()).min(1),
  strategy: z.enum(MAPPING_STRATEGIES),
  // 'dd/MM/yyyy'. Resolves 13/05 vs 05/13, which one row cannot.
  dateFormat: z.string().optional(),
  // enum_map only: {'Hot':'GOOD_LEAD_FOLLOW_UP'}
  valueMap: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
})

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>

export const MappingPlanSchema = z.object({
  columns: z.array(ColumnMappingSchema),
  /** Appended to crm_note, so nothing the user uploaded is lost. */
  noteColumns: z.array(z.string()),
  ignoreColumns: z.array(z.string()),
  headerRowIndex: z.number().int().min(0),
  defaultCountryCode: z.string().default('+91'),
  /** The LLM was unavailable; this plan came from heuristics alone. */
  degraded: z.boolean().default(false),
})

export type MappingPlan = z.infer<typeof MappingPlanSchema>

// Every column a plan names must exist in the real header row. A hallucinated
// or hostile name is dropped, not obeyed.
export function sanitizePlan(plan: MappingPlan, headers: readonly string[]): MappingPlan {
  const known = new Set(headers)
  return {
    ...plan,
    columns: plan.columns.filter((c) => c.sourceColumns.every((s) => known.has(s))),
    noteColumns: plan.noteColumns.filter((c) => known.has(c)),
    ignoreColumns: plan.ignoreColumns.filter((c) => known.has(c)),
  }
}
