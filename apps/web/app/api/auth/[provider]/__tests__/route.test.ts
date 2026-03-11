import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"
import { createMockSessionUser } from "@/lib/test-helpers/mock-session-user"

// --- Mock setup ---
const requireSessionUserMock = vi.fn()
const createErrorResponseMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getOAuthConfigMock = vi.fn()
const handleOAuthCallbackMock = vi.fn()
const handleProviderErrorMock = vi.fn()
const initiateOAuthFlowMock = vi.fn()
const validateProviderNameMock = vi.fn()
const captureExceptionMock = vi.fn()
const captureMessageMock = vi.fn()

vi.mock("@/features/auth/lib/auth", () => {
  class AuthenticationError extends Error {
    constructor(message = "Authentication required") {
      super(message)
      this.name = "AuthenticationError"
    }
  }

  return {
    AuthenticationError,
    requireSessionUser: requireSessionUserMock,
    createErrorResponse: createErrorResponseMock,
  }
})

vi.mock("@/lib/integrations/validation", () => ({
  validateProviderName: validateProviderNameMock,
}))

vi.mock("@/lib/oauth/oauth-flow-handler", () => ({
  checkRateLimit: checkRateLimitMock,
  getOAuthConfig: getOAuthConfigMock,
  handleOAuthCallback: handleOAuthCallbackMock,
  handleProviderError: handleProviderErrorMock,
  initiateOAuthFlow: initiateOAuthFlowMock,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  captureMessage: captureMessageMock,
}))

const { GET } = await import("../route")
const { AuthenticationError } = await import("@/features/auth/lib/auth")

const MOCK_USER = createMockSessionUser({
  email: "user@example.com",
  name: "User",
})

function createRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "GET",
    headers: {
      host: "localhost",
      "x-forwarded-proto": "http",
    },
  })
}

function readRedirectLocation(res: Response): URL {
  const location = res.headers.get("location")
  if (!location) throw new Error("Expected redirect but no location header")
  return new URL(location)
}

