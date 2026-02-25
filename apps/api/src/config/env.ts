import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5080),
  NODE_ENV: z.union([z.literal("development"), z.literal("staging"), z.literal("production")]).default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ALIVE_PASSCODE: z.string().min(1),
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
