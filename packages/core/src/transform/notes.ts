import { isBlank } from './extract.js'

export interface NoteParts {
  /** Value that was already destined for crm_note, if any. */
  base?: string
  extraEmails?: string[]
  extraPhones?: string[]
  /** Columns the plan did not map, kept so no uploaded data is lost. */
  unmapped?: Record<string, string>
}

// The brief says the first email and first mobile win, and everything left over
// goes to crm_note — including columns we could not map. A CRM note is the
// lossless channel; nothing the user uploaded is thrown away.
export function buildNote(parts: NoteParts): string {
  const segments: string[] = []

  if (!isBlank(parts.base)) segments.push((parts.base as string).trim())

  const emails = parts.extraEmails?.filter((e) => !isBlank(e)) ?? []
  if (emails.length > 0) segments.push(`Other emails: ${emails.join(', ')}`)

  const phones = parts.extraPhones?.filter((p) => !isBlank(p)) ?? []
  if (phones.length > 0) segments.push(`Other phones: ${phones.join(', ')}`)

  for (const [column, value] of Object.entries(parts.unmapped ?? {})) {
    if (!isBlank(value)) segments.push(`${column}: ${value.trim()}`)
  }

  return segments.join(' | ')
}
