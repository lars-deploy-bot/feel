import { cookies } from "next/headers"
import { hasSessionCookie, hasValidUser } from "@/features/auth/types/guards"
import { verifySessionToken } from "./jwt"

export interface SessionUser {
  id: string
  workspaces: string[]
}

// Legacy session format that should be rejected
const LEGACY_SESSION_VALUE = "1"

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  if (!sessionCookie || !hasSessionCookie(sessionCookie)) {
    return null
  }

  const sessionValue = sessionCookie.value

  // Test mode
  if (process.env.BRIDGE_ENV === "local" && sessionValue === "test-user") {
    return {
      id: "test-user",
      workspaces: ["test"],
    }
  }

  // Legacy session format is invalid - requires re-authentication
  if (sessionValue === LEGACY_SESSION_VALUE) {
    return null
  }

  // Verify JWT token and extract workspaces
  const payload = verifySessionToken(sessionValue)
  if (!payload) {
    return null // Invalid/expired/tampered token
  }

  const user = {
    id: sessionValue,
    workspaces: payload.workspaces,
  }

  return hasValidUser(user) ? user : null
}

/**
 * Check if a workspace is authenticated in the current session
 * Uses JWT verification to prevent token tampering
 */
export async function isWorkspaceAuthenticated(workspace: string): Promise<boolean> {
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  if (!sessionCookie || !hasSessionCookie(sessionCookie)) {
    return false
  }

  const sessionValue = sessionCookie.value

  // Test mode allows all workspaces
  if (process.env.BRIDGE_ENV === "local" && sessionValue === "test-user") {
    return true
  }

  // Legacy session format is invalid - requires re-authentication
  if (sessionValue === LEGACY_SESSION_VALUE) {
    return false
  }

  // Verify JWT token and extract workspaces
  const payload = verifySessionToken(sessionValue)
  if (!payload) {
    return false // Invalid/expired/tampered token
  }

  return payload.workspaces.includes(workspace)
}

/**
 * Get list of authenticated workspaces from session
 * Verifies JWT signature before returning workspaces
 */
export async function getAuthenticatedWorkspaces(): Promise<string[]> {
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  if (!sessionCookie || !hasSessionCookie(sessionCookie)) {
    return []
  }

  const sessionValue = sessionCookie.value

  // Legacy session format - return empty (requires re-login to upgrade)
  if (sessionValue === LEGACY_SESSION_VALUE || sessionValue === "test-user") {
    return []
  }

  // Verify JWT and extract workspaces
  const payload = verifySessionToken(sessionValue)
  return payload ? payload.workspaces : []
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error("Authentication required")
  }
  return user
}

/**
 * Check if the manager workspace is authenticated
 * Special workspace for system administration
 * Uses separate manager_session cookie instead of workspace JWT
 */
export async function isManagerAuthenticated(): Promise<boolean> {
  const jar = await cookies()
  const managerCookie = jar.get("manager_session")

  // Manager uses a separate session cookie, not the workspace JWT
  return !!managerCookie && managerCookie.value === "1"
}

/**
 * Get session cookie value safe for passing to child processes
 * Validates JWT format to prevent "jwt malformed" errors in MCP tools
 *
 * @param logPrefix - Optional prefix for warning logs (e.g., "[Claude Stream xyz]")
 * @returns Valid JWT cookie value or undefined if invalid/legacy/malformed
 *
 * @example
 * const sessionCookie = await getSafeSessionCookie("[MyRoute abc123]")
 * runAgentChild(cwd, { sessionCookie, ...otherOptions })
 */
export async function getSafeSessionCookie(logPrefix = "[Auth]"): Promise<string | undefined> {
  const jar = await cookies()
  const rawCookie = jar.get("session")?.value

  // No cookie present
  if (!rawCookie) {
    return undefined
  }

  // Legacy session format (pre-JWT)
  if (rawCookie === LEGACY_SESSION_VALUE) {
    console.warn(`${logPrefix} Skipping legacy session cookie format (value="${LEGACY_SESSION_VALUE}")`)
    return undefined
  }

  // Test mode special value
  if (process.env.BRIDGE_ENV === "local" && rawCookie === "test-user") {
    return rawCookie
  }

  // Validate JWT format (must contain dots: header.payload.signature)
  if (!rawCookie.includes(".")) {
    console.warn(
      `${logPrefix} Skipping malformed session cookie (not JWT format, first 20 chars: "${rawCookie.substring(0, 20)}")`,
    )
    return undefined
  }

  // Verify JWT signature and expiration
  const payload = verifySessionToken(rawCookie)
  if (!payload) {
    // verifySessionToken already logs specific error (expired/invalid/tampered)
    // Log context about where this validation failed
    console.warn(`${logPrefix} JWT validation failed, see [JWT] logs above for details`)
    return undefined
  }

  return rawCookie
}
