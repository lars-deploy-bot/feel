import { checkSchema, formatSchemaFailure } from "@webalive/database"

interface Logger {
  error(msg: string, data?: Record<string, unknown>): void
}

/**
 * Verify database schema is accessible (tables exist, permissions OK).
 * Exits the process if schema is broken. No fallbacks.
 */
export async function verifySeedData(supabaseUrl: string, supabaseKey: string, logger: Logger): Promise<void> {
  try {
    const result = await checkSchema(supabaseUrl, supabaseKey)
    if (!result.ok) {
      logger.error("schema_check_failed", { message: formatSchemaFailure(result) })
      process.exit(1)
    }
  } catch (err) {
    logger.error("schema_check_error", {
      message: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  }
}
