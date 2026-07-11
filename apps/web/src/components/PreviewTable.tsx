'use client'

import type { PreviewData } from '@/lib/preview'

export function PreviewTable({ headers, rows, totalRows }: PreviewData) {
  const capped = totalRows > rows.length

  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[1fr_auto]">
      {/* min-w-0 lets the table scroll inside this box instead of stretching the
          page; overflow-auto gives both axes, the sticky header rides the y-scroll. */}
      <div className="min-h-0 min-w-0 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-sidebar/95 border-border sticky top-0 z-10 border-b backdrop-blur">
            <tr>
              <th
                scope="col"
                className="text-muted-foreground bg-sidebar/95 sticky left-0 z-20 h-9 pr-3 pl-4 text-right text-[0.7rem] font-medium tabular-nums backdrop-blur sm:pl-6"
              >
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="text-muted-foreground h-9 px-3 text-left font-mono text-[0.7rem] font-medium tracking-tight whitespace-nowrap last:pr-4 sm:last:pr-6"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-border/70 hover:bg-accent/40 border-b transition-colors">
                <td className="bg-background text-muted-foreground sticky left-0 py-2 pr-3 pl-4 text-right text-xs tabular-nums sm:pl-6">
                  {i + 1}
                </td>
                {headers.map((header) => (
                  <td key={header} className="px-3 py-2 whitespace-nowrap last:pr-4 sm:last:pr-6">
                    {row[header] ? (
                      row[header]
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {capped && (
        <p className="border-border text-muted-foreground border-t px-4 py-2 text-xs sm:px-6">
          Showing the first {rows.length} of {totalRows.toLocaleString()} rows.
        </p>
      )}
    </div>
  )
}
