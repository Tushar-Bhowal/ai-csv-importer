import { z } from 'zod'

export const CRM_STATUS = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const

export const DATA_SOURCE = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const

export const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
] as const

export type CrmField = (typeof CRM_FIELDS)[number]

// '' rather than null throughout: a record's terminal form is a CSV row, and ''
// is what an empty cell is. The two closed sets allow '' for the same reason.
export const CrmRecordSchema = z.object({
  created_at: z.string(), // 'YYYY-MM-DD HH:mm:ss' — always new Date()-parseable
  name: z.string(),
  email: z.string(),
  country_code: z.string(), // '+91' style, with the plus
  mobile_without_country_code: z.string(), // bare digits
  company: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  lead_owner: z.string(),
  crm_status: z.enum(CRM_STATUS).or(z.literal('')),
  crm_note: z.string(), // newlines escaped as literal \n
  data_source: z.enum(DATA_SOURCE).or(z.literal('')),
  possession_time: z.string(),
  description: z.string(),
})

export type CrmRecord = z.infer<typeof CrmRecordSchema>

export const EMPTY_RECORD: CrmRecord = Object.freeze(
  Object.fromEntries(CRM_FIELDS.map((f) => [f, ''])),
) as CrmRecord
