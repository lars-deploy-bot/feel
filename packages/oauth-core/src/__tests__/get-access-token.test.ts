/**
 * Tests for OAuthManager.getAccessToken() — the token refresh flow.
 *
 * This is the most critical behavior in oauth-core:
 * 1. Returns cached token when not expired
 * 2. Refreshes token when expired (with lock, double-check, provider call)
 * 3. Preserves refresh_token when provider doesn't return a new one (Google)
 * 4. Stores new refresh_token when provider rotates it (Microsoft)
 * 5. Throws actionable errors for every failure path
 *
 * All storage and provider calls are mocked — no real HTTP or DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NoopAuditLogger, oauthAudit } from "../audit"
import { InMemoryRefreshLockManager } from "../refresh-lock"

// ---------------------------------------------------------------
// Mock setup: Supabase client + provider registry
// ---------------------------------------------------------------

const createClientMock = vi.hoisted(() => vi.fn())
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

// Mock the provider registry so we can control what getProvider returns
const mockGetProvider = vi.hoisted(() => vi.fn())
const mockIsRefreshable = vi.hoisted(() => vi.fn())
vi.mock("../providers/index", () => ({
  getProvider: mockGetProvider,
}))
vi.mock("../providers/base", () => ({
  isRefreshable: mockIsRefreshable,
  isRevocable: vi.fn(() => false),
  isUserInfoProvider: vi.fn(() => false),
  isExternalIdentityProvider: vi.fn(() => false),
}))

import { OAuthManager } from "../index"
import type { IRefreshLockManager } from "../refresh-lock"
import { Security } from "../security"
import { OAUTH_TOKENS_NAMESPACE } from "../types"

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/** Creates a stored token blob (what comes back from storage.get after decryption) */
function makeTokenBlob(overrides: {
  access_token?: string
  refresh_token?: string | null
  expires_at?: string | null
  scope?: string | null
}) {
  return JSON.stringify({
    access_token: "old-access-token",
    refresh_token: "valid-refresh-token",
    expires_at: null,
    scope: "read write",
    token_type: "Bearer",
    saved_at: new Date().toISOString(),
    cached_email: "user@example.com",
    ...overrides,
  })
}

/** Encrypts a token blob and returns what the RPC would return */
function encryptedRow(blob: string) {
  const encrypted = Security.encrypt(blob)
  return {
    data: [{ ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.authTag }],
    error: null,
  }
}

function createManager(lockManager?: IRefreshLockManager) {
  return new OAuthManager({
    provider: "google",
    instanceId: "google:test",
    namespace: OAUTH_TOKENS_NAMESPACE,
    environment: "test",
    lockManager: lockManager ?? new InMemoryRefreshLockManager(false),
  })
}

