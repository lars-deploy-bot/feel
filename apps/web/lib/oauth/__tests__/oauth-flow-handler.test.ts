import { OAUTH_MCP_PROVIDERS } from "@webalive/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getOAuthConfig, type OAuthFlowResult } from "../oauth-flow-handler"

const baseUrl = "https://example.com"
const envKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_SCOPES", "GOOGLE_CALENDAR_SCOPES"] as const

function setGoogleCredentials() {
  process.env.GOOGLE_CLIENT_ID = "google-client-id"
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret"
}

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key]
  }
})

describe("getOAuthConfig scope isolation", () => {
  it("google_calendar does not inherit GOOGLE_SCOPES", () => {
    setGoogleCredentials()
    process.env.GOOGLE_SCOPES = "https://www.googleapis.com/auth/gmail.modify"

    const config = getOAuthConfig("google_calendar", baseUrl)

    expect(config).not.toBeNull()
    expect(config?.scopes).toBe(OAUTH_MCP_PROVIDERS.google_calendar.defaultScopes)
  })

  it("google_calendar uses GOOGLE_CALENDAR_SCOPES when provided", () => {
    setGoogleCredentials()
    process.env.GOOGLE_CALENDAR_SCOPES = "scope.one scope.two"

    const config = getOAuthConfig("google_calendar", baseUrl)

    expect(config).not.toBeNull()
    expect(config?.scopes).toBe("scope.one scope.two")
  })

  it("google OAuth-only provider still uses GOOGLE_SCOPES", () => {
    setGoogleCredentials()
    process.env.GOOGLE_SCOPES = "scope.alpha scope.beta"

    const config = getOAuthConfig("google", baseUrl)

    expect(config).not.toBeNull()
    expect(config?.scopes).toBe("scope.alpha scope.beta")
  })
})

// --- handleOAuthCallback tests ---

const mockConsumeState = vi.fn()
const mockCreateState = vi.fn()
vi.mock("@/lib/oauth/oauth-state-store", () => ({
  OAuthStateStore: {
    createState: (...args: unknown[]) => mockCreateState(...args),
    consumeState: (...args: unknown[]) => mockConsumeState(...args),
  },
  STATE_TTL_SECONDS: 600,
}))

const mockUpsert = vi.fn()
vi.mock("@/lib/oauth/oauth-identity-store", () => ({
  OAuthIdentityStore: {
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
}))

const mockHandleCallback = vi.fn()
const mockGetAccessToken = vi.fn()
const mockDisconnect = vi.fn()
vi.mock("@/lib/oauth/oauth-instances", () => ({
  getOAuthInstance: () => ({
    handleCallback: mockHandleCallback,
    getAccessToken: mockGetAccessToken,
    disconnect: mockDisconnect,
  }),
}))

const mockGetUserInfo = vi.fn()
vi.mock("@webalive/oauth-core", () => ({
  GoogleProvider: class {},
  OAuthMissingRequiredScopesError: class extends Error {
    readonly code = "MISSING_REQUIRED_SCOPES" as const
    readonly missingScopes: string[]
    constructor(missingScopes: string[]) {
      super(`Missing required OAuth scopes: ${missingScopes.join(", ")}`)
      this.name = "OAuthMissingRequiredScopesError"
      this.missingScopes = missingScopes
    }
  },
  getProvider: () => ({
    name: "google",
    getUserInfo: mockGetUserInfo,
  }),
  isExternalIdentityProvider: () => true,
}))

vi.mock("@webalive/shared", async importOriginal => {
  const actual = await importOriginal<typeof import("@webalive/shared")>()
  return {
    ...actual,
    getOAuthKeyForProvider: (p: string) => (p === "gmail" ? "google" : p),
  }
})

vi.mock("@webalive/env/server", () => ({
  env: { NODE_ENV: "test" },
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: vi.fn(),
    get: vi.fn(),
  }),
}))

vi.mock("@/lib/auth/client-identifier", () => ({
  getClientIdentifier: () => "test-client",
}))

vi.mock("@/lib/auth/rate-limiter", () => ({
  oauthInitiationRateLimiter: {
    isRateLimited: () => false,
    recordFailedAttempt: vi.fn(),
    reset: vi.fn(),
  },
  oauthOperationRateLimiter: {
    isRateLimited: () => false,
    recordFailedAttempt: vi.fn(),
    getBlockedTimeRemaining: () => 0,
    reset: vi.fn(),
  },
}))

vi.mock("@/lib/error-logger", () => ({
  errorLogger: {
    oauth: vi.fn(),
  },
}))

vi.mock("@/lib/integrations/visibility", () => ({
  canUserAccessIntegration: () => true,
}))

vi.mock("./providers", () => ({
  buildOAuthRedirectUri: (base: string, provider: string) => `${base}/api/auth/${provider}`,
  isOAuthProviderSupported: () => true,
  OAUTH_PROVIDER_CONFIG: {},
}))

vi.mock("@/lib/oauth/oauth-error-taxonomy", () => ({
  createOAuthErrorPayload: (params: {
    integration: string
    errorCode: string
    message?: string
    provider?: string
  }) => ({
    integration: params.integration,
    status: "error",
    error_code: params.errorCode,
    error_action: "retry",
    message: params.message ?? `${params.provider ?? params.integration} connection failed. Please try again.`,
  }),
  createOAuthSuccessPayload: (integration: string) => ({
    integration,
    status: "success",
  }),
  buildOAuthCallbackRedirectUrl: (
    base: string,
    payload: { integration: string; status: string; error_code?: string; error_action?: string; message?: string },
  ) => {
    const url = new URL("/oauth/callback", base)
    url.searchParams.set("integration", payload.integration)
    url.searchParams.set("status", payload.status)
    if (payload.error_code) url.searchParams.set("error_code", payload.error_code)
    if (payload.error_action) url.searchParams.set("error_action", payload.error_action)
    if (payload.message) url.searchParams.set("message", payload.message)
    return url.toString()
  },
  mapProviderErrorToOAuthCode: (error: string) =>
    error === "access_denied" ? "OAUTH_ACCESS_DENIED" : "OAUTH_PROVIDER_ERROR",
}))

