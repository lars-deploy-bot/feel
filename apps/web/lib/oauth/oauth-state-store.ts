/**
 * OAuth State Store — Server-side CSRF state lifecycle
 *
 * Replaces cookie-only state with DB-backed state records.
 * Uses Supabase RPCs (create_oauth_state, consume_oauth_state) in public schema.
 *
 * Pattern: LockboxAdapter (packages/oauth-core/src/storage.ts)
 */

import crypto from "node:crypto"
import { createServicePublicClient } from "@/lib/supabase/service"

const STATE_TOKEN_BYTES = 32
/** OAuth state TTL in seconds (10 minutes). Used for both DB records and cookie maxAge. */
export const STATE_TTL_SECONDS = 600

/** Result from consuming an OAuth state token (discriminated union) */
export type ConsumeStateResult =
  | { valid: true; userId: string; provider: string }
  | { valid: false; userId?: string; provider?: string; failureReason: string }

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export class OAuthStateStore {
  /**
   * Create a new OAuth state record and return the raw token.
   * The DB stores only the SHA-256 hash (the raw token travels in the cookie/URL).
   */
  static async createState(provider: string, userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(STATE_TOKEN_BYTES).toString("hex")
    const stateHash = sha256(rawToken)
    const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString()

    const supabase = createServicePublicClient()
    const { error } = await supabase.rpc("create_oauth_state", {
      p_state_hash: stateHash,
      p_provider: provider,
      p_user_id: userId,
      p_expires_at: expiresAt,
    })

    if (error) {
      throw new Error(`[OAuthStateStore] Failed to create state: ${error.message}`)
    }

    return rawToken
  }

  /**
   * Consume a state token — validates and marks as consumed atomically.
   * Returns typed result with failure reason for observability.
   */
  static async consumeState(rawState: string): Promise<ConsumeStateResult> {
    const stateHash = sha256(rawState)

    const supabase = createServicePublicClient()
    const { data, error } = await supabase.rpc("consume_oauth_state", {
      p_state_hash: stateHash,
    })

    if (error) {
      throw new Error(`[OAuthStateStore] Failed to consume state: ${error.message}`)
    }

    const row = data?.[0]
    if (!row) {
      return { valid: false, failureReason: "state_not_found" }
    }

    if (!row.valid) {
      return {
        valid: false,
        userId: row.user_id ?? undefined,
        provider: row.provider ?? undefined,
        failureReason: row.failure_reason ?? "unknown",
      }
    }

    // Valid state must have userId and provider — the DB guarantees this
    if (!row.user_id || !row.provider) {
      return { valid: false, failureReason: "state_corrupt" }
    }

    return {
      valid: true,
      userId: row.user_id,
      provider: row.provider,
    }
  }
}
