import type { ErrorHandler } from "hono"
import { AppError, ErrorCodes } from "../infra/errors"
import { logger } from "../infra/logger"
import type { AppBindings } from "../types/hono"

export const errorHandler: ErrorHandler<AppBindings> = (err, c) => {
  if (err instanceof AppError) {
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

  // Unexpected error
  const message = err instanceof Error ? err.message : "Unknown error"
  const stack = err instanceof Error ? err.stack : undefined

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
