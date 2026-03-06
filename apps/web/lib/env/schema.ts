import { z } from "zod"
import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "@webalive/env"

// Server-side Supabase config
export const supabaseServerSchema = z.object({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabasePublishableKey,
  SUPABASE_SERVICE_ROLE_KEY: supabaseSecretKey.optional(),
})

// Client-side Supabase config (browser-safe)
export const supabaseClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublishableKey,
})

export type SupabaseServerEnv = z.infer<typeof supabaseServerSchema>
export type SupabaseClientEnv = z.infer<typeof supabaseClientSchema>
