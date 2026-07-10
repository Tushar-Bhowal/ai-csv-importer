'use client'

import { useRef, useState } from 'react'

import { FolderIllustration } from '@/components/FolderIllustration'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SPECIMEN = [
  ['First Name', 'Last Name', 'E-mail Address', 'Phone', 'Enquiry Date', 'Lead Status'],
  ['name', 'crm_note', 'email', 'country_code + mobile', 'created_at', 'crm_status'],
]

interface EmptyStateProps {
  name: string
  pending: boolean
  file: File | null
  onFileChosen: (file: File | null) => void
}

export function EmptyState({ name, pending, file, onFileChosen }: EmptyStateProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // A DataTransfer round-trip is the only way to seed a file input from a drop,
  // and the input must hold the file for the form action to receive it.
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
    <div className="grid flex-1 place-items-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid w-full max-w-2xl gap-6 sm:gap-8">
        <div className="grid gap-3 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Upload a CSV of leads
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Any column names, in any order. The columns are read once, up front, and every row is
            converted by code that cannot invent a value.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!pending) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={acceptDrop}
        >
          <label
            className={cn(
              'grid place-items-center gap-4 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:gap-5 sm:px-6 sm:py-14',
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
              className="size-32 max-w-full sm:size-40 motion-reduce:hidden"
            />
            <FolderIllustration className="hidden size-32 max-w-full sm:size-40 motion-reduce:block" />

            <div className="grid gap-1">
              {file ? (
                <>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {(file.size / 1024).toFixed(0)} KB · choose another file
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">
                    Drag and drop or{' '}
                    <span className="text-accent-foreground font-semibold underline underline-offset-2">
                      choose file
                    </span>{' '}
                    to upload.
                  </p>
                  <p className="text-muted-foreground text-sm">File format : CSV. Max 4.0 MB</p>
                </>
              )}
            </div>

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

        <div className="flex justify-center">
          <Button type="submit" size="lg" disabled={!file || pending}>
            {pending ? 'Reading…' : 'Import'}
          </Button>
        </div>

        <div className="border-border grid gap-2 border-t pt-6">
          <p className="text-muted-foreground text-xs">What that looks like</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <tbody>
                {SPECIMEN.map((row, i) => (
                  <tr key={i} className={i === 0 ? 'text-muted-foreground' : ''}>
                    {row.map((c) => (
                      <td key={c} className="py-1 pr-4 whitespace-nowrap">
                        {i === 1 ? <code>{c}</code> : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
