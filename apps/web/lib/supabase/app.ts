/**
 * App Schema Client
 * Provides type-safe access to the app schema (errors, feedback, user_profile, etc.)
 *
 * Service-role clients are lazy singletons (cached for process lifetime).
 * Cookie-based clients are created per-request (they bind to request cookies).
 */

// Security: Prevent client-side imports (allow test environment)
const isTestEnv = process.env.NODE_ENV === "test" || "vi" in globalThis
if (typeof window !== "undefined" && !isTestEnv) {
  throw new Error(
    "[SECURITY] lib/supabase/app cannot be imported in client-side code. " +
      "App operations must only run server-side.",
  )
}

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import type { AppDatabase as Database } from "@webalive/database"
import { cookies } from "next/headers"
import { getSupabaseCredentials, type KeyType } from "@/lib/env/server"

let _serviceAppClient: SupabaseClient<Database> | undefined

/**
 * Get a Supabase client scoped to the app schema.
 *
 * Service-role clients (keyType="service") are cached as lazy singletons.
 * Anon/cookie-based clients are created per-request (they bind to request cookies).
 *
 * @param keyType - Use "service" for admin operations, "anon" for RLS-protected queries
 * @throws Error in standalone mode (Supabase not available)
 */
export async function createAppClient(keyType: KeyType = "service") {
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
    if (!_serviceAppClient) {
      const { url, key } = getSupabaseCredentials("service")
      _serviceAppClient = createClient<Database>(url, key, {
        db: {
          schema: "app",
        },
      })
    }
    return _serviceAppClient
  }

  // In test environment, cookies() is not available. Use a plain client (uncached,
  // since tests may use different keyTypes across calls).
  if (isTestEnv) {
    const { url, key } = getSupabaseCredentials(keyType)
    return createClient<Database>(url, key, {
      db: {
        schema: "app",
      },
    })
  }

  // Cookie-based clients must be created per-request (bound to request cookies).
  const { url, key } = getSupabaseCredentials(keyType)
  const cookieStore = await cookies()

  return createServerClient<Database>(url, key, {
    db: {
      schema: "app", // Force all queries to use the app schema
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
export type AppDatabase = Database

// Tables
export type AppConversation = Database["app"]["Tables"]["conversations"]["Row"]
export type AppConversationTab = Database["app"]["Tables"]["conversation_tabs"]["Row"]
export type AppMessage = Database["app"]["Tables"]["messages"]["Row"]
export type AppDomain = Database["app"]["Tables"]["domains"]["Row"]
export type AppError = Database["app"]["Tables"]["errors"]["Row"]
export type AppFeedback = Database["app"]["Tables"]["feedback"]["Row"]
export type AppGatewaySetting = Database["app"]["Tables"]["gateway_settings"]["Row"]
export type AppTemplate = Database["app"]["Tables"]["templates"]["Row"]
export type AppUserOnboarding = Database["app"]["Tables"]["user_onboarding"]["Row"]
export type AppUserProfile = Database["app"]["Tables"]["user_profile"]["Row"]

// Insert types
export type AppConversationInsert = Database["app"]["Tables"]["conversations"]["Insert"]
export type AppConversationTabInsert = Database["app"]["Tables"]["conversation_tabs"]["Insert"]
export type AppMessageInsert = Database["app"]["Tables"]["messages"]["Insert"]
export type AppDomainInsert = Database["app"]["Tables"]["domains"]["Insert"]
export type AppErrorInsert = Database["app"]["Tables"]["errors"]["Insert"]
export type AppFeedbackInsert = Database["app"]["Tables"]["feedback"]["Insert"]
export type AppGatewaySettingInsert = Database["app"]["Tables"]["gateway_settings"]["Insert"]
export type AppTemplateInsert = Database["app"]["Tables"]["templates"]["Insert"]
export type AppUserOnboardingInsert = Database["app"]["Tables"]["user_onboarding"]["Insert"]
export type AppUserProfileInsert = Database["app"]["Tables"]["user_profile"]["Insert"]

// Update types
export type AppConversationUpdate = Database["app"]["Tables"]["conversations"]["Update"]
export type AppConversationTabUpdate = Database["app"]["Tables"]["conversation_tabs"]["Update"]
export type AppMessageUpdate = Database["app"]["Tables"]["messages"]["Update"]
export type AppDomainUpdate = Database["app"]["Tables"]["domains"]["Update"]
export type AppErrorUpdate = Database["app"]["Tables"]["errors"]["Update"]
export type AppFeedbackUpdate = Database["app"]["Tables"]["feedback"]["Update"]
export type AppGatewaySettingUpdate = Database["app"]["Tables"]["gateway_settings"]["Update"]
export type AppUserOnboardingUpdate = Database["app"]["Tables"]["user_onboarding"]["Update"]
export type AppUserProfileUpdate = Database["app"]["Tables"]["user_profile"]["Update"]

// Enums
export type AppSeverityLevel = Database["app"]["Enums"]["severity_level"]
// Values: "info" | "warn" | "error" | "debug" | "fatal"
