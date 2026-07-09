import { describe, expect, it } from 'vitest'

import { coerceDate } from './coerceDate.js'

const parses = (value: string) => !Number.isNaN(new Date(value).getTime())

describe('coerceDate', () => {
  it('preserves the instant of an ISO timestamp, in any timezone', () => {
    const iso = '2026-05-13T14:20:48Z'
    expect(new Date(coerceDate(iso)).getTime()).toBe(new Date(iso).getTime())
  })

  it('accepts the format the sample CRM file uses', () => {
    expect(coerceDate('2026-05-13 14:20:48')).toBe('2026-05-13 14:20:48')
  })

  it('resolves the dd/MM vs MM/dd ambiguity from the supplied format, not a guess', () => {
    expect(coerceDate('13/05/2026', 'dd/MM/yyyy')).toBe('2026-05-13 00:00:00')
    expect(coerceDate('05/13/2026', 'MM/dd/yyyy')).toBe('2026-05-13 00:00:00')
    // Same eight characters, two different dates. Only the format tells them apart.
    expect(coerceDate('05/06/2026', 'dd/MM/yyyy')).toBe('2026-06-05 00:00:00')
    expect(coerceDate('05/06/2026', 'MM/dd/yyyy')).toBe('2026-05-06 00:00:00')
  })

  it('decodes an Excel serial date', () => {
    expect(coerceDate('45678')).toBe('2025-01-21 00:00:00')
  })

  it('does not mistake a phone number or a year for an Excel serial', () => {
    expect(coerceDate('9876543210')).toBe('')
    expect(coerceDate('2026')).toBe('')
  })

  it.each(['', '  ', 'N/A', '-', 'null', 'not a date', 'yesterday'])(
    'returns empty string for %o rather than an Invalid Date',
    (raw) => {
      expect(coerceDate(raw)).toBe('')
    },
  )

  it('CONTRACT: every non-empty output satisfies new Date()', () => {
    const inputs = [
      '2026-05-13 14:20:48',
      '2026-05-13T14:20:48+05:30',
      '13/05/2026',
      '45678',
      'May 13, 2026',
      '2026/05/13',
    ]
    for (const input of inputs) {
      const out = coerceDate(input, 'dd/MM/yyyy')
      if (out !== '') expect(parses(out), `${input} → ${out}`).toBe(true)
    }
  })
})
