import { Polar } from "@polar-sh/sdk"
import { env } from "../../config/env"

let polarClient: Polar | null = null

/**
 * Get the Polar SDK client singleton.
 * Uses sandbox for dev/staging, production for production.
 *
 * POLAR_ACCESS_TOKEN is required at startup (validated by env schema).
 * Sandbox tokens come from sandbox.polar.sh, production from polar.sh.
 */
export function getPolarClient(): Polar {
  if (polarClient) return polarClient

  const server = env.ALIVE_ENV === "production" ? "production" : "sandbox"
  polarClient = new Polar({ accessToken: env.POLAR_ACCESS_TOKEN, server })
  return polarClient
}
