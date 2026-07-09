import { describe, expect, it } from 'vitest'

import { buildNote } from './notes.js'

describe('buildNote', () => {
  it('returns an empty string when there is nothing to say', () => {
    expect(buildNote({})).toBe('')
    expect(buildNote({ base: '  ', extraEmails: [], extraPhones: [], unmapped: {} })).toBe('')
  })

  it('keeps the original note first', () => {
    expect(buildNote({ base: 'Client wants a demo' })).toBe('Client wants a demo')
  })

  it('appends the emails and phones that did not fit their own fields', () => {
    const note = buildNote({
      base: 'Follow up Monday',
      extraEmails: ['second@y.com'],
      extraPhones: ['9811122233', '9876500000'],
    })
    expect(note).toBe('Follow up Monday | Other emails: second@y.com | Other phones: 9811122233, 9876500000')
  })

  it('preserves unmapped columns so nothing the user uploaded is lost', () => {
    expect(buildNote({ unmapped: { Campaign: 'Summer', 'Ad Set': 'Retargeting' } })).toBe(
      'Campaign: Summer | Ad Set: Retargeting',
    )
  })

  it('drops blank and N/A values rather than writing noise into the note', () => {
    expect(
      buildNote({
        base: '',
        extraEmails: ['', '  '],
        extraPhones: ['N/A'],
        unmapped: { Campaign: '-', 'Ad Set': 'null', Form: 'lead_form_1' },
      }),
    ).toBe('Form: lead_form_1')
  })
})
