import { AppError, errorBody, MAX_UPLOAD_BYTES } from '@groweasy/core'
import type { ErrorRequestHandler, RequestHandler } from 'express'

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}`))
}

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

// body-parser aborts an over-sized upload mid-stream, before the route ever runs.
// Left to AppError.from it would surface as a 500 that blames the server.
const isTooLarge = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.too.large'

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  const appError = isTooLarge(err)
    ? new AppError('PAYLOAD_TOO_LARGE', `That file is larger than the ${MB(MAX_UPLOAD_BYTES)} limit.`)
    : AppError.from(err)

  if (appError.status >= 500) {
    console.error({ requestId: req.requestId, cause: appError.cause ?? appError })
  }

  res.status(appError.status).json(errorBody(appError, req.requestId))
}
