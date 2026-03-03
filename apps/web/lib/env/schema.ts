import { z } from "zod"

// Reusable validators
const httpsUrl = z
  .string()
  .url()
  .refine(u => u.startsWith("https://"), "Must use HTTPS")
const supabasePublishableKey = z
  .string()
  .min(1)
  .refine(key => key.startsWith("eyJ") || key.startsWith("sb_publishable_"), "Must be valid Supabase publishable key")
const supabaseSecretKey = z
  .string()
  .min(1)
  .refine(key => key.startsWith("eyJ") || key.startsWith("sb_secret_"), "Must be valid Supabase secret key")

// Server-side Supabase config
export const supabaseServerSchema = z.object({
  SUPABASE_URL: httpsUrl,
  SUPABASE_ANON_KEY: supabasePublishableKey,
  SUPABASE_SERVICE_ROLE_KEY: supabaseSecretKey.optional(),
})

// Client-side Supabase config (browser-safe)
export const supabaseClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpsUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublishableKey,
})

export type SupabaseServerEnv = z.infer<typeof supabaseServerSchema>
export type SupabaseClientEnv = z.infer<typeof supabaseClientSchema>
