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
    // Same eight characters, two different dates.
    expect(coerceDate('05/06/2026', 'dd/MM/yyyy')).toBe('2026-06-05 00:00:00')
    expect(coerceDate('05/06/2026', 'MM/dd/yyyy')).toBe('2026-05-06 00:00:00')
  })

  // date-fns throws a RangeError on these: they mean week-numbering year and
  // day-of-year. An LLM writes them because a human would. Its own error message
  // asks for the lowercase forms, so make that substitution.
  it('reads the uppercase date tokens an LLM naturally writes', () => {
    expect(coerceDate('13/05/2026', 'DD/MM/YYYY')).toBe('2026-05-13 00:00:00')
    expect(coerceDate('05/13/2026', 'MM/DD/YYYY')).toBe('2026-05-13 00:00:00')
    expect(coerceDate('2026-05-13', 'YYYY-MM-DD')).toBe('2026-05-13 00:00:00')
  })

  it('CONTRACT: an unusable format never throws — the import must not die on one plan', () => {
    // 'zzz' is an unescaped latin character; date-fns rejects it outright.
    expect(() => coerceDate('13/05/2026', 'zzz')).not.toThrow()
    expect(() => coerceDate('13/05/2026', '$$$$')).not.toThrow()
    // The ISO and native fallbacks still stand behind the unusable format.
    expect(coerceDate('2026-05-13 14:20:48', 'zzz')).toBe('2026-05-13 14:20:48')
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

  it.each([
    '2026-05-13 14:20:48',
    '2026-05-13T14:20:48+05:30',
    '13/05/2026',
    '45678',
    'May 13, 2026',
    '2026/05/13',
  ])('CONTRACT: %s produces a non-empty string that new Date() parses', (input) => {
    const out = coerceDate(input, 'dd/MM/yyyy')
    expect(out, `${input} must not be dropped`).not.toBe('')
    expect(parses(out), `${input} → ${out}`).toBe(true)
  })
})
