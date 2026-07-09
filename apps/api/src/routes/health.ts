import { Router } from 'express'

import { allowedOrigins, hasLlmKey } from '../config.js'

const VERSION = process.env.npm_package_version ?? '0.1.0'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    llm: hasLlmKey ? 'available' : 'degraded',
    version: VERSION,
    allowedOrigins,
  })
})
