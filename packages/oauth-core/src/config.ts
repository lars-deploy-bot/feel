/**
 * Configuration and Environment Validation
 */

import { z } from "zod"

const configSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  LOCKBOX_MASTER_KEY: z.string().length(64, "LOCKBOX_MASTER_KEY must be 64 hex characters (32 bytes)"),
})

export type Config = z.infer<typeof configSchema>

const validateConfig = (): Config => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const result = configSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: serviceKey,
    LOCKBOX_MASTER_KEY: process.env.LOCKBOX_MASTER_KEY,
  })

  if (!result.success) {
    const errors = result.error.format()
    throw new Error(`[OAuth Core] Invalid configuration:\n${JSON.stringify(errors, null, 2)}`)
  }

  return result.data
}

let cachedConfig: Config | null = null

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = validateConfig()
  }
  return cachedConfig
}

/**
 * Master key for encryption - validated on first use
 */
const validateMasterKey = (): Buffer => {
  const key = Buffer.from(getConfig().LOCKBOX_MASTER_KEY, "hex")

  if (key.length !== 32) {
    throw new Error("[OAuth Core] LOCKBOX_MASTER_KEY must decode to exactly 32 bytes")
  }

  return key
}

let masterKeyBuffer: Buffer | null = null

export function getMasterKey(): Buffer {
  if (!masterKeyBuffer) {
    masterKeyBuffer = validateMasterKey()
  }
  return masterKeyBuffer
}
