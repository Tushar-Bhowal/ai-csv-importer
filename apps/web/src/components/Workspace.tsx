'use client'

import { InfoIcon } from 'lucide-react'
import { useActionState, useState } from 'react'

import { importCsvAction, type ImportState } from '@/app/actions'
import { ApiStatus } from '@/components/ApiStatus'
import { DataGrid } from '@/components/DataGrid'
import { EmptyState } from '@/components/EmptyState'
import { PlanRail } from '@/components/PlanRail'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const INITIAL: ImportState = { kind: 'idle' }

function Stat({
  label,
  value,
  tone,
  dot,
}: {
  label: string
  value: number
  tone: string
  dot: string
}) {
  return (
    <span className={`flex items-center gap-2 rounded-lg px-2.5 py-1 ring-1 ring-inset ${tone}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </span>
  )
}

export function Workspace({ fields }: { fields: readonly string[] }) {
  const [state, formAction, pending] = useActionState(importCsvAction, INITIAL)
  const [file, setFile] = useState<File | null>(null)
  const [startingOver, setStartingOver] = useState(false)

  const showResult = state.kind === 'done' && !pending && !startingOver

  return (
    <form
      action={formAction}
      onSubmit={() => setStartingOver(false)}
      className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden"
    >
      <header className="border-border bg-background shadow-2xs z-20 flex items-center justify-between gap-4 border-b px-5 py-2.5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="from-chart-1 to-chart-3 size-5 rounded-md bg-linear-to-br" />
          <span className="text-sm font-semibold tracking-tight">AI CSV Importer</span>
          {showResult && (
            <span className="text-muted-foreground hidden text-xs sm:inline">{state.fileName}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {showResult && state.outcome.summary.degraded && (
            <span className="text-muted-foreground hidden text-xs md:inline">
              heuristic mapping
            </span>
          )}
          <ApiStatus />
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

      {pending && (
        <div className="grid place-items-center gap-3 p-8" aria-live="polite">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-40 w-full max-w-3xl" />
          <span className="text-muted-foreground text-sm">Reading your file…</span>
        </div>
      )}

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
          <EmptyState name="file" pending={pending} file={file} onFileChosen={setFile} />
        </div>
      )}

      {showResult && (
        <div className="grid min-h-0 min-w-0 lg:grid-cols-[minmax(280px,320px)_1fr]">
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
          <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_1fr]">
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

            <div
              className="border-border grid gap-3 border-b px-4 py-3 sm:px-6"
              aria-live="polite"
            >
              <div className="flex flex-wrap gap-2">
                <Stat
                  label="Imported"
                  value={state.outcome.summary.imported}
                  tone="bg-success/10 ring-success/25"
                  dot="bg-success"
                />
                <Stat
                  label="Skipped"
                  value={state.outcome.summary.skipped}
                  tone="bg-destructive/10 ring-destructive/25"
                  dot="bg-destructive"
                />
                <Stat
                  label="Rows accounted for"
                  value={state.outcome.summary.totalRows}
                  tone="bg-accent ring-primary/20"
                  dot="bg-primary"
                />
                <span className="text-muted-foreground self-center text-xs tabular-nums">
                  {Math.round(state.outcome.summary.durationMs)} ms
                </span>
              </div>

              {state.outcome.summary.degraded && (
                <Alert>
                  <InfoIcon aria-hidden />
                  <AlertTitle>Heuristic mapping</AlertTitle>
                  <AlertDescription>
                    No API key is set, so columns were matched by name alone and an ambiguous date
                    format may be read the wrong way round. Set{' '}
                    <code>GOOGLE_GENERATIVE_AI_API_KEY</code> to enable AI mapping.
                  </AlertDescription>
                </Alert>
              )}
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
