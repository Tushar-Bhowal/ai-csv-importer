'use client'

import { InfoIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DataGrid } from '@/components/DataGrid'
import { EmptyState } from '@/components/EmptyState'
import { Insights } from '@/components/Insights'
import { LoadingState } from '@/components/LoadingState'
import { PlanRail } from '@/components/PlanRail'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { importCsv, type ImportState } from '@/lib/import'

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
  const [file, setFile] = useState<File | null>(null)
  const [startingOver, setStartingOver] = useState(false)

  const showResult = state.kind === 'done' && !pending && !startingOver

  // Each view swap unmounts the control that had focus (Import, then New import),
  // which drops focus to <body>. Move it onto the content that replaced them, so a
  // keyboard user keeps their place. Not on first paint, and not on a validation
  // error — that never leaves the input view, so there is nothing to catch up to.
  const view = pending ? 'loading' : showResult ? 'result' : 'input'
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStartingOver(false)

    if (!file || file.size === 0) {
      setState({ kind: 'error', message: 'Choose a CSV file to import.' })
      return
    }
    if (file.size > maxBytes) {
      setState({
        kind: 'error',
        message: `That file is ${MB(file.size)}. The limit is ${MB(maxBytes)}.`,
      })
      return
    }

    setPending(true)
    try {
      setState({ kind: 'done', fileName: file.name, outcome: await importCsv(file) })
    } catch (err) {
      setState({ kind: 'error', message: failureMessage(err) })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden">
      <header className="border-border bg-background/90 shadow-2xs z-20 flex items-center justify-between gap-4 border-b px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="from-chart-1 to-chart-3 size-6 rounded-md bg-linear-to-br" />
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
                setFile(null)
                setStartingOver(true)
              }}
            >
              New import
            </Button>
          )}
        </div>
      </header>

      {pending && <LoadingState />}

      {!pending && !showResult && (
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-y-auto">
          {state.kind === 'error' && !startingOver && (
            <div className="px-4 pt-6 sm:px-6">
              <Alert variant="destructive" className="mx-auto max-w-xl">
                <AlertTitle>That file could not be imported</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            </div>
          )}
          <EmptyState
            name="file"
            pending={pending}
            file={file}
            maxBytes={maxBytes}
            inputRef={dropzoneRef}
            onFileChosen={setFile}
          />
        </div>
      )}

      {showResult && (
        <div
          ref={resultRef}
          tabIndex={-1}
          aria-label={`Import complete. ${state.outcome.summary.imported} imported, ${state.outcome.summary.skipped} skipped.`}
          className="animate-in fade-in grid min-h-0 min-w-0 outline-none duration-500 lg:grid-cols-[minmax(280px,320px)_1fr]"
        >
          <aside className="border-border bg-sidebar hidden min-h-0 overflow-auto border-r lg:block">
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
            <div className="border-border max-h-[46vh] overflow-y-auto border-b lg:max-h-none">
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
                  fields={fields}
                />

                {state.outcome.summary.degraded && (
                  <Alert>
                    <InfoIcon aria-hidden />
                    <AlertTitle>Heuristic mapping</AlertTitle>
                    <AlertDescription>
                      {state.outcome.summary.degradedReason === 'call_failed' ? (
                        <>
                          The AI mapping call failed, so columns were matched by name alone and an
                          ambiguous date format may be read the wrong way round. Check that{' '}
                          <code>GOOGLE_GENERATIVE_AI_API_KEY</code> is valid.
                        </>
                      ) : (
                        <>
                          No API key is set, so columns were matched by name alone and an ambiguous
                          date format may be read the wrong way round. Set{' '}
                          <code>GOOGLE_GENERATIVE_AI_API_KEY</code> to enable AI mapping.
                        </>
                      )}
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
    </form>
  )
}
