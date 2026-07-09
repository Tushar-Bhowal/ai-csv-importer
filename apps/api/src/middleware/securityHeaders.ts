import type { RequestHandler } from 'express'

// Replaces helmet: Vercel's Express builder typechecks with hardcoded compiler
// settings that cannot read helmet's dual CJS/ESM type declarations (TS2349 on
// every deploy). For a JSON-only API these five headers are what helmet would
// have contributed anyway.
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  next()
}
