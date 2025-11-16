import { cookies } from "next/headers"
import { createIamClient } from "@/lib/supabase/iam"
import { verifySessionToken } from "./jwt"

export interface SessionUser {
  id: string
  email: string
  name: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  if (!sessionCookie?.value) {
    return null
  }

  // Test mode
  if (process.env.BRIDGE_ENV === "local" && sessionCookie.value === "test-user") {
    return {
      id: "test-user",
      email: "test@bridge.local",
      name: "Test User",
    }
  }

  // Verify JWT and extract userId
  const payload = verifySessionToken(sessionCookie.value)
  if (!payload?.userId) {
    console.warn("[Auth] Invalid JWT token")
    return null
  }

  // Query user from iam.users
  const iam = await createIamClient("service")
  const { data: user } = await iam
    .from("users")
    .select("user_id, email, display_name")
    .eq("user_id", payload.userId)
    .single()

  if (!user) {
    console.warn("[Auth] User not found in IAM:", payload.userId)
    return null
  }

  return {
    id: user.user_id,
    email: user.email || "",
    name: user.display_name,
  }
}

/**
 * Check if a workspace (domain) is authenticated in the current session
 * Queries user's org memberships and their associated domains
 */
export async function isWorkspaceAuthenticated(workspace: string): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) {
    return false
  }

  // Test mode allows all workspaces
  if (process.env.BRIDGE_ENV === "local" && user.id === "test-user") {
    return true
  }

  // Get user's org memberships
  const iam = await createIamClient("service")
  const { data: memberships } = await iam.from("org_memberships").select("org_id").eq("user_id", user.id)

  if (!memberships || memberships.length === 0) {
    return false
  }

  const orgIds = memberships.map(m => m.org_id)

  // Check if any of user's orgs has this domain
  const { createAppClient } = await import("@/lib/supabase/app")
  const app = await createAppClient("service")
  const { data: domain } = await app
    .from("domains")
    .select("domain_id")
    .eq("hostname", workspace)
    .in("org_id", orgIds)
    .single()

  return !!domain
}

/**
 * Get list of authenticated workspaces (domains) from session
 * Returns all domains from user's organizations
 */
export async function getAuthenticatedWorkspaces(): Promise<string[]> {
  const user = await getSessionUser()
  if (!user) {
    return []
  }

  // Get user's org memberships
  const iam = await createIamClient("service")
  const { data: memberships } = await iam.from("org_memberships").select("org_id").eq("user_id", user.id)

  if (!memberships || memberships.length === 0) {
    return []
  }

  const orgIds = memberships.map(m => m.org_id)

  // Get all domains for these orgs
  const { createAppClient } = await import("@/lib/supabase/app")
  const app = await createAppClient("service")
  const { data: domains } = await app.from("domains").select("hostname").in("org_id", orgIds)

  return domains?.map(d => d.hostname) || []
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
 * Uses separate manager_session cookie
 */
export async function isManagerAuthenticated(): Promise<boolean> {
  const { cookies } = await import("next/headers")
  const jar = await cookies()
  const managerCookie = jar.get("manager_session")

  return !!managerCookie && managerCookie.value === "1"
}

/**
 * Get JWT session cookie for passing to child processes
 *
 * @param logPrefix - Optional prefix for logs (e.g., "[Claude Stream xyz]")
 * @returns JWT session cookie value or undefined if not authenticated
 *
 * @example
 * const sessionCookie = await getSafeSessionCookie("[MyRoute abc123]")
 * runAgentChild(cwd, { sessionCookie, ...otherOptions })
 */
export async function getSafeSessionCookie(logPrefix = "[Auth]"): Promise<string | undefined> {
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  if (!sessionCookie?.value) {
    return undefined
  }

  // Test mode special value
  if (process.env.BRIDGE_ENV === "local" && sessionCookie.value === "test-user") {
    return sessionCookie.value
  }

  // Verify JWT format and validity
  const payload = verifySessionToken(sessionCookie.value)
  if (!payload) {
    console.warn(`${logPrefix} Invalid JWT session token`)
    return undefined
  }

  return sessionCookie.value
}
