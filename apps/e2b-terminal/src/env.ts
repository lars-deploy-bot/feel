import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5075),
  SHELL_PASSWORD: z.string().min(1),
  E2B_DOMAIN: z.string().min(1),
  ALIVE_ENV: z.enum(["local", "dev", "staging", "production", "standalone"]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
})

export type E2bTerminalEnv = z.infer<typeof envSchema>

function loadEnv(): E2bTerminalEnv {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${(errors ?? []).join(", ")}`)
      .join("\n")
    throw new Error(`[e2b-terminal-env] Missing or invalid environment variables:\n${missing}`)
  }
  return result.data
}

export const env = loadEnv()
