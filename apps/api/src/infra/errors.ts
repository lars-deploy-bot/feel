import type { ContentfulStatusCode } from "hono/utils/http-status"

export const ErrorCodes = {
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFLICT: "CONFLICT",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: ContentfulStatusCode

  constructor(message: string, code: ErrorCode, status: ContentfulStatusCode) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, ErrorCodes.NOT_FOUND, 404)
    this.name = "NotFoundError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, ErrorCodes.UNAUTHORIZED, 401)
    this.name = "UnauthorizedError"
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, ErrorCodes.VALIDATION_ERROR, 400)
    this.name = "ValidationError"
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, ErrorCodes.RATE_LIMITED, 429)
    this.name = "RateLimitError"
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, ErrorCodes.INTERNAL_ERROR, 500)
    this.name = "InternalError"
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, ErrorCodes.CONFLICT, 409)
    this.name = "ConflictError"
  }
}
