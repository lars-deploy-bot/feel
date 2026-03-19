import { COOKIE_NAMES, DOMAINS } from "@webalive/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"
import { createMockNextRequest, parseCookieHeader, splitSetCookieHeaders } from "@/lib/test-helpers/mock-request"

// Mock env modules before importing route
// Both @/lib/env (internal) and @webalive/env/server (package) need to be mocked
// to allow dynamic env access during tests via vi.stubEnv()
const envMock = {
  env: {
    get ALIVE_PASSCODE() {
      return process.env.ALIVE_PASSCODE
    },
    get ALIVE_ENV() {
      return process.env.ALIVE_ENV
    },
    get NODE_ENV() {
      return process.env.NODE_ENV
    },
    // JWT requires a secret in production mode
    get JWT_SECRET() {
      return process.env.JWT_SECRET || "test-secret-for-unit-tests"
    },
    get JWT_ALGORITHM() {
      return process.env.JWT_ALGORITHM
    },
  },
}

vi.mock("@/lib/env", () => envMock)
vi.mock("@webalive/env/server", () => envMock)

// Mock session-service (logout route imports it)
vi.mock("@/features/auth/sessions/session-service", () => ({
  revokeSession: vi.fn().mockResolvedValue(true),
  createAuthSession: vi.fn().mockResolvedValue(undefined),
}))

// Import route handlers after mocking
const { POST: loginManagerPOST, OPTIONS: loginManagerOPTIONS } = await import("../route")
const { POST: logoutPOST } = await import("../../logout/route")

/**
 * MANAGER LOGIN TESTS
 *
 * Critical security tests for manager authentication:
 * 1. Passcode validation against env.ALIVE_PASSCODE
 * 2. Test mode support for local development
 * 3. Cookie configuration consistency with logout
 * 4. Proper error codes and messages
 * 5. CORS handling
 */

// createMockNextRequest, parseCookieHeader, splitSetCookieHeaders, CookieConfig
// are imported from @/lib/test-helpers/mock-request

