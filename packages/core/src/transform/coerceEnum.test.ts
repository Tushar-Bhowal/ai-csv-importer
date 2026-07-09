import { describe, expect, it } from 'vitest'

import { coerceDataSource, coerceStatus } from './coerceEnum.js'

describe('coerceStatus', () => {
  it('accepts the canonical values however they are punctuated', () => {
    expect(coerceStatus('GOOD_LEAD_FOLLOW_UP')).toBe('GOOD_LEAD_FOLLOW_UP')
    expect(coerceStatus('good lead follow up')).toBe('GOOD_LEAD_FOLLOW_UP')
    expect(coerceStatus('sale-done')).toBe('SALE_DONE')
  })

  it.each([
    ['Hot', 'GOOD_LEAD_FOLLOW_UP'],
    ['Interested', 'GOOD_LEAD_FOLLOW_UP'],
    ['Not Dialed', 'DID_NOT_CONNECT'],
    ['Busy', 'DID_NOT_CONNECT'],
    ['Cold', 'BAD_LEAD'],
    ['Not Interested', 'BAD_LEAD'],
    ['Closed Won', 'SALE_DONE'],
    ['Converted', 'SALE_DONE'],
  ])('maps the common CRM word %s to %s with no AI call', (raw, expected) => {
    expect(coerceStatus(raw)).toBe(expected)
  })

  it("prefers the plan's valueMap over its own synonyms", () => {
    expect(coerceStatus('Hot', { Hot: 'SALE_DONE' })).toBe('SALE_DONE')
  })

  it('ignores a valueMap entry that is not an allowed status', () => {
    expect(coerceStatus('Hot', { Hot: 'TOTALLY_MADE_UP' })).toBe('GOOD_LEAD_FOLLOW_UP')
  })

  it.each(['', 'N/A', '-', 'purple', 'Stage 4'])('returns empty for the unmappable %o', (raw) => {
    expect(coerceStatus(raw)).toBe('')
  })
})

describe('coerceDataSource', () => {
  it('accepts an exact internal project name', () => {
    expect(coerceDataSource('meridian_tower')).toBe('meridian_tower')
    expect(coerceDataSource('Sarjapur Plots')).toBe('sarjapur_plots')
  })

  it('REFUSES to guess: an external source word maps to blank, never invented', () => {
    for (const raw of ['Facebook', 'Google Ads', 'Website', 'Campaign 4', 'leads']) {
      expect(coerceDataSource(raw)).toBe('')
    }
  })

  it('still honours an explicit mapping the user or model supplied', () => {
    expect(coerceDataSource('Tower Campaign', { 'Tower Campaign': 'meridian_tower' })).toBe(
      'meridian_tower',
    )
  })
})
