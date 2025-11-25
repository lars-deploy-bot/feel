import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseCredentials } from "@/lib/env/client"
import type { PublicDatabase as Database } from "@webalive/database"

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (browserClient) return browserClient

  const { url, key } = getSupabaseCredentials()

  browserClient = createBrowserClient<Database>(url, key)

  return browserClient
}
