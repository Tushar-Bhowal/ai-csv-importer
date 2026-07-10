'use client'

import { useEffect, useState } from 'react'

// Flips true one frame after mount, so a fill can paint at 0 and then transition
// to its value. Under prefers-reduced-motion the transitions are neutralised in
// globals.css, so the value simply appears.
export function useReveal(): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return shown
}
