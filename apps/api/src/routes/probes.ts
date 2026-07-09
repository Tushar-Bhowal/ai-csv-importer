import express, { Router } from 'express'

// Two questions we must answer on the real deployment before any feature depends on them.
// Delete this file and its mount at the end of Phase 3.
//
//   1. Does the platform stream an SSE response, or buffer it into one blob at the end?
//      A buffered stream works perfectly on localhost and silently lies in production.
//        curl -N <api-url>/api/v1/probe/stream     → 3 ticks, 1s apart. Not one blob after 3s.
//
//   2. What is the platform's request body ceiling? Vercel Functions cap well below the 5 MB
//      the assignment mentions, and multer would never see the request.
//        curl -F file=@5mb.csv <api-url>/api/v1/probe/echo   → 200, not 413.

export const probeRouter = Router()

const TICKS = 3
const TICK_MS = 1000
const ECHO_LIMIT = '10mb'

probeRouter.get('/probe/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  let tick = 0
  const timer = setInterval(() => {
    tick += 1
    res.write(`event: tick\ndata: ${JSON.stringify({ tick, of: TICKS })}\n\n`)
    if (tick >= TICKS) {
      clearInterval(timer)
      res.end()
    }
  }, TICK_MS)

  req.on('close', () => clearInterval(timer))
})

probeRouter.post('/probe/echo', express.raw({ type: '*/*', limit: ECHO_LIMIT }), (req, res) => {
  const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0
  res.json({ bytes, appLimit: ECHO_LIMIT })
})