const { handleOAuthCallback } = await import("../oauth-flow-handler")

// --- Helpers ---

function makeContext(overrides?: Partial<{ provider: string; userId: string; baseUrl: string }>) {
  return {
    provider: overrides?.provider ?? "gmail",
    user: {
      id: overrides?.userId ?? "user-123",
      email: "test@test.com",
      name: null,
      firstName: null,
      lastName: null,
      canSelectAnyModel: false,
      isAdmin: false,
      isSuperadmin: false,
      enabledModels: [],
    },
    baseUrl: overrides?.baseUrl ?? "https://app.test.com",
  }
}

function makeReq() {
  return new Request("https://app.test.com/api/auth/callback") as unknown as import("next/server").NextRequest
}

/** Extract redirect URL from result — asserts it's a redirect */
function redirectUrl(result: OAuthFlowResult): string {
  expect(result.type).toBe("redirect")
  if (result.type !== "redirect") throw new Error("Expected redirect")
  return result.url
}

describe("handleOAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("state user/provider binding (Finding #1)", () => {
    it("rejects callback when state userId does not match authenticated user", async () => {
      // State was created for user-attacker, but user-victim is completing the callback
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-attacker",
        provider: "gmail",
      })

      const result = await handleOAuthCallback(
        makeContext({ userId: "user-victim" }),
        "auth-code",
        "valid-state-token",
        makeReq(),
      )

      expect(redirectUrl(result)).toContain("status=error")
      // Should NOT have exchanged the code for tokens
      expect(mockHandleCallback).not.toHaveBeenCalled()
    })

    it("rejects callback when state provider does not match request provider", async () => {
      // State was created for "linear" but callback is for "gmail"
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "linear",
      })

      const result = await handleOAuthCallback(
        makeContext({ provider: "gmail" }),
        "auth-code",
        "valid-state-token",
        makeReq(),
      )

      expect(redirectUrl(result)).toContain("status=error")
      expect(mockHandleCallback).not.toHaveBeenCalled()
    })

    it("proceeds when state userId and provider both match", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      mockGetUserInfo.mockResolvedValue({ id: "google-id-1", email: "test@test.com" })
      mockUpsert.mockResolvedValue({ success: true, conflict: false })

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(redirectUrl(result)).toContain("status=success")
      expect(mockHandleCallback).toHaveBeenCalled()
    })
  })

  describe("conflict disconnect failure (Finding #2)", () => {
    it("returns conflict error even when disconnect throws", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      mockGetUserInfo.mockResolvedValue({ id: "google-id-1", email: "test@test.com" })
      mockUpsert.mockResolvedValue({
        success: false,
        conflict: true,
        existingUserId: "other-user-456",
      })
      // Disconnect throws — this must NOT swallow the conflict
      mockDisconnect.mockRejectedValue(new Error("disconnect failed"))

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      const url = redirectUrl(result)
      expect(url).toContain("status=error")
      expect(url).toContain("already+connected")
    })

    it("returns conflict error when disconnect succeeds", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      mockGetUserInfo.mockResolvedValue({ id: "google-id-1", email: "test@test.com" })
      mockUpsert.mockResolvedValue({
        success: false,
        conflict: true,
        existingUserId: "other-user-456",
      })
      mockDisconnect.mockResolvedValue(undefined)

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      const url = redirectUrl(result)
      expect(url).toContain("status=error")
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe("identity check fail-closed (Finding #3)", () => {
    it("fails the connection when getUserInfo throws", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      // getUserInfo throws — connection must NOT succeed
      mockGetUserInfo.mockRejectedValue(new Error("API error"))

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      expect(redirectUrl(result)).toContain("status=error")
    })

    it("fails the connection when getAccessToken throws", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      // getAccessToken throws — connection must NOT succeed
      mockGetAccessToken.mockRejectedValue(new Error("Token retrieval failed"))

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      expect(redirectUrl(result)).toContain("status=error")
    })

    it("fails the connection when getUserInfo returns empty id", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      // getUserInfo returns empty id — connection must NOT succeed (fail-closed)
      mockGetUserInfo.mockResolvedValue({ id: "", email: "test@test.com" })

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      expect(redirectUrl(result)).toContain("status=error")
      // Should NOT have attempted identity upsert
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it("fails the connection when identity upsert throws", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      mockGetUserInfo.mockResolvedValue({ id: "google-id-1", email: "test@test.com" })
      // Identity upsert throws — connection must NOT succeed
      mockUpsert.mockRejectedValue(new Error("DB error"))

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      expect(redirectUrl(result)).toContain("status=error")
    })
  })

  describe("happy path", () => {
    it("succeeds with matching state, no conflict, and valid identity", async () => {
      mockConsumeState.mockResolvedValue({
        valid: true,
        userId: "user-123",
        provider: "gmail",
      })
      mockHandleCallback.mockResolvedValue(undefined)
      mockGetAccessToken.mockResolvedValue("access-token")
      mockGetUserInfo.mockResolvedValue({ id: "google-id-1", email: "test@test.com" })
      mockUpsert.mockResolvedValue({ success: true, conflict: false })

      const result = await handleOAuthCallback(makeContext(), "auth-code", "valid-state-token", makeReq())

      expect(result.type).toBe("redirect")
      expect(redirectUrl(result)).toContain("status=success")
    })
  })
})
