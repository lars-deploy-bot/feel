/**
 * Tests for StoredOAuthConnection schema versioning and migration.
 *
 * Covers:
 * - v2 round-trip (build → stringify → parse)
 * - v1 → v2 migration (disabled_at/disabled_reason default to null)
 * - Legacy (no version) → v2 migration
 * - Provider mismatch rejection
 */

import { describe, expect, it } from "vitest"
import { buildStoredOAuthConnection, parseStoredOAuthConnection, type StoredOAuthConnection } from "../oauth-connection"

const BASE_OPTIONS = {
  provider: "google",
  credentialProvider: "google",
  email: "user@example.com",
  expiresAt: "2026-12-01T00:00:00.000Z",
  now: Date.now(),
  tokens: {
    access_token: "ya29.test-access",
    refresh_token: "1//test-refresh",
    expires_in: 3600,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    token_type: "Bearer" as const,
  },
}

const PARSE_OPTIONS = {
  provider: "google",
  fallbackCredentialProvider: "google",
}

describe("StoredOAuthConnection schema", () => {
  // ---------------------------------------------------------------
  // V2 ROUND-TRIP
  // ---------------------------------------------------------------

  it("builds v2 connections with disabled_at/disabled_reason as null", () => {
    const result = buildStoredOAuthConnection(BASE_OPTIONS)

    expect(result.version).toBe(2)
    expect(result.disabled_at).toBeNull()
    expect(result.disabled_reason).toBeNull()
    expect(result.access_token).toBe("ya29.test-access")
    expect(result.refresh_token).toBe("1//test-refresh")
    expect(result.provider).toBe("google")
  })

  it("round-trips v2 through JSON (build → stringify → parse)", () => {
    const built = buildStoredOAuthConnection(BASE_OPTIONS)
    const json = JSON.stringify(built)
    const parsed = parseStoredOAuthConnection(JSON.parse(json), PARSE_OPTIONS)

    expect(parsed).toEqual(built)
  })

  it("round-trips v2 with disabled fields set", () => {
    const built = buildStoredOAuthConnection(BASE_OPTIONS)
    const disabled: StoredOAuthConnection = {
      ...built,
      disabled_at: "2026-03-21T12:00:00.000Z",
      disabled_reason: "refresh_failed",
    }

    const json = JSON.stringify(disabled)
    const parsed = parseStoredOAuthConnection(JSON.parse(json), PARSE_OPTIONS)

    expect(parsed.disabled_at).toBe("2026-03-21T12:00:00.000Z")
    expect(parsed.disabled_reason).toBe("refresh_failed")
  })

  // ---------------------------------------------------------------
  // V1 → V2 MIGRATION
  // ---------------------------------------------------------------

  it("upgrades v1 connections to v2 with null disabled fields", () => {
    const v1 = {
      version: 1,
      provider: "google",
      credential_provider: "google",
      tenant_user_id: null,
      redirect_uri: null,
      access_token: "ya29.v1-token",
      refresh_token: "1//v1-refresh",
      expires_at: null,
      scope: "read",
      token_type: "Bearer",
      saved_at: "2026-01-01T00:00:00.000Z",
      cached_email: null,
      provider_metadata: {},
    }

    const parsed = parseStoredOAuthConnection(v1, PARSE_OPTIONS)

    expect(parsed.version).toBe(2)
    expect(parsed.disabled_at).toBeNull()
    expect(parsed.disabled_reason).toBeNull()
    expect(parsed.access_token).toBe("ya29.v1-token")
  })

  // ---------------------------------------------------------------
  // LEGACY → V2 MIGRATION
  // ---------------------------------------------------------------

  it("upgrades legacy (no version) connections to v2", () => {
    const legacy = {
      access_token: "ya29.legacy-token",
      refresh_token: "1//legacy-refresh",
      expires_at: null,
      scope: "read",
      token_type: "Bearer",
    }

    const parsed = parseStoredOAuthConnection(legacy, PARSE_OPTIONS)

    expect(parsed.version).toBe(2)
    expect(parsed.disabled_at).toBeNull()
    expect(parsed.disabled_reason).toBeNull()
    expect(parsed.access_token).toBe("ya29.legacy-token")
    expect(parsed.provider).toBe("google")
    expect(parsed.credential_provider).toBe("google")
  })

  // ---------------------------------------------------------------
  // ERROR CASES
  // ---------------------------------------------------------------

  it("rejects v2 connection with wrong provider", () => {
    const built = buildStoredOAuthConnection(BASE_OPTIONS)
    const json = JSON.parse(JSON.stringify(built))

    expect(() =>
      parseStoredOAuthConnection(json, {
        provider: "linear",
        fallbackCredentialProvider: "linear",
      }),
    ).toThrow("provider mismatch")
  })

  it("rejects v1 connection with wrong provider", () => {
    const v1 = {
      version: 1,
      provider: "google",
      credential_provider: "google",
      tenant_user_id: null,
      redirect_uri: null,
      access_token: "token",
      refresh_token: null,
      expires_at: null,
      scope: null,
      token_type: "Bearer",
      saved_at: "2026-01-01T00:00:00.000Z",
      cached_email: null,
      provider_metadata: {},
    }

    expect(() =>
      parseStoredOAuthConnection(v1, {
        provider: "github",
        fallbackCredentialProvider: "github",
      }),
    ).toThrow("provider mismatch")
  })

  it("throws on completely invalid data", () => {
    expect(() => parseStoredOAuthConnection({ invalid: true }, PARSE_OPTIONS)).toThrow(
      "does not match OAuth connection schema",
    )
  })
})
