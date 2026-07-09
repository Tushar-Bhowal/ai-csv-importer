import { describe, expect, it } from 'vitest'

import { decodeCsvBuffer } from './decode.js'

const utf8 = (text: string) => new TextEncoder().encode(text)

describe('decodeCsvBuffer', () => {
  it('decodes valid UTF-8, including multi-byte characters', () => {
    expect(decodeCsvBuffer(utf8('name,city\nJosé,Bengalūru'))).toBe('name,city\nJosé,Bengalūru')
  })

  it('strips a UTF-8 BOM', () => {
    expect(decodeCsvBuffer(utf8('﻿name,email'))).toBe('name,email')
  })

  it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
    // 0xE9 is "é" in Windows-1252 and invalid as standalone UTF-8.
    const bytes = new Uint8Array([...utf8('Jos'), 0xe9])
    expect(decodeCsvBuffer(bytes)).toBe('José')
  })

  it('never emits the U+FFFD replacement character', () => {
    const bytes = new Uint8Array([0x93, 0x94, 0x96]) // smart quotes + en dash in cp1252
    expect(decodeCsvBuffer(bytes)).not.toContain('�')
  })

  it('handles an empty buffer', () => {
    expect(decodeCsvBuffer(new Uint8Array())).toBe('')
  })
})
