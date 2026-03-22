import { Polar } from "@polar-sh/sdk"
import { env } from "../../config/env"

let polarClient: Polar | null = null

/**
 * Get the Polar SDK client singleton.
 * Points at sandbox for now — switch to "production" when ready.
 */
export function getPolarClient(): Polar {
  if (polarClient) return polarClient

  const token = env.POLAR_ACCESS_TOKEN
  if (!token) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured. Set it to enable billing.")
  }

  polarClient = new Polar({ accessToken: token, server: "production" })
  return polarClient
}
