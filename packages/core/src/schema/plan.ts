import { z } from 'zod'

import { CRM_FIELDS, CRM_STATUS, DATA_SOURCE } from './crm.js'

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
  defaultCountryCode: z.string().regex(/^\+\d{1,4}$/).default('+91'),
  /** The LLM was unavailable; this plan came from heuristics alone. */
  degraded: z.boolean().default(false),
})

export type MappingPlan = z.infer<typeof MappingPlanSchema>

// Gemini's structured output takes an OpenAPI subset. @ai-sdk/google converts our
// JSON Schema by copying a fixed whitelist of keywords — type, description,
// required, properties, items, allOf, anyOf, oneOf, format, const, minLength,
// enum — and silently drops the rest. `additionalProperties` is dropped, so a
// z.record() arrives as a bare `{"type":"object"}` and comes back `{}`. A list of
// pairs survives, and pins `to` to the allowed values, so the model cannot name a
// fifth status.
export const ValueMapEntrySchema = z.object({
  from: z.string(), // the file's own word, e.g. 'Ring Back Later'
  to: z.enum([...CRM_STATUS, ...DATA_SOURCE]),
})

// maxLength, minimum, maximum, pattern and minItems are dropped too. A bound the
// model never sees but Zod still enforces is a tripwire: one over-long `reasoning`
// would fail validation and throw the whole plan away. So the draft states shape
// only. `fromDraft` applies the bounds afterwards, where overshooting costs a
// truncation instead of the entire mapping.
const PlanDraftColumnSchema = ColumnMappingSchema.omit({
  sourceColumns: true,
  valueMap: true,
  confidence: true,
  reasoning: true,
}).extend({
  sourceColumns: z.array(z.string()),
  valueMap: z.array(ValueMapEntrySchema).optional(),
  confidence: z.number(),
  reasoning: z.string(),
})

// What the model is allowed to decide. `headerRowIndex` we already measured,
// `degraded` reports whether the model answered at all, and `defaultCountryCode`
// is a CRM constant — none of the three is its to say.
export const PlanDraftSchema = MappingPlanSchema.omit({
  headerRowIndex: true,
  degraded: true,
  defaultCountryCode: true,
}).extend({ columns: z.array(PlanDraftColumnSchema) })

export type PlanDraft = z.infer<typeof PlanDraftSchema>

/** The heuristic plan, reduced to the shape the model is asked to correct. */
export function toDraft(plan: MappingPlan): PlanDraft {
  return {
    columns: plan.columns.map(({ valueMap: _valueMap, ...column }) => column),
    noteColumns: plan.noteColumns,
    ignoreColumns: plan.ignoreColumns,
  }
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

const MAX_REASONING = 200

// 'yyyy-MM-dd HH:mm:ss.SSSXXX' is 26. Anything longer is not a date pattern, and
// it would reach coerceDate once per row. Truncating would only make it nonsense,
// so drop it: coerceDate then falls back to ISO and native parsing.
const MAX_DATE_FORMAT = 32

export function fromDraft(draft: PlanDraft, headerRowIndex: number): MappingPlan {
  return {
    columns: draft.columns
      .filter((c) => c.sourceColumns.length > 0)
      .map(({ valueMap, confidence, reasoning, dateFormat, ...column }) => ({
        ...column,
        confidence: clamp01(confidence),
        reasoning: reasoning.slice(0, MAX_REASONING),
        ...(dateFormat && dateFormat.length <= MAX_DATE_FORMAT ? { dateFormat } : {}),
        // coerceEnum looks the raw value up verbatim, then lowercased.
        ...(valueMap?.length
          ? { valueMap: Object.fromEntries(valueMap.map((e) => [e.from.trim().toLowerCase(), e.to])) }
          : {}),
      })),
    noteColumns: draft.noteColumns,
    ignoreColumns: draft.ignoreColumns,
    headerRowIndex,
    defaultCountryCode: '+91',
    degraded: false,
  }
}

// Every column a plan names must exist in the real header row. A hallucinated
// or hostile name is dropped, not obeyed.
export function sanitizePlan(plan: MappingPlan, headers: readonly string[]): MappingPlan {
  const known = new Set(headers)
  const columns = plan.columns.filter((c) => c.sourceColumns.every((s) => known.has(s)))
  const ignoreColumns = plan.ignoreColumns.filter((c) => known.has(c))

  // A column already read into a field, or explicitly ignored, must not also be
  // appended to crm_note: the value would appear twice in the record.
  const spoken = new Set([...columns.flatMap((c) => c.sourceColumns), ...ignoreColumns])

  return {
    ...plan,
    columns,
    ignoreColumns,
    noteColumns: plan.noteColumns.filter((c) => known.has(c) && !spoken.has(c)),
  }
}
