import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyPlan,
  CRM_FIELDS,
  hasLlmKey,
  heuristicPlan,
  parseCsv,
  refinePlan,
  sampleRows,
} from '@groweasy/core'
import type { ApplyPlanResult, CrmField, CrmRecord } from '@groweasy/core'

import { FIXTURES, IMPORTED_AT, type Fixture } from './expected.js'

interface Tally {
  matched: number
  total: number
}

interface Score {
  overall: Tally
  perField: Map<CrmField, Tally>
  partitionOk: boolean
}

let hardFail = false

function assertInvariant(file: string, result: ApplyPlanResult, totalRows: number): void {
  const seen = result.records.length + result.skipped.length
  if (seen !== totalRows) {
    hardFail = true
    console.error(
      `  ✗ INVARIANT BROKEN in ${file}: ${result.records.length} + ${result.skipped.length} !== ${totalRows}`,
    )
  }
}

// Score populated cells only. A cell that is correctly blank in both expected and
// actual is not counted — leaving 13 of 15 fields empty for a given lead is normal,
// and padding the denominator with it would hide where the mapping actually differs.
// A field the file carries data for is scored; so is a field an approach wrongly
// filled (expected '' but actual not).
function scoreApproach(fixture: Fixture, result: ApplyPlanResult, rowNumbers: number[]): Score {
  const skippedRows = new Set(result.skipped.map((s) => s.rowNumber))
  const importedRows = rowNumbers.filter((n) => !skippedRows.has(n))

  // applyPlan preserves row order and pushes imported rows in order, so the i-th
  // record belongs to the i-th non-skipped row.
  const byRow = new Map<number, CrmRecord>()
  importedRows.forEach((n, i) => {
    const record = result.records[i]
    if (record) byRow.set(n, record)
  })

  const unscored = new Set(fixture.unscored ?? [])
  const overall: Tally = { matched: 0, total: 0 }
  const perField = new Map<CrmField, Tally>()

  for (const expected of fixture.imported) {
    const actual = byRow.get(expected.row)
    for (const field of CRM_FIELDS) {
      if (unscored.has(field)) continue
      const want = expected.fields[field] ?? ''
      const got = actual ? actual[field] : ''
      if (want === '' && got === '') continue

      const tally = perField.get(field) ?? { matched: 0, total: 0 }
      tally.total++
      overall.total++
      if (want === got) {
        tally.matched++
        overall.matched++
      }
      perField.set(field, tally)
    }
  }

  const expectedSkipped = new Set(fixture.skipped)
  const partitionOk =
    expectedSkipped.size === skippedRows.size &&
    [...expectedSkipped].every((n) => skippedRows.has(n))

  return { overall, perField, partitionOk }
}

const pct = (t: Tally): string =>
  t.total === 0 ? '—' : `${Math.round((100 * t.matched) / t.total)}% (${t.matched}/${t.total})`

const COL = 26

function printFixture(
  fixture: Fixture,
  parsedRows: number,
  imported: number,
  skipped: number,
  heuristic: Score,
  llm: Score | null,
): void {
  console.log(`\n▸ ${fixture.file}`)
  console.log(`  ${fixture.targets}`)

  const partitionNote = heuristic.partitionOk && (!llm || llm.partitionOk) ? 'split ✓' : 'split ✗'
  console.log(
    `  ${imported} imported · ${skipped} skipped of ${parsedRows} rows · ${partitionNote}`,
  )

  const header = llm
    ? `  ${'field'.padEnd(COL)}${'heuristic'.padEnd(16)}llm`
    : `  ${'field'.padEnd(COL)}heuristic`
  console.log(header)
  console.log(
    `  ${'overall'.padEnd(COL)}${pct(heuristic.overall).padEnd(16)}${llm ? pct(llm.overall) : ''}`,
  )

  const fields = new Set<CrmField>([...heuristic.perField.keys(), ...(llm?.perField.keys() ?? [])])
  for (const field of CRM_FIELDS) {
    if (!fields.has(field)) continue
    const h = heuristic.perField.get(field) ?? { matched: 0, total: 0 }
    const l = llm?.perField.get(field) ?? { matched: 0, total: 0 }
    const worst = Math.min(
      h.total ? h.matched / h.total : 1,
      llm && l.total ? l.matched / l.total : 1,
    )
    if (worst >= 1) continue // both approaches perfect on this field — nothing to see
    console.log(`  ${field.padEnd(COL)}${pct(h).padEnd(16)}${llm ? pct(l) : ''}`)
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, 'fixtures')
const useLlm = hasLlmKey()

const grand = { heuristic: { matched: 0, total: 0 }, llm: { matched: 0, total: 0 } }
const latencies: number[] = []
let everySplitOk = true

console.log(
  useLlm
    ? 'Running eval — heuristic baseline vs LLM (one mapping call per fixture).'
    : 'Running eval — no GOOGLE_GENERATIVE_AI_API_KEY set, heuristic baseline only.',
)

for (const fixture of FIXTURES) {
  const csv = readFileSync(join(fixturesDir, fixture.file), 'utf8')
  const parsed = parseCsv(csv)
  const rowNumbers = parsed.rows.map((r) => r.rowNumber)

  const heuristicPlanResult = heuristicPlan(parsed.headers, {
    headerRowIndex: parsed.headerRowIndex,
    sampleRows: sampleRows(parsed.rows),
  })
  const heuristicApply = applyPlan(parsed.rows, heuristicPlanResult, IMPORTED_AT)
  assertInvariant(fixture.file, heuristicApply, parsed.rows.length)
  const heuristicScore = scoreApproach(fixture, heuristicApply, rowNumbers)
  grand.heuristic.matched += heuristicScore.overall.matched
  grand.heuristic.total += heuristicScore.overall.total

  let llmScore: Score | null = null
  let imported = heuristicApply.records.length
  let skipped = heuristicApply.skipped.length

  if (useLlm) {
    const started = performance.now()
    const llmPlan = await refinePlan(parsed.headers, parsed.rows, {
      headerRowIndex: parsed.headerRowIndex,
    })
    latencies.push(performance.now() - started)
    const llmApply = applyPlan(parsed.rows, llmPlan, IMPORTED_AT)
    assertInvariant(fixture.file, llmApply, parsed.rows.length)
    llmScore = scoreApproach(fixture, llmApply, rowNumbers)
    grand.llm.matched += llmScore.overall.matched
    grand.llm.total += llmScore.overall.total
    imported = llmApply.records.length
    skipped = llmApply.skipped.length
  }

  if (!heuristicScore.partitionOk || (llmScore && !llmScore.partitionOk)) everySplitOk = false
  printFixture(fixture, parsed.rows.length, imported, skipped, heuristicScore, llmScore)
}

console.log(`\n${'─'.repeat(48)}`)
console.log('summary')
if (useLlm) {
  console.log(
    `  populated-cell accuracy   heuristic ${pct(grand.heuristic)}   ·   llm ${pct(grand.llm)}`,
  )
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length / 1000
  const max = Math.max(...latencies) / 1000
  console.log(
    `  llm mapping latency       avg ${avg.toFixed(1)}s · max ${max.toFixed(1)}s  (${latencies.length} calls)`,
  )
} else {
  console.log(
    `  populated-cell accuracy   heuristic ${pct(grand.heuristic)}   (set a key to measure the LLM lift)`,
  )
}
console.log(
  `  imported/skipped split    ${everySplitOk ? 'correct on every fixture ✓' : 'WRONG on at least one fixture ✗'}`,
)
console.log(`  ${FIXTURES.length} fixtures`)

if (hardFail) process.exitCode = 1
