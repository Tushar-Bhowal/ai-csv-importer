'use client'

import { ClockIcon, SparklesIcon } from 'lucide-react'

import type { CrmRecord, ImportSummary, SkippedRow } from '@groweasy/core'

import { StatusDonut, type DonutSegment } from '@/components/charts/StatusDonut'
import { STATUS_META, STATUS_ORDER } from '@/lib/crm-display'
import { cn } from '@/lib/utils'

export function Insights({
  records,
  skipped,
  summary,
}: {
  records: CrmRecord[]
  skipped: SkippedRow[]
  summary: ImportSummary
}) {
  const imported = records.length

  const statusRows = STATUS_ORDER.map((key) => ({
    key,
    label: STATUS_META[key]?.label ?? key,
    dot: STATUS_META[key]?.dot ?? 'bg-muted-foreground',
    stroke: STATUS_META[key]?.stroke ?? 'stroke-muted-foreground',
    count: records.reduce((n, r) => (r.crm_status === key ? n + 1 : n), 0),
  })).filter((s) => s.count > 0)

  const segments: DonutSegment[] = statusRows.map((s) => ({
    label: s.label,
    count: s.count,
    stroke: s.stroke,
  }))

  return (
    <section className="border-border bg-card animate-in fade-in slide-in-from-bottom-3 grid max-w-md content-start gap-3 rounded-xl border p-4 duration-500 fill-mode-both">
      <div className="grid gap-0.5">
        <h3 className="text-xs font-medium tracking-wide uppercase">Imported by status</h3>
        <p className="text-muted-foreground text-[0.7rem]">{summary.totalRows} rows in</p>
      </div>

      <div className="flex items-center gap-4">
        <StatusDonut segments={segments} imported={imported} skipped={skipped.length} />
        <ul className="grid min-w-0 flex-1 gap-1.5 text-xs">
          {statusRows.length === 0 ? (
            <li className="text-muted-foreground">No lead status was set.</li>
          ) : (
            statusRows.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', s.dot)} />
                <span className="text-foreground/80 truncate">{s.label}</span>
                <span className="text-muted-foreground ml-auto tabular-nums">{s.count}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-destructive size-2 rounded-full" />
          {skipped.length} skipped
        </span>
        <span className="inline-flex items-center gap-1">
          <ClockIcon aria-hidden className="size-3" />
          {Math.round(summary.durationMs)} ms
        </span>
        <span className="inline-flex items-center gap-1">
          <SparklesIcon aria-hidden className="size-3" />
          {summary.llmCalls} AI {summary.llmCalls === 1 ? 'call' : 'calls'}
        </span>
      </div>
    </section>
  )
}
