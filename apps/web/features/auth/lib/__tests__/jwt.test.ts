import { describe, expect, it as test } from "vitest"
import { createSessionToken, verifySessionToken } from "../jwt"

describe("JWT Session Token", () => {
  test("creates valid token with userId", () => {
    const token = createSessionToken("user-123")
    expect(token).toBeTruthy()
    expect(typeof token).toBe("string")
    expect(token.split(".").length).toBe(3) // JWT has 3 parts
  })

  test("verifies valid token and extracts userId", () => {
    const userId = "test-user-456"
    const token = createSessionToken(userId)
    const payload = verifySessionToken(token)

    expect(payload).toBeTruthy()
    expect(payload?.userId).toBe(userId)
    expect(payload?.iat).toBeTruthy() // issued at
    expect(payload?.exp).toBeTruthy() // expires at
  })

  test("rejects tampered token", () => {
    const token = createSessionToken("user-123")

    // Tamper with token by modifying the payload part
    const parts = token.split(".")
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: "hacker-456" })).toString("base64url")
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

    const payload = verifySessionToken(tamperedToken)
    expect(payload).toBeNull() // Should reject tampered token
  })

  test("rejects invalid token", () => {
    const payload = verifySessionToken("invalid.jwt.token")
    expect(payload).toBeNull()
  })

  test("rejects malformed token", () => {
    const payload = verifySessionToken("not-a-jwt")
    expect(payload).toBeNull()
  })

  test("handles special characters in userId", () => {
    const userId = "user-with-uuid-550e8400-e29b-41d4-a716-446655440000"
    const token = createSessionToken(userId)
    const payload = verifySessionToken(token)

    expect(payload?.userId).toBe(userId)
  })

  test("rejects empty userId", () => {
    const token = createSessionToken("")
    const payload = verifySessionToken(token)

    // Empty userId is rejected at JWT level for security
    expect(payload).toBeNull()
  })

  test("token expires after 30 days", () => {
    const token = createSessionToken("user-123")
    const payload = verifySessionToken(token)

    expect(payload?.exp).toBeTruthy()
    if (payload?.exp && payload?.iat) {
      const expiresIn = payload.exp - payload.iat
      // 30 days = 2592000 seconds
      expect(expiresIn).toBe(2592000)
    }
  })
})
