'use client'

import { useReveal } from '@/components/charts/useReveal'
import { cn } from '@/lib/utils'

const ROWS = [
  { from: 'Full Name', to: 'name' },
  { from: 'E-mail Address', to: 'email' },
  { from: 'Phone No.', to: '+code · mobile' },
  { from: 'Lead Status', to: 'crm_status' },
  { from: 'Enquiry Date', to: 'created_at' },
]

// `hero` reveals once; `loop` keeps a dot travelling each connector while the call runs.
export function MappingDemo({ variant = 'hero' }: { variant?: 'hero' | 'loop' }) {
  const shown = useReveal()

  return (
    <div className="grid gap-2" aria-hidden>
      {ROWS.map((row, i) => (
        <div
          key={row.to}
          className="animate-in fade-in slide-in-from-left-2 fill-mode-both grid grid-cols-[minmax(0,1fr)_minmax(2.5rem,1fr)_minmax(0,1fr)] items-center gap-2 duration-500"
          style={{ animationDelay: `${i * 110}ms` }}
        >
          <span className="border-border bg-muted/60 text-foreground/80 justify-self-end truncate rounded-md border px-2 py-1 font-mono text-[11px]">
            {row.from}
          </span>

          <span className="relative h-px overflow-visible">
            <span
              className="from-border to-primary/60 absolute inset-y-0 left-0 block h-px bg-linear-to-r transition-[width] duration-700 ease-out"
              style={{ width: shown ? '100%' : '0%', transitionDelay: `${i * 110 + 150}ms` }}
            />
            {variant === 'loop' && (
              <span
                className="bg-primary absolute top-[-2.5px] size-1.5 rounded-full"
                style={{ animation: `slide-dot 2.2s ease-in-out ${i * 0.35}s infinite` }}
              />
            )}
          </span>

          <span
            className={cn(
              'bg-accent text-accent-foreground w-fit truncate rounded-md px-2 py-1 font-mono text-[11px]',
              'animate-in fade-in fill-mode-both duration-500',
            )}
            style={{ animationDelay: `${i * 110 + 400}ms` }}
          >
            {row.to}
          </span>
        </div>
      ))}
    </div>
  )
}
