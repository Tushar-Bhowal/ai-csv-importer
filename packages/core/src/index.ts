export { AppError, ERROR_STATUS, errorBody } from './errors/index.js'
export type { ErrorBody, ErrorCode } from './errors/index.js'

export { CRM_FIELDS, CRM_STATUS, CrmRecordSchema, DATA_SOURCE, EMPTY_RECORD } from './schema/crm.js'
export type { CrmField, CrmRecord } from './schema/crm.js'

export {
  ColumnMappingSchema,
  fromDraft,
  MAPPING_STRATEGIES,
  MappingPlanSchema,
  PlanDraftSchema,
  sanitizePlan,
  toDraft,
  ValueMapEntrySchema,
} from './schema/plan.js'
export type { ColumnMapping, MappingPlan, PlanDraft } from './schema/plan.js'

export {
  DEGRADED_REASONS,
  ImportResultSchema,
  ImportSummarySchema,
  MAX_UPLOAD_BYTES,
  SKIP_REASONS,
  SkippedRowSchema,
} from './schema/api.js'
export type { ImportResult, ImportSummary, SkippedRow } from './schema/api.js'

export { decodeCsvBuffer } from './parse/decode.js'
export { detectHeaderRow } from './parse/detectHeaderRow.js'
export { parseCsv } from './parse/parseCsv.js'
export type { CsvRow, ParsedCsv } from './parse/parseCsv.js'

export { heuristicPlan } from './mapping/heuristic.js'
export { hasLlmKey, refinePlan } from './mapping/llm.js'
export type { RefinePlanOptions } from './mapping/llm.js'
export { sampleRows } from './mapping/sample.js'

export { applyPlan } from './transform/applyPlan.js'
export type { ApplyPlanResult } from './transform/applyPlan.js'
export { coerceDate, CRM_DATE_FORMAT } from './transform/coerceDate.js'
export { coerceDataSource, coerceStatus } from './transform/coerceEnum.js'
export { csvSafe, singleLine } from './transform/csvSafe.js'
export { findEmails, findPhones, isBlank } from './transform/extract.js'
export { normalizePhone } from './transform/normalizePhone.js'
export type { PhoneParts } from './transform/normalizePhone.js'
export { buildNote } from './transform/notes.js'
export { isContactable } from './transform/skipPolicy.js'
