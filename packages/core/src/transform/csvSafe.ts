// No '\r' — the newline escape below runs first, so it can never reach the
// check. A leading tab still primes a formula in some spreadsheet importers.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t']

// A cell starting with = + - @ executes as a formula when the exported CSV is
// opened in Excel or Sheets. Newlines would split one record across two rows.
export function csvSafe(value: string): string {
  const escaped = value.replace(/\r\n|\r|\n/g, '\\n')
  if (escaped.length === 0) return escaped
  return FORMULA_TRIGGERS.includes(escaped[0] as string) ? `'${escaped}` : escaped
}
