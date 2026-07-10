'use client'

import { SearchIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { CrmRecord, SkippedRow } from '@groweasy/core'

import { humanizeField, STATUS_META } from '@/lib/crm-display'
import { cn } from '@/lib/utils'

const SKIP_REASON_LABEL: Record<string, string> = {
  no_contact: 'No email and no mobile number',
  ai_extraction_failed: 'The model could not read this row',
}

type Tab = 'imported' | 'skipped'

function StatusCell({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>

  const meta = STATUS_META[value]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        meta?.chip ?? 'bg-muted ring-border',
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', meta?.dot ?? 'bg-border')} />
      {meta?.label ?? value}
    </span>
  )
}

export function DataGrid({
  fields,
  records,
  skipped,
}: {
  fields: readonly string[]
  records: CrmRecord[]
  skipped: SkippedRow[]
}) {
  const [tab, setTab] = useState<Tab>('imported')
  const [query, setQuery] = useState('')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) => Object.values(r).some((v) => v.toLowerCase().includes(q)))
  }, [records, query])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'imported', label: 'Imported', count: records.length },
    { id: 'skipped', label: 'Skipped', count: skipped.length },
  ]

  // ARIA APG tabs: only the selected tab is in the Tab order; arrows move focus
  // and selection together, Home/End jump to the ends.
  function onTabKeyDown(event: React.KeyboardEvent) {
    const order = tabs.map((t) => t.id)
    const current = order.indexOf(tab)
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % order.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (current - 1 + order.length) % order.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = order.length - 1
    else return

    event.preventDefault()
    const id = order[next]
    if (!id) return
    setTab(id)
    tabRefs.current[id]?.focus()
  }

  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_1fr]">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-6">
        <div
          role="tablist"
          aria-label="Import results"
          className="bg-muted/60 flex gap-1 rounded-lg p-0.5"
          onKeyDown={onTabKeyDown}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              ref={(el) => {
                tabRefs.current[t.id] = el
              }}
              tabIndex={tab === t.id ? 0 : -1}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'focus-visible:ring-ring/60 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-all outline-none focus-visible:ring-2',
                tab === t.id
                  ? 'bg-background text-foreground shadow-2xs font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[0.7rem] tabular-nums',
                  tab === t.id ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {tab === 'imported' && records.length > 0 && (
          <label className="relative flex items-center">
            <SearchIcon
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute left-2 size-3.5"
            />
            <span className="sr-only">Filter imported records</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter records"
              className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 shadow-2xs h-7 w-52 rounded-md border pl-7 text-sm outline-none focus-visible:ring-3"
            />
          </label>
        )}
      </div>

      {tab === 'imported' && (
        <div
          id="panel-imported"
          role="tabpanel"
          aria-labelledby="tab-imported"
          tabIndex={0}
          className="focus-visible:ring-ring/50 min-h-0 min-w-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          {records.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              No rows were imported. Every row was skipped — see the Skipped tab.
            </p>
          ) : (
            <>
              {/* Padding lives on the edge cells, not the scroll container: a scroll
              container's padding-right is not painted past the scrolled content. */}
              <table className="w-full border-collapse text-sm">
                <thead className="bg-sidebar/95 border-border sticky top-0 z-10 border-b backdrop-blur">
                  <tr>
                    <th
                      scope="col"
                      className="text-muted-foreground bg-sidebar/95 sticky left-0 z-20 h-9 pr-3 pl-4 text-right text-[0.7rem] font-medium tabular-nums backdrop-blur sm:pl-6"
                    >
                      #
                    </th>
                    {fields.map((field) => (
                      <th
                        key={field}
                        scope="col"
                        className="text-muted-foreground h-9 px-3 text-left font-mono text-[0.7rem] font-medium tracking-tight whitespace-nowrap last:pr-4 sm:last:pr-6"
                      >
                        {humanizeField(field)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record, i) => (
                    <tr key={i} className="border-border/70 hover:bg-accent/40 border-b transition-colors">
                      <td className="bg-background text-muted-foreground sticky left-0 py-2 pr-3 pl-4 text-right text-xs tabular-nums sm:pl-6">
                        {i + 1}
                      </td>
                      {fields.map((field) => {
                        const value = record[field as keyof CrmRecord]
                        return (
                          <td key={field} className="px-3 py-2 whitespace-nowrap last:pr-4 sm:last:pr-6">
                            {field === 'crm_status' ? (
                              <StatusCell value={value} />
                            ) : value ? (
                              <span className={cn(field.includes('mobile') && 'font-mono tabular-nums')}>
                                {value}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <p className="text-muted-foreground p-8 text-center text-sm">
                  No record matches “{query}”.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'skipped' && (
        <div
          id="panel-skipped"
          role="tabpanel"
          aria-labelledby="tab-skipped"
          tabIndex={0}
          className="focus-visible:ring-ring/50 min-h-0 min-w-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          {skipped.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              Every row had an email or a mobile number. Nothing was skipped.
            </p>
          ) : (
            <ul className="divide-border/70 divide-y">
              {skipped.map((row) => (
                <li key={row.rowNumber} className="grid gap-1 px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-mono font-medium tabular-nums">Line {row.rowNumber}</span>
                    <span className="text-muted-foreground">
                      {SKIP_REASON_LABEL[row.reason] ?? row.reason}
                    </span>
                  </div>
                  <p className="text-muted-foreground overflow-x-auto text-xs whitespace-nowrap">
                    {Object.entries(row.original)
                      .filter(([, v]) => v !== '')
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('  ·  ') || 'every cell was empty'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
