'use client'

import { SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CrmRecord, SkippedRow } from '@groweasy/core'

import { avatarTone, humanizeField, initials, STATUS_META } from '@/lib/crm-display'
import { cn } from '@/lib/utils'

const SKIP_REASON_LABEL: Record<string, string> = {
  no_contact: 'No email and no mobile number',
}

// Wide free-text columns truncate with a tooltip instead of stretching the row.
const TRUNCATED: Partial<Record<keyof CrmRecord, string>> = {
  name: 'max-w-[22ch]',
  email: 'max-w-[28ch]',
  company: 'max-w-[20ch]',
  lead_owner: 'max-w-[20ch]',
  crm_note: 'max-w-[36ch]',
  description: 'max-w-[32ch]',
  possession_time: 'max-w-[18ch]',
}

const MONO_FIELDS = new Set<keyof CrmRecord>(['created_at', 'country_code', 'mobile_without_country_code'])

// Rows are a fixed 44px (h-11, single-line cells), which is what makes windowing
// arithmetic instead of measurement. Below the threshold the DOM is cheap enough
// that windowing would only add moving parts.
const ROW_H = 44
const VIRTUALIZE_OVER = 150
const OVERSCAN = 12

type Tab = 'imported' | 'skipped'

function StatusCell({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground/60">—</span>

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

function NameCell({ record }: { record: CrmRecord }) {
  if (!record.name) return <span className="text-muted-foreground/60">—</span>

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
          avatarTone(record.name + record.email),
        )}
      >
        {initials(record.name)}
      </span>
      <span className="text-foreground max-w-[22ch] truncate font-medium" title={record.name}>
        {record.name}
      </span>
    </span>
  )
}

function Cell({ record, field }: { record: CrmRecord; field: keyof CrmRecord }) {
  const value = record[field]

  if (field === 'name') return <NameCell record={record} />
  if (field === 'crm_status') return <StatusCell value={value} />
  if (!value) return <span className="text-muted-foreground/60">—</span>

  if (MONO_FIELDS.has(field)) {
    return (
      <span
        className={cn(
          'font-mono text-[13px] tabular-nums whitespace-nowrap',
          field === 'created_at' ? 'text-muted-foreground' : 'text-foreground/85',
        )}
      >
        {value}
      </span>
    )
  }

  const truncate = TRUNCATED[field]
  return (
    <span
      className={cn('text-foreground/85 block whitespace-nowrap', truncate && `${truncate} truncate`)}
      {...(truncate ? { title: value } : {})}
    >
      {value}
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

  const panelRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(600)

  useEffect(() => {
    const measure = () => setViewH(panelRef.current?.clientHeight ?? 600)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [tab])

  // A shrinking result set (new filter, tab switch) can leave the stored offset
  // pointing past the content, which would window an empty slice until the next
  // scroll event. Jumping to the top is also the expected filter behavior.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
    setScrollTop(0)
  }, [query, tab])

  const windowed = filtered.length > VIRTUALIZE_OVER
  const start = windowed ? Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN) : 0
  const end = windowed
    ? Math.min(filtered.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN)
    : filtered.length
  const visible = filtered.slice(start, end)

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
    <section className="grid min-h-0 min-w-0 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="border-border bg-card shadow-xs grid min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-2.5 py-2">
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
                className="text-muted-foreground pointer-events-none absolute left-2.5 size-3.5"
              />
              <span className="sr-only">Filter imported records</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter records"
                className="bg-muted/50 focus-visible:bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-8 w-56 rounded-lg border border-transparent pl-8 text-sm transition-colors outline-none focus-visible:ring-3"
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
            ref={panelRef}
            onScroll={(e) => {
              if (windowed) setScrollTop(e.currentTarget.scrollTop)
            }}
            className="focus-visible:ring-ring/50 min-h-0 min-w-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            {records.length === 0 ? (
              <p className="text-muted-foreground p-10 text-center text-sm">
                No rows were imported. Every row was skipped — see the Skipped tab.
              </p>
            ) : (
              <>
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-card/95 sticky top-0 z-10 backdrop-blur">
                    <tr>
                      <th
                        scope="col"
                        className="border-border text-muted-foreground bg-card/95 sticky left-0 z-20 h-9 w-10 border-b pr-2 pl-4 text-right align-middle text-[11px] font-medium backdrop-blur"
                      >
                        #
                      </th>
                      {fields.map((field) => (
                        <th
                          key={field}
                          scope="col"
                          className="border-border text-muted-foreground h-9 border-b px-3 text-left align-middle text-[11px] font-medium tracking-wide whitespace-nowrap last:pr-4"
                        >
                          {humanizeField(field)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {windowed && start > 0 && (
                      <tr aria-hidden style={{ height: start * ROW_H }}>
                        <td colSpan={fields.length + 1} className="p-0" />
                      </tr>
                    )}
                    {visible.map((record, i) => (
                      <tr key={start + i} className="group hover:bg-accent/40 transition-colors">
                        <td className="border-border/60 bg-card group-hover:bg-[color-mix(in_oklab,var(--accent)_40%,var(--card))] text-muted-foreground/70 sticky left-0 h-11 border-b pr-2 pl-4 text-right text-xs tabular-nums transition-colors">
                          {start + i + 1}
                        </td>
                        {fields.map((field) => (
                          <td
                            key={field}
                            className="border-border/60 h-11 border-b px-3 align-middle last:pr-4"
                          >
                            <Cell record={record} field={field as keyof CrmRecord} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {windowed && end < filtered.length && (
                      <tr aria-hidden style={{ height: (filtered.length - end) * ROW_H }}>
                        <td colSpan={fields.length + 1} className="p-0" />
                      </tr>
                    )}
                  </tbody>
                </table>

                {filtered.length === 0 && (
                  <p className="text-muted-foreground p-10 text-center text-sm">
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
              <p className="text-muted-foreground p-10 text-center text-sm">
                Every row had an email or a mobile number. Nothing was skipped.
              </p>
            ) : (
              <ul>
                {skipped.map((row) => (
                  <li
                    key={row.rowNumber}
                    className="border-border/60 hover:bg-accent/30 grid gap-1.5 border-b px-4 py-3 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums">
                        Row {row.rowNumber}
                      </span>
                      <span className="bg-destructive/10 text-destructive ring-destructive/20 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
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

        <div className="border-border text-muted-foreground flex items-center justify-between border-t px-4 py-1.5 text-xs tabular-nums">
          {tab === 'imported' ? (
            <>
              <span>
                {query
                  ? `${filtered.length} of ${records.length} record${records.length === 1 ? '' : 's'}`
                  : `${records.length} record${records.length === 1 ? '' : 's'}`}
              </span>
              <span>{fields.length} fields</span>
            </>
          ) : (
            <span>
              {skipped.length} row{skipped.length === 1 ? '' : 's'} skipped
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
