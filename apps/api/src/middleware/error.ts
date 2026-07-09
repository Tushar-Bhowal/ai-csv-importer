import { AppError, errorBody } from '@groweasy/core'
import type { ErrorRequestHandler, RequestHandler } from 'express'

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}`))
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  const appError = AppError.from(err)

  if (appError.status >= 500) {
    console.error({ requestId: req.requestId, cause: appError.cause ?? appError })
  }

  res.status(appError.status).json(errorBody(appError, req.requestId))
}
