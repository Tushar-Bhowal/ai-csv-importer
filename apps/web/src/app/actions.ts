'use server'

import { importCsv, MAX_UPLOAD_BYTES, type ImportOutcome } from '@/lib/import'

export type ImportState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; fileName: string; outcome: ImportOutcome }

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export async function importCsvAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return { kind: 'error', message: 'Choose a CSV file to import.' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      kind: 'error',
      message: `That file is ${MB(file.size)}. The limit is ${MB(MAX_UPLOAD_BYTES)}.`,
    }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const outcome = await importCsv(bytes)

    if (outcome.summary.totalRows === 0) {
      return { kind: 'error', message: 'That file has a header row but no data rows.' }
    }
    return { kind: 'done', fileName: file.name, outcome }
  } catch (err) {
    // The file is arbitrary bytes from a stranger. A decode or parse failure is
    // an expected outcome, not an exception the page should crash on.
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'That file could not be read as CSV.',
    }
  }
}
