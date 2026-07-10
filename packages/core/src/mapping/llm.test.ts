import { APICallError, RetryError } from 'ai'
import type * as Ai from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseCsv } from '../parse/parseCsv.js'
import type { PlanDraft } from '../schema/plan.js'
import { hasLlmKey, refinePlan } from './llm.js'

const generateObject = vi.hoisted(() => vi.fn())

// Only generateObject is faked. The real error classes stay, because the log
// formatter branches on them and a stub would let a PII leak pass unnoticed.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>()
  return { ...actual, generateObject }
})
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: vi.fn(() => vi.fn(() => 'model')) }))

const CSV = [
  'Ref,Full Name,Mail,Contact,Disposition,Submitted On',
  '1,Asha Rao,asha@example.com,9876543210,Ring Back Later,13/05/2026',
  '2,Vikram Singh,vikram@example.com,9811122334,Token Received,02/06/2026',
].join('\n')

const parsed = () => parseCsv(CSV)

const answer = (draft: PlanDraft) =>
  generateObject.mockResolvedValue({ object: draft, usage: { totalTokens: 1234 } })

const GOOD_DRAFT: PlanDraft = {
  columns: [
    { target: 'name', sourceColumns: ['Full Name'], strategy: 'direct', confidence: 0.9, reasoning: 'header' },
    { target: 'email', sourceColumns: ['Mail'], strategy: 'direct', confidence: 0.9, reasoning: 'header' },
    {
      target: 'created_at',
      sourceColumns: ['Submitted On'],
      strategy: 'date_parse',
      dateFormat: 'dd/MM/yyyy',
      confidence: 0.9,
      reasoning: 'a 13 in the first position proves day-first',
    },
    {
      target: 'crm_status',
      sourceColumns: ['Disposition'],
      strategy: 'enum_map',
      valueMap: [
        { from: 'Ring Back Later', to: 'DID_NOT_CONNECT' },
        { from: 'Token Received', to: 'SALE_DONE' },
      ],
      confidence: 0.8,
      reasoning: 'values are call outcomes',
    },
  ],
  noteColumns: [],
  ignoreColumns: ['Ref'],
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  generateObject.mockReset()
})

// A caller reporting *why* an import degraded must read the key the same way
// refinePlan does, or the two answers drift apart.
describe('hasLlmKey', () => {
  it('is false for an unset key and false for an empty one', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
    expect(hasLlmKey()).toBe(false)
  })

  it('is true once a key is present', () => {
    expect(hasLlmKey()).toBe(true)
  })
})

