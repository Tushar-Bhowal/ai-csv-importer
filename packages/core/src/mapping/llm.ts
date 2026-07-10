import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { APICallError, generateObject, NoObjectGeneratedError, RetryError } from 'ai'

import type { CsvRow } from '../parse/parseCsv.js'
import { fromDraft, PlanDraftSchema, sanitizePlan, toDraft, type MappingPlan } from '../schema/plan.js'
import { heuristicPlan } from './heuristic.js'
import { buildPrompt, SYSTEM_PROMPT } from './prompt.js'
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

const MAX_LOGGED_BODY = 400

export interface RefinePlanOptions {
  headerRowIndex?: number
  signal?: AbortSignal
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').slice(0, MAX_LOGGED_BODY)

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

  if (response.ok) console.info(`[core] gemini HTTP ${response.status} in ${ms}ms`)
  else console.warn(`[core] gemini HTTP ${response.status} in ${ms}ms — ${oneLine(await response.clone().text())}`)

  return response
}

const google = createGoogleGenerativeAI({ fetch: loggingFetch })

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

  if (!hasLlmKey()) {
    console.warn('[core] GOOGLE_GENERATIVE_AI_API_KEY is not set; using the heuristic plan')
    return fallback
  }

  const startedAt = performance.now()

  try {
    const { object, usage } = await generateObject({
      model: google(MODEL),
      schema: PlanDraftSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt({ headers, sample, draft: toDraft(fallback) }),
      temperature: 0,
      providerOptions: THINKING_OFF,
      maxRetries: MAX_RETRIES,
      abortSignal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })

    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
    console.info(`[core] mapping plan from ${MODEL} — ${usage.totalTokens ?? '?'} tokens, ${seconds}s`)

    return sanitizePlan(fromDraft(object, options.headerRowIndex ?? 0), headers)
  } catch (error) {
    // The upload must succeed without the model, and the caller reads `degraded`.
    // But a key that is merely wrong would degrade every import in silence.
    console.warn(`[core] mapping call failed — ${describeLlmError(error)}; using the heuristic plan`)
    return fallback
  }
}
