import posthog from "posthog-js"
import { getRuntimeConfig } from "@/lib/hooks/useRuntimeConfig"

/**
 * Reset PostHog identity on logout.
 * Call this from logout handlers to clear the distinct_id and device_id,
 * ensuring the next user gets a clean session.
 */
export function resetPostHogIdentity() {
  if (typeof window === "undefined" || !getRuntimeConfig().posthogKey) return
  posthog.reset(true)
}