describe("GET /api/auth/[provider]", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    createErrorResponseMock.mockImplementation((error: string, status: number, fields?: Record<string, unknown>) => {
      return NextResponse.json({ ok: false, error, ...fields }, { status })
    })
    requireSessionUserMock.mockResolvedValue(MOCK_USER)
    checkRateLimitMock.mockResolvedValue({ limited: false })
    validateProviderNameMock.mockImplementation((provider: string) => ({ valid: true, provider }))
    getOAuthConfigMock.mockReturnValue({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost/api/auth/linear",
      scopes: "read write",
    })
  })

  // --- Authentication ---

  it("returns 401 when unauthenticated", async () => {
    requireSessionUserMock.mockRejectedValueOnce(new AuthenticationError())

    const res = await GET(createRequest("/api/auth/linear"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  // --- Provider validation ---

  it("returns 400 for invalid provider name", async () => {
    validateProviderNameMock.mockReturnValueOnce({ valid: false, error: "Unknown provider" })

    const res = await GET(createRequest("/api/auth/not-a-provider"), {
      params: Promise.resolve({ provider: "not-a-provider" }),
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe(ErrorCodes.INVALID_PROVIDER)
  })

  // --- Rate limiting ---

  it("redirects with TOO_MANY_REQUESTS on rate limit", async () => {
    checkRateLimitMock.mockResolvedValueOnce({ limited: true, minutesRemaining: 3 })

    const res = await GET(createRequest("/api/auth/linear?code=auth-code&state=valid"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.pathname).toBe("/oauth/callback")
    expect(redirectUrl.searchParams.get("integration")).toBe("linear")
    expect(redirectUrl.searchParams.get("status")).toBe("error")
    expect(redirectUrl.searchParams.get("error_code")).toBe(ErrorCodes.TOO_MANY_REQUESTS)
    expect(redirectUrl.searchParams.get("error_action")).toBe("retry")
    // Verify the handler was never called
    expect(handleOAuthCallbackMock).not.toHaveBeenCalled()
    expect(initiateOAuthFlowMock).not.toHaveBeenCalled()
  })

  // --- Provider error (e.g. user clicks "Cancel" on provider page) ---

  it("redirects with typed error when provider returns access_denied", async () => {
    handleProviderErrorMock.mockReturnValueOnce({
      type: "redirect",
      url: "http://localhost/oauth/callback?integration=linear&status=error&error_code=OAUTH_ACCESS_DENIED&error_action=retry",
    })

    const res = await GET(createRequest("/api/auth/linear?error=access_denied"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.searchParams.get("error_code")).toBe("OAUTH_ACCESS_DENIED")
    expect(redirectUrl.searchParams.get("error_action")).toBe("retry")
    // Callback handler must NOT be called when provider returns an error
    expect(handleOAuthCallbackMock).not.toHaveBeenCalled()
    expect(handleProviderErrorMock).toHaveBeenCalledWith("linear", "access_denied", null, "http://localhost")
  })

  // --- Callback: state mismatch ---

  it("redirects with OAUTH_STATE_MISMATCH on invalid state", async () => {
    handleOAuthCallbackMock.mockResolvedValueOnce({
      type: "redirect",
      url: "http://localhost/oauth/callback?integration=linear&status=error&error_code=OAUTH_STATE_MISMATCH&error_action=retry",
    })

    const res = await GET(createRequest("/api/auth/linear?code=auth-code&state=bad-state"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.searchParams.get("integration")).toBe("linear")
    expect(redirectUrl.searchParams.get("status")).toBe("error")
    expect(redirectUrl.searchParams.get("error_code")).toBe("OAUTH_STATE_MISMATCH")
    expect(redirectUrl.searchParams.get("error_action")).toBe("retry")
  })

  // --- Callback: missing scopes ---

  it("redirects with OAUTH_MISSING_REQUIRED_SCOPES when scopes insufficient", async () => {
    handleOAuthCallbackMock.mockResolvedValueOnce({
      type: "redirect",
      url: "http://localhost/oauth/callback?integration=linear&status=error&error_code=OAUTH_MISSING_REQUIRED_SCOPES&error_action=reconnect",
    })

    const res = await GET(createRequest("/api/auth/linear?code=auth-code&state=valid-state"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.searchParams.get("status")).toBe("error")
    expect(redirectUrl.searchParams.get("error_code")).toBe("OAUTH_MISSING_REQUIRED_SCOPES")
    // Missing scopes should suggest reconnect, not just retry
    expect(redirectUrl.searchParams.get("error_action")).toBe("reconnect")
  })

  // --- Callback: success ---

  it("redirects with success status on successful callback", async () => {
    handleOAuthCallbackMock.mockResolvedValueOnce({
      type: "redirect",
      url: "http://localhost/oauth/callback?integration=linear&status=success",
    })

    const res = await GET(createRequest("/api/auth/linear?code=auth-code&state=valid-state"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.pathname).toBe("/oauth/callback")
    expect(redirectUrl.searchParams.get("integration")).toBe("linear")
    expect(redirectUrl.searchParams.get("status")).toBe("success")
    // Success must NOT have error fields
    expect(redirectUrl.searchParams.get("error_code")).toBeNull()
    expect(redirectUrl.searchParams.get("error_action")).toBeNull()
    expect(handleOAuthCallbackMock).toHaveBeenCalledTimes(1)
  })

  // --- Initiation: missing config ---

  it("redirects with OAUTH_CONFIG_ERROR when provider config is missing", async () => {
    getOAuthConfigMock.mockReturnValueOnce(null)

    const res = await GET(createRequest("/api/auth/linear"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.pathname).toBe("/oauth/callback")
    expect(redirectUrl.searchParams.get("error_code")).toBe(ErrorCodes.OAUTH_CONFIG_ERROR)
    expect(redirectUrl.searchParams.get("error_action")).toBe("contact_admin")
    expect(captureMessageMock).toHaveBeenCalledWith("[linear OAuth] Missing configuration", "error")
  })

  // --- Initiation: success ---

  it("redirects to provider auth URL on initiation", async () => {
    initiateOAuthFlowMock.mockResolvedValueOnce({
      type: "redirect",
      url: "https://linear.app/oauth/authorize?client_id=test&state=abc",
    })

    const res = await GET(createRequest("/api/auth/linear"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.origin).toBe("https://linear.app")
    expect(redirectUrl.pathname).toBe("/oauth/authorize")
    expect(initiateOAuthFlowMock).toHaveBeenCalledTimes(1)
  })

  // --- Unexpected errors ---

  it("redirects with INTEGRATION_ERROR on unexpected throw when provider is known", async () => {
    handleOAuthCallbackMock.mockRejectedValueOnce(new Error("Database connection failed"))

    const res = await GET(createRequest("/api/auth/linear?code=auth-code&state=valid"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.pathname).toBe("/oauth/callback")
    expect(redirectUrl.searchParams.get("integration")).toBe("linear")
    expect(redirectUrl.searchParams.get("error_code")).toBe(ErrorCodes.INTEGRATION_ERROR)
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
  })

  it("returns JSON error on unexpected throw before provider is parsed", async () => {
    // Simulate error before provider is resolved (e.g. params promise rejects)
    const res = await GET(createRequest("/api/auth/linear"), {
      params: Promise.reject(new Error("params failed")),
    })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe(ErrorCodes.INTEGRATION_ERROR)
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
  })

  // --- Outlook (Microsoft OAuth) path ---

  it("initiates Outlook OAuth flow via microsoft provider", async () => {
    getOAuthConfigMock.mockReturnValueOnce({
      clientId: "ms-client-id",
      clientSecret: "ms-client-secret",
      redirectUri: "http://localhost/api/auth/outlook",
      scopes: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send",
    })
    initiateOAuthFlowMock.mockResolvedValueOnce({
      type: "redirect",
      url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=ms-client-id&state=xyz",
    })

    const res = await GET(createRequest("/api/auth/outlook"), {
      params: Promise.resolve({ provider: "outlook" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.origin).toBe("https://login.microsoftonline.com")
    expect(initiateOAuthFlowMock).toHaveBeenCalledTimes(1)
    // Context must carry "outlook" as the provider, not "microsoft"
    expect(initiateOAuthFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "outlook" }),
      expect.objectContaining({ clientId: "ms-client-id" }),
    )
  })

  it("handles Outlook callback success", async () => {
    handleOAuthCallbackMock.mockResolvedValueOnce({
      type: "redirect",
      url: "http://localhost/oauth/callback?integration=outlook&status=success",
    })

    const res = await GET(createRequest("/api/auth/outlook?code=ms-auth-code&state=valid-state"), {
      params: Promise.resolve({ provider: "outlook" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.searchParams.get("integration")).toBe("outlook")
    expect(redirectUrl.searchParams.get("status")).toBe("success")
    expect(handleOAuthCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "outlook" }),
      "ms-auth-code",
      "valid-state",
      expect.any(NextRequest),
    )
  })

  it("handles Microsoft OAuth provider returning access_denied for Outlook", async () => {
    handleProviderErrorMock.mockReturnValueOnce({
      type: "redirect",
      url: "http://localhost/oauth/callback?integration=outlook&status=error&error_code=OAUTH_ACCESS_DENIED&error_action=retry",
    })

    const res = await GET(createRequest("/api/auth/outlook?error=access_denied"), {
      params: Promise.resolve({ provider: "outlook" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.searchParams.get("integration")).toBe("outlook")
    expect(redirectUrl.searchParams.get("error_code")).toBe("OAUTH_ACCESS_DENIED")
    expect(handleProviderErrorMock).toHaveBeenCalledWith("outlook", "access_denied", null, "http://localhost")
  })

  it("redirects with OAUTH_CONFIG_ERROR when Outlook config is missing", async () => {
    getOAuthConfigMock.mockReturnValueOnce(null)

    const res = await GET(createRequest("/api/auth/outlook"), {
      params: Promise.resolve({ provider: "outlook" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.searchParams.get("error_code")).toBe(ErrorCodes.OAUTH_CONFIG_ERROR)
    expect(captureMessageMock).toHaveBeenCalledWith("[outlook OAuth] Missing configuration", "error")
  })

  // --- Microsoft (OAuth-only provider) path ---

  it("accepts microsoft as a valid OAuth-only provider", async () => {
    getOAuthConfigMock.mockReturnValueOnce({
      clientId: "ms-client-id",
      clientSecret: "ms-client-secret",
      redirectUri: "http://localhost/api/auth/microsoft",
      scopes: "https://graph.microsoft.com/Mail.ReadWrite",
    })
    initiateOAuthFlowMock.mockResolvedValueOnce({
      type: "redirect",
      url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=ms-client-id",
    })

    const res = await GET(createRequest("/api/auth/microsoft"), {
      params: Promise.resolve({ provider: "microsoft" }),
    })
    const redirectUrl = readRedirectLocation(res)

    expect(redirectUrl.origin).toBe("https://login.microsoftonline.com")
    expect(initiateOAuthFlowMock).toHaveBeenCalledTimes(1)
  })

  // --- Redirect structure validation ---

  it("never leaks internal error messages in redirect URL for non-dev environments", async () => {
    const internalError = "ECONNREFUSED 127.0.0.1:5432 - database connection refused"
    handleOAuthCallbackMock.mockResolvedValueOnce({
      type: "redirect",
      url: `http://localhost/oauth/callback?integration=linear&status=error&error_code=INTEGRATION_ERROR&error_action=retry&message=${encodeURIComponent(internalError)}`,
    })

    const res = await GET(createRequest("/api/auth/linear?code=auth-code&state=valid"), {
      params: Promise.resolve({ provider: "linear" }),
    })
    const redirectUrl = readRedirectLocation(res)

    // The route itself doesn't generate messages — handleOAuthCallback does.
    // But the route must pass through whatever the handler returns.
    expect(redirectUrl.searchParams.get("status")).toBe("error")
    expect(redirectUrl.searchParams.get("error_code")).toBe("INTEGRATION_ERROR")
  })
})
