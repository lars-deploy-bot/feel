import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import type { AppDatabase, IamDatabase } from "@webalive/database"
import { env } from "../config/env"

interface IamPasswordResetRpcSchema {
  Tables: Record<string, never>
  Views: Record<string, never>
  Functions: {
    issue_password_reset_token: {
      Args: {
        p_user_id: string
        p_token_hash: string
        p_expires_at: string
      }
      Returns: null
    }
    consume_password_reset_token: {
      Args: {
        p_token_hash: string
        p_new_password_hash: string
      }
      Returns: string | null
    }
  }
  Enums: Record<string, never>
  CompositeTypes: Record<string, never>
}

interface IamPasswordResetRpcDatabase {
  __InternalSupabase: {
    PostgrestVersion: string
  }
  iam: IamPasswordResetRpcSchema
}

export const iam: SupabaseClient<IamDatabase> = createClient<IamDatabase>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: "iam" },
    auth: { persistSession: false },
  },
)

export const iamPasswordResetRpc: SupabaseClient<IamPasswordResetRpcDatabase> =
  createClient<IamPasswordResetRpcDatabase>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "iam" },
    auth: { persistSession: false },
  })

export const app: SupabaseClient<AppDatabase> = createClient<AppDatabase>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: "app" },
    auth: { persistSession: false },
  },
)
