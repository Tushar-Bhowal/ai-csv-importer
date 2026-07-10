'use client'

import { useEffect, useState } from 'react'

// Tracks the real pipeline — parse, sample, map, transform — so the wait feels
// like progress, not a stall. Purely visual; a screen reader hears one stable line.
const MESSAGES = [
  'Reading your CSV…',
  'Finding the header and sampling rows…',
  'Mapping your columns to the CRM…',
  'Cleaning phone numbers and dates…',
  'Almost there — building your records…',
]

const INTERVAL_MS = 2400

function CyclingMessage() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <p
      key={i}
      aria-hidden
      className="animate-in fade-in text-muted-foreground text-center text-sm duration-500 sm:text-base lg:text-lg"
    >
      {MESSAGES[i]}
    </p>
  )
}

export function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid content-center place-items-center gap-6 p-8 lg:gap-8"
    >
      <span className="sr-only">Importing your file, please wait…</span>
      {/* SMIL animation lives in the file; alt is empty because the cycling line
          below carries the meaning. */}
      <img
        src="/loading.svg"
        alt=""
        aria-hidden
        className="size-44 max-w-full sm:size-56 lg:size-72 xl:size-80"
      />
      <CyclingMessage />
    </div>
  )
}
