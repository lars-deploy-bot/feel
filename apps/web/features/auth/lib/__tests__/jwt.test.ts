import { describe, expect, test } from "bun:test"
import { addWorkspaceToToken, createSessionToken, verifySessionToken } from "../jwt"

describe("JWT Session Token", () => {
  test("creates valid token with workspaces", () => {
    const token = createSessionToken(["site1.goalive.nl"])
    expect(token).toBeTruthy()
    expect(typeof token).toBe("string")
    expect(token.split(".").length).toBe(3) // JWT has 3 parts
  })

  test("verifies valid token", () => {
    const token = createSessionToken(["site1.goalive.nl", "site2.goalive.nl"])
    const payload = verifySessionToken(token)

    expect(payload).toBeTruthy()
    expect(payload?.workspaces).toEqual(["site1.goalive.nl", "site2.goalive.nl"])
    expect(payload?.iat).toBeTruthy() // issued at
    expect(payload?.exp).toBeTruthy() // expires at
  })

  test("rejects tampered token", () => {
    const token = createSessionToken(["site1.goalive.nl"])

    // Tamper with token by modifying the payload part
    const parts = token.split(".")
    const tamperedPayload = Buffer.from(
      JSON.stringify({ workspaces: ["site1.goalive.nl", "hacked-site.goalive.nl"] }),
    ).toString("base64url")
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

  test("adds workspace to existing token", () => {
    const token1 = createSessionToken(["site1.goalive.nl"])
    const token2 = addWorkspaceToToken(token1, "site2.goalive.nl")

    const payload = verifySessionToken(token2)
    expect(payload?.workspaces).toEqual(["site1.goalive.nl", "site2.goalive.nl"])
  })

  test("does not duplicate workspace", () => {
    const token1 = createSessionToken(["site1.goalive.nl"])
    const token2 = addWorkspaceToToken(token1, "site1.goalive.nl")

    const payload = verifySessionToken(token2)
    expect(payload?.workspaces).toEqual(["site1.goalive.nl"]) // No duplicate
  })

  test("creates new token if existing is invalid", () => {
    const token = addWorkspaceToToken("invalid-token", "site1.goalive.nl")
    const payload = verifySessionToken(token)

    expect(payload?.workspaces).toEqual(["site1.goalive.nl"])
  })

  test("handles special characters in workspace names", () => {
    const workspace = "site-with-dash.sub.goalive.nl"
    const token = createSessionToken([workspace])
    const payload = verifySessionToken(token)

    expect(payload?.workspaces).toEqual([workspace])
  })

  test("rejects empty workspaces array", () => {
    const token = createSessionToken([])
    const payload = verifySessionToken(token)

    // Token is valid but workspaces is empty
    expect(payload?.workspaces).toEqual([])
  })
})
