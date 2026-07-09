export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export interface ErrorBody {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
    requestId?: string
  }
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: Record<string, unknown> | undefined

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS[code]
    this.details = details
  }

  static from(err: unknown): AppError {
    if (err instanceof AppError) return err
    // An unknown error's message may carry a path, a query, or a credential.
    // Keep it on `cause` for the logs; never let it reach the client.
    const wrapped = new AppError('INTERNAL', 'Something went wrong on our side.')
    wrapped.cause = err
    return wrapped
  }
}

export function errorBody(err: AppError, requestId?: string): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  }
}
