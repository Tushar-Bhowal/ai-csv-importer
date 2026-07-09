import cors from 'cors'
import express from 'express'

import { allowedOrigins } from './config.js'
import { errorHandler, notFound } from './middleware/error.js'
import { requestId } from './middleware/requestId.js'
import { securityHeaders } from './middleware/securityHeaders.js'
import { healthRouter } from './routes/health.js'
import { probeRouter } from './routes/probes.js'

export const app = express()

app.disable('x-powered-by')
app.use(securityHeaders)
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['X-Request-Id'] }))
app.use(requestId)

app.get('/', (_req, res) => {
  res.json({ service: 'ai-csv-importer-api', health: '/api/v1/health' })
})

app.use('/api/v1', healthRouter)
app.use('/api/v1', probeRouter)

app.use(notFound)
app.use(errorHandler)

export default app
