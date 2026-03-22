import { e2bApiKey, polarAccessToken, supabaseSecretKey, supabaseUrl } from "@webalive/env"
import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5080),
  NODE_ENV: z.enum(["development", "staging", "production"]).default("production"),
  ALIVE_ENV: z.enum(["local", "dev", "staging", "production", "standalone"]).optional(),
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: supabaseSecretKey,
  ALIVE_PASSCODE: z.string().min(1),
  E2B_API_KEY: e2bApiKey,
  GROQ_API_SECRET: z.string().min(1),
  POSTHOG_API_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url(),
  POSTHOG_PROJECT_ID: z.coerce.number().int().positive(),
  // Polar.sh billing — REQUIRED, fail fast if not set
  POLAR_ACCESS_TOKEN: polarAccessToken,
  POLAR_WEBHOOK_SECRET: z.string().min(1),
  // JWT — REQUIRED for verifying user session cookies from the web app
  JWT_SECRET: z.string().min(1),
  // Redis — REQUIRED for rate limiting
  REDIS_URL: z.string().min(1),
  // Alive internal services API key
  ALIVE_SECRET_KEY: z.string().min(1),
})

export type EnvConfig = z.infer<typeof envSchema>

function loadEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${(errors ?? []).join(", ")}`)
      .join("\n")
    throw new Error(`[env] Missing or invalid environment variables:\n${missing}`)
  }
  return result.data
}

export const env = loadEnv()
