'use client'

import { useState, type RefObject } from 'react'

import { FolderIllustration } from '@/components/FolderIllustration'
import { MappingDemo } from '@/components/MappingDemo'
import { WordPullUp } from '@/components/WordPullUp'
import { cn } from '@/lib/utils'

const HEADLINE = [
  { word: 'Any' },
  { word: 'CSV' },
  { word: 'in.' },
  { word: 'CRM‑ready', highlight: true },
  { word: 'leads', highlight: true },
  { word: 'out.' },
]

interface EmptyStateProps {
  name: string
  pending: boolean
  file: File | null
  maxBytes: number
  // Owned by the parent so it can return focus here after an import.
  inputRef: RefObject<HTMLInputElement | null>
  onFileChosen: (file: File | null) => void
}

export function EmptyState({
  name,
  pending,
  file,
  maxBytes,
  inputRef,
  onFileChosen,
}: EmptyStateProps) {
  const [dragging, setDragging] = useState(false)

  // A DataTransfer round-trip is the only way to seed a file input from a drop, and
  // the input must hold the file so the native picker shows it as the current choice.
  const acceptDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (pending) return

    const dropped = event.dataTransfer.files?.[0]
    if (!dropped || !inputRef.current) return

    const transfer = new DataTransfer()
    transfer.items.add(dropped)
    inputRef.current.files = transfer.files
    onFileChosen(dropped)
  }

  return (
    <div className="grid flex-1 place-items-center px-4 py-6 sm:px-6">
      <div className="grid w-full max-w-3xl gap-5 sm:gap-6">
        <div className="grid gap-2 text-center">
          <WordPullUp
            words={HEADLINE}
            className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          />
          <p
            className="text-muted-foreground animate-in fade-in slide-in-from-bottom-2 fill-mode-both mx-auto max-w-xl text-sm text-pretty duration-500"
            style={{ animationDelay: '550ms' }}
          >
            The model reads your columns once and names a mapping plan. Deterministic code
            converts every row — it cannot invent a value.
          </p>
        </div>

        <div
          className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
          style={{ animationDelay: '750ms' }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!pending) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={acceptDrop}
        >
          <label
            className={cn(
              'grid place-items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:px-6 sm:py-7',
              'focus-within:outline-ring/50 focus-within:outline-2 focus-within:outline-offset-4',
              dragging
                ? 'border-primary bg-accent'
                : 'border-input bg-sidebar hover:border-primary/50 hover:bg-accent/50',
              pending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
          >
            {/* SMIL animates inside <img> but ignores the page's reduced-motion query,
                so the still illustration is the fallback rather than a second copy. */}
            <img
              src="/add-files-button.svg"
              alt=""
              aria-hidden
              width={160}
              height={160}
              className="size-24 max-w-full sm:size-28 motion-reduce:hidden"
            />
            <FolderIllustration className="hidden size-24 max-w-full sm:size-28 motion-reduce:block" />

            {file ? (
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {(file.size / 1024).toFixed(0)} KB · choose another file
                </span>
              </span>
            ) : (
              <span className="grid gap-0.5">
                <span className="text-sm">
                  Drag and drop or{' '}
                  <span className="text-accent-foreground font-semibold underline underline-offset-2">
                    choose a file
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  CSV · up to {(maxBytes / 1024 / 1024).toFixed(1)} MB · previewed before anything
                  is sent
                </span>
              </span>
            )}

            <input
              ref={inputRef}
              type="file"
              name={name}
              accept=".csv,text/csv"
              disabled={pending}
              onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </div>

        <aside
          className="border-border bg-card shadow-xs animate-in fade-in slide-in-from-bottom-3 fill-mode-both grid gap-3 rounded-2xl border p-4 duration-500 sm:px-5"
          style={{ animationDelay: '950ms' }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-medium tracking-wide uppercase">The mapping plan</h2>
            <p className="text-muted-foreground text-xs">
              Column names only — never your data.
            </p>
          </div>
          <MappingDemo />
          <p className="border-border text-muted-foreground border-t pt-2.5 text-[11px]">
            Decided once per file by the model, then applied to every row by code.
          </p>
        </aside>
      </div>
    </div>
  )
}
