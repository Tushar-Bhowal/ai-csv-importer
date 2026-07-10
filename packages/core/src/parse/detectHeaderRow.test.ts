import { describe, expect, it } from 'vitest'

import { detectHeaderRow } from './detectHeaderRow.js'

describe('detectHeaderRow', () => {
  it('picks the first row when it is an ordinary header', () => {
    expect(detectHeaderRow([['name', 'email'], ['Rahil', 'r@x.com']])).toBe(0)
  })

  it('skips a title block above the real header', () => {
    expect(
      detectHeaderRow([['Lead Export'], ['Generated 2026-05-13'], [], ['name', 'email'], ['Rahil', 'r@x.com']]),
    ).toBe(3)
  })

  it('skips a preamble even when a trailing blank row sits below the data', () => {
    // A trailing newline makes the parser emit an empty final row. It must not
    // cost the real header its width bonus, or the title row wins the tie.
    expect(
      detectHeaderRow([
        ['Leads Export', '', '', ''],
        ['Generated 2026-07-05', '', '', ''],
        ['', '', '', ''],
        ['Full Name', 'Email ID', 'Phone', 'Created'],
        ['Sanjay', 's@x.com', '+919812300011', '10/06/2026'],
        ['Pooja', 'p@x.com', '+919812300022', '22/06/2026'],
        [''],
      ]),
    ).toBe(3)
  })

  it('penalises cells that look like data, not labels', () => {
    expect(detectHeaderRow([['email', 'email', ''], ['a@b.com', 'c@d.com', 'x']])).toBe(0)
  })

  it('penalises a row of numbers', () => {
    expect(detectHeaderRow([['1', '2', '3'], ['name', 'age', 'city'], ['Rahil', '30', 'Pune']])).toBe(1)
  })

  it('rewards a row whose width the rows below agree with', () => {
    expect(detectHeaderRow([['solo'], ['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']])).toBe(1)
  })

  it('breaks ties toward the earliest row, because headers come first', () => {
    expect(detectHeaderRow([['a', 'b'], ['c', 'd'], ['e', 'f']])).toBe(0)
  })

  it('penalises very long cells, which are prose rather than labels', () => {
    const essay = 'x'.repeat(80)
    expect(detectHeaderRow([[essay, essay], ['name', 'email'], ['Rahil', 'r@x.com']])).toBe(1)
  })

  it('falls back to row 0 when every row is blank', () => {
    expect(detectHeaderRow([[''], ['  ']])).toBe(0)
  })

  it('only looks at the first `lookahead` rows', () => {
    const rows = [['name', 'email'], ...Array.from({ length: 20 }, () => ['a', 'b'])]
    expect(detectHeaderRow(rows, 2)).toBe(0)
  })
})
