import type { ErrorHandler } from "hono"
import { AppError, ErrorCodes } from "../infra/errors"
import { logger } from "../infra/logger"
import { Sentry } from "../infra/sentry"
import type { AppBindings } from "../types/hono"

export const errorHandler: ErrorHandler<AppBindings> = (err, c) => {
  if (err instanceof AppError) {
    // AppErrors are expected (validation, auth, etc.) — only report 5xx to Sentry
    if (err.status >= 500) {
      Sentry.withScope(scope => {
        scope.setTag("error.code", err.code)
        scope.setTag("requestId", c.get("requestId") ?? "unknown")
        Sentry.captureException(err)
      })
    }

    logger.error(err.message, {
      code: err.code,
      status: err.status,
      requestId: c.get("requestId"),
    })

    return c.json(
      {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.status,
    )
  }

  // Unexpected error — always report to Sentry
  const message = err instanceof Error ? err.message : "Unknown error"
  const stack = err instanceof Error ? err.stack : undefined

  Sentry.withScope(scope => {
    scope.setTag("requestId", c.get("requestId") ?? "unknown")
    scope.setLevel("error")
    Sentry.captureException(err)
  })

  logger.error("Unhandled error", {
    message,
    stack,
    requestId: c.get("requestId"),
  })

  return c.json(
    {
      ok: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: "Internal server error",
      },
    },
    500,
  )
}
