import { describe, expect, it } from 'vitest'

import type { CsvRow } from '../parse/parseCsv.js'
import { sampleRows } from './sample.js'

const rows = (n: number, cells: (i: number) => Record<string, string> = (i) => ({ id: String(i) })): CsvRow[] =>
  Array.from({ length: n }, (_, i) => ({ rowNumber: i + 2, cells: cells(i) }))

const ids = (sample: Record<string, string>[]) => sample.map((r) => Number(r.id))

describe('sampleRows', () => {
  it('returns every row when the file is no larger than the sample', () => {
    expect(ids(sampleRows(rows(30)))).toEqual([...Array(30).keys()])
    expect(sampleRows(rows(4))).toHaveLength(4)
    expect(sampleRows([])).toEqual([])
  })

  it('takes 30 rows from a larger file: the first 10 and the last 5 among them', () => {
    const sample = ids(sampleRows(rows(1000)))

    expect(sample).toHaveLength(30)
    expect(sample.slice(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(sample.slice(-5)).toEqual([995, 996, 997, 998, 999])
  })

  // The point of the middle band: a sorted export's first rows all share one
  // status, one city, one date shape, and would teach the model nothing.
  it('reaches deep into the middle of a sorted file', () => {
    const middle = ids(sampleRows(rows(1000))).slice(10, 25)

    expect(middle).toHaveLength(15)
    expect(middle[0]).toBeGreaterThanOrEqual(10)
    expect(middle.at(-1)).toBeGreaterThan(900)
    expect([...middle].sort((a, b) => a - b)).toEqual(middle)
  })

  it('builds the same sample twice, so an eval run measures the model and not a dice roll', () => {
    expect(sampleRows(rows(500))).toEqual(sampleRows(rows(500)))
  })

  // 31 rows is the tightest the middle band ever gets: 16 rows to draw 15 from.
  it('never samples the same row twice, even one row above the cutoff', () => {
    const sample = ids(sampleRows(rows(31)))

    expect(sample).toHaveLength(30)
    expect(new Set(sample).size).toBe(30)
  })

  it('truncates a long cell so one essay cannot dominate the prompt', () => {
    const long = 'x'.repeat(500)
    const description = sampleRows(rows(1, () => ({ description: long })))[0]?.description

    expect(description).toHaveLength(121)
    expect(description?.endsWith('…')).toBe(true)
  })

  it('leaves a short cell exactly as it was', () => {
    const [first] = sampleRows(rows(1, () => ({ note: 'ready to move' })))
    expect(first?.note).toBe('ready to move')
  })
})
