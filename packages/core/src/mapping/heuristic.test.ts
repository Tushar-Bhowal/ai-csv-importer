import { describe, expect, it } from 'vitest'

import { sanitizePlan } from '../schema/plan.js'
import { heuristicPlan } from './heuristic.js'

const targets = (headers: string[], sampleRows?: Record<string, string>[]) =>
  Object.fromEntries(
    heuristicPlan(headers, sampleRows ? { sampleRows } : {}).columns.map((c) => [
      c.target,
      c.sourceColumns[0],
    ]),
  )

describe('heuristicPlan', () => {
  it('maps a Facebook Lead Ads export from header names alone', () => {
    expect(targets(['created_time', 'full_name', 'email', 'phone_number'])).toEqual({
      created_at: 'created_time',
      name: 'full_name',
      email: 'email',
      mobile_without_country_code: 'phone_number',
    })
  })

  it('maps a hand-made spreadsheet with different words for the same things', () => {
    const map = targets(['Date Created', 'Customer Name', 'Mail', 'Contact Number', 'Organisation', 'Town'])
    expect(map.created_at).toBe('Date Created')
    expect(map.name).toBe('Customer Name')
    expect(map.email).toBe('Mail')
    expect(map.mobile_without_country_code).toBe('Contact Number')
    expect(map.company).toBe('Organisation')
    expect(map.city).toBe('Town')
  })

  it('never guesses data_source, because its values are GrowEasy project names', () => {
    const plan = heuristicPlan(['name', 'email', 'Source', 'Campaign'])
    expect(plan.columns.some((c) => c.target === 'data_source')).toBe(false)
  })

  it('reads sample values when the header name gives nothing away', () => {
    const map = targets(
      ['col_a', 'col_b', 'col_c'],
      [{ col_a: 'Rahil', col_b: 'rahil@test.com', col_c: '9876543210' }],
    )
    expect(map.email).toBe('col_b')
    expect(map.mobile_without_country_code).toBe('col_c')
  })

  it('routes unmapped columns to the note, so nothing is dropped', () => {
    const plan = heuristicPlan(['name', 'email', 'Ad Set', 'Form ID'])
    expect(plan.noteColumns).toEqual(['Ad Set', 'Form ID'])
  })

  it('marks itself degraded — it is a fallback, not the intended path', () => {
    expect(heuristicPlan(['name']).degraded).toBe(true)
  })

  it('assigns each CRM field at most one source column', () => {
    const plan = heuristicPlan(['email', 'Email Address', 'work email'])
    expect(plan.columns.filter((c) => c.target === 'email')).toHaveLength(1)
  })
})

describe('sanitizePlan', () => {
  it('drops mappings that name a column the file does not have', () => {
    const plan = heuristicPlan(['name', 'email'])
    const hostile = {
      ...plan,
      columns: [
        ...plan.columns,
        {
          target: 'company' as const,
          sourceColumns: ['../../etc/passwd'],
          strategy: 'direct' as const,
          confidence: 1,
          reasoning: 'hallucinated or hostile',
        },
      ],
    }

    const clean = sanitizePlan(hostile, ['name', 'email'])
    expect(clean.columns.some((c) => c.target === 'company')).toBe(false)
    expect(clean.columns).toHaveLength(plan.columns.length)
  })

  it('filters noteColumns and ignoreColumns by the same rule', () => {
    const plan = heuristicPlan(['name', 'email', 'Budget'])
    const hostile = {
      ...plan,
      noteColumns: ['Budget', 'does_not_exist'],
      ignoreColumns: ['email', '../../secrets'],
    }

    const clean = sanitizePlan(hostile, ['name', 'email', 'Budget'])
    expect(clean.noteColumns).toEqual(['Budget'])
    expect(clean.ignoreColumns).toEqual(['email'])
  })

  it('drops a mapping where only one of several source columns is real', () => {
    const plan = heuristicPlan(['name', 'email'])
    const hostile = {
      ...plan,
      columns: [
        {
          target: 'name' as const,
          sourceColumns: ['name', 'invented'],
          strategy: 'concat' as const,
          confidence: 1,
          reasoning: 'half hallucinated',
        },
      ],
    }

    expect(sanitizePlan(hostile, ['name', 'email']).columns).toHaveLength(0)
  })
})
