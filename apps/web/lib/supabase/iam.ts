/**
 * IAM Schema Client
 * Provides type-safe access to the IAM schema (users, sessions, workspaces)
 *
 * Service-role clients are lazy singletons (cached for process lifetime).
 * Cookie-based clients are created per-request (they bind to request cookies).
 */

// Security: Prevent client-side imports (allow test environment)
const isTestEnv = process.env.NODE_ENV === "test" || "vi" in globalThis
if (typeof window !== "undefined" && !isTestEnv) {
  throw new Error(
    "[SECURITY] lib/supabase/iam cannot be imported in client-side code. " +
      "IAM operations must only run server-side.",
  )
}

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import type { IamDatabase as Database } from "@webalive/database"
import { getSupabaseCredentials, type KeyType } from "@/lib/env/server"

let _serviceIamClient: SupabaseClient<Database> | undefined

/**
 * Get a Supabase client scoped to the IAM schema.
 *
 * Service-role clients (keyType="service") are cached as lazy singletons.
 * Anon/cookie-based clients are created per-request (they bind to request cookies).
 *
 * @param keyType - Use "service" for admin operations, "anon" for RLS-protected queries
 * @throws Error in standalone mode (Supabase not available)
 */
export async function createIamClient(keyType: KeyType = "service") {
  // Standalone mode - no Supabase available
  if (process.env.ALIVE_ENV === "standalone") {
    throw new Error(
      "[Standalone] Supabase is not available in standalone mode. " +
        "Use in-memory alternatives or ensure code paths avoid database calls.",
    )
  }

  // Service-role admin operations must never inherit end-user cookies.
  // Use a direct client so staging/prod admin routes actually run with service_role privileges.
  // Cached as a lazy singleton — same client for the entire process lifetime.
  if (keyType === "service") {
    if (!_serviceIamClient) {
      const { url, key } = getSupabaseCredentials("service")
      _serviceIamClient = createClient<Database>(url, key, {
        db: {
          schema: "iam",
        },
      })
    }
    return _serviceIamClient
  }

  // In test environment, cookies() is not available. Use a plain client (uncached,
  // since tests may use different keyTypes across calls).
  if (isTestEnv) {
    const { url, key } = getSupabaseCredentials(keyType)
    return createClient<Database>(url, key, {
      db: {
        schema: "iam",
      },
    })
  }

  // Cookie-based clients must be created per-request (bound to request cookies).
  // Lazy import cookies to avoid breaking Playwright tests.
  const { url, key } = getSupabaseCredentials(keyType)
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()

  return createServerClient<Database>(url, key, {
    db: {
      schema: "iam", // Force all queries to use the iam schema
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from Server Component
        }
      },
    },
  })
}

/**
 * Type exports for convenience
 */
export type IamDatabase = Database

// Tables
export type IamUser = Database["iam"]["Tables"]["users"]["Row"]
export type IamOrg = Database["iam"]["Tables"]["orgs"]["Row"]
export type IamOrgMembership = Database["iam"]["Tables"]["org_memberships"]["Row"]
export type IamOrgInvite = Database["iam"]["Tables"]["org_invites"]["Row"]
export type IamSession = Database["iam"]["Tables"]["sessions"]["Row"]

// Insert types
export type IamUserInsert = Database["iam"]["Tables"]["users"]["Insert"]
export type IamOrgInsert = Database["iam"]["Tables"]["orgs"]["Insert"]
export type IamOrgMembershipInsert = Database["iam"]["Tables"]["org_memberships"]["Insert"]
export type IamOrgInviteInsert = Database["iam"]["Tables"]["org_invites"]["Insert"]
export type IamSessionInsert = Database["iam"]["Tables"]["sessions"]["Insert"]

// Update types
export type IamUserUpdate = Database["iam"]["Tables"]["users"]["Update"]
export type IamOrgUpdate = Database["iam"]["Tables"]["orgs"]["Update"]
export type IamOrgMembershipUpdate = Database["iam"]["Tables"]["org_memberships"]["Update"]
export type IamOrgInviteUpdate = Database["iam"]["Tables"]["org_invites"]["Update"]
export type IamSessionUpdate = Database["iam"]["Tables"]["sessions"]["Update"]

// Enums
export type IamOrgRole = Database["iam"]["Enums"]["org_role"]
export type IamUserStatus = Database["iam"]["Enums"]["user_status"]
