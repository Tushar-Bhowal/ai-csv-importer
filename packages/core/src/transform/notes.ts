import { isBlank } from './extract.js'

export interface NoteParts {
  base?: string
  extraEmails?: string[]
  extraPhones?: string[]
  /** Columns the plan did not map. crm_note is the lossless channel. */
  unmapped?: Record<string, string>
}

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
