// No '\r' — singleLine() runs first, so it can never reach the check. A leading
// tab still primes a formula in some spreadsheet importers.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t']

// A record is one CSV row. A newline inside a field would split it across two.
export function singleLine(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\\n')
}

// A cell starting with = + - @ executes as a formula when the exported CSV is
// opened in Excel or Sheets. The leading quote is a spreadsheet escape, not part
// of the value, so it is applied here at the export boundary rather than to the
// record — which is also returned as JSON and rendered in the results table.
export function csvSafe(value: string): string {
  const line = singleLine(value)
  if (line.length === 0) return line
  return FORMULA_TRIGGERS.includes(line[0] as string) ? `'${line}` : line
}
