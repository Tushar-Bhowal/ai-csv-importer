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

// The chart ramp is the brand's own blues, defined for both themes, so an avatar
// wash never needs a dark-mode override. Only the three lightest steps: chart-4/5
// as text on a 15% wash of themselves fall under AA in dark mode.
const AVATAR_TONES = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
]

// Deterministic: the same lead gets the same tone on every render and re-import.
export function avatarTone(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length] as string
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => (word[0] ?? '').toUpperCase())
    .join('')
