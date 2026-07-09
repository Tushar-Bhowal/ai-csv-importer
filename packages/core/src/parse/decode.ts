const utf8Strict = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('windows-1252')

// Excel on Windows still saves "CSV" as Windows-1252. Try strict UTF-8 first;
// if the bytes are not valid UTF-8, fall back rather than emitting U+FFFD
// garbage into names like "José".
export function decodeCsvBuffer(bytes: Uint8Array): string {
  let text: string
  try {
    text = utf8Strict.decode(bytes)
  } catch {
    text = latin1.decode(bytes)
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}
