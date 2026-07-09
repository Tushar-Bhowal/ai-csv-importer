import Papa from 'papaparse'

import { decodeCsvBuffer } from './decode.js'
import { detectHeaderRow } from './detectHeaderRow.js'

export interface CsvRow {
  /** 1-based line number in the original file, as a spreadsheet shows it. */
  rowNumber: number
  cells: Record<string, string>
}

export interface ParsedCsv {
  headers: string[]
  rows: CsvRow[]
  headerRowIndex: number
  delimiter: string
}

// Real exports contain blank and duplicate header names; both would collide in
// a header→value map.
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

export function parseCsv(
  input: string | Uint8Array,
  options: { headerRowIndex?: number } = {},
): ParsedCsv {
  const text =
    typeof input === 'string'
      ? input.charCodeAt(0) === 0xfeff
        ? input.slice(1)
        : input
      : decodeCsvBuffer(input)

  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false })
  const grid = result.data.map((row) => row.map((cell) => (cell ?? '').trim()))

  const headerRowIndex = options.headerRowIndex ?? detectHeaderRow(grid)
  const headers = normalizeHeaders(grid[headerRowIndex] ?? [])

  const rows: CsvRow[] = []
  for (let i = headerRowIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? []
    if (isBlankRow(row)) continue
    const cells: Record<string, string> = {}
    headers.forEach((header, col) => {
      cells[header] = row[col] ?? ''
    })
    rows.push({ rowNumber: i + 1, cells })
  }

  return { headers, rows, headerRowIndex, delimiter: result.meta.delimiter }
}
