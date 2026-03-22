import { Polar } from "@polar-sh/sdk"
import { env } from "../../config/env"

let polarClient: Polar | null = null

/**
 * Get the Polar SDK client singleton.
 * Uses sandbox for dev/staging, production for production.
 * Requires separate tokens — sandbox tokens from sandbox.polar.sh,
 * production tokens from polar.sh.
 */
export function getPolarClient(): Polar {
  if (polarClient) return polarClient

  const token = env.POLAR_ACCESS_TOKEN
  if (!token) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured. Set it to enable billing.")
  }

  const server = env.ALIVE_ENV === "production" ? "production" : "sandbox"
  polarClient = new Polar({ accessToken: token, server })
  return polarClient
}
