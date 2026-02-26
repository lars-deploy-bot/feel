import { timingSafeEqual } from "node:crypto"
import { env } from "../../config/env"

export function verifyPasscode(passcode: string): boolean {
  const bufA = Buffer.from(passcode)
  const bufB = Buffer.from(env.ALIVE_PASSCODE)

  if (bufA.byteLength !== bufB.byteLength) {
    // Keep timing constant
    timingSafeEqual(bufA, bufA)
    return false
  }

  return timingSafeEqual(bufA, bufB)
}
