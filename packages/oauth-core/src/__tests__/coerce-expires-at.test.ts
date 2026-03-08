/**
 * Tests for OAuthManager.coerceExpiresAt() — the expiry buffer calculation.
 *
 * coerceExpiresAt is private static, so we test it indirectly through saveTokens()
 * by inspecting the stored expires_at value.
 *
 * The formula:
 *   value = now + max(0, floor(expiresInSeconds)) * 1000 - TOKEN_EXPIRY_BUFFER_MS
 *   result = max(value, now + 30_000)
 *
 * Where TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000 = 300_000ms (5 minutes)
 *
 * This means:
 *   - A 1-hour token (3600s) → should-refresh-at = now + 55 minutes
 *   - A 5-minute token (300s) → 300s - 300s = 0s → floored to 30s
 *   - A 0-second token → treated as no expiry (0 is falsy)
 *   - Negative expires_in → floored to 30s
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NoopAuditLogger, oauthAudit } from "../audit"

const createClientMock = vi.hoisted(() => vi.fn())
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

import { OAuthManager } from "../index"
import { InMemoryRefreshLockManager } from "../refresh-lock"
import { Security } from "../security"
import { OAUTH_TOKENS_NAMESPACE } from "../types"

const BUFFER_MS = 5 * 60 * 1000 // 5 minutes
const FLOOR_MS = 30_000 // 30 seconds

describe("coerceExpiresAt (via saveTokens)", () => {
  let rpcMock: ReturnType<typeof vi.fn>
  let manager: OAuthManager

  beforeEach(() => {
    vi.clearAllMocks()
    oauthAudit.setLogger(new NoopAuditLogger())

    rpcMock = vi.fn().mockResolvedValue({ data: "saved", error: null })
    createClientMock.mockReturnValue({ rpc: rpcMock })

    manager = new OAuthManager({
      provider: "google",
      instanceId: "google:test",
      namespace: OAUTH_TOKENS_NAMESPACE,
      environment: "test",
      lockManager: new InMemoryRefreshLockManager(false),
    })
  })

  /** Extract the expires_at from the encrypted blob that was saved */
  function extractSavedExpiresAt(): Date | null {
    const saveCall = rpcMock.mock.calls[0]
    if (!saveCall) throw new Error("No RPC call recorded")

    const params = saveCall[1]
    // Decrypt the saved blob to inspect expires_at
    const decrypted = Security.decrypt(params.p_ciphertext, params.p_iv, params.p_auth_tag)
    const parsed = JSON.parse(decrypted)

    return parsed.expires_at ? new Date(parsed.expires_at) : null
  }

  it("stores null expires_at when token has no expires_in", async () => {
    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      // no expires_in
    })

    const expiresAt = extractSavedExpiresAt()
    expect(expiresAt).toBeNull()
  })

  it("1-hour token: should-refresh-at is ~55 minutes from now", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 3600, // 1 hour
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()
    expect(expiresAt).not.toBeNull()

    const expectedMin = before + 3600 * 1000 - BUFFER_MS
    const expectedMax = after + 3600 * 1000 - BUFFER_MS

    const expiresAtMs = expiresAt!.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin)
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMax)

    // Should be roughly 55 minutes from now (3300 seconds)
    const diffSeconds = (expiresAtMs - before) / 1000
    expect(diffSeconds).toBeGreaterThan(3290) // ~54.8 min
    expect(diffSeconds).toBeLessThan(3310) // ~55.2 min
  })

  it("5-minute token: buffer cancels out entirely, floored to 30s", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 300, // 5 minutes = exact buffer
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()!

    // 300s * 1000 - 300_000 = 0ms from now → floored to now + 30s
    const expiresAtMs = expiresAt.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + FLOOR_MS)
    expect(expiresAtMs).toBeLessThanOrEqual(after + FLOOR_MS + 10) // small tolerance
  })

  it("0-second token: treated as no expiry (0 is falsy in JS)", async () => {
    // expires_in: 0 is falsy, so `tokens.expires_in ? ... : null` evaluates to null
    // This is correct behavior — a 0-second token has no valid lifetime
    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 0,
    })

    const expiresAt = extractSavedExpiresAt()
    expect(expiresAt).toBeNull()
  })

  it("negative expires_in: treated as 0, floored to 30s", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: -500,
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()!

    // Math.max(0, floor(-500)) = 0 → 0ms - 300_000ms = negative → floored to 30s
    const expiresAtMs = expiresAt.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + FLOOR_MS)
    expect(expiresAtMs).toBeLessThanOrEqual(after + FLOOR_MS + 10)
  })

  it("301-second token: 1 second past buffer, still floored to 30s", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 301, // 301s * 1000 - 300_000ms = 1000ms → floored to 30s
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()!

    // 1000ms from now < 30_000ms → floored to 30s
    const expiresAtMs = expiresAt.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + FLOOR_MS)
    expect(expiresAtMs).toBeLessThanOrEqual(after + FLOOR_MS + 10)
  })

  it("330-second token: exactly at floor (330s - 300s = 30s)", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 330, // 330s * 1000 - 300_000ms = 30_000ms = exactly 30s
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()!

    const expiresAtMs = expiresAt.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + FLOOR_MS)
    expect(expiresAtMs).toBeLessThanOrEqual(after + FLOOR_MS + 10)
  })

  it("600-second token (10 min): 5 minutes from now (past the floor)", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 600, // 600s * 1000 - 300_000ms = 300_000ms = 5 minutes
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()!

    const expectedMs = 600 * 1000 - BUFFER_MS // 300_000ms = 5 min
    const expiresAtMs = expiresAt.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + expectedMs)
    expect(expiresAtMs).toBeLessThanOrEqual(after + expectedMs + 10)
  })

  it("fractional expires_in is floored (3600.7 treated as 3600)", async () => {
    const before = Date.now()

    await manager.saveTokens("user-1", "google", {
      access_token: "token",
      expires_in: 3600.7,
    })

    const after = Date.now()
    const expiresAt = extractSavedExpiresAt()!

    // floor(3600.7) = 3600 → 3600 * 1000 - 300_000 = 3_300_000ms
    const expectedMs = 3600 * 1000 - BUFFER_MS
    const expiresAtMs = expiresAt.getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + expectedMs)
    expect(expiresAtMs).toBeLessThanOrEqual(after + expectedMs + 10)
  })

  // ---------------------------------------------------------------
  // Token blob shape verification
  // ---------------------------------------------------------------

  it("saves complete token blob with all expected fields", async () => {
    await manager.saveTokens(
      "user-1",
      "google",
      {
        access_token: "my-token",
        refresh_token: "my-refresh",
        expires_in: 3600,
        scope: "email profile",
        token_type: "Bearer",
      },
      "user@example.com",
    )

    const saveCall = rpcMock.mock.calls[0]
    const params = saveCall[1]
    const decrypted = JSON.parse(Security.decrypt(params.p_ciphertext, params.p_iv, params.p_auth_tag))

    expect(decrypted.access_token).toBe("my-token")
    expect(decrypted.refresh_token).toBe("my-refresh")
    expect(decrypted.expires_at).toBeTruthy()
    expect(decrypted.scope).toBe("email profile")
    expect(decrypted.token_type).toBe("Bearer")
    expect(decrypted.saved_at).toBeTruthy()
    expect(decrypted.cached_email).toBe("user@example.com")
  })

  it("defaults token_type to Bearer when not provided", async () => {
    await manager.saveTokens("user-1", "google", {
      access_token: "my-token",
      // no token_type
    })

    const saveCall = rpcMock.mock.calls[0]
    const params = saveCall[1]
    const decrypted = JSON.parse(Security.decrypt(params.p_ciphertext, params.p_iv, params.p_auth_tag))

    expect(decrypted.token_type).toBe("Bearer")
  })
})
