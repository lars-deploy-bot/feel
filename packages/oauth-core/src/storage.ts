/**
 * Storage Layer - Supabase Lockbox Adapter
 *
 * Handles encrypted secret storage in lockbox.user_secrets table
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from './config.js';
import { Security } from './security.js';
import type { SecretNamespace, UserSecret } from './types.js';
import type { Database } from './lockbox.types.js';

export class LockboxAdapter {
  private supabase: SupabaseClient<Database>;

  constructor() {
    const config = getConfig();
    // Service key required to write to protected lockbox schema (bypasses RLS)
    this.supabase = createClient<Database>(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'lockbox',
        },
      }
    );
  }

  /**
   * Saves an encrypted secret to the lockbox
   *
   * @param userId - User ID (clerk_id foreign key to iam.users)
   * @param namespace - Type of secret (provider_config or oauth_tokens)
   * @param name - Secret identifier (e.g., "github_client_secret")
   * @param value - Plaintext value to encrypt and store
   */
  async save(
    userId: string,
    namespace: SecretNamespace,
    name: string,
    value: string
  ): Promise<void> {
    const { ciphertext, iv, authTag } = Security.encrypt(value);

    // Mark previous versions as not current (for key rotation)
    await this.supabase
      .from('user_secrets')
      .update({ is_current: false })
      .match({ clerk_id: userId, namespace, name, is_current: true });

    // Insert new version
    const { error } = await this.supabase
      .from('user_secrets')
      .insert({
        clerk_id: userId,
        namespace,
        name,
        ciphertext,
        iv,
        auth_tag: authTag,
        version: 1,
        is_current: true,
      });

    if (error) {
      throw new Error(
        `[Lockbox] Save failed for '${name}': ${error.message} (Code: ${error.code})`
      );
    }
  }

  /**
   * Retrieves and decrypts a secret from the lockbox
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @param name - Secret identifier
   * @returns Decrypted plaintext value, or null if not found
   */
  async get(
    userId: string,
    namespace: SecretNamespace,
    name: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('user_secrets')
      .select('ciphertext, iv, auth_tag')
      .match({ clerk_id: userId, namespace, name, is_current: true })
      .limit(1)
      .single();

    if (error) {
      // Not found is expected for missing secrets
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`[Lockbox] Get failed for '${name}': ${error.message}`);
    }

    if (!data) {
      return null;
    }

    try {
      return Security.decrypt(data.ciphertext, data.iv, data.auth_tag);
    } catch (error) {
      console.error(`[Lockbox] Decryption failed for '${name}':`, error);
      return null;
    }
  }

  /**
   * Deletes all versions of a secret from the lockbox
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @param name - Secret identifier
   */
  async delete(userId: string, namespace: SecretNamespace, name: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_secrets')
      .delete()
      .match({ clerk_id: userId, namespace, name });

    if (error) {
      throw new Error(`[Lockbox] Delete failed for '${name}': ${error.message}`);
    }
  }

  /**
   * Lists all current secrets for a user in a namespace (metadata only)
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @returns Array of secret metadata (no decrypted values)
   */
  async list(userId: string, namespace: SecretNamespace): Promise<UserSecret[]> {
    const { data, error } = await this.supabase
      .from('user_secrets')
      .select('*')
      .match({ clerk_id: userId, namespace, is_current: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`[Lockbox] List failed: ${error.message}`);
    }

    return (data || []) as UserSecret[];
  }

  /**
   * Checks if a secret exists without decrypting it
   *
   * @param userId - User ID
   * @param namespace - Type of secret
   * @param name - Secret identifier
   * @returns true if secret exists
   */
  async exists(
    userId: string,
    namespace: SecretNamespace,
    name: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('user_secrets')
      .select('secret_id')
      .match({ clerk_id: userId, namespace, name, is_current: true })
      .limit(1)
      .single();

    return !error && !!data;
  }
}
