'use client'

import { cn } from '@/lib/utils'

import { useReveal } from './useReveal'

export type DonutSegment = { label: string; count: number; stroke: string }

const R = 42
const STROKE = 9
const C = 2 * Math.PI * R
const GAP = 14 // svg units; a touch over the stroke width so the round caps clear

export function StatusDonut({
  segments,
  imported,
  skipped,
}: {
  segments: DonutSegment[]
  imported: number
  skipped: number
}) {
  const shown = useReveal()
  const present = segments.filter((s) => s.count > 0)
  const gap = present.length > 1 ? GAP : 0

  let cursor = 0
  const arcs = present.map((s) => {
    const raw = (s.count / imported) * C
    const draw = Math.max(raw - gap, 0.5)
    const offset = -cursor
    cursor += raw
    return { draw, offset, stroke: s.stroke, label: s.label, count: s.count }
  })

  const summary =
    present.length > 0
      ? present.map((s) => `${s.label} ${s.count}`).join(', ')
      : 'no status set'

  return (
    <div
      className="relative grid aspect-square w-full max-w-36 place-items-center"
      role="img"
      aria-label={`${imported} imported by status: ${summary}. ${skipped} skipped.`}
    >
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth={STROKE} className="stroke-muted" />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${shown ? a.draw : 0} ${C}`}
            strokeDashoffset={a.offset}
            className={cn(a.stroke, 'transition-[stroke-dasharray] duration-700 ease-out')}
            style={{ transitionDelay: `${i * 90}ms` }}
          />
        ))}
      </svg>
      <div className="absolute grid place-items-center text-center">
        <span className="font-display text-3xl leading-none font-semibold tabular-nums">
          {imported}
        </span>
        <span className="text-muted-foreground mt-1 text-[0.65rem] tracking-wide uppercase">
          imported
        </span>
      </div>
    </div>
  )
}
