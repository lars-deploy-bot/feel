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
  workspaces: string[]
  iat?: number
  exp?: number
}

/**
 * Create a signed JWT token for authenticated workspaces
 * Token expires in 30 days
 * @param workspaces - Array of workspace names user is authenticated for
 * @returns Signed JWT token
 */
export function createSessionToken(workspaces: string[]): string {
  const payload: SessionPayload = { workspaces }
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
    if (!decoded.workspaces || !Array.isArray(decoded.workspaces)) {
      console.error("[JWT] Invalid token payload: workspaces missing or not an array")
      return null
    }

    return decoded
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.log("[JWT] Token expired")
    } else if (error instanceof JsonWebTokenError) {
      console.error("[JWT] Invalid token:", error.message)
    } else {
      console.error("[JWT] Token verification failed:", error)
    }
    return null
  }
}

/**
 * Add workspace to existing token (creates new token with updated list)
 * @param existingToken - Current JWT token
 * @param newWorkspace - Workspace to add
 * @returns New JWT token with updated workspaces, or new token if existing invalid
 */
export function addWorkspaceToToken(existingToken: string, newWorkspace: string): string {
  const payload = verifySessionToken(existingToken)

  if (!payload) {
    // Invalid/expired token - create new one
    return createSessionToken([newWorkspace])
  }

  // Add workspace if not already present
  if (!payload.workspaces.includes(newWorkspace)) {
    payload.workspaces.push(newWorkspace)
  }

  return createSessionToken(payload.workspaces)
}
