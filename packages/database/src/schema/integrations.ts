/**
 * Integrations Schema - OAuth and External Service Integrations
 *
 * Tables for managing OAuth providers, access policies, and user tokens.
 */
import { relations } from "drizzle-orm"
import { boolean, index, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Import IAM schema for foreign keys
import { users } from "./iam"

// Define the Integrations schema
export const integrationsSchema = pgSchema("integrations")

// ============================================================================
// TABLES
// ============================================================================

/**
 * Providers - OAuth/integration provider definitions
 */
export const providers = integrationsSchema.table(
  "providers",
  {
    providerId: uuid("provider_id").defaultRandom().primaryKey(),
    providerKey: text("provider_key").notNull().unique(), // 'linear', 'gmail', 'stripe', etc.
    displayName: text("display_name").notNull(),
    logoPath: text("logo_path"),
    defaultScopes: jsonb("default_scopes"), // Default OAuth scopes
    visibilityLevel: text("visibility_level").default("public").notNull(), // 'public', 'beta', 'internal'
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  table => [
    index("providers_provider_key_idx").on(table.providerKey),
    index("providers_is_active_idx").on(table.isActive),
  ],
)

/**
 * Access policies - Controls which users can access which providers
 */
export const accessPolicies = integrationsSchema.table(
  "access_policies",
  {
    policyId: uuid("policy_id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.providerId, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // User granted access
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  table => [
    index("access_policies_provider_id_idx").on(table.providerId),
    index("access_policies_user_id_idx").on(table.userId),
  ],
)

/**
 * User tokens - Encrypted OAuth tokens per user per provider
 * Note: Actual token storage is in lockbox.user_secrets with encryption
 */
export const userTokens = integrationsSchema.table(
  "user_tokens",
  {
    tokenId: uuid("token_id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.providerId, { onDelete: "cascade" }),
    // Token data is stored encrypted in lockbox.user_secrets
    // This table tracks metadata only
    scopes: jsonb("scopes"), // Granted OAuth scopes
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
    isValid: boolean("is_valid").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("user_tokens_user_id_idx").on(table.userId),
    index("user_tokens_provider_id_idx").on(table.providerId),
    index("user_tokens_user_provider_idx").on(table.userId, table.providerId),
    index("user_tokens_is_valid_idx").on(table.isValid),
  ],
)

// ============================================================================
// RELATIONS
// ============================================================================

export const providersRelations = relations(providers, ({ many }) => ({
  accessPolicies: many(accessPolicies),
  userTokens: many(userTokens),
}))

export const accessPoliciesRelations = relations(accessPolicies, ({ one }) => ({
  provider: one(providers, {
    fields: [accessPolicies.providerId],
    references: [providers.providerId],
  }),
}))

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  provider: one(providers, {
    fields: [userTokens.providerId],
    references: [providers.providerId],
  }),
}))
