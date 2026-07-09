// No '\r': the newline escape below runs first, so a leading carriage return can
// never reach this check. '\t' can, and a leading tab still primes a formula in
// some spreadsheet importers.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t']

// Two separate hazards, both about the record's terminal form: a CSV row.
//
// 1. A literal newline inside a cell would split one record across two lines.
//    Escape to a two-character \n so the record survives a round trip.
// 2. A cell beginning = + - @ is executed as a formula when the exported CSV is
//    opened in Excel or Sheets. `=cmd|'/c calc'!A1` in a lead's note is a
//    remote-code-execution vector, not a curiosity. Prefix with an apostrophe.
export function csvSafe(value: string): string {
  const escaped = value.replace(/\r\n|\r|\n/g, '\\n')
  if (escaped.length === 0) return escaped
  return FORMULA_TRIGGERS.includes(escaped[0] as string) ? `'${escaped}` : escaped
}
