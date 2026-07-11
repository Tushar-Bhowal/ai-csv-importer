import { describe, expect, it } from 'vitest'

import { parsePreview, PreviewError, PREVIEW_ROW_CAP } from './preview'

const file = (csv: string) => new File([csv], 'x.csv', { type: 'text/csv' })

describe('parsePreview', () => {
  it('reads headers, rows, and the true total', async () => {
    const d = await parsePreview(file('name,email\nAlice,a@x.com\nBob,b@y.com'))
    expect(d.headers).toEqual(['name', 'email'])
    expect(d.totalRows).toBe(2)
    expect(d.rows[0]).toEqual({ name: 'Alice', email: 'a@x.com' })
  })

  it('strips a leading BOM from the first header', async () => {
    const d = await parsePreview(file('﻿name,email\nA,a@x.com'))
    expect(d.headers).toEqual(['name', 'email'])
  })

  it('normalizes blank and duplicate headers', async () => {
    const d = await parsePreview(file('name,name,\nA,B,C'))
    expect(d.headers).toEqual(['name', 'name_2', 'column_3'])
    expect(d.rows[0]).toEqual({ name: 'A', name_2: 'B', column_3: 'C' })
  })

  it('skips leading blank lines before the header', async () => {
    const d = await parsePreview(file('\n\nname,email\nA,a@x.com'))
    expect(d.headers).toEqual(['name', 'email'])
    expect(d.totalRows).toBe(1)
  })

  it('finds the real header under a title/preamble, matching the server', async () => {
    const csv = [
      'GrowEasy CRM — lead export,,,,,,,,',
      'Generated 2026-07-09. Confidential.,,,,,,,,',
      '',
      'created_at,name,email,country_code,mobile,company,city,state,country',
      '2026-07-09,Asha Rao,asha@x.com,+91,9876543210,Acme,Pune,MH,India',
    ].join('\n')
    const d = await parsePreview(file(csv))
    expect(d.headers[0]).toBe('created_at')
    expect(d.headers).toContain('email')
    expect(d.headers).not.toContain('column_2')
    expect(d.totalRows).toBe(1)
    expect(d.rows[0]?.name).toBe('Asha Rao')
  })

  it('drops blank data rows but counts only real rows', async () => {
    const d = await parsePreview(file('name\nA\n\n\nB'))
    expect(d.totalRows).toBe(2)
  })

  it('caps rendered rows but reports the true total', async () => {
    const csv = ['h', ...Array.from({ length: 250 }, (_, i) => `r${i}`)].join('\n')
    const d = await parsePreview(file(csv))
    expect(d.rows).toHaveLength(PREVIEW_ROW_CAP)
    expect(d.totalRows).toBe(250)
  })

  it('rejects an empty file', async () => {
    await expect(parsePreview(file('   \n  '))).rejects.toThrow(PreviewError)
    await expect(parsePreview(file('   \n  '))).rejects.toThrow('That file is empty.')
  })

  it('rejects a header row with no data rows', async () => {
    await expect(parsePreview(file('name,email'))).rejects.toThrow(
      'That file has a header row but no data rows.',
    )
  })
})
