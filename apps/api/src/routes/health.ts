import { Router } from 'express'

const VERSION = process.env.npm_package_version ?? '0.1.0'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    llm: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'available' : 'degraded',
    version: VERSION,
  })
})
