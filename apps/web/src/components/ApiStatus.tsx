'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Health {
  status: string
  llm: 'available' | 'degraded'
  version: string
}

type State = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'error' }

export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_URL}/api/v1/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return (await res.json()) as Health
      })
      .then((health) => setState({ kind: 'ok', health }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'error' })
      })

    return () => controller.abort()
  }, [])

  const label =
    state.kind === 'loading'
      ? 'checking API'
      : state.kind === 'error'
        ? 'API unreachable'
        : `API v${state.health.version}`

  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          state.kind === 'ok' && 'bg-success',
          state.kind === 'error' && 'bg-destructive',
          state.kind === 'loading' && 'bg-muted-foreground',
        )}
      />
      {label}
    </span>
  )
}
