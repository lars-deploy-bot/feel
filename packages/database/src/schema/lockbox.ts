/**
 * Lockbox Schema - Encrypted Secrets Storage
 *
 * Secure storage for API keys, OAuth tokens, and other sensitive data.
 * All secrets are encrypted with AES-256-GCM using the LOCKBOX_MASTER_KEY.
 */
import { relations } from "drizzle-orm"
import { boolean, index, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Define the Lockbox schema
export const lockboxSchema = pgSchema("lockbox")

// ============================================================================
// TABLES
// ============================================================================

/**
 * User secrets - Encrypted secrets per user
 * Used for OAuth tokens, API keys, and other sensitive data
 */
export const userSecrets = lockboxSchema.table(
  "user_secrets",
  {
    userSecretId: uuid("user_secret_id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    instanceId: uuid("instance_id").defaultRandom().notNull(), // For multi-instance deployments
    namespace: text("namespace").default("default").notNull(), // Grouping (e.g., 'oauth', 'apikey')
    name: text("name").notNull(), // Secret identifier (e.g., 'linear_access_token')

    // Encrypted data (AES-256-GCM)
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(), // Initialization vector
    authTag: text("auth_tag").notNull(), // Authentication tag

    // Metadata
    scope: jsonb("scope").default({}).notNull(), // Access scope/permissions
    version: integer("version").default(1).notNull(), // For versioning secrets
    isCurrent: boolean("is_current").default(true).notNull(), // Latest version flag
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete

    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("user_secrets_user_id_idx").on(table.userId),
    index("user_secrets_namespace_idx").on(table.namespace),
    index("user_secrets_name_idx").on(table.name),
    index("user_secrets_user_namespace_name_idx").on(table.userId, table.namespace, table.name),
    index("user_secrets_is_current_idx").on(table.isCurrent),
  ],
)

/**
 * Secret keys - API keys for programmatic access
 * Used for bearer token authentication to Claude Bridge API
 */
export const secretKeys = lockboxSchema.table(
  "secret_keys",
  {
    secretId: uuid("secret_id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    instanceId: uuid("instance_id").defaultRandom().notNull(),
    keyId: text("key_id").notNull().unique(), // Public key identifier (sk_live_xxx)
    name: text("name").notNull(), // User-friendly name
    secretHash: text("secret_hash").notNull(), // bcrypt hash of the secret

    // Permissions
    scopes: jsonb("scopes").default([]).notNull(), // API scopes
    environment: text("environment").default("production").notNull(), // 'development', 'production'

    // Rate limiting
    rateLimitPm: integer("rate_limit_pm"), // Requests per minute

    // State
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("secret_keys_user_id_idx").on(table.userId),
    index("secret_keys_key_id_idx").on(table.keyId),
    index("secret_keys_secret_hash_idx").on(table.secretHash),
  ],
)

// ============================================================================
// RELATIONS
// ============================================================================

// Note: Lockbox tables intentionally don't have foreign key relations to IAM tables
// to maintain schema isolation. User IDs are stored as text and validated at application level.
