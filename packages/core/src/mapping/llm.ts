import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { APICallError, generateObject, NoObjectGeneratedError, RetryError } from 'ai'

import type { CsvRow } from '../parse/parseCsv.js'
import type { DegradedReason } from '../schema/api.js'
import { fromDraft, PlanDraftSchema, sanitizePlan, toDraft, type MappingPlan } from '../schema/plan.js'
import { heuristicPlan } from './heuristic.js'
import { buildPrompt, MAX_PROMPT_COLUMNS, SYSTEM_PROMPT } from './prompt.js'
import { sampleRows } from './sample.js'

// gemini-2.5-flash and -flash-lite now 404 for a new API key: "no longer available
// to new users". Of what a fresh key can reach, both flash-lite models drop
// "Site Visit Booked" from the enum map — they will not classify what they are
// unsure of — and gemini-3.5-flash answered correctly but took 33s under load.
const MODEL = 'gemini-3-flash-preview'

// It thinks by default and then overran a 40s budget on a 5-row file. Thinking off
// it answers in ~7s, with the same enum map and the same date format. Naming a
// column is recall, not reasoning.
const THINKING_OFF = { google: { thinkingConfig: { thinkingBudget: 0 } } }

// Vercel's function budget is 60s; give up well before it, so a slow model still
// leaves time to fall back to the heuristic and render a page.
const TIMEOUT_MS = 30_000

// The SDK retries a retryable APICallError with exponential backoff, honouring
// retry-after. It does not re-roll a schema validation failure — that is not
// transient, so we fall back rather than pay for the same answer twice.
const MAX_RETRIES = 3

// Bounds the cost of one call. A plan for the MAX_PROMPT_COLUMNS-wide cap sits
// well under this; the ceiling only stops a pathological generation running away.
const MAX_OUTPUT_TOKENS = 8192

// A wait that alone would spend half the deadline cannot pay off — the call that
// follows still needs 5–28s — so we abandon and fall back to the heuristic in a
// beat instead of sleeping to the deadline for the same answer.
const MAX_RETRY_AFTER_MS = TIMEOUT_MS / 2

const MAX_LOGGED_BODY = 400

export interface LlmFailure {
  reason: DegradedReason
  /** One safe human sentence, built from the status code — never Gemini's raw body. */
  detail: string
}

export interface RefinePlanOptions {
  headerRowIndex?: number
  signal?: AbortSignal
  /** A caller-supplied key wins over the environment's, for this one call only. */
  apiKey?: string
  /** Called at most once, when the plan falls back to the heuristic. */
  onDegraded?: (failure: LlmFailure) => void
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').slice(0, MAX_LOGGED_BODY)

// retry-after is either a count of seconds or an HTTP date. Returns the wait in
// milliseconds, or null when the header is absent or unparseable.
export function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return seconds * 1000
  const at = Date.parse(header)
  return Number.isNaN(at) ? null : at - Date.now()
}

/**
 * Every attempt, logged as it happens.
 *
 * The SDK retries a 429 or a 503 with backoff, all of it inside one abort signal.
 * When that signal fires we catch a TimeoutError and Gemini's actual complaint is
 * lost. So the response is named here, before anything can mask it.
 *
 * `init.body` is the prompt — thirty sampled rows of real leads. It is never read.
 */
const loggingFetch: typeof fetch = async (input, init) => {
  const startedAt = performance.now()
  const response = await fetch(input, init)
  const ms = Math.round(performance.now() - startedAt)

  if (response.ok) {
    console.info(`[core] gemini HTTP ${response.status} in ${ms}ms`)
    return response
  }

  console.warn(`[core] gemini HTTP ${response.status} in ${ms}ms — ${oneLine(await response.clone().text())}`)

  // A rate-limit or overload can name a retry-after we could never wait out inside
  // the deadline. Letting the SDK honour it only sleeps through the budget and
  // returns the heuristic anyway, so abandon now and let the caller fall back fast.
  const retryAfter = retryAfterMs(response)
  if ((response.status === 429 || response.status === 503) && retryAfter !== null && retryAfter >= MAX_RETRY_AFTER_MS) {
    throw new Error(`gemini asked to wait ${Math.round(retryAfter / 1000)}s, longer than the ${TIMEOUT_MS / 1000}s budget`)
  }

  return response
}

const google = createGoogleGenerativeAI({ fetch: loggingFetch })

// The model only ever sees the first MAX_PROMPT_COLUMNS headers, so it cannot place
// the rest. Rather than lose their data, append the surplus to crm_note — the same
// lossless channel every unmapped column already uses. Only touches wide files.
export function preserveOverflow(plan: MappingPlan, headers: readonly string[]): MappingPlan {
  if (headers.length <= MAX_PROMPT_COLUMNS) return plan

  const placed = new Set([
    ...plan.columns.flatMap((c) => c.sourceColumns),
    ...plan.ignoreColumns,
    ...plan.noteColumns,
  ])
  const overflow = headers.slice(MAX_PROMPT_COLUMNS).filter((h) => !placed.has(h))
  return overflow.length > 0 ? { ...plan, noteColumns: [...plan.noteColumns, ...overflow] } : plan
}

/** The one place the key's presence is decided. Callers report *why* they degraded. */
export const hasLlmKey = (): boolean => Boolean(process.env['GOOGLE_GENERATIVE_AI_API_KEY'])

