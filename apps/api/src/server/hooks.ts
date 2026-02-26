import { logger } from "../infra/logger"

let shutdownInProgress = false

function gracefulShutdown(signal: string): void {
  if (shutdownInProgress) return
  shutdownInProgress = true

  logger.info("shutdown", { signal, message: `Received ${signal}, shutting down gracefully` })

  // Give in-flight requests a moment to complete
  setTimeout(() => {
    logger.info("shutdown", { message: "Exiting process" })
    process.exit(0)
  }, 2000)
}

export function registerShutdownHooks(): void {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))

  process.on("uncaughtException", err => {
    logger.error("uncaught_exception", { message: err.message, stack: err.stack })
    process.exit(1)
  })

  process.on("unhandledRejection", reason => {
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    logger.error("unhandled_rejection", { message, stack })
  })
}
