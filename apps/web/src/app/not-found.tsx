import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

import { BrandMark } from '@/components/BrandMark'

export default function NotFound() {
  return (
    <main className="bg-background grid min-h-dvh place-items-center px-6 py-12">
      <div className="animate-in fade-in slide-in-from-bottom-3 grid max-w-md justify-items-center gap-6 text-center duration-500">
        <BrandMark className="size-9" />

        <div className="grid gap-2.5">
          <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
            404 · no match
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            This page didn&rsquo;t map to anything.
          </h1>
          <p className="text-muted-foreground text-pretty">
            That address isn&rsquo;t one of our columns. Head back to the importer and turn a CSV
            into clean CRM records.
          </p>
        </div>

        <Link
          href="/"
          className="bg-primary text-primary-foreground shadow-xs focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--primary),black_12%)] focus-visible:ring-3"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Back to the importer
        </Link>
      </div>
    </main>
  )
}
