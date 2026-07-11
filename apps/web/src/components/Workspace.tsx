'use client'

import { InfoIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '@/components/BrandMark'
import { DataGrid } from '@/components/DataGrid'
import { EmptyState } from '@/components/EmptyState'
import { Insights } from '@/components/Insights'
import { LoadingState } from '@/components/LoadingState'
import { PlanRail } from '@/components/PlanRail'
import { PreviewTable } from '@/components/PreviewTable'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { importCsv, type ImportState } from '@/lib/import'
import { parsePreview, PreviewError, type PreviewData } from '@/lib/preview'

const INITIAL: ImportState = { kind: 'idle' }

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

function failureMessage(err: unknown): string {
  // AbortSignal.timeout rejects with a DOMException; a dead or CORS-blocked API
  // rejects with a TypeError. Neither message is fit to show a human.
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return 'The import took too long and was cancelled. Try a smaller file.'
  }
  if (err instanceof TypeError) {
    return 'Could not reach the import API. Check that it is running.'
  }
  return err instanceof Error ? err.message : 'That file could not be read as CSV.'
}

export function Workspace({ fields, maxBytes }: { fields: readonly string[]; maxBytes: number }) {
  const [state, setState] = useState<ImportState>(INITIAL)
  const [pending, setPending] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [startingOver, setStartingOver] = useState(false)

  const showResult = state.kind === 'done' && !pending && !startingOver

  // Parse in the browser the moment a file is chosen — no network, no AI — so the
  // preview and the Confirm gate come before the backend is ever called. The
  // authoritative parse still runs server-side on confirm.
  async function choose(next: File | null) {
    setStartingOver(false)
    setState(INITIAL)
    setPreview(null)
    setFile(next)
    if (!next) return

    if (next.size === 0) {
      setState({ kind: 'error', message: 'Choose a CSV file to import.' })
      setFile(null)
      return
    }
    if (next.size > maxBytes) {
      setState({ kind: 'error', message: `That file is ${MB(next.size)}. The limit is ${MB(maxBytes)}.` })
      setFile(null)
      return
    }

    setParsing(true)
    try {
      setPreview(await parsePreview(next))
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof PreviewError ? err.message : 'That file could not be read as CSV.',
      })
      setFile(null)
    } finally {
      setParsing(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setState(INITIAL)
  }

  // The only backend call: the preview dialog's Confirm, or a degraded result's
  // re-run with the visitor's own key. The key lives in this state for the session
  // only — it is a request header, never storage.
  const [userKey, setUserKey] = useState('')

  async function runImport(apiKey?: string) {
    if (!file || pending) return
    setPending(true)
    try {
      setState({ kind: 'done', fileName: file.name, outcome: await importCsv(file, apiKey) })
    } catch (err) {
      setState({ kind: 'error', message: failureMessage(err) })
    } finally {
      setPending(false)
    }
  }

  const view = pending ? 'loading' : showResult ? 'result' : preview ? 'preview' : 'input'

  // The dialog traps and restores focus itself. These two views are plain regions,
  // so move focus onto whichever one replaced the last — not on first paint, and
  // not on a same-view re-render — so a keyboard user keeps their place.
  const dropzoneRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const prevView = useRef<typeof view | null>(null)

  useEffect(() => {
    const from = prevView.current
    prevView.current = view
    if (from === null || from === view) return
    if (view === 'result') resultRef.current?.focus()
    else if (view === 'input') dropzoneRef.current?.focus()
  }, [view])

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden">
      <header className="border-border bg-background/90 shadow-2xs z-20 flex items-center justify-between gap-4 border-b px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-5" />
          <span className="font-display text-[0.95rem] font-semibold tracking-tight">
            CSV&nbsp;→&nbsp;CRM
          </span>
          {showResult && (
            <span className="text-muted-foreground hidden max-w-[16ch] truncate text-xs sm:inline">
              {state.fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {showResult && state.outcome.summary.degraded && (
            <span className="bg-muted text-muted-foreground hidden rounded-full px-2 py-0.5 text-[0.7rem] md:inline">
              heuristic mapping
            </span>
          )}
          <ThemeToggle />
          {showResult && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset()
                setStartingOver(true)
              }}
            >
              New import
            </Button>
          )}
        </div>
      </header>

      {view === 'loading' && <LoadingState />}

      {(view === 'input' || view === 'preview') && (
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-y-auto">
          {view === 'input' && state.kind === 'error' && !startingOver && (
            <div className="px-4 pt-6 sm:px-6">
              <Alert variant="destructive" className="mx-auto max-w-xl">
                <AlertTitle>That file could not be imported</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            </div>
          )}
          <EmptyState
            name="file"
            pending={parsing}
            file={file}
            maxBytes={maxBytes}
            inputRef={dropzoneRef}
            onFileChosen={choose}
          />
        </div>
      )}

      <Dialog
        open={view === 'preview'}
        onOpenChange={(open) => {
          // Escape, the backdrop, or the ✕ close it. Starting the import also closes
          // it, but that path sets `pending` first, so it must not reset the file.
          if (!open && !pending && !showResult) reset()
        }}
      >
        {preview && (
          <DialogContent className="grid max-h-[85vh] w-[calc(100%-2rem)] max-w-6xl grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0">
            <div className="border-border border-b py-4 pr-12 pl-5">
              <DialogHeader>
                <DialogTitle>Review before importing</DialogTitle>
                <DialogDescription>
                  Read in your browser — {preview.totalRows.toLocaleString()} rows,{' '}
                  {preview.headers.length} columns. Nothing is sent until you confirm.
                </DialogDescription>
              </DialogHeader>
              {state.kind === 'error' && !startingOver && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTitle>That file could not be imported</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="min-h-0 min-w-0 overflow-hidden">
              <PreviewTable {...preview} />
            </div>

            <DialogFooter className="border-border border-t px-5 py-3">
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button type="button" onClick={() => runImport()}>
                Confirm import
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {showResult && (
        <div
          ref={resultRef}
          tabIndex={-1}
          aria-label={`Import complete. ${state.outcome.summary.imported} imported, ${state.outcome.summary.skipped} skipped.`}
          className="animate-in fade-in grid min-h-0 min-w-0 outline-none duration-500 lg:grid-cols-[minmax(280px,320px)_1fr]"
        >
          <aside className="border-border bg-sidebar scrollbar-hidden hidden min-h-0 overflow-auto border-r lg:block">
            <PlanRail
              plan={state.outcome.plan}
              summary={state.outcome.summary}
              headers={state.outcome.headers}
              csv={state.outcome.csv}
              fileName={state.fileName}
            />
          </aside>

          {/* min-w-0: a grid item's default min-width is its content, so without this
              the 15-column table stretches the column instead of scrolling inside it. */}
          <div className="grid min-h-0 min-w-0 grid-rows-[auto_1fr]">
            <div className="max-h-[46vh] overflow-y-auto lg:max-h-none">
              <details className="border-border border-b lg:hidden">
                <summary className="focus-visible:outline-ring/50 cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-2 sm:px-6">
                  Mapping plan — {state.outcome.plan.columns.length} columns mapped
                </summary>
                <PlanRail
                  plan={state.outcome.plan}
                  summary={state.outcome.summary}
                  headers={state.outcome.headers}
                  csv={state.outcome.csv}
                  fileName={state.fileName}
                />
              </details>

              <div className="grid gap-4 p-4 sm:p-6">
                <Insights
                  records={state.outcome.records}
                  skipped={state.outcome.skipped}
                  summary={state.outcome.summary}
                />

                {state.outcome.summary.degraded && (
                  <Alert>
                    <InfoIcon aria-hidden />
                    <AlertTitle>
                      {state.outcome.summary.degradedReason === 'rate_limited'
                        ? 'AI mapping is rate-limited right now'
                        : state.outcome.summary.degradedReason === 'invalid_key'
                          ? 'Gemini rejected the API key'
                          : state.outcome.summary.degradedReason === 'timeout'
                            ? 'The model took too long'
                            : state.outcome.summary.degradedReason === 'no_key'
                              ? 'No AI key is configured'
                              : 'The AI mapping call failed'}
                    </AlertTitle>
                    <AlertDescription>
                      <p>
                        {state.outcome.summary.degradedDetail}{' '}
                        Columns were matched by name alone, so an ambiguous date format may be read
                        the wrong way round.
                      </p>

                      <form
                        className="mt-3 grid gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (userKey.trim()) runImport(userKey.trim())
                        }}
                      >
                        <p className="text-foreground text-sm font-medium">
                          Have a{' '}
                          <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
                          >
                            Gemini key
                          </a>
                          ? Re-run this import with it.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="password"
                            value={userKey}
                            onChange={(e) => setUserKey(e.target.value)}
                            placeholder="AIza…"
                            aria-label="Your Gemini API key"
                            autoComplete="off"
                            spellCheck={false}
                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-8 w-64 max-w-full rounded-lg border px-2.5 font-mono text-xs outline-none focus-visible:ring-3"
                          />
                          <Button type="submit" size="sm" disabled={!userKey.trim()}>
                            Re-run with my key
                          </Button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Sent with this one request over HTTPS, used in memory, never stored or
                          logged — there is no database.
                        </p>
                      </form>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <DataGrid
              fields={fields}
              records={state.outcome.records}
              skipped={state.outcome.skipped}
            />
          </div>
        </div>
      )}
    </div>
  )
}