describe("OAuthManager.getAccessToken", () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    oauthAudit.setLogger(new NoopAuditLogger())

    rpcMock = vi.fn()
    createClientMock.mockReturnValue({ rpc: rpcMock })

    // Default: provider is refreshable
    mockIsRefreshable.mockReturnValue(true)
    mockGetProvider.mockReturnValue({
      name: "google",
      refreshToken: vi.fn(),
      exchangeCode: vi.fn(),
      getAuthUrl: vi.fn(),
    })
  })

  // ---------------------------------------------------------------
  // HAPPY PATH: Token still valid
  // ---------------------------------------------------------------

  it("returns access_token when token has no expiry (never expires)", async () => {
    const blob = makeTokenBlob({ expires_at: null })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))

    const manager = createManager()
    const token = await manager.getAccessToken("user-1", "google")

    expect(token).toBe("old-access-token")
  })

  it("returns access_token when token is not yet expired", async () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30min from now
    const blob = makeTokenBlob({ expires_at: futureDate })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))

    const manager = createManager()
    const token = await manager.getAccessToken("user-1", "google")

    expect(token).toBe("old-access-token")
  })

  // ---------------------------------------------------------------
  // USER NOT CONNECTED
  // ---------------------------------------------------------------

  it("throws when user has no token stored", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })

    const manager = createManager()
    await expect(manager.getAccessToken("user-1", "google")).rejects.toThrow("User user-1 is not connected to 'google'")
  })

  // ---------------------------------------------------------------
  // CORRUPTED TOKEN DATA
  // ---------------------------------------------------------------

  it("throws when stored token blob is not valid JSON", async () => {
    const encrypted = Security.encrypt("not-valid-json{{{")
    rpcMock.mockResolvedValueOnce({
      data: [{ ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.authTag }],
      error: null,
    })

    const manager = createManager()
    await expect(manager.getAccessToken("user-1", "google")).rejects.toThrow("Failed to parse token data")
  })

  // ---------------------------------------------------------------
  // EXPIRED TOKEN: No refresh_token available
  // ---------------------------------------------------------------

  it("throws when token is expired and no refresh_token exists", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString() // 1 minute ago
    const blob = makeTokenBlob({ expires_at: pastDate, refresh_token: null })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))

    const manager = createManager()
    await expect(manager.getAccessToken("user-1", "google")).rejects.toThrow(
      "has expired and no refresh token is available",
    )
  })

  // ---------------------------------------------------------------
  // EXPIRED TOKEN: Provider doesn't support refresh
  // ---------------------------------------------------------------

  it("throws when provider does not support token refresh", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const blob = makeTokenBlob({ expires_at: pastDate })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))

    mockIsRefreshable.mockReturnValue(false)

    const manager = createManager()
    await expect(manager.getAccessToken("user-1", "github")).rejects.toThrow("does not support token refresh")
  })

  // ---------------------------------------------------------------
  // EXPIRED TOKEN: Missing OAuth client credentials
  // ---------------------------------------------------------------

  it("throws when CLIENT_ID/CLIENT_SECRET env vars are missing", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const blob = makeTokenBlob({ expires_at: pastDate })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))

    // Ensure env vars are NOT set
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET

    const manager = createManager()
    await expect(manager.getAccessToken("user-1", "google")).rejects.toThrow("Missing OAuth credentials for 'google'")
  })

  // ---------------------------------------------------------------
  // SUCCESSFUL REFRESH
  // ---------------------------------------------------------------

  describe("successful token refresh", () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()

    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id"
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret"
    })

    afterEach(() => {
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_CLIENT_SECRET
    })

    it("calls provider.refreshToken with correct arguments", async () => {
      const blob = makeTokenBlob({ expires_at: pastDate })
      // First call: getAccessToken reads the token
      rpcMock.mockResolvedValueOnce(encryptedRow(blob))
      // Inside lock double-check: re-read (still expired)
      rpcMock.mockResolvedValueOnce(encryptedRow(blob))
      // saveTokens call
      rpcMock.mockResolvedValueOnce({ data: "saved", error: null })

      const mockRefreshToken = vi.fn().mockResolvedValue({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        scope: "read write",
        token_type: "Bearer",
      })
      mockGetProvider.mockReturnValue({
        name: "google",
        refreshToken: mockRefreshToken,
        exchangeCode: vi.fn(),
        getAuthUrl: vi.fn(),
      })

      const manager = createManager()
      const token = await manager.getAccessToken("user-1", "google")

      expect(token).toBe("new-access-token")
      expect(mockRefreshToken).toHaveBeenCalledWith("valid-refresh-token", "test-client-id", "test-client-secret")
    })

    it("preserves original refresh_token when provider returns none (Google pattern)", async () => {
      const blob = makeTokenBlob({
        expires_at: pastDate,
        refresh_token: "original-refresh-token",
      })
      rpcMock.mockResolvedValueOnce(encryptedRow(blob))
      rpcMock.mockResolvedValueOnce(encryptedRow(blob))
      rpcMock.mockResolvedValueOnce({ data: "saved", error: null })

      // Google does NOT return refresh_token on refresh
      const mockRefreshToken = vi.fn().mockResolvedValue({
        access_token: "new-access-token",
        // NO refresh_token field
        expires_in: 3600,
        scope: "read write",
        token_type: "Bearer",
      })
      mockGetProvider.mockReturnValue({
        name: "google",
        refreshToken: mockRefreshToken,
        exchangeCode: vi.fn(),
        getAuthUrl: vi.fn(),
      })

      const manager = createManager()
      await manager.getAccessToken("user-1", "google")

      // Decrypt the saved blob and verify the original refresh token was preserved
      const saveCall = rpcMock.mock.calls[2]
      const savedParams = saveCall[1]
      const savedBlob = JSON.parse(Security.decrypt(savedParams.p_ciphertext, savedParams.p_iv, savedParams.p_auth_tag))
      expect(savedBlob.refresh_token).toBe("original-refresh-token")
      expect(savedBlob.access_token).toBe("new-access-token")
    })

    it("stores rotated refresh_token when provider returns one (Microsoft rotation)", async () => {
      const blob = makeTokenBlob({
        expires_at: pastDate,
        refresh_token: "old-refresh-token",
      })
      rpcMock.mockResolvedValueOnce(encryptedRow(blob))
      rpcMock.mockResolvedValueOnce(encryptedRow(blob))
      rpcMock.mockResolvedValueOnce({ data: "saved", error: null })

      // Microsoft DOES return a new refresh_token
      const mockRefreshToken = vi.fn().mockResolvedValue({
        access_token: "ms-new-access-token",
        refresh_token: "ms-rotated-refresh-token",
        expires_in: 3600,
        scope: "Mail.Read",
        token_type: "Bearer",
      })
      mockGetProvider.mockReturnValue({
        name: "microsoft",
        refreshToken: mockRefreshToken,
        exchangeCode: vi.fn(),
        getAuthUrl: vi.fn(),
      })

      process.env.MICROSOFT_CLIENT_ID = "ms-client-id"
      process.env.MICROSOFT_CLIENT_SECRET = "ms-client-secret"

      const manager = createManager()
      const token = await manager.getAccessToken("user-1", "microsoft")

      expect(token).toBe("ms-new-access-token")

      // Decrypt the saved blob and verify the rotated refresh token was stored
      const saveCall = rpcMock.mock.calls[2]
      const savedParams = saveCall[1]
      const savedBlob = JSON.parse(Security.decrypt(savedParams.p_ciphertext, savedParams.p_iv, savedParams.p_auth_tag))
      expect(savedBlob.refresh_token).toBe("ms-rotated-refresh-token")
      expect(savedBlob.access_token).toBe("ms-new-access-token")

      delete process.env.MICROSOFT_CLIENT_ID
      delete process.env.MICROSOFT_CLIENT_SECRET
    })
  })

  // ---------------------------------------------------------------
  // DOUBLE-CHECK PATTERN: Token refreshed by another request
  // ---------------------------------------------------------------

  it("skips refresh when double-check finds token already refreshed", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const expiredBlob = makeTokenBlob({ expires_at: pastDate })

    // Future date: another request already refreshed
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const freshBlob = makeTokenBlob({
      access_token: "already-refreshed-token",
      expires_at: futureDate,
    })

    // 1st read: token is expired
    rpcMock.mockResolvedValueOnce(encryptedRow(expiredBlob))
    // 2nd read (inside lock): token is fresh
    rpcMock.mockResolvedValueOnce(encryptedRow(freshBlob))

    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret"

    const mockRefreshToken = vi.fn()
    mockGetProvider.mockReturnValue({
      name: "google",
      refreshToken: mockRefreshToken,
      exchangeCode: vi.fn(),
      getAuthUrl: vi.fn(),
    })

    const manager = createManager()
    const token = await manager.getAccessToken("user-1", "google")

    // Should use the already-refreshed token, NOT call the provider
    expect(token).toBe("already-refreshed-token")
    expect(mockRefreshToken).not.toHaveBeenCalled()
    // Only 2 RPC calls (initial read + double-check read), no save
    expect(rpcMock).toHaveBeenCalledTimes(2)

    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  })

  // ---------------------------------------------------------------
  // PROVIDER REFRESH FAILURE
  // ---------------------------------------------------------------

  it("wraps provider refresh errors with actionable message", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const blob = makeTokenBlob({ expires_at: pastDate })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))

    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret"

    mockGetProvider.mockReturnValue({
      name: "google",
      refreshToken: vi.fn().mockRejectedValue(new Error("invalid_grant")),
      exchangeCode: vi.fn(),
      getAuthUrl: vi.fn(),
    })

    const manager = createManager()
    await expect(manager.getAccessToken("user-1", "google")).rejects.toThrow(
      "Token refresh failed for 'google': invalid_grant. User may need to re-authenticate.",
    )

    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  })

  // ---------------------------------------------------------------
  // CREDENTIAL ALIAS RESOLUTION
  // ---------------------------------------------------------------

  it("resolves google_calendar credentials to google env vars", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const blob = makeTokenBlob({ expires_at: pastDate })
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))
    rpcMock.mockResolvedValueOnce({ data: "saved", error: null })

    // Set GOOGLE_ env vars (not GOOGLE_CALENDAR_)
    process.env.GOOGLE_CLIENT_ID = "google-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret"

    mockGetProvider.mockReturnValue({
      name: "google_calendar",
      refreshToken: vi.fn().mockResolvedValue({
        access_token: "cal-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
      exchangeCode: vi.fn(),
      getAuthUrl: vi.fn(),
    })

    const manager = createManager()
    const token = await manager.getAccessToken("user-1", "google_calendar")

    expect(token).toBe("cal-token")

    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  })

  // ---------------------------------------------------------------
  // CONCURRENT REFRESH: Lock deduplication
  // ---------------------------------------------------------------

  it("only calls provider once when multiple requests trigger refresh simultaneously", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const blob = makeTokenBlob({ expires_at: pastDate })

    // We need enough RPC mock responses for all concurrent calls
    // Each getAccessToken call reads once, then inside the lock reads again
    // But the lock manager deduplicates, so only ONE lock body executes
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const freshBlob = makeTokenBlob({ access_token: "refreshed-token", expires_at: futureDate })

    // Mock: every read returns expired blob initially
    // After first refresh, reads return fresh blob
    let refreshed = false
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "lockbox_get") {
        if (refreshed) {
          return Promise.resolve(encryptedRow(freshBlob))
        }
        return Promise.resolve(encryptedRow(blob))
      }
      if (fnName === "lockbox_save") {
        refreshed = true
        return Promise.resolve({ data: "saved", error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret"

    let providerCallCount = 0
    mockGetProvider.mockReturnValue({
      name: "google",
      refreshToken: vi.fn().mockImplementation(async () => {
        providerCallCount++
        await new Promise(r => setTimeout(r, 20)) // Simulate network latency
        return {
          access_token: "refreshed-token",
          refresh_token: "kept-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }
      }),
      exchangeCode: vi.fn(),
      getAuthUrl: vi.fn(),
    })

    const lockManager = new InMemoryRefreshLockManager(false)
    const manager = new OAuthManager({
      provider: "google",
      instanceId: "google:test",
      namespace: OAUTH_TOKENS_NAMESPACE,
      environment: "test",
      lockManager,
    })

    // Fire 3 concurrent getAccessToken calls
    const results = await Promise.all([
      manager.getAccessToken("user-1", "google"),
      manager.getAccessToken("user-1", "google"),
      manager.getAccessToken("user-1", "google"),
    ])

    // All should return the refreshed token
    for (const result of results) {
      expect(result).toBe("refreshed-token")
    }

    // The provider's refreshToken should only have been called ONCE
    // (lock deduplication prevents multiple calls)
    expect(providerCallCount).toBe(1)

    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  })
})
