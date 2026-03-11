import { STREAM_ENV } from "@webalive/shared"
import { EmailProviderError } from "./types"

export function isEmailDeliveryDisabled(): boolean {
  const nodeEnv = process.env.NODE_ENV?.toString()
  const streamEnv = process.env.STREAM_ENV
  if (!streamEnv && nodeEnv !== "production") {
    return true
  }
  return nodeEnv === "staging" || streamEnv === STREAM_ENV.STAGING
}

export function assertEmailDeliveryAllowed(channel: string): void {
  if (isEmailDeliveryDisabled()) {
    throw new EmailProviderError(`Email delivery is disabled in staging for ${channel}`, "delivery_disabled")
  }
}
