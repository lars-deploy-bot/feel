import { describe, expect, it } from "vitest"
import { redactTokens } from "../redact-tokens"

describe("redactTokens", () => {
  it("redacts gho_ tokens (OAuth)", () => {
    const token = `gho_${["abc123", "XYZ"].join("")}`
    const input = `fatal: Authentication failed for 'https://github.com/user/repo.git' token: ${token}`
    expect(redactTokens(input)).toBe(
      "fatal: Authentication failed for 'https://github.com/user/repo.git' token: [REDACTED]",
    )
  })

  it("redacts ghp_ tokens (personal access)", () => {
    const token = `ghp_${"myPersonalAccessToken123"}`
    expect(redactTokens(`Using ${token} for auth`)).toBe("Using [REDACTED] for auth")
  })

  it("redacts ghs_ tokens (server-to-server)", () => {
    const token = `ghs_${"serverToken456"}`
    expect(redactTokens(token)).toBe("[REDACTED]")
  })

  it("redacts ghu_ tokens (user-to-server)", () => {
    const token = `ghu_${"userToken789"}`
    expect(redactTokens(`auth ${token}`)).toBe("auth [REDACTED]")
  })

  it("redacts github_pat_ tokens", () => {
    const token = `github_pat_${"longTokenValue_here"}`
    expect(redactTokens(token)).toBe("[REDACTED]")
  })

  it("redacts x-access-token in URLs", () => {
    const token = `gho_${["secret", "123"].join("")}`
    const input = `fatal: unable to access 'https://x-access-token:${token}@github.com/user/repo.git/'`
    const result = redactTokens(input)
    expect(result).not.toContain(token)
    expect(result).toContain("x-access-token:[REDACTED]@")
  })

  it("redacts X-ACCESS-TOKEN in URLs (case-insensitive)", () => {
    const token = `ghp_${["token", "123"].join("")}`
    const input = `fatal: unable to access 'https://X-ACCESS-TOKEN:${token}@github.com/user/repo.git/'`
    const result = redactTokens(input)
    expect(result).not.toContain(token)
    expect(result).toContain("x-access-token:[REDACTED]@")
  })

  it("redacts multiple tokens in same string", () => {
    const result = redactTokens(`token1: gho_${"abc"} token2: ghp_${"def"}`)
    expect(result).toBe("token1: [REDACTED] token2: [REDACTED]")
  })

  it("does not modify strings without tokens", () => {
    const input = "Everything up-to-date\nTo https://github.com/user/repo.git\n  abc123..def456 main -> main"
    expect(redactTokens(input)).toBe(input)
  })

  it("handles empty string", () => {
    expect(redactTokens("")).toBe("")
  })
})
