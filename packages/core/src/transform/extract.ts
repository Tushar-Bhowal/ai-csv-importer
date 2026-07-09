const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// Loose on purpose: libphonenumber decides validity, this only finds candidates.
const PHONE = /\+?\d[\d\s().-]{6,18}\d/g

const NULLISH = new Set(['', '-', '--', 'n/a', 'na', 'null', 'nil', 'none', 'undefined', 'nan'])

/** "N/A", "-" and friends all mean empty. */
export function isBlank(value: string | undefined | null): boolean {
  return value == null || NULLISH.has(value.trim().toLowerCase())
}

const dedupe = (values: string[]) => [...new Set(values)]

export function findEmails(text: string): string[] {
  if (isBlank(text)) return []
  return dedupe((text.match(EMAIL) ?? []).map((e) => e.trim().toLowerCase()))
}

export function findPhones(text: string): string[] {
  if (isBlank(text)) return []
  return dedupe(
    (text.match(PHONE) ?? [])
      .map((p) => p.trim())
      .filter((p) => {
        const digits = p.replace(/\D/g, '')
        return digits.length >= 7 && digits.length <= 15
      }),
  )
}
