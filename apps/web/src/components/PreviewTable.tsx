'use client'

import type { PreviewData } from '@/lib/preview'

export function PreviewTable({ headers, rows, totalRows }: PreviewData) {
  const capped = totalRows > rows.length

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[1fr_auto]">
      {/* min-w-0 lets the table scroll inside this box instead of stretching the
          dialog; overflow-auto gives both axes, the sticky header rides the y-scroll. */}
      <div className="min-h-0 min-w-0 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-card/95 sticky top-0 z-10 backdrop-blur">
            <tr>
              <th
                scope="col"
                className="border-border text-muted-foreground bg-card/95 sticky left-0 z-20 h-9 w-10 border-b pr-2 pl-4 text-right align-middle text-[11px] font-medium backdrop-blur sm:pl-5"
              >
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="border-border text-muted-foreground h-9 border-b px-3 text-left align-middle text-[11px] font-medium tracking-wide whitespace-nowrap last:pr-5"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="group hover:bg-accent/40 transition-colors">
                <td className="border-border/60 bg-card group-hover:bg-[color-mix(in_oklab,var(--accent)_40%,var(--card))] text-muted-foreground/70 sticky left-0 border-b py-2.5 pr-2 pl-4 text-right text-xs tabular-nums transition-colors sm:pl-5">
                  {i + 1}
                </td>
                {headers.map((header) => (
                  <td key={header} className="border-border/60 border-b px-3 py-2.5 align-middle last:pr-5">
                    {row[header] ? (
                      <span
                        className="text-foreground/85 block max-w-[28ch] truncate whitespace-nowrap"
                        title={row[header]}
                      >
                        {row[header]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {capped && (
        <p className="border-border text-muted-foreground border-t px-5 py-2 text-xs tabular-nums">
          Showing the first {rows.length} of {totalRows.toLocaleString()} rows.
        </p>
      )}
    </div>
  )
}
