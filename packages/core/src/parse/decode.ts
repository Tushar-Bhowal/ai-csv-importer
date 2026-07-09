const utf8Strict = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('windows-1252')

// Excel on Windows still saves CSV as Windows-1252. Strict UTF-8 first, so
// invalid bytes fall back instead of becoming U+FFFD inside names like "José".
export function decodeCsvBuffer(bytes: Uint8Array): string {
  let text: string
  try {
    text = utf8Strict.decode(bytes)
  } catch {
    text = latin1.decode(bytes)
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}
