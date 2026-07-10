'use client'

import { ArrowRightIcon, DownloadIcon } from 'lucide-react'

import type { ImportSummary, MappingPlan } from '@groweasy/core'

import { useReveal } from '@/components/charts/useReveal'
import { Button } from '@/components/ui/button'

const STRATEGY_LABEL: Record<string, string> = {
  direct: 'copied as-is',
  concat: 'joined',
  phone_split: 'split into code + number',
  date_parse: 'parsed as a date',
  enum_map: 'mapped onto allowed values',
}

function download(csv: string, sourceName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = sourceName.replace(/\.csv$/i, '') + '-crm.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function PlanRail({
  plan,
  summary,
  headers,
  csv,
  fileName,
}: {
  plan: MappingPlan
  summary: ImportSummary
  headers: readonly string[]
  csv: string
  fileName: string
}) {
  const shown = useReveal()
  const accounted = plan.columns.length + plan.noteColumns.length + plan.ignoreColumns.length
  const unmatched = headers.length - accounted

  return (
    <div className="grid content-start gap-5 p-5">
      <div className="grid gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">Mapping plan</h2>
        <p className="text-muted-foreground text-xs text-pretty">
          Decided once, from the header row and a sample — then applied to every row by code.
          {plan.headerRowIndex > 0 && ` Header found on line ${plan.headerRowIndex + 1}.`}
        </p>
      </div>

      <ol className="grid gap-2.5">
        {plan.columns.map((column, i) => {
          const pct = Math.round(column.confidence * 100)
          return (
            <li
              key={column.target}
              className="animate-in fade-in slide-in-from-left-3 fill-mode-both group border-border bg-card hover:border-primary/40 grid gap-2 rounded-lg border p-3 transition-colors"
              style={{ animationDelay: `${Math.min(i * 55, 500)}ms` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="truncate font-mono text-[0.8rem] font-medium"
                  title={column.sourceColumns.join(' + ')}
                >
                  {column.sourceColumns.join(' + ')}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{pct}%</span>
              </div>

              <div className="text-muted-foreground flex items-center gap-2 text-[0.7rem]">
                <span className="from-border to-primary/50 h-px flex-1 bg-linear-to-r" />
                <span className="whitespace-nowrap">
                  {STRATEGY_LABEL[column.strategy] ?? column.strategy}
                  {column.dateFormat && ` · ${column.dateFormat}`}
                </span>
                <ArrowRightIcon aria-hidden className="size-3" />
              </div>

              <div className="flex items-center gap-2">
                <code className="bg-accent text-accent-foreground rounded-md px-1.5 py-0.5 font-mono text-[0.72rem]">
                  {column.target}
                </code>
                <div
                  role="meter"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Confidence for ${column.target}`}
                  className="bg-border h-1 flex-1 overflow-hidden rounded-full"
                >
                  <div
                    className="from-chart-1 to-chart-3 h-full rounded-full bg-linear-to-r transition-[width] duration-700 ease-out"
                    style={{ width: shown ? `${pct}%` : '0%' }}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {(plan.noteColumns.length > 0 || plan.ignoreColumns.length > 0 || unmatched > 0) && (
        <dl className="border-border grid gap-2 border-t pt-4 text-xs">
          {plan.noteColumns.length > 0 && (
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Appended to the note</dt>
              <dd className="text-pretty">{plan.noteColumns.join(', ')}</dd>
            </div>
          )}
          {plan.ignoreColumns.length > 0 && (
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Ignored</dt>
              <dd className="text-pretty">{plan.ignoreColumns.join(', ')}</dd>
            </div>
          )}
          {unmatched > 0 && (
            <div className="text-muted-foreground">
              {unmatched} column{unmatched === 1 ? '' : 's'} matched nothing.
            </div>
          )}
        </dl>
      )}

      <div className="border-border grid gap-2 border-t pt-4">
        <Button type="button" onClick={() => download(csv, fileName)} className="w-full">
          <DownloadIcon aria-hidden />
          Download {summary.imported} records
        </Button>
        <p className="text-muted-foreground text-[0.7rem]">
          All 15 CRM fields. Values beginning <code>= + - @</code> are quoted so a spreadsheet
          cannot execute them.
        </p>
      </div>
    </div>
  )
}
