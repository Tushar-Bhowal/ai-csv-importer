import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'

import { csvSafe, singleLine } from './csvSafe.js'

describe('singleLine', () => {
  it('escapes newlines so a record stays one CSV row', () => {
    expect(singleLine('line one\nline two')).toBe('line one\\nline two')
    expect(singleLine('windows\r\nstyle')).toBe('windows\\nstyle')
    expect(singleLine('old\rmac')).toBe('old\\nmac')
  })

  it('leaves a formula trigger alone — that quote belongs at the export boundary', () => {
    expect(singleLine("=cmd|'/c calc'!A1")).toBe("=cmd|'/c calc'!A1")
    expect(singleLine('-2 BHK')).toBe('-2 BHK')
    expect(singleLine('+91')).toBe('+91')
  })
})

describe('csvSafe', () => {
  it('escapes newlines so a record stays one CSV row', () => {
    expect(csvSafe('line one\nline two')).toBe('line one\\nline two')
    expect(csvSafe('windows\r\nstyle')).toBe('windows\\nstyle')
    expect(csvSafe('old\rmac')).toBe('old\\nmac')
  })

  it('neutralises CSV formula injection', () => {
    expect(csvSafe("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1")
    expect(csvSafe('+1234')).toBe("'+1234")
    expect(csvSafe('-1+1')).toBe("'-1+1")
    expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvSafe('\t=SUM(A1)')).toBe("'\t=SUM(A1)")
  })

  it('escapes a leading carriage return before it can look like a trigger', () => {
    expect(csvSafe('\r=SUM(A1)')).toBe('\\n=SUM(A1)')
  })

  it('leaves ordinary values untouched', () => {
    expect(csvSafe('Rahil Mohammad')).toBe('Rahil Mohammad')
    expect(csvSafe('rahil@test.com')).toBe('rahil@test.com')
    expect(csvSafe('')).toBe('')
    expect(csvSafe('Client asked to reschedule, will call back')).toBe(
      'Client asked to reschedule, will call back',
    )
  })

  it('PROPERTY: a safed value always round-trips as exactly one CSV row', () => {
    const hostile = [
      'note with, comma',
      'note with "quotes"',
      'multi\nline\nnote',
      "=HYPERLINK('http://evil','click')",
      'trailing\r\n',
      '  ',
    ]
    for (const value of hostile) {
      const csv = Papa.unparse([{ crm_note: csvSafe(value), email: 'a@b.com' }])
      const back = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
      expect(back.data, value).toHaveLength(1)
      expect(back.data[0]?.email).toBe('a@b.com')
    }
  })
})
