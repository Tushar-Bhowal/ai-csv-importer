export type StatusMeta = { label: string; bar: string; stroke: string; dot: string; chip: string }

// One source of truth for how each crm_status looks, shared by the table chips
// and the distribution chart so a colour never means two things across the UI.
export const STATUS_META: Record<string, StatusMeta> = {
  GOOD_LEAD_FOLLOW_UP: {
    label: 'Good lead · follow up',
    bar: 'bg-primary',
    stroke: 'stroke-primary',
    dot: 'bg-primary',
    chip: 'bg-primary/10 ring-primary/25',
  },
  SALE_DONE: {
    label: 'Sale done',
    bar: 'bg-success',
    stroke: 'stroke-success',
    dot: 'bg-success',
    chip: 'bg-success/10 ring-success/25',
  },
  DID_NOT_CONNECT: {
    label: 'Did not connect',
    bar: 'bg-muted-foreground',
    stroke: 'stroke-muted-foreground',
    dot: 'bg-muted-foreground',
    chip: 'bg-muted-foreground/10 ring-muted-foreground/25',
  },
  BAD_LEAD: {
    label: 'Bad lead',
    bar: 'bg-destructive',
    stroke: 'stroke-destructive',
    dot: 'bg-destructive',
    chip: 'bg-destructive/10 ring-destructive/25',
  },
}

export const STATUS_ORDER = Object.keys(STATUS_META)

export const humanizeField = (field: string) => field.replace(/_/g, ' ')

// Tight labels for the completeness list, where a long name would just truncate.
const SHORT_FIELD: Record<string, string> = {
  mobile_without_country_code: 'mobile',
  country_code: 'country code',
  created_at: 'created',
  crm_status: 'status',
  crm_note: 'note',
  data_source: 'source',
  possession_time: 'possession',
  lead_owner: 'lead owner',
}

export const shortField = (field: string) => SHORT_FIELD[field] ?? humanizeField(field)
