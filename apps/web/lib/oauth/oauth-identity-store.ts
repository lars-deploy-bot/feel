/**
 * OAuth Identity Store — External account conflict detection
 *
 * Tracks which provider accounts (e.g. Google user ID) map to which internal users.
 * Detects conflicts when the same external account is connected by two different users.
 *
 * Uses Supabase RPC (upsert_oauth_identity) in public schema.
 * Pattern: LockboxAdapter (packages/oauth-core/src/storage.ts)
 */

import { createServicePublicClient } from "@/lib/supabase/service"

/** Result from upserting an external identity */
export interface UpsertIdentityResult {
  success: boolean
  conflict: boolean
  existingUserId?: string
}

export class OAuthIdentityStore {
  /**
   * Upsert an external identity mapping.
   *
   * - If the provider account is new → inserts
   * - If it belongs to the same user → updates last_connected_at
   * - If it belongs to a DIFFERENT user → returns conflict
   */
  static async upsert(
    userId: string,
    provider: string,
    providerUserId: string,
    providerEmail?: string,
  ): Promise<UpsertIdentityResult> {
    const supabase = createServicePublicClient()
    const { data, error } = await supabase.rpc("upsert_oauth_identity", {
      p_user_id: userId,
      p_provider: provider,
      p_provider_user_id: providerUserId,
      p_provider_email: providerEmail,
    })

    if (error) {
      throw new Error(`[OAuthIdentityStore] Failed to upsert identity: ${error.message}`)
    }

    const row = data?.[0]
    if (!row) {
      throw new Error("[OAuthIdentityStore] Unexpected empty response from upsert_oauth_identity")
    }

    return {
      success: row.success,
      conflict: row.conflict,
      existingUserId: row.existing_user_id ?? undefined,
    }
  }
}
