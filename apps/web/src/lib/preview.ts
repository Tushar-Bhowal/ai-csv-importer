import Papa from 'papaparse'

export interface PreviewData {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}

export const PREVIEW_ROW_CAP = 100

export class PreviewError extends Error {}

// Mirrors packages/core/src/parse/parseCsv.ts: real exports carry blank and
// duplicate header names, which would otherwise collide in a header→value map.
function normalizeHeaders(raw: readonly string[]): string[] {
  const used = new Set<string>()
  return raw.map((cell, i) => {
    const base = cell.trim() === '' ? `column_${i + 1}` : cell.trim()
    let name = base
    let n = 2
    while (used.has(name)) name = `${base}_${n++}`
    used.add(name)
    return name
  })
}

const isBlankRow = (row: readonly string[]) => row.every((c) => c.trim() === '')

const looksNumeric = (cell: string) => /^[\d\s.,/:+-]+$/.test(cell)
const looksLikeData = (cell: string) => cell.includes('@') || cell.length > 40

// Mirrors packages/core's detectHeaderRow so a title/preamble above the header previews
// on the same row the server will pick. Ties go to the earliest row.
function detectHeaderRow(rows: readonly string[][], lookahead = 10): number {
  let best = 0
  let bestScore = -Infinity
  const limit = Math.min(rows.length, lookahead)
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? []
    const filled = row.filter((c) => c.trim() !== '')
    if (filled.length === 0) continue

    let score = filled.length
    score -= filled.filter(looksNumeric).length * 2
    score -= filled.filter(looksLikeData).length * 2
    const distinct = new Set(filled.map((c) => c.trim().toLowerCase())).size
    score -= filled.length - distinct

    const below = rows.slice(i + 1, i + 4).filter((r) => r.some((c) => c.trim() !== ''))
    if (below.length > 0 && below.every((r) => r.length === row.length)) score += 3

    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

/** Parses the CSV in the browser for the preview only — no network, no AI. */
export async function parsePreview(file: File): Promise<PreviewData> {
  const raw = await file.text()
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  if (text.trim() === '') throw new PreviewError('That file is empty.')

  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false })
  const grid = result.data.map((row) => row.map((cell) => (cell ?? '').trim()))

  const headerIndex = detectHeaderRow(grid)
  const headers = normalizeHeaders(grid[headerIndex] ?? [])

  const rows: Record<string, string>[] = []
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? []
    if (isBlankRow(row)) continue
    const cells: Record<string, string> = {}
    headers.forEach((header, col) => {
      cells[header] = row[col] ?? ''
    })
    rows.push(cells)
  }

  if (rows.length === 0) throw new PreviewError('That file has a header row but no data rows.')

  return { headers, rows: rows.slice(0, PREVIEW_ROW_CAP), totalRows: rows.length }
}
