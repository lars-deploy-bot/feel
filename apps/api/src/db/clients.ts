import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import type { AppDatabase, IamDatabase } from "@webalive/database"
import { env } from "../config/env"

export const iam: SupabaseClient<IamDatabase> = createClient<IamDatabase>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: "iam" },
    auth: { persistSession: false },
  },
)

export const app: SupabaseClient<AppDatabase> = createClient<AppDatabase>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: "app" },
    auth: { persistSession: false },
  },
)
