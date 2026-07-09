import { describe, expect, it } from 'vitest'

import { AppError, errorBody } from './index.js'

describe('AppError', () => {
  it('derives the HTTP status from the code', () => {
    expect(new AppError('NOT_FOUND', 'nope').status).toBe(404)
    expect(new AppError('PAYLOAD_TOO_LARGE', 'too big').status).toBe(413)
    expect(new AppError('INTERNAL', 'boom').status).toBe(500)
  })

  it('passes an AppError through unchanged', () => {
    const original = new AppError('BAD_REQUEST', 'bad csv', { row: 3 })
    expect(AppError.from(original)).toBe(original)
  })

  it('never leaks the message of an unknown error to the client', () => {
    const leaky = new Error('connect ECONNREFUSED postgres://user:hunter2@10.0.0.4:5432')

    const wrapped = AppError.from(leaky)

    expect(wrapped.code).toBe('INTERNAL')
    expect(wrapped.message).not.toContain('hunter2')
    expect(wrapped.cause).toBe(leaky)
  })

  it('wraps a non-Error throw', () => {
    expect(AppError.from('a string').code).toBe('INTERNAL')
    expect(AppError.from(undefined).status).toBe(500)
  })
})

describe('errorBody', () => {
  it('omits details and requestId when absent', () => {
    expect(errorBody(new AppError('NOT_FOUND', 'nope'))).toEqual({
      error: { code: 'NOT_FOUND', message: 'nope' },
    })
  })

  it('includes details and requestId when present', () => {
    const err = new AppError('PAYLOAD_TOO_LARGE', 'CSV exceeds the limit.', {
      sizeBytes: 8_912_345,
      limitBytes: 5_242_880,
    })

    expect(errorBody(err, 'req_123')).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'CSV exceeds the limit.',
        details: { sizeBytes: 8_912_345, limitBytes: 5_242_880 },
        requestId: 'req_123',
      },
    })
  })
})