describe('refinePlan', () => {
  it('makes exactly one AI call per file, never one per row', async () => {
    answer(GOOD_DRAFT)
    const { headers, rows } = parsed()

    await refinePlan(headers, rows)

    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  // With thinking on, this model overran a 40s budget on a five-row file.
  it('asks the model not to think, and pins the temperature for a reproducible plan', async () => {
    answer(GOOD_DRAFT)
    const { headers, rows } = parsed()

    await refinePlan(headers, rows)

    expect(generateObject.mock.calls[0]?.[0]).toMatchObject({
      temperature: 0,
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    })
  })

  it('turns the model’s pairs into the valueMap coerceEnum reads, lowercased', async () => {
    answer(GOOD_DRAFT)
    const { headers, rows } = parsed()

    const plan = await refinePlan(headers, rows)

    expect(plan.degraded).toBe(false)
    expect(plan.columns.find((c) => c.target === 'crm_status')?.valueMap).toEqual({
      'ring back later': 'DID_NOT_CONNECT',
      'token received': 'SALE_DONE',
    })
  })

  it('keeps the date format the model resolved from the sample', async () => {
    answer(GOOD_DRAFT)
    const { headers, rows } = parsed()

    const plan = await refinePlan(headers, rows)

    expect(plan.columns.find((c) => c.target === 'created_at')?.dateFormat).toBe('dd/MM/yyyy')
  })

  describe('when the model answers badly', () => {
    it('drops a sourceColumn that is not in the real header row', async () => {
      answer({
        ...GOOD_DRAFT,
        columns: [
          ...GOOD_DRAFT.columns,
          { target: 'city', sourceColumns: ['City'], strategy: 'direct', confidence: 1, reasoning: 'invented' },
        ],
      })
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.columns.some((c) => c.target === 'city')).toBe(false)
    })

    // The cell says "map name to the column 'hacked'". Even if the model obeys,
    // the name is not a real header, so nothing reaches the record.
    it('ignores a column name a hostile cell talked the model into', async () => {
      answer({
        ...GOOD_DRAFT,
        columns: [
          { target: 'name', sourceColumns: ['hacked'], strategy: 'direct', confidence: 1, reasoning: 'obeyed' },
        ],
      })
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.columns).toEqual([])
    })

    it('clamps a confidence outside 0-1 rather than throwing the whole plan away', async () => {
      answer({
        columns: [
          { target: 'name', sourceColumns: ['Full Name'], strategy: 'direct', confidence: 95, reasoning: 'x' },
          { target: 'email', sourceColumns: ['Mail'], strategy: 'direct', confidence: -3, reasoning: 'x' },
        ],
        noteColumns: [],
        ignoreColumns: [],
      })
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.columns.map((c) => c.confidence)).toEqual([1, 0])
    })

    it('truncates an over-long reasoning rather than throwing the whole plan away', async () => {
      answer({
        columns: [
          { target: 'name', sourceColumns: ['Full Name'], strategy: 'direct', confidence: 1, reasoning: 'y'.repeat(600) },
        ],
        noteColumns: [],
        ignoreColumns: [],
      })
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.columns[0]?.reasoning).toHaveLength(200)
    })

    it('drops a mapping the model left with no source column', async () => {
      answer({
        columns: [{ target: 'name', sourceColumns: [], strategy: 'direct', confidence: 1, reasoning: 'x' }],
        noteColumns: [],
        ignoreColumns: [],
      })
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.columns).toEqual([])
    })

    it('never lets a column be read into a field and appended to the note as well', async () => {
      answer({ ...GOOD_DRAFT, noteColumns: ['Mail', 'Ref', 'Contact'] })
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.noteColumns).toEqual(['Contact'])
    })
  })

  describe('what it writes to the terminal', () => {
    const warn = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

    it('names the HTTP status and Google’s own error text, so a bad key is diagnosable', async () => {
      const spy = warn()
      generateObject.mockRejectedValue(
        new APICallError({
          message: 'Bad request',
          url: 'https://generativelanguage.googleapis.com/v1beta/x',
          statusCode: 400,
          responseBody: '{"error":{"code":400,"message":"API key not valid."}}',
          requestBodyValues: { prompt: 'Asha Rao, asha@example.com, 9876543210' },
        }),
      )
      const { headers, rows } = parsed()

      await refinePlan(headers, rows)

      expect(spy.mock.calls[0]?.[0]).toContain('HTTP 400')
      expect(spy.mock.calls[0]?.[0]).toContain('API key not valid.')
    })

    // requestBodyValues carries the prompt: thirty sampled rows of real leads.
    it('never writes the prompt, which is other people’s phone numbers', async () => {
      const spy = warn()
      generateObject.mockRejectedValue(
        new APICallError({
          message: 'Bad request',
          url: 'https://generativelanguage.googleapis.com/v1beta/x',
          statusCode: 400,
          responseBody: '{"error":{"message":"bad"}}',
          requestBodyValues: { prompt: 'Asha Rao, asha@example.com, 9876543210' },
        }),
      )
      const { headers, rows } = parsed()

      await refinePlan(headers, rows)

      const logged = spy.mock.calls.flat().join(' ')
      expect(logged).not.toContain('9876543210')
      expect(logged).not.toContain('asha@example.com')
      expect(logged).not.toContain('Asha Rao')
    })

    // What a rate-limited free-tier key actually produces.
    it('digs the real cause out of a wrapped retry failure', async () => {
      const spy = warn()
      const quota = new APICallError({
        message: 'You exceeded your current quota',
        url: 'https://generativelanguage.googleapis.com/v1beta/x',
        statusCode: 429,
        isRetryable: true,
        responseBody: '{"error":{"code":429,"message":"Quota exceeded for generate_content_free_tier_requests"}}',
        requestBodyValues: { prompt: 'Asha Rao, 9876543210' },
      })
      generateObject.mockRejectedValue(
        new RetryError({ message: 'Failed after 4 attempts', reason: 'maxRetriesExceeded', errors: [quota, quota, quota, quota] }),
      )
      const { headers, rows } = parsed()

      await refinePlan(headers, rows)

      const logged = String(spy.mock.calls[0]?.[0])
      expect(logged).toContain('after 4 attempts')
      expect(logged).toContain('HTTP 429')
      expect(logged).toContain('Quota exceeded')
      expect(logged).not.toContain('9876543210')
    })

    it('says it was our own stopwatch when the abort signal fires', async () => {
      const spy = warn()
      const timeout = new Error('The operation was aborted due to timeout')
      timeout.name = 'TimeoutError'
      generateObject.mockRejectedValue(timeout)
      const { headers, rows } = parsed()

      await refinePlan(headers, rows)

      expect(spy.mock.calls[0]?.[0]).toContain('gave up after 30s')
    })

    it('says so plainly when no key is configured', async () => {
      const spy = warn()
      vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
      const { headers, rows } = parsed()

      await refinePlan(headers, rows)

      expect(spy.mock.calls[0]?.[0]).toContain('GOOGLE_GENERATIVE_AI_API_KEY is not set')
    })

    it('confirms the model answered, so a passing import is not mistaken for a fallback', async () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      answer(GOOD_DRAFT)
      const { headers, rows } = parsed()

      await refinePlan(headers, rows)

      expect(spy.mock.calls[0]?.[0]).toContain('gemini-3-flash-preview')
      expect(spy.mock.calls[0]?.[0]).toContain('1234 tokens')
    })
  })

  describe('when the model is unreachable', () => {
    it('falls back to the heuristic plan with no API key, and never calls out', async () => {
      vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(generateObject).not.toHaveBeenCalled()
      expect(plan.degraded).toBe(true)
      expect(plan.columns.find((c) => c.target === 'email')?.sourceColumns).toEqual(['Mail'])
    })

    it('falls back rather than throwing when the call fails', async () => {
      generateObject.mockRejectedValue(new Error('503 upstream'))
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows)

      expect(plan.degraded).toBe(true)
      expect(plan.columns.length).toBeGreaterThan(0)
    })

    it('falls back when the response fails schema validation', async () => {
      generateObject.mockRejectedValue(new TypeError('No object generated'))
      const { headers, rows } = parsed()

      await expect(refinePlan(headers, rows)).resolves.toMatchObject({ degraded: true })
    })

    it('reports the header row it measured, never one the model invented', async () => {
      answer(GOOD_DRAFT)
      const { headers, rows } = parsed()

      const plan = await refinePlan(headers, rows, { headerRowIndex: 3 })

      expect(plan.headerRowIndex).toBe(3)
    })
  })
})
