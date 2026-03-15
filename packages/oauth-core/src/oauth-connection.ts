import { z } from "zod"
import type { OAuthProviderMetadata, OAuthTokens } from "./types"

const oauthProviderMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const oauthProviderMetadataSchema = z.record(z.string(), oauthProviderMetadataValueSchema)

const storedOAuthConnectionSchema = z.object({
  version: z.literal(1),
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

export type StoredOAuthConnection = z.infer<typeof storedOAuthConnectionSchema>

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
    version: 1,
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
  }
}

export function parseStoredOAuthConnection(
  value: unknown,
  options: ParseStoredOAuthConnectionOptions,
): StoredOAuthConnection {
  const storedResult = storedOAuthConnectionSchema.safeParse(value)
  if (storedResult.success) {
    if (storedResult.data.provider !== options.provider) {
      throw new Error(
        `Stored connection provider mismatch: expected '${options.provider}', got '${storedResult.data.provider}'`,
      )
    }
    return storedResult.data
  }

  const legacyResult = legacyStoredOAuthConnectionSchema.safeParse(value)
  if (legacyResult.success) {
    return {
      version: 1,
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
    }
  }

  const errors = storedResult.error.issues.map(issue => issue.message)
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
