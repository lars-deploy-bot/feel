/**
 * App Schema Client
 * Provides type-safe access to the app schema (errors, feedback, user_profile, etc.)
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
import { cookies } from "next/headers"
import { getSupabaseCredentials, type KeyType } from "@/lib/env/server"
import type { Database } from "./app.types"

/**
 * Create a Supabase client scoped to the app schema
 * @param keyType - Use "service" for admin operations, "anon" for RLS-protected queries
 */
export async function createAppClient(keyType: KeyType = "service") {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseCredentials(keyType)

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
export type AppDomain = Database["app"]["Tables"]["domains"]["Row"]
export type AppError = Database["app"]["Tables"]["errors"]["Row"]
export type AppFeedback = Database["app"]["Tables"]["feedback"]["Row"]
export type AppGatewaySetting = Database["app"]["Tables"]["gateway_settings"]["Row"]
export type AppUserOnboarding = Database["app"]["Tables"]["user_onboarding"]["Row"]
export type AppUserProfile = Database["app"]["Tables"]["user_profile"]["Row"]

// Insert types
export type AppDomainInsert = Database["app"]["Tables"]["domains"]["Insert"]
export type AppErrorInsert = Database["app"]["Tables"]["errors"]["Insert"]
export type AppFeedbackInsert = Database["app"]["Tables"]["feedback"]["Insert"]
export type AppGatewaySettingInsert = Database["app"]["Tables"]["gateway_settings"]["Insert"]
export type AppUserOnboardingInsert = Database["app"]["Tables"]["user_onboarding"]["Insert"]
export type AppUserProfileInsert = Database["app"]["Tables"]["user_profile"]["Insert"]

// Update types
export type AppDomainUpdate = Database["app"]["Tables"]["domains"]["Update"]
export type AppErrorUpdate = Database["app"]["Tables"]["errors"]["Update"]
export type AppFeedbackUpdate = Database["app"]["Tables"]["feedback"]["Update"]
export type AppGatewaySettingUpdate = Database["app"]["Tables"]["gateway_settings"]["Update"]
export type AppUserOnboardingUpdate = Database["app"]["Tables"]["user_onboarding"]["Update"]
export type AppUserProfileUpdate = Database["app"]["Tables"]["user_profile"]["Update"]

// Enums
export type AppSeverityLevel = Database["app"]["Enums"]["severity_level"]
// Values: "info" | "warn" | "error" | "debug" | "fatal"
