import { describe, expect, it } from 'vitest'

import { parseCsv } from './parseCsv.js'

describe('parseCsv', () => {
  it('parses a plain comma file', () => {
    const { headers, rows } = parseCsv('name,email\nRahil,r@test.com\nAmit,a@test.com')
    expect(headers).toEqual(['name', 'email'])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells).toEqual({ name: 'Rahil', email: 'r@test.com' })
  })

  it('strips a UTF-8 BOM instead of poisoning the first header', () => {
    const { headers } = parseCsv('﻿name,email\nRahil,r@test.com')
    expect(headers[0]).toBe('name')
  })

  it('auto-detects a semicolon delimiter', () => {
    const { headers, rows, delimiter } = parseCsv('name;email\nRahil;r@test.com')
    expect(delimiter).toBe(';')
    expect(headers).toEqual(['name', 'email'])
    expect(rows[0]?.cells.email).toBe('r@test.com')
  })

  it('handles CRLF, quoted commas, and embedded newlines', () => {
    const csv = 'name,note\r\n"Rahil","hello, world"\r\n"Amit","line one\nline two"\r\n'
    const { rows } = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells.note).toBe('hello, world')
    expect(rows[1]?.cells.note).toContain('\n')
  })

  it('finds the real header under an Excel preamble', () => {
    const csv = ['Lead Export Report', 'Generated 2026-05-13', '', 'name,email', 'Rahil,r@test.com'].join('\n')
    const { headers, rows, headerRowIndex } = parseCsv(csv)
    expect(headerRowIndex).toBe(3)
    expect(headers).toEqual(['name', 'email'])
    expect(rows).toHaveLength(1)
  })

  it('keeps duplicate and empty headers positionally distinct', () => {
    const { headers } = parseCsv('email,email,\na@b.com,c@d.com,x')
    expect(headers).toEqual(['email', 'email_2', 'column_3'])
  })

  it('numbers rows as a spreadsheet does, skipping blank lines', () => {
    const { rows } = parseCsv('name\nRahil\n\nAmit\n')
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 4])
  })

  it('decodes Windows-1252 bytes rather than emitting replacement characters', () => {
    // "José" in Windows-1252: é = 0xE9, which is invalid standalone UTF-8.
    const bytes = new Uint8Array([...'name\nJos'].map((c) => c.charCodeAt(0)).concat([0xe9]))
    const { rows } = parseCsv(bytes)
    expect(rows[0]?.cells.name).toBe('José')
  })
})
