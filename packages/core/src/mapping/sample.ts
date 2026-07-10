import type { CsvRow } from '../parse/parseCsv.js'

const HEAD = 10
const MIDDLE = 15
const TAIL = 5

/** One long free-text cell must not dominate the prompt's token budget. */
const MAX_CELL_CHARS = 120

const truncate = (value: string) =>
  value.length <= MAX_CELL_CHARS ? value : `${value.slice(0, MAX_CELL_CHARS)}…`

const clip = (row: CsvRow): Record<string, string> =>
  Object.fromEntries(Object.entries(row.cells).map(([k, v]) => [k, truncate(v)]))

// Exports are usually sorted, so the first 30 rows misrepresent the file: one
// status, one city, one date shape. Head, an even stride through the middle,
// then tail. The stride is deterministic rather than random — the same file must
// build the same prompt, or the eval harness measures noise.
export function sampleRows(rows: readonly CsvRow[]): Record<string, string>[] {
  const total = HEAD + MIDDLE + TAIL
  if (rows.length <= total) return rows.map(clip)

  const middleStart = HEAD
  const middleEnd = rows.length - TAIL
  const span = middleEnd - middleStart

  const middle: CsvRow[] = []
  for (let i = 0; i < MIDDLE; i++) {
    middle.push(rows[middleStart + Math.floor((i * span) / MIDDLE)] as CsvRow)
  }

  return [...rows.slice(0, HEAD), ...middle, ...rows.slice(middleEnd)].map(clip)
}
