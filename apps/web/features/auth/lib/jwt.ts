import { JsonWebTokenError, type Secret, sign, TokenExpiredError, verify } from "jsonwebtoken"

const JWT_SECRET: Secret = process.env.JWT_SECRET || "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"

// Fail hard in production if JWT_SECRET not set
if (process.env.NODE_ENV === "production" && JWT_SECRET === "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION") {
  throw new Error(
    "⚠️  CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set in production!\n" +
      "Generate a secure secret with: openssl rand -base64 32\n" +
      "Then set JWT_SECRET in your environment.",
  )
}

export interface SessionPayload {
  userId: string
  iat?: number
  exp?: number
}

/**
 * Create a signed JWT token for authenticated user
 * Token expires in 30 days
 * @param userId - User ID (UUID)
 * @returns Signed JWT token
 */
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { userId }
  return sign(payload, JWT_SECRET, { expiresIn: "30d" })
}

/**
 * Verify and decode a session JWT token
 * @param token - JWT token to verify
 * @returns SessionPayload if valid, null if invalid/expired
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as SessionPayload

    // Validate payload structure
    if (!decoded.userId || typeof decoded.userId !== "string") {
      console.error("[JWT] Invalid token payload: userId missing or invalid")
      return null
    }

    return decoded
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.log("[JWT] Token expired")
    } else if (error instanceof JsonWebTokenError) {
      console.error("[JWT] Invalid token:", (error as Error).message)
    } else {
      console.error("[JWT] Token verification failed:", error)
    }
    return null
  }
}
