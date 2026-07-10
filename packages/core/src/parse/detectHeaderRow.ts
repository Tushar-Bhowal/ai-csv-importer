const looksNumeric = (cell: string) => /^[\d\s.,/:+-]+$/.test(cell)
const looksLikeData = (cell: string) => cell.includes('@') || cell.length > 40

// Excel exports often carry a title or a date line above the real header.
// Ties go to the earliest row, because headers come first.
export function detectHeaderRow(rows: readonly string[][], lookahead = 10): number {
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

    // Blank rows — a trailing newline's empty final row, or a separator line —
    // carry no width, so they must not break the agreement between a header and
    // the data under it. Compare only the non-blank rows in the window.
    const below = rows.slice(i + 1, i + 4).filter((r) => r.some((c) => c.trim() !== ''))
    if (below.length > 0 && below.every((r) => r.length === row.length)) score += 3

    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }

  return best
}
