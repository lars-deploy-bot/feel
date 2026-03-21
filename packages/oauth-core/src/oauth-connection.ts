import { z } from "zod"
import type { OAuthProviderMetadata, OAuthTokens } from "./types"

const oauthProviderMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const oauthProviderMetadataSchema = z.record(z.string(), oauthProviderMetadataValueSchema)

/** Shared fields between v1 and v2 */
const sharedConnectionFields = {
  provider: z.string().min(1),
  credential_provider: z.string().min(1),
  tenant_user_id: z.string().min(1).nullable(),
  redirect_uri: z.string().min(1).nullable(),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullable(),
  expires_at: z.string().min(1).nullable(),
  scope: z.string().min(1).nullable(),
  token_type: z.string().min(1),
  saved_at: z.string().min(1),
  cached_email: z.string().min(1).nullable(),
  provider_metadata: oauthProviderMetadataSchema,
} as const

const storedOAuthConnectionSchemaV1 = z.object({
  version: z.literal(1),
  ...sharedConnectionFields,
})

const storedOAuthConnectionSchemaV2 = z.object({
  version: z.literal(2),
  ...sharedConnectionFields,
  disabled_at: z.string().min(1).nullable(),
  disabled_reason: z.string().min(1).nullable(),
})

const legacyStoredOAuthConnectionSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).nullable().optional(),
    expires_at: z.string().min(1).nullable().optional(),
    scope: z.string().min(1).nullable().optional(),
    token_type: z.string().min(1).optional(),
    saved_at: z.string().min(1).optional(),
    cached_email: z.string().min(1).nullable().optional(),
  })
  .passthrough()

const legacySavedAt = "1970-01-01T00:00:00.000Z"

/** Always the latest version */
export type StoredOAuthConnection = z.infer<typeof storedOAuthConnectionSchemaV2>

export interface BuildStoredOAuthConnectionOptions {
  provider: string
  credentialProvider: string
  tenantUserId?: string | null
  redirectUri?: string | null
  email?: string | null
  providerMetadata?: OAuthProviderMetadata
  expiresAt: string | null
  now: number
  tokens: OAuthTokens
}

export interface ParseStoredOAuthConnectionOptions {
  provider: string
  fallbackCredentialProvider: string
}

export function buildStoredOAuthConnection(options: BuildStoredOAuthConnectionOptions): StoredOAuthConnection {
  const mergedProviderMetadata = mergeProviderMetadata(options.providerMetadata, options.tokens.provider_metadata)

  return {
    version: 2,
    provider: options.provider,
    credential_provider: options.credentialProvider,
    tenant_user_id: options.tenantUserId ?? null,
    redirect_uri: options.redirectUri ?? null,
    access_token: options.tokens.access_token,
    refresh_token: options.tokens.refresh_token ?? null,
    expires_at: options.expiresAt,
    scope: options.tokens.scope ?? null,
    token_type: options.tokens.token_type ?? "Bearer",
    saved_at: new Date(options.now).toISOString(),
    cached_email: options.email ?? null,
    provider_metadata: mergedProviderMetadata,
    disabled_at: null,
    disabled_reason: null,
  }
}

/** Upgrade a v1 connection to v2 by adding disabled fields */
function upgradeV1ToV2(v1: z.infer<typeof storedOAuthConnectionSchemaV1>): StoredOAuthConnection {
  return { ...v1, version: 2, disabled_at: null, disabled_reason: null }
}

export function parseStoredOAuthConnection(
  value: unknown,
  options: ParseStoredOAuthConnectionOptions,
): StoredOAuthConnection {
  // Try v2 first (latest)
  const v2Result = storedOAuthConnectionSchemaV2.safeParse(value)
  if (v2Result.success) {
    if (v2Result.data.provider !== options.provider) {
      throw new Error(
        `Stored connection provider mismatch: expected '${options.provider}', got '${v2Result.data.provider}'`,
      )
    }
    return v2Result.data
  }

  // Try v1 and upgrade
  const v1Result = storedOAuthConnectionSchemaV1.safeParse(value)
  if (v1Result.success) {
    if (v1Result.data.provider !== options.provider) {
      throw new Error(
        `Stored connection provider mismatch: expected '${options.provider}', got '${v1Result.data.provider}'`,
      )
    }
    return upgradeV1ToV2(v1Result.data)
  }

  // Try legacy (pre-versioned) and upgrade
  const legacyResult = legacyStoredOAuthConnectionSchema.safeParse(value)
  if (legacyResult.success) {
    return {
      version: 2,
      provider: options.provider,
      credential_provider: options.fallbackCredentialProvider,
      tenant_user_id: null,
      redirect_uri: null,
      access_token: legacyResult.data.access_token,
      refresh_token: legacyResult.data.refresh_token ?? null,
      expires_at: legacyResult.data.expires_at ?? null,
      scope: legacyResult.data.scope ?? null,
      token_type: legacyResult.data.token_type ?? "Bearer",
      saved_at: legacyResult.data.saved_at ?? legacySavedAt,
      cached_email: legacyResult.data.cached_email ?? null,
      provider_metadata: {},
      disabled_at: null,
      disabled_reason: null,
    }
  }

  // Use v2 errors for the most helpful diagnostics
  const errors = v2Result.error.issues.map(issue => issue.message)
  throw new Error(`Stored token data does not match OAuth connection schema: ${errors.join("; ")}`)
}

export function mergeProviderMetadata(
  existing: OAuthProviderMetadata | undefined,
  next: OAuthProviderMetadata | undefined,
): OAuthProviderMetadata {
  const merged: OAuthProviderMetadata = {}

  if (existing) {
    for (const [key, value] of Object.entries(existing)) {
      merged[key] = value
    }
  }

  if (next) {
    for (const [key, value] of Object.entries(next)) {
      merged[key] = value
    }
  }

  return merged
}
