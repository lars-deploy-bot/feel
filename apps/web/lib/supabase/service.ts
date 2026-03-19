/**
 * Service-Role Supabase Clients (No Cookies)
 *
 * For background tasks (cron, automations, internal APIs) that run outside
 * a request context and don't have access to cookies.
 *
 * These use the service role key — bypasses RLS. Use only in trusted server code.
 *
 * Clients are lazy singletons: created on first call, cached for the process lifetime.
 * This avoids creating a new Supabase client on every function invocation.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "[SECURITY] lib/supabase/service cannot be imported in client-side code. " +
      "Service-role clients must only run server-side.",
  )
}

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import type { AppDatabase, IamDatabase, PublicDatabase } from "@webalive/database"
import { getSupabaseCredentials } from "@/lib/env/server"

let _serviceAppClient: SupabaseClient<AppDatabase, "app"> | undefined
let _serviceIamClient: SupabaseClient<IamDatabase, "iam"> | undefined
let _servicePublicClient: SupabaseClient<PublicDatabase, "public"> | undefined

/**
 * Get the service-role Supabase client for the app schema.
 * No cookies, no RLS — for background tasks only.
 * Lazy singleton: created on first call, reused thereafter.
 */
export function createServiceAppClient(): SupabaseClient<AppDatabase, "app"> {
  if (!_serviceAppClient) {
    const { url, key } = getSupabaseCredentials("service")
    _serviceAppClient = createClient<AppDatabase, "app">(url, key, {
      db: { schema: "app" },
    })
  }
  return _serviceAppClient
}

/**
 * Get the service-role Supabase client for the iam schema.
 * No cookies, no RLS — for background tasks only.
 * Lazy singleton: created on first call, reused thereafter.
 */
export function createServiceIamClient(): SupabaseClient<IamDatabase, "iam"> {
  if (!_serviceIamClient) {
    const { url, key } = getSupabaseCredentials("service")
    _serviceIamClient = createClient<IamDatabase, "iam">(url, key, {
      db: { schema: "iam" },
    })
  }
  return _serviceIamClient
}

/**
 * Get the service-role Supabase client for the public schema.
 * Used by OAuth stores (state lifecycle, identity conflict detection).
 * No cookies, no RLS — for background tasks only.
 * Lazy singleton: created on first call, reused thereafter.
 */
export function createServicePublicClient(): SupabaseClient<PublicDatabase, "public"> {
  if (!_servicePublicClient) {
    const { url, key } = getSupabaseCredentials("service")
    _servicePublicClient = createClient<PublicDatabase, "public">(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "public" },
    })
  }
  return _servicePublicClient
}
