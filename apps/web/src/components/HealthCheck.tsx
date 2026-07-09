'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Health {
  status: string
  llm: 'available' | 'degraded'
  version: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health }
  | { kind: 'error'; message: string }

export function HealthCheck() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_URL}/api/v1/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API responded ${res.status}`)
        return (await res.json()) as Health
      })
      .then((health) => setState({ kind: 'ok', health }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Unreachable' })
      })

    return () => controller.abort()
  }, [])

  return (
    <section
      aria-live="polite"
      style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
        API — {API_URL}
      </h2>

      {state.kind === 'loading' && <p style={{ margin: 0 }}>Checking…</p>}

      {state.kind === 'error' && (
        <p style={{ margin: 0, color: 'var(--brand)' }}>
          Cannot reach the API: {state.message}. Is it running, and does <code>WEB_ORIGIN</code>{' '}
          include this page&rsquo;s origin?
        </p>
      )}

      {state.kind === 'ok' && (
        <p style={{ margin: 0 }}>
          <strong>{state.health.status}</strong> · v{state.health.version} · AI mapping{' '}
          {state.health.llm === 'available' ? 'available' : 'degraded (no API key — heuristics only)'}
        </p>
      )}
    </section>
  )
}