/**
 * Enough to name the cause in a terminal, and nothing more.
 *
 * `APICallError.requestBodyValues` holds the prompt — thirty sampled rows of real
 * leads. It is never read here. `responseBody` is Google's own error payload
 * ("API key not valid", "Quota exceeded"), which is what an operator needs and
 * carries none of our data.
 */
function describeLlmError(error: unknown): string {
  // The SDK wraps the attempts it made. The last one is the one worth naming.
  if (RetryError.isInstance(error)) {
    return `${error.name} after ${error.errors.length} attempts — ${describeLlmError(error.lastError)}`
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? '?'
    const retryable = error.isRetryable ? ', retryable' : ''
    const body = error.responseBody ? ` — ${oneLine(error.responseBody)}` : ''
    return `${error.name} HTTP ${status}${retryable}${body}`
  }

  // Our own stopwatch, not Gemini's answer. The `gemini HTTP …` lines above this
  // one say what each attempt actually did.
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `gave up after ${TIMEOUT_MS / 1000}s (TIMEOUT_MS)`
  }

  // The model answered, but not with our schema. Its raw text is the plan it tried
  // to write; it can quote a column name, so it stays out of the log.
  if (NoObjectGeneratedError.isInstance(error)) {
    return `${error.name} finishReason=${error.finishReason ?? '?'}`
  }

  if (error instanceof Error) return `${error.name}: ${error.message}`
  return `non-error thrown (${typeof error})`
}

/**
 * Names why the model was abandoned, in a form safe to send to the browser: a
 * category and one sentence built from the status code. Gemini's raw error body
 * can carry the key owner's project identifiers, so it never leaves the server.
 */
export function categorizeLlmFailure(error: unknown): LlmFailure {
  if (RetryError.isInstance(error)) return categorizeLlmFailure(error.lastError)

  if (APICallError.isInstance(error)) {
    const status = error.statusCode
    if (status === 429 || status === 503) {
      return {
        reason: 'rate_limited',
        detail: `Gemini answered HTTP ${status} — the key's quota is used up or the model is overloaded right now.`,
      }
    }
    // Gemini reports a bad key as 400 API_KEY_INVALID, not only as 401/403.
    if (status === 401 || status === 403 || (status === 400 && /api.?key/i.test(error.responseBody ?? ''))) {
      return { reason: 'invalid_key', detail: `Gemini rejected the API key (HTTP ${status}).` }
    }
    return { reason: 'call_failed', detail: `The mapping call failed (HTTP ${status ?? 'error'}).` }
  }

  if (error instanceof Error && error.name === 'TimeoutError') {
    return { reason: 'timeout', detail: `The model did not answer within ${TIMEOUT_MS / 1000} seconds.` }
  }

  // loggingFetch bails out of an unpayable retry-after with a plain Error.
  if (error instanceof Error && error.message.startsWith('gemini asked to wait')) {
    return {
      reason: 'rate_limited',
      detail: "Gemini asked for a longer wait than the request budget allows — the key's quota is used up right now.",
    }
  }

  return { reason: 'call_failed', detail: 'The mapping call failed before the model answered.' }
}

/**
 * One AI call per file. The model reads the headers and a sample of rows and
 * returns column names, a date format and enum maps — never a data value, which
 * is why a cell reading "ignore previous instructions" cannot reach the output.
 *
 * Never throws. A missing key, a timeout, a refusal or a malformed object all
 * return the heuristic plan with `degraded: true`.
 */
export async function refinePlan(
  headers: readonly string[],
  rows: readonly CsvRow[],
  options: RefinePlanOptions = {},
): Promise<MappingPlan> {
  const sample = sampleRows(rows)
  const fallback = heuristicPlan(headers, {
    headerRowIndex: options.headerRowIndex ?? 0,
    sampleRows: sample,
  })

  if (!options.apiKey && !hasLlmKey()) {
    console.warn('[core] GOOGLE_GENERATIVE_AI_API_KEY is not set; using the heuristic plan')
    options.onDegraded?.({ reason: 'no_key', detail: 'No Gemini key is configured on the server.' })
    return fallback
  }

  if (headers.length > MAX_PROMPT_COLUMNS) {
    console.warn(`[core] ${headers.length} columns; sending the first ${MAX_PROMPT_COLUMNS} to the model`)
  }

  const startedAt = performance.now()

  // A caller's key exists for exactly one call; only the env-keyed provider is shared.
  const provider = options.apiKey
    ? createGoogleGenerativeAI({ apiKey: options.apiKey, fetch: loggingFetch })
    : google

  try {
    const { object, usage } = await generateObject({
      model: provider(MODEL),
      schema: PlanDraftSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt({ headers, sample, draft: toDraft(fallback) }),
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: THINKING_OFF,
      maxRetries: MAX_RETRIES,
      // The caller's signal reports a client disconnect. It adds a way to give up
      // early; it must never replace the deadline, or a client that stays connected
      // waits on the model until the platform kills the function.
      abortSignal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
    })

    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
    console.info(`[core] mapping plan from ${MODEL} — ${usage.totalTokens ?? '?'} tokens, ${seconds}s`)

    return preserveOverflow(sanitizePlan(fromDraft(object, options.headerRowIndex ?? 0), headers), headers)
  } catch (error) {
    // The upload must succeed without the model, and the caller reads `degraded`.
    // But a key that is merely wrong would degrade every import in silence.
    console.warn(`[core] mapping call failed — ${describeLlmError(error)}; using the heuristic plan`)
    options.onDegraded?.(categorizeLlmFailure(error))
    return fallback
  }
}
