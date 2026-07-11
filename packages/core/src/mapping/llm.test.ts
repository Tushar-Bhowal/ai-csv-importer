import { APICallError, RetryError } from 'ai'
import { describe, expect, it } from 'vitest'

import type { MappingPlan } from '../schema/plan.js'
import { categorizeLlmFailure, preserveOverflow, retryAfterMs } from './llm.js'

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

describe('categorizeLlmFailure', () => {
  const apiError = (statusCode: number, responseBody?: string) =>
    new APICallError({
      message: 'call failed',
      url: 'https://example.test',
      requestBodyValues: {},
      statusCode,
      ...(responseBody === undefined ? {} : { responseBody }),
    })

  it('names a 429 as rate_limited', () => {
    expect(categorizeLlmFailure(apiError(429)).reason).toBe('rate_limited')
  })

  it("names Gemini's 400 API_KEY_INVALID as invalid_key, other 400s as call_failed", () => {
    expect(categorizeLlmFailure(apiError(400, 'API key not valid. [API_KEY_INVALID]')).reason).toBe('invalid_key')
    expect(categorizeLlmFailure(apiError(400, 'malformed request')).reason).toBe('call_failed')
    expect(categorizeLlmFailure(apiError(403)).reason).toBe('invalid_key')
  })

  it('unwraps a RetryError to its last attempt', () => {
    const wrapped = new RetryError({
      message: 'retries exhausted',
      reason: 'maxRetriesExceeded',
      errors: [apiError(503), apiError(429)],
    })
    expect(categorizeLlmFailure(wrapped).reason).toBe('rate_limited')
  })

  it('names our own deadline as timeout', () => {
    const timeout = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' })
    expect(categorizeLlmFailure(timeout).reason).toBe('timeout')
  })

  it('names an unpayable retry-after bail-out as rate_limited', () => {
    expect(categorizeLlmFailure(new Error('gemini asked to wait 25s, longer than the 30s budget')).reason).toBe('rate_limited')
  })

  it('never leaks the response body into the detail', () => {
    const failure = categorizeLlmFailure(apiError(429, 'quota for project 123456789 exhausted'))
    expect(failure.detail).not.toContain('123456789')
  })

  it('falls back to call_failed for anything else', () => {
    expect(categorizeLlmFailure(new Error('socket hang up')).reason).toBe('call_failed')
    expect(categorizeLlmFailure(undefined).reason).toBe('call_failed')
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
