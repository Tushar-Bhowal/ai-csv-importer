'use client'

import type { CrmRecord, ImportSummary, SkippedRow } from '@groweasy/core'

import { StatusDonut, type DonutSegment } from '@/components/charts/StatusDonut'
import { STATUS_META, STATUS_ORDER } from '@/lib/crm-display'
import { cn } from '@/lib/utils'

function Tile({
  label,
  value,
  sub,
  tone,
  delay,
}: {
  label: string
  value: string
  sub: string
  tone?: 'success' | 'destructive'
  delay: number
}) {
  return (
    <div
      className="border-border bg-card animate-in fade-in slide-in-from-bottom-3 fill-mode-both grid content-center gap-0.5 rounded-xl border p-4 duration-500"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span
        className={cn(
          'font-display text-2xl font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{sub}</span>
    </div>
  )
}

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

  const seconds = `${(summary.durationMs / 1000).toFixed(1)}s`

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,22rem)_1fr]">
      <section className="border-border bg-card animate-in fade-in slide-in-from-bottom-3 fill-mode-both grid content-start gap-3 rounded-xl border p-4 duration-500">
        <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          Imported by status
        </h3>
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
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Rows in file"
          value={String(summary.totalRows)}
          sub="every one accounted for"
          delay={60}
        />
        <Tile
          label="Imported"
          value={String(imported)}
          sub="records ready for the CRM"
          tone="success"
          delay={120}
        />
        <Tile
          label="Skipped"
          value={String(skipped.length)}
          sub={skipped.length > 0 ? 'no email or mobile' : 'nothing skipped'}
          tone={skipped.length > 0 ? 'destructive' : undefined}
          delay={180}
        />
        <Tile
          label="AI mapping"
          value={seconds}
          sub={
            summary.degraded
              ? 'heuristic fallback'
              : `${summary.llmCalls} model call${summary.llmCalls === 1 ? '' : 's'}`
          }
          delay={240}
        />
      </div>
    </div>
  )
}
