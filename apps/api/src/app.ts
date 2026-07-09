import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { allowedOrigins } from './config.js'
import { errorHandler, notFound } from './middleware/error.js'
import { requestId } from './middleware/requestId.js'
import { healthRouter } from './routes/health.js'
import { probeRouter } from './routes/probes.js'

export const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['X-Request-Id'] }))
app.use(requestId)

app.use('/api/v1', healthRouter)
app.use('/api/v1', probeRouter)

app.use(notFound)
app.use(errorHandler)

export default app
