import { describe, expect, it } from 'vitest'

import { normalizePhone } from './normalizePhone.js'

describe('normalizePhone', () => {
  it.each([
    ['+919876543210', '+91', '9876543210'],
    ['+91 98765 43210', '+91', '9876543210'],
    ['+91-98765-43210', '+91', '9876543210'],
    ['(+91) 98765 43210', '+91', '9876543210'],
    ['919876543210', '+91', '9876543210'],
    ['00919876543210', '+91', '9876543210'],
    ['9876543210', '+91', '9876543210'],
    ['09876543210', '+91', '9876543210'],
    ['  9876543210  ', '+91', '9876543210'],
  ])('splits %s into %s / %s', (raw, cc, mobile) => {
    expect(normalizePhone(raw)).toEqual({ countryCode: cc, mobile })
  })

  it('recovers a number Excel turned into a float', () => {
    expect(normalizePhone('9.87654321e+09')).toEqual({ countryCode: '+91', mobile: '9876543210' })
    expect(normalizePhone('9876543210.0')).toEqual({ countryCode: '+91', mobile: '9876543210' })
  })

  it('keeps a non-Indian number on its own country code', () => {
    expect(normalizePhone('+1 415 555 2671')).toEqual({ countryCode: '+1', mobile: '4155552671' })
    expect(normalizePhone('+44 20 7946 0958')).toEqual({ countryCode: '+44', mobile: '2079460958' })
  })

  it('honours a different default country', () => {
    expect(normalizePhone('4155552671', '+1')).toEqual({ countryCode: '+1', mobile: '4155552671' })
  })

  it('accepts the digit-length boundaries and rejects outside them', () => {
    expect(normalizePhone('1'.repeat(7))).not.toBeNull()
    expect(normalizePhone('1'.repeat(15))).not.toBeNull()
    expect(normalizePhone('1'.repeat(6))).toBeNull()
    expect(normalizePhone('1'.repeat(16))).toBeNull()
  })

  it.each(['', '   ', 'N/A', '-', 'null', 'not a phone', '123', '1'.repeat(16)])(
    'returns null for %o',
    (raw) => {
      expect(normalizePhone(raw)).toBeNull()
    },
  )

  it('never leaves a + inside the national digits', () => {
    const parts = normalizePhone('+91 (98765) 43210')
    expect(parts?.mobile).toMatch(/^\d+$/)
    expect(parts?.countryCode).toMatch(/^\+\d+$/)
  })
})
