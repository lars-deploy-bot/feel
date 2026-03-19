import { supabaseSecretKey, supabaseUrl } from "@webalive/env"
import { z } from "zod"

const envSchema = z.object({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: supabaseSecretKey,
  JWT_SECRET: z.string().min(1),
  WORKER_PORT: z.coerce.number().int().positive().default(5070),
  /** Port of the web app — used to build the internal trigger URL */
  WEB_APP_PORT: z.coerce.number().int().positive().default(9000),
  ALIVE_ENV: z.enum(["local", "dev", "staging", "production", "standalone"]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
})

export type WorkerEnv = z.infer<typeof envSchema>

function loadEnv(): WorkerEnv {
  const result = envSchema.safeParse({
    ...process.env,
    // Map PORT to WEB_APP_PORT for clarity (PORT is the web app's port, not ours)
    WEB_APP_PORT: process.env.PORT,
  })
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${(errors ?? []).join(", ")}`)
      .join("\n")
    throw new Error(`[worker-env] Missing or invalid environment variables:\n${missing}`)
  }
  return result.data
}

export const env = loadEnv()