describe("POST /api/login-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default test environment
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("ALIVE_PASSCODE", "wachtwoord")
    vi.stubEnv("ALIVE_ENV", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  /**
   * VALID PASSCODE TEST (PRODUCTION)
   * Should authenticate successfully with correct passcode
   */
  it("should authenticate successfully with valid passcode", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wachtwoord" }),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.requestId).toBeDefined()

    // Check manager_session cookie is set
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain(`${COOKIE_NAMES.MANAGER_SESSION}=`)
    // Verify token is not the old insecure "1"
    expect(setCookie).not.toContain(`${COOKIE_NAMES.MANAGER_SESSION}=1`)
    // Verify token exists and is base64url format (alphanumeric + - _)
    const tokenMatch = setCookie?.match(new RegExp(`${COOKIE_NAMES.MANAGER_SESSION}=([A-Za-z0-9_-]+)`))
    expect(tokenMatch).toBeTruthy()
    expect(tokenMatch![1].length).toBeGreaterThan(20) // At least 20 chars
    expect(setCookie).toContain("HttpOnly")
    // Case-insensitive check for SameSite
    // In production: samesite=none (for cross-origin iframe support)
    // In development: samesite=lax
    expect(setCookie?.toLowerCase()).toMatch(/samesite=(lax|none)/)
  })

  /**
   * INVALID PASSCODE TEST
   * Should reject authentication with wrong passcode
   */
  it("should reject invalid passcode with proper error code", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wrong_password" }),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.ok).toBe(false)
    expect(json.error).toBe(ErrorCodes.INVALID_CREDENTIALS)
    expect(json.message).toBeDefined()
    expect(json.requestId).toBeDefined()

    // Should NOT set cookie
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toBeNull()
  })

  /**
   * MISSING PASSCODE TEST
   * Should validate request body and reject empty passcode
   */
  it("should reject missing passcode with validation error", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toBe(ErrorCodes.INVALID_REQUEST)
    expect(json.details?.issues).toBeDefined()
  })

  /**
   * EMPTY PASSCODE TEST
   * Should reject empty string passcode
   */
  it("should reject empty passcode", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "" }),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toBe(ErrorCodes.INVALID_REQUEST)
  })

  /**
   * TEST MODE AUTHENTICATION
   * Should accept "test" passcode when ALIVE_ENV=local
   */
  it("should authenticate with test passcode in local mode", async () => {
    vi.stubEnv("ALIVE_ENV", "local")

    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "test" }),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)

    // Check manager_session cookie is set with secure token (not the test value "1")
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain(`${COOKIE_NAMES.MANAGER_SESSION}=`)
    expect(setCookie).not.toContain(`${COOKIE_NAMES.MANAGER_SESSION}=1;`) // Should not be exactly "1"
    expect(setCookie).not.toContain(`${COOKIE_NAMES.MANAGER_SESSION}=1 `) // Alternative format check
  })

  /**
   * TEST MODE SHOULD NOT WORK IN PRODUCTION
   * Test passcode should be rejected when not in local mode
   */
  it("should reject test passcode in production mode", async () => {
    vi.stubEnv("ALIVE_ENV", "")
    vi.stubEnv("NODE_ENV", "production")

    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "test" }),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.ok).toBe(false)
    expect(json.error).toBe(ErrorCodes.INVALID_CREDENTIALS)
  })

  /**
   * MISSING ENVIRONMENT VARIABLE TEST
   * Should fail gracefully if ALIVE_PASSCODE not set
   */
  it("should reject all passcodes if ALIVE_PASSCODE not set", async () => {
    process.env.ALIVE_PASSCODE = undefined

    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "any_password" }),
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.ok).toBe(false)
    expect(json.error).toBe(ErrorCodes.INVALID_CREDENTIALS)
  })

  /**
   * COOKIE CONFIGURATION CONSISTENCY TEST (PRODUCTION)
   * Manager login cookie should match logout cookie attributes
   */
  it("should set manager cookie with attributes matching logout (PRODUCTION)", async () => {
    vi.stubEnv("NODE_ENV", "production")

    // Get login cookie config
    const loginReq = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wachtwoord" }),
    })

    const loginRes = await loginManagerPOST(loginReq)
    const loginSetCookie = loginRes.headers.get("set-cookie")

    if (!loginSetCookie) {
      throw new Error("Manager login didn't set cookie")
    }

    const loginCookie = parseCookieHeader(loginSetCookie)

    // Get logout cookie config
    const logoutReq = createMockNextRequest("http://localhost/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const logoutRes = await logoutPOST(logoutReq)
    const logoutSetCookie = logoutRes.headers.get("set-cookie")

    if (!logoutSetCookie) {
      throw new Error("Logout didn't set cookies")
    }

    const logoutCookieStrings = splitSetCookieHeaders(logoutSetCookie)
    const logoutCookies = logoutCookieStrings.map(parseCookieHeader)
    const managerCookie = logoutCookies.find(c => c.name === COOKIE_NAMES.MANAGER_SESSION)

    if (!managerCookie) {
      throw new Error(`Logout didn't clear ${COOKIE_NAMES.MANAGER_SESSION}`)
    }

    // Assert cookie attributes match (except value)
    expect(loginCookie.name).toBe(managerCookie.name)
    expect(loginCookie.httpOnly).toBe(managerCookie.httpOnly)
    expect(loginCookie.secure).toBe(managerCookie.secure) // CRITICAL
    expect(loginCookie.sameSite).toBe(managerCookie.sameSite) // CRITICAL
    expect(loginCookie.path).toBe(managerCookie.path)

    // Login should set a secure token (not "1")
    expect(loginCookie.value).not.toBe("1")
    expect(loginCookie.value.length).toBeGreaterThan(20)

    // Logout should clear value
    expect(managerCookie.value).toBe("")
  })

  /**
   * COOKIE CONFIGURATION CONSISTENCY TEST (DEVELOPMENT)
   * Same test for development environment
   */
  it("should set manager cookie with attributes matching logout (DEVELOPMENT)", async () => {
    vi.stubEnv("NODE_ENV", "development")

    const loginReq = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wachtwoord" }),
    })

    const loginRes = await loginManagerPOST(loginReq)
    const loginSetCookie = loginRes.headers.get("set-cookie")

    if (!loginSetCookie) {
      throw new Error("Manager login didn't set cookie")
    }

    const loginCookie = parseCookieHeader(loginSetCookie)

    // Get logout cookie
    const logoutReq = createMockNextRequest("http://localhost/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const logoutRes = await logoutPOST(logoutReq)
    const logoutSetCookie = logoutRes.headers.get("set-cookie")

    if (!logoutSetCookie) {
      throw new Error("Logout didn't set cookies")
    }

    const logoutCookieStrings = splitSetCookieHeaders(logoutSetCookie)
    const logoutCookies = logoutCookieStrings.map(parseCookieHeader)
    const managerCookie = logoutCookies.find(c => c.name === COOKIE_NAMES.MANAGER_SESSION)

    if (!managerCookie) {
      throw new Error(`Logout didn't clear ${COOKIE_NAMES.MANAGER_SESSION}`)
    }

    // Assert attributes match
    expect(loginCookie.httpOnly).toBe(managerCookie.httpOnly)
    expect(loginCookie.secure).toBe(managerCookie.secure)
    expect(loginCookie.sameSite).toBe(managerCookie.sameSite)
    expect(loginCookie.path).toBe(managerCookie.path)
  })

  /**
   * SECURE FLAG TEST
   * In deployed server: secure=true, in local dev: secure=false
   * Cookie implementation uses ALIVE_ENV (not NODE_ENV)
   */
  it("should set secure flag based on ALIVE_ENV", async () => {
    // Deployed server (ALIVE_ENV !== "local"): secure should be TRUE
    vi.stubEnv("ALIVE_ENV", "production")
    let req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wachtwoord" }),
    })
    let res = await loginManagerPOST(req)
    let setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain("Secure")

    // Local development (ALIVE_ENV === "local"): secure should be FALSE
    vi.stubEnv("ALIVE_ENV", "local")
    req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wachtwoord" }),
    })
    res = await loginManagerPOST(req)
    setCookie = res.headers.get("set-cookie")
    expect(setCookie).not.toContain("Secure")
  })

  /**
   * CORS HEADERS TEST
   * Should include CORS headers in response
   * Requires DOMAINS.APP_PROD — skipped in CI (no server-config.json)
   */
  it.skipIf(!DOMAINS.APP_PROD)("should include CORS headers", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wachtwoord" }),
    })

    const res = await loginManagerPOST(req)

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(DOMAINS.APP_PROD)
  })

  /**
   * MALFORMED JSON TEST
   * Should handle malformed JSON gracefully
   */
  it("should handle malformed JSON", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    })

    const res = await loginManagerPOST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })
})

describe("OPTIONS /api/login-manager", () => {
  /**
   * CORS PREFLIGHT TEST
   * OPTIONS should return 200 with CORS headers
   * Requires DOMAINS.APP_PROD — skipped in CI (no server-config.json)
   */
  it.skipIf(!DOMAINS.APP_PROD)("should handle CORS preflight requests", async () => {
    const req = createMockNextRequest("http://localhost/api/login-manager", {
      method: "OPTIONS",
    })

    const res = await loginManagerOPTIONS(req)

    expect(res.status).toBe(204)
    expect(res.headers.has("Access-Control-Allow-Origin")).toBe(true)
  })
})
