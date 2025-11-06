import { cookies } from "next/headers"
import { hasSessionCookie, hasValidUser } from "@/features/auth/types/guards"
import { verifySessionToken } from "./jwt"

export interface SessionUser {
  id: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  if (!sessionCookie || !hasSessionCookie(sessionCookie)) {
    return null
  }

  // Session value is either a legacy "1" or JSON array of authenticated workspaces
  const sessionValue = sessionCookie.value

  // Simple implementation: use session value as user ID
  const user = {
    id: sessionValue || "anonymous",
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

  // Legacy session format "1" is invalid - requires re-authentication
  if (sessionValue === "1") {
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
  if (sessionValue === "1" || sessionValue === "test-user") {
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
