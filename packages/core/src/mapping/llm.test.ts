import { describe, expect, it } from 'vitest'

import type { MappingPlan } from '../schema/plan.js'
import { preserveOverflow, retryAfterMs } from './llm.js'

const plan = (over: Partial<MappingPlan> = {}): MappingPlan => ({
  columns: [],
  noteColumns: [],
  ignoreColumns: [],
  headerRowIndex: 0,
  defaultCountryCode: '+91',
  degraded: false,
  ...over,
})

describe('retryAfterMs', () => {
  it('reads a seconds count', () => {
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': '25' } }))).toBe(25_000)
  })

  it('is null when the header is absent', () => {
    expect(retryAfterMs(new Response(null))).toBeNull()
  })

  it('is null when the header is neither a number nor a date', () => {
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': 'soon' } }))).toBeNull()
  })

  it('reads an HTTP-date as a delay from now', () => {
    const at = new Date(Date.now() + 20_000).toUTCString()
    const ms = retryAfterMs(new Response(null, { headers: { 'retry-after': at } }))

    expect(ms).not.toBeNull()
    expect(ms as number).toBeGreaterThan(15_000)
    expect(ms as number).toBeLessThanOrEqual(20_000)
  })
})

describe('preserveOverflow', () => {
  const wide = Array.from({ length: 70 }, (_, i) => `col_${i}`)

  it('appends columns past the model cap to the note, so no data is lost', () => {
    const result = preserveOverflow(plan({ noteColumns: ['col_0'] }), wide)
    // col_60..col_69 are past the 60-column cap and were never shown to the model.
    expect(result.noteColumns).toContain('col_69')
    expect(result.noteColumns).toContain('col_0')
  })

  it('does not re-add an overflow column the plan already placed', () => {
    const result = preserveOverflow(
      plan({
        columns: [{ target: 'name', sourceColumns: ['col_65'], strategy: 'direct', confidence: 1, reasoning: 'x' }],
      }),
      wide,
    )
    expect(result.noteColumns).not.toContain('col_65')
  })

  it('leaves a plan untouched when the file is within the cap', () => {
    const narrow = plan({ noteColumns: ['a'] })
    expect(preserveOverflow(narrow, ['a', 'b', 'c'])).toBe(narrow)
  })
})
