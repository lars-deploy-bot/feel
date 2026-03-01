import { describe, expect, it } from "vitest"
import { type CorsDomainsConfig, checkGetAllowedOrigin, checkOriginAllowed } from "../cors"

// Server 1: alive.best is both main and wildcard
const server1: CorsDomainsConfig = { main: "alive.best", wildcard: "alive.best" }

// Server 2: sonno.tech is main, alive.best is wildcard
const server2: CorsDomainsConfig = { main: "sonno.tech", wildcard: "alive.best" }

describe("checkOriginAllowed (server 1: alive.best)", () => {
  const check = (origin: string) => checkOriginAllowed(origin, server1)

  it("allows https://app.alive.best", () => {
    expect(check("https://app.alive.best")).toBe(true)
  })

  it("allows https://staging.alive.best", () => {
    expect(check("https://staging.alive.best")).toBe(true)
  })

  it("allows https://anything.alive.best", () => {
    expect(check("https://anything.alive.best")).toBe(true)
  })

  it("allows https://alive.best (bare domain)", () => {
    expect(check("https://alive.best")).toBe(true)
  })

  it("allows http://alive.best (bare domain, http)", () => {
    expect(check("http://alive.best")).toBe(true)
  })

  it("rejects https://evil.com", () => {
    expect(check("https://evil.com")).toBe(false)
  })

  it("rejects https://notalive.best (partial domain match)", () => {
    expect(check("https://notalive.best")).toBe(false)
  })

  it("rejects origin containing domain as substring in attacker domain", () => {
    expect(check("https://evil.com.alive.best.attacker.com")).toBe(false)
  })

  it("rejects origin with domain as prefix of attacker domain", () => {
    expect(check("https://alive.best.evil.com")).toBe(false)
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

describe("checkOriginAllowed (server 2: sonno.tech + alive.best)", () => {
  const check = (origin: string) => checkOriginAllowed(origin, server2)

  it("allows https://app.alive.best (wildcard)", () => {
    expect(check("https://app.alive.best")).toBe(true)
  })

  it("allows https://app.sonno.tech (main)", () => {
    expect(check("https://app.sonno.tech")).toBe(true)
  })

  it("allows https://sonno.tech (bare main)", () => {
    expect(check("https://sonno.tech")).toBe(true)
  })

  it("allows https://staging.sonno.tech", () => {
    expect(check("https://staging.sonno.tech")).toBe(true)
  })

  it("rejects https://notsonno.tech", () => {
    expect(check("https://notsonno.tech")).toBe(false)
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
    const config: CorsDomainsConfig = { main: "alive.best", wildcard: "" }
    expect(checkOriginAllowed("https://app.alive.best", config)).toBe(true)
    expect(checkOriginAllowed("https://evil.com", config)).toBe(false)
  })

  it("handles empty main gracefully", () => {
    const config: CorsDomainsConfig = { main: "", wildcard: "alive.best" }
    expect(checkOriginAllowed("https://app.alive.best", config)).toBe(true)
    expect(checkOriginAllowed("https://evil.com", config)).toBe(false)
  })

  it("handles both empty (test/browser env)", () => {
    const config: CorsDomainsConfig = { main: "", wildcard: "" }
    expect(checkOriginAllowed("http://localhost:3000", config)).toBe(true)
    expect(checkOriginAllowed("https://anything.com", config)).toBe(false)
  })

  it("rejects origin with port on allowed domain", () => {
    expect(checkOriginAllowed("https://alive.best:8080", server1)).toBe(false)
  })

  it("allows origin with trailing slash (path ignored by URL parser)", () => {
    expect(checkOriginAllowed("https://alive.best/", server1)).toBe(true)
  })

  it("allows origin with path component (path ignored by URL parser)", () => {
    expect(checkOriginAllowed("https://alive.best/some-path", server1)).toBe(true)
  })

  it("rejects ftp:// scheme", () => {
    expect(checkOriginAllowed("ftp://alive.best", server1)).toBe(false)
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
    // correctly extracts "alive.best" regardless
    expect(checkOriginAllowed("https://admin:pass@alive.best", server1)).toBe(true)
  })
})

describe("checkGetAllowedOrigin", () => {
  const fallback = "https://app.alive.best"
  const get = (origin: string | null) => checkGetAllowedOrigin(origin, server1, fallback)

  it("returns the origin when allowed", () => {
    expect(get("https://app.alive.best")).toBe("https://app.alive.best")
  })

  it("returns the origin for allowed subdomain", () => {
    expect(get("https://staging.alive.best")).toBe("https://staging.alive.best")
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
      "https://alive.best.evil.com",
      "javascript:alert(1)",
      "data:text/html,<h1>xss</h1>",
    ]
    for (const attack of attacks) {
      expect(get(attack)).toBe(fallback)
    }
  })
})
