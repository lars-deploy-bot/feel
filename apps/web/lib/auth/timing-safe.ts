/**
 * Timing-Safe String Comparison & Internal Secret Verification
 *
 * SECURITY: Standard === comparison is vulnerable to timing attacks.
 * Attacker can measure response time to deduce characters one by one.
 *
 * Uses HMAC to normalize both inputs to fixed-length digests before
 * comparing, so neither content nor length leaks via timing.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"

/**
 * Compare two strings in constant time.
 * Uses HMAC-SHA256 to normalize both inputs to 32-byte digests,
 * preventing length-based timing leaks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false
  }

  // HMAC both inputs with a fixed key so the digests are always 32 bytes,
  // regardless of input length. This avoids the timingSafeEqual same-length
  // requirement without leaking length information.
  const key = "timing-safe-compare"
  const digestA = createHmac("sha256", key).update(a).digest()
  const digestB = createHmac("sha256", key).update(b).digest()

  return timingSafeEqual(digestA, digestB)
}

/**
 * Verify an internal secret header against an environment variable.
 * Returns null on success, or a 401/500 Response on failure.
 *
 * Usage:
 *   const error = verifyInternalSecret(req, "INTERNAL_TOOLS_SECRET", "x-internal-tools-secret")
 *   if (error) return error
 */
export function verifyInternalSecret(req: Request, envVar: string, headerName: string): Response | null {
  const expected = process.env[envVar]
  const provided = req.headers.get(headerName)

  if (!expected) {
    console.error(`[verifyInternalSecret] ${envVar} not configured`)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  if (!provided || !timingSafeCompare(provided, expected)) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, {
      status: 401,
      details: { requestId: crypto.randomUUID() },
    })
  }

  return null
}
