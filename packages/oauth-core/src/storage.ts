/**
 * Storage Layer - Supabase Lockbox Adapter
 *
 * Handles encrypted secret storage in lockbox.user_secrets table
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getConfig } from "./config"
import { Security } from "./security"
import type { SecretNamespace, UserSecret } from "./types"
import type { LockboxDatabase as Database } from "@webalive/database"

export interface LockboxAdapterConfig {
  instanceId?: string // Instance identifier for multi-tenant isolation
  defaultTtlSeconds?: number // Default TTL for secrets
}

export class LockboxAdapter {
  private supabase: SupabaseClient<Database, "lockbox", "lockbox">
  private instanceId: string
  private defaultTtlSeconds?: number

  constructor(config?: LockboxAdapterConfig) {
    const appConfig = getConfig()
    // Service key required to write to protected lockbox schema (bypasses RLS)
    this.supabase = createClient<Database, "lockbox">(appConfig.SUPABASE_URL, appConfig.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: "lockbox",
      },
    })

    // Use provided instance ID or default for backwards compatibility
    this.instanceId = config?.instanceId || "default"
    this.defaultTtlSeconds = config?.defaultTtlSeconds
  }

  /**
   * Saves an encrypted secret to the lockbox with instance isolation
   * Uses atomic rotation pattern: INSERT first, then UPDATE to prevent gaps
   *
   * @param userId - User ID (user_id foreign key to iam.users)
   * @param namespace - Type of secret (provider_config or oauth_tokens)
   * @param name - Secret identifier (e.g., "github_client_secret")
   * @param value - Plaintext value to encrypt and store
   */
  async save(userId: string, namespace: SecretNamespace, name: string, value: string): Promise<void> {
    const { ciphertext, iv, authTag } = Security.encrypt(value)

    // Calculate expiry if TTL is configured
    const expiresAt = this.defaultTtlSeconds
      ? new Date(Date.now() + this.defaultTtlSeconds * 1000).toISOString()
      : undefined

    // Get the next version number for this secret
    const { data: versionData, error: versionError } = await this.supabase
      .from("user_secrets")
      .select("version")
      .match({
        user_id: userId,
        instance_id: this.instanceId,
        namespace,
        name,
      })
      .order("version", { ascending: false })
      .limit(1)
      .single()

    // PGRST116 = no rows returned (expected for new secrets)
    // Any other error indicates a real storage problem that should surface
    if (versionError && versionError.code !== "PGRST116") {
      throw new Error(
        `[Lockbox] Failed to read current version for '${name}' (instance: ${this.instanceId}): ${versionError.message}`,
      )
    }

    const nextVersion = versionData ? versionData.version + 1 : 1

    // STEP 1: Insert new version with is_current = true
    // The unique index will prevent race conditions if two inserts happen simultaneously
    const { data: newSecret, error: insertError } = await this.supabase
      .from("user_secrets")
      .insert({
        user_id: userId,
        instance_id: this.instanceId,
        namespace,
        name,
        ciphertext,
        iv,
        auth_tag: authTag,
        version: nextVersion,
        is_current: true,
        expires_at: expiresAt,
        created_by: userId,
        updated_by: userId,
      })
      .select("user_secret_id")
      .single()

    if (insertError) {
      // Check if it's a unique constraint violation (race condition caught!)
      if (insertError.code === "23505") {
        throw new Error(
          `[Lockbox] Concurrent rotation detected for '${name}' (instance: ${this.instanceId}). Please retry.`,
        )
      }
      throw new Error(
        `[Lockbox] Save failed for '${name}' (instance: ${this.instanceId}): ${insertError.message} (Code: ${insertError.code})`,
      )
    }

    // STEP 2: Demote older versions (scoped by instance_id)
    // This happens AFTER insert to ensure we always have at least one current secret
    if (newSecret) {
      const { error: updateError } = await this.supabase
        .from("user_secrets")
        .update({
          is_current: false,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .match({
          user_id: userId,
          instance_id: this.instanceId,
          namespace,
          name,
          is_current: true,
        })
        .neq("user_secret_id", newSecret.user_secret_id)

      if (updateError) {
        console.error(
          `[Lockbox] Warning: Failed to demote old versions for '${name}' (instance: ${this.instanceId}):`,
          updateError,
        )
        // Note: We don't throw here because the new secret was successfully inserted
        // The unique index ensures only one can be current anyway
      }
    }
  }

  /**
   * Retrieves and decrypts a secret from the lockbox with instance isolation
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @param name - Secret identifier
   * @returns Decrypted plaintext value, or null if not found
   */
  async get(userId: string, namespace: SecretNamespace, name: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("user_secrets")
      .select("ciphertext, iv, auth_tag")
      .match({
        user_id: userId,
        instance_id: this.instanceId,
        namespace,
        name,
        is_current: true,
      })
      .limit(1)
      .single()

    if (error) {
      // Not found is expected for missing secrets
      if (error.code === "PGRST116") {
        return null
      }
      throw new Error(`[Lockbox] Get failed for '${name}' (instance: ${this.instanceId}): ${error.message}`)
    }

    if (!data) {
      return null
    }

    try {
      return Security.decrypt(data.ciphertext, data.iv, data.auth_tag)
    } catch (error) {
      console.error(`[Lockbox] Decryption failed for '${name}' (instance: ${this.instanceId}):`, error)
      return null
    }
  }

  /**
   * Deletes all versions of a secret from the lockbox with instance isolation
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @param name - Secret identifier
   */
  async delete(userId: string, namespace: SecretNamespace, name: string): Promise<void> {
    const { error } = await this.supabase.from("user_secrets").delete().match({
      user_id: userId,
      instance_id: this.instanceId,
      namespace,
      name,
    })

    if (error) {
      throw new Error(`[Lockbox] Delete failed for '${name}' (instance: ${this.instanceId}): ${error.message}`)
    }
  }

  /**
   * Lists all current secrets for a user in a namespace (metadata only) with instance isolation
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @returns Array of secret metadata (no decrypted values)
   */
  async list(userId: string, namespace: SecretNamespace): Promise<UserSecret[]> {
    const { data, error } = await this.supabase
      .from("user_secrets")
      .select("*")
      .match({
        user_id: userId,
        instance_id: this.instanceId,
        namespace,
        is_current: true,
      })
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`[Lockbox] List failed (instance: ${this.instanceId}): ${error.message}`)
    }

    return (data || []) as UserSecret[]
  }

  /**
   * Checks if a secret exists without decrypting it with instance isolation
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @param name - Secret identifier
   * @returns true if secret exists
   */
  async exists(userId: string, namespace: SecretNamespace, name: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("user_secrets")
      .select("user_secret_id")
      .match({
        user_id: userId,
        instance_id: this.instanceId,
        namespace,
        name,
        is_current: true,
      })
      .limit(1)
      .single()

    if (error) {
      // PGRST116 = no rows returned, which means secret doesn't exist
      if (error.code === "PGRST116") {
        return false
      }
      // Real errors should be thrown, not hidden
      throw new Error(`[Lockbox] Exists check failed for '${name}' (instance: ${this.instanceId}): ${error.message}`)
    }

    return !!data
  }
}
