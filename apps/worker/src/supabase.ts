/**
 * Service-role Supabase client for the worker process.
 *
 * Reads credentials from validated env module (same .env.production as web).
 * No cookie-based auth — worker is a background process.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { AppDatabase } from "@webalive/database"
import { env } from "./env"

type AppClient = SupabaseClient<AppDatabase, "app">

let cachedClient: AppClient | null = null

export function createWorkerAppClient(): AppClient {
  if (cachedClient) return cachedClient

  cachedClient = createClient<AppDatabase, "app">(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "app" },
  })
  return cachedClient
}
