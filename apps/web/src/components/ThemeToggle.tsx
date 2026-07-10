'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  // The class is set before hydration by the inline script in layout.tsx, so read
  // it here rather than assume a default — otherwise the icon can contradict the page.
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // Private mode can throw on write; the class still flips for this session.
    }
    setDark(next)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {/* Hidden until mounted so the server-rendered icon can't disagree with the
          actual theme and cause a hydration mismatch. */}
      {mounted && (dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />)}
    </Button>
  )
}
