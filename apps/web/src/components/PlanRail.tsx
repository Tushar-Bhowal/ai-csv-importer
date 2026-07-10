'use client'

import { DownloadIcon } from 'lucide-react'

import type { ImportSummary, MappingPlan } from '@groweasy/core'

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
  const accounted = plan.columns.length + plan.noteColumns.length + plan.ignoreColumns.length
  const unmatched = headers.length - accounted

  return (
    <div className="grid content-start gap-6 p-5">
      <div className="grid gap-1">
        <h2 className="text-base font-medium">Mapping plan</h2>
        <p className="text-muted-foreground text-xs text-pretty">
          Decided once, from the header row and a sample. Then applied to every row by code.
          {plan.headerRowIndex > 0 && ` Header found on line ${plan.headerRowIndex + 1}.`}
        </p>
      </div>

      <ul className="grid gap-3.5">
        {plan.columns.map((column) => (
          <li key={column.target} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="truncate text-sm font-medium"
                title={column.sourceColumns.join(' + ')}
              >
                {column.sourceColumns.join(' + ')}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {Math.round(column.confidence * 100)}%
              </span>
            </div>

            <code className="text-muted-foreground text-[0.7rem]">→ {column.target}</code>

            <div
              role="meter"
              aria-valuenow={Math.round(column.confidence * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Confidence for ${column.target}`}
              className="bg-border mt-0.5 h-1 w-full overflow-hidden rounded-full"
            >
              <div
                className="from-chart-1 to-chart-3 h-full rounded-full bg-linear-to-r"
                style={{ inlineSize: `${column.confidence * 100}%` }}
              />
            </div>

            <span className="text-muted-foreground text-[0.7rem]">
              {STRATEGY_LABEL[column.strategy] ?? column.strategy}
              {column.dateFormat && ` · ${column.dateFormat}`}
            </span>
          </li>
        ))}
      </ul>

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
