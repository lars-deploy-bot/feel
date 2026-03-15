import { describe, expect, it } from "vitest"
import { type CorsDomainsConfig, checkGetAllowedOrigin, checkOriginAllowed } from "../cors"

// Server 1: test.example is both main and wildcard
const server1: CorsDomainsConfig = { main: "test.example", wildcard: "test.example" }

// Server 2: test.example is main, test.example is wildcard
const server2: CorsDomainsConfig = { main: "test.example", wildcard: "test.example" }

describe("checkOriginAllowed (server 1: test.example)", () => {
  const check = (origin: string) => checkOriginAllowed(origin, server1)

  it("allows https://app.test.example", () => {
    expect(check("https://app.test.example")).toBe(true)
  })

  it("allows https://staging.test.example", () => {
    expect(check("https://staging.test.example")).toBe(true)
  })

  it("allows https://anything.test.example", () => {
    expect(check("https://anything.test.example")).toBe(true)
  })

  it("allows https://test.example (bare domain)", () => {
    expect(check("https://test.example")).toBe(true)
  })

  it("allows http://test.example (bare domain, http)", () => {
    expect(check("http://test.example")).toBe(true)
  })

  it("rejects https://evil.com", () => {
    expect(check("https://evil.com")).toBe(false)
  })

  it("rejects https://nottest.example (partial domain match)", () => {
    expect(check("https://nottest.example")).toBe(false)
  })

  it("rejects origin containing domain as substring in attacker domain", () => {
    expect(check("https://evil.com.test.example.attacker.com")).toBe(false)
  })

  it("rejects origin with domain as prefix of attacker domain", () => {
    expect(check("https://test.example.evil.com")).toBe(false)
  })

  it("allows http://localhost:3000", () => {
    expect(check("http://localhost:3000")).toBe(true)
  })

  it("allows http://127.0.0.1:9000", () => {
    expect(check("http://127.0.0.1:9000")).toBe(true)
  })

  it("allows http://localhost (no port)", () => {
    expect(check("http://localhost")).toBe(true)
  })

  it("allows https://localhost:3000", () => {
    expect(check("https://localhost:3000")).toBe(true)
  })

  it("rejects empty string", () => {
    expect(check("")).toBe(false)
  })

  it("rejects arbitrary https origin (the vulnerability)", () => {
    expect(check("https://attacker.example.com")).toBe(false)
  })

  it("rejects javascript: protocol", () => {
    expect(check("javascript:alert(1)")).toBe(false)
  })

  it("rejects data: protocol", () => {
    expect(check("data:text/html,<h1>hi</h1>")).toBe(false)
  })

  it("rejects null string", () => {
    expect(check("null")).toBe(false)
  })
})

describe("checkOriginAllowed (server 2: test.example + test.example)", () => {
  const check = (origin: string) => checkOriginAllowed(origin, server2)

  it("allows https://app.test.example (wildcard)", () => {
    expect(check("https://app.test.example")).toBe(true)
  })

  it("allows https://app.test.example (main)", () => {
    expect(check("https://app.test.example")).toBe(true)
  })

  it("allows https://test.example (bare main)", () => {
    expect(check("https://test.example")).toBe(true)
  })

  it("allows https://staging.test.example", () => {
    expect(check("https://staging.test.example")).toBe(true)
  })

  it("rejects https://nottest.example", () => {
    expect(check("https://nottest.example")).toBe(false)
  })

  it("rejects https://evil.com", () => {
    expect(check("https://evil.com")).toBe(false)
  })

  it("allows localhost for development", () => {
    expect(check("http://localhost:5080")).toBe(true)
  })
})

describe("checkOriginAllowed edge cases", () => {
  it("handles empty wildcard gracefully", () => {
    const config: CorsDomainsConfig = { main: "test.example", wildcard: "" }
    expect(checkOriginAllowed("https://app.test.example", config)).toBe(true)
    expect(checkOriginAllowed("https://evil.com", config)).toBe(false)
  })

  it("handles empty main gracefully", () => {
    const config: CorsDomainsConfig = { main: "", wildcard: "test.example" }
    expect(checkOriginAllowed("https://app.test.example", config)).toBe(true)
    expect(checkOriginAllowed("https://evil.com", config)).toBe(false)
  })

  it("handles both empty (test/browser env)", () => {
    const config: CorsDomainsConfig = { main: "", wildcard: "" }
    expect(checkOriginAllowed("http://localhost:3000", config)).toBe(true)
    expect(checkOriginAllowed("https://anything.com", config)).toBe(false)
  })

  it("rejects origin with port on allowed domain", () => {
    expect(checkOriginAllowed("https://test.example:8080", server1)).toBe(false)
  })

  it("allows origin with trailing slash (path ignored by URL parser)", () => {
    expect(checkOriginAllowed("https://test.example/", server1)).toBe(true)
  })

  it("allows origin with path component (path ignored by URL parser)", () => {
    expect(checkOriginAllowed("https://test.example/some-path", server1)).toBe(true)
  })

  it("rejects ftp:// scheme", () => {
    expect(checkOriginAllowed("ftp://test.example", server1)).toBe(false)
  })

  it("rejects file:// scheme", () => {
    expect(checkOriginAllowed("file:///etc/passwd", server1)).toBe(false)
  })

  it("rejects malformed URLs", () => {
    expect(checkOriginAllowed("not-a-url", server1)).toBe(false)
    expect(checkOriginAllowed("://missing-scheme", server1)).toBe(false)
    expect(checkOriginAllowed("https://", server1)).toBe(false)
  })

  it("allows origin with userinfo (URL parser extracts hostname correctly)", () => {
    // Browsers never send userinfo in Origin headers, but URL.hostname
    // correctly extracts "test.example" regardless
    expect(checkOriginAllowed("https://admin:pass@test.example", server1)).toBe(true)
  })
})

describe("checkGetAllowedOrigin", () => {
  const fallback = "https://app.test.example"
  const get = (origin: string | null) => checkGetAllowedOrigin(origin, server1, fallback)

  it("returns the origin when allowed", () => {
    expect(get("https://app.test.example")).toBe("https://app.test.example")
  })

  it("returns the origin for allowed subdomain", () => {
    expect(get("https://staging.test.example")).toBe("https://staging.test.example")
  })

  it("returns fallback for disallowed origin", () => {
    expect(get("https://evil.com")).toBe(fallback)
  })

  it("returns fallback for null origin", () => {
    expect(get(null)).toBe(fallback)
  })

  it("returns fallback for empty string", () => {
    expect(get("")).toBe(fallback)
  })

  it("never reflects an untrusted origin", () => {
    const attacks = [
      "https://evil.com",
      "https://test.example.evil.com",
      "javascript:alert(1)",
      "data:text/html,<h1>xss</h1>",
    ]
    for (const attack of attacks) {
      expect(get(attack)).toBe(fallback)
    }
  })
})
