import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { ImportResultSchema, MAX_UPLOAD_BYTES } from '@groweasy/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { app } from '../app.js'

const KEY = 'GOOGLE_GENERATIVE_AI_API_KEY'

let server: Server
let base: string
let savedKey: string | undefined

beforeAll(() => {
  // Force the heuristic path: no key means refinePlan never calls Gemini, so the
  // route is deterministic and the suite runs offline.
  savedKey = process.env[KEY]
  process.env[KEY] = ''
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  if (savedKey === undefined) delete process.env[KEY]
  else process.env[KEY] = savedKey
  server.close()
})

interface ErrorEnvelope {
  error: { code: string; message: string; requestId?: string }
}

const post = (body: string | Uint8Array, contentType = 'text/csv') =>
  fetch(`${base}/api/v1/import`, { method: 'POST', headers: { 'Content-Type': contentType }, body })

const errorOf = async (res: Response) => ((await res.json()) as ErrorEnvelope).error

describe('POST /api/v1/import', () => {
  it('415s when the body is not text/csv, with the error envelope', async () => {
    const res = await post('name,email\nA,a@x.com', 'application/json')
    expect(res.status).toBe(415)

    const error = await errorOf(res)
    expect(error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
    expect(typeof error.message).toBe('string')
    expect(error.requestId).toMatch(/^req_/)
    expect(res.headers.get('x-request-id')).toMatch(/^req_/)
  })

  it('400s on an empty body', async () => {
    const res = await post(new Uint8Array(0))
    expect(res.status).toBe(400)
    expect((await errorOf(res)).code).toBe('BAD_REQUEST')
  })

  it('422s on a header row with no data rows', async () => {
    const res = await post('name,email')
    expect(res.status).toBe(422)
    expect((await errorOf(res)).code).toBe('UNPROCESSABLE_ENTITY')
  })

  it('413s on a body over the upload limit', async () => {
    const res = await post(new Uint8Array(MAX_UPLOAD_BYTES + 1))
    expect(res.status).toBe(413)
    expect((await errorOf(res)).code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('200s with a valid ImportResult, splitting contactable from skipped rows', async () => {
    const res = await post(
      'Full Name,E-mail,Phone,Lead Status\nAsha Rao,asha@x.com,9876543210,Hot\nNo Contact,,,Cold\n',
    )
    expect(res.status).toBe(200)

    const parsed = ImportResultSchema.safeParse(await res.json())
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const { records, skipped, summary } = parsed.data
    expect(summary.totalRows).toBe(2)
    expect(records.length + skipped.length).toBe(summary.totalRows)
    expect(records).toHaveLength(1)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.reason).toBe('no_contact')

    // No key was set, so the mapping degrades to the heuristic and says why.
    expect(summary.degraded).toBe(true)
    expect(summary.degradedReason).toBe('no_key')
    expect(summary.degradedDetail).toBeTruthy()
    expect(summary.llmCalls).toBe(0)
  })
})
