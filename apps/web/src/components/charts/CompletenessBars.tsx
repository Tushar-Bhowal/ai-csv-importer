'use client'

import { useReveal } from './useReveal'

export type Bar = { label: string; pct: number }

export function CompletenessBars({ rows, emptyCount }: { rows: Bar[]; emptyCount: number }) {
  const shown = useReveal()

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-xs">No imported rows to measure.</p>
  }

  return (
    <div className="grid gap-2.5">
      <ul className="grid gap-2.5" aria-label="Share of imported rows carrying each field">
        {rows.map((row, i) => (
          <li key={row.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
            <span
              className="text-foreground/80 truncate font-mono text-[0.72rem]"
              title={`${row.label}: ${row.pct}%`}
            >
              {row.label}
            </span>
            <span className="bg-muted h-1.5 overflow-hidden rounded-full">
              <span
                className="from-chart-1 to-chart-3 block h-full rounded-full bg-linear-to-r transition-[width] duration-700 ease-out"
                style={{ width: shown ? `${row.pct}%` : '0%', transitionDelay: `${Math.min(i * 45, 400)}ms` }}
              />
            </span>
            <span className="text-muted-foreground text-right text-[0.72rem] tabular-nums">
              {row.pct}%
            </span>
          </li>
        ))}
      </ul>

      {emptyCount > 0 && (
        <p className="text-muted-foreground text-[0.7rem]">
          {emptyCount} field{emptyCount === 1 ? '' : 's'} had no data.
        </p>
      )}
    </div>
  )
}
