'use client'

import { CheckIcon, LoaderCircleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MappingDemo } from '@/components/MappingDemo'

function Elapsed() {
  const [tenths, setTenths] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTenths((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [])

  return (
    <span aria-hidden className="text-muted-foreground font-mono text-xs tabular-nums">
      {(tenths / 10).toFixed(1)}s
    </span>
  )
}

export function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="grid content-center place-items-center p-6">
      <span className="sr-only">Importing your file, please wait…</span>

      <div className="border-border bg-card shadow-xs grid w-full max-w-md gap-5 rounded-2xl border p-6">
        <MappingDemo variant="loop" />

        <ol aria-hidden className="border-border grid gap-3 border-t pt-5 text-sm">
          <li className="flex items-center gap-2.5">
            <CheckIcon className="text-success size-4 shrink-0" />
            <span className="text-muted-foreground">File sent</span>
          </li>

          <li className="grid gap-0.5">
            <span className="flex items-center gap-2.5">
              <LoaderCircleIcon className="text-primary size-4 shrink-0 animate-spin" />
              <span className="text-foreground flex-1 font-medium">
                Model is naming the mapping plan
              </span>
              <Elapsed />
            </span>
            <span className="text-muted-foreground pl-6.5 text-xs">
              One call for the whole file — typically 5–30 seconds.
            </span>
          </li>

          <li className="flex items-center gap-2.5">
            <span aria-hidden className="border-border size-4 shrink-0 rounded-full border-2" />
            <span className="text-muted-foreground">Code applies the plan to every row</span>
          </li>
        </ol>
      </div>
    </div>
  )
}
