import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { getClientIdentifier } from "../client-identifier"

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/test", {
    method: "GET",
    headers,
  })
}

describe("getClientIdentifier", () => {
  it("uses first x-forwarded-for entry as client IP", () => {
    const req = createRequest({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.7",
    })

    expect(getClientIdentifier(req, "login:ip")).toBe("login:ip:203.0.113.10")
  })

  it("falls back to cf-connecting-ip when x-forwarded-for is absent", () => {
    const req = createRequest({
      "cf-connecting-ip": "203.0.113.20",
    })

    expect(getClientIdentifier(req, "login:ip")).toBe("login:ip:203.0.113.20")
  })

  it("falls back to x-real-ip when no forwarded header is present", () => {
    const req = createRequest({
      "x-real-ip": "198.51.100.30",
    })

    expect(getClientIdentifier(req, "login:ip")).toBe("login:ip:198.51.100.30")
  })

  it("does not use host header as IP fallback", () => {
    const req = createRequest({
      host: "staging.alive.best",
    })

    expect(getClientIdentifier(req, "login:ip")).toBe("login:ip:unknown")
  })
})
