import type { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"
import { REQUEST_ID_HEADER } from "@/lib/request-id"
import { middleware } from "../middleware"

interface ResponseWithInjected extends Response {
  __injectedRequestHeaders?: Headers
}

/**
 * Build a minimal NextRequest-like object for testing middleware.
 * Adds nextUrl with pathname since middleware accesses request.nextUrl.pathname.
 */
function buildRequest(url: string, headers?: Record<string, string>): NextRequest {
  const req = new Request(url, { headers })
  const parsed = new URL(url)
  Object.defineProperty(req, "nextUrl", { value: parsed, writable: false })
  return req as unknown as NextRequest
}

// Capture what NextResponse.next() receives so we can inspect request header injection.
// The mock must support both `new NextResponse(body, init)` (used for 404 blocks)
// and `NextResponse.next()` (used for pass-through with injected headers).
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")

  class MockNextResponse extends Response {
    __injectedRequestHeaders?: Headers

    static next(init?: { request?: { headers?: Headers } }) {
      const res = new MockNextResponse(null, { status: 200 })
      res.__injectedRequestHeaders = init?.request?.headers
      return res as unknown as ReturnType<typeof actual.NextResponse.next>
    }
  }

  return {
    ...actual,
    NextResponse: MockNextResponse,
  }
})

describe("request-id middleware", () => {
  it("generates a UUID when no X-Request-Id is provided", () => {
    const req = buildRequest("http://localhost/api/test")
    const res = middleware(req)

    const id = res.headers.get(REQUEST_ID_HEADER)
    expect(id).toBeTruthy()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it("preserves an incoming X-Request-Id", () => {
    const req = buildRequest("http://localhost/api/test", {
      "x-request-id": "caller-supplied-id",
    })
    const res = middleware(req)

    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("caller-supplied-id")
  })

  it("sets X-Request-Id on the response", () => {
    const req = buildRequest("http://localhost/api/test")
    const res = middleware(req)

    expect(res.headers.has(REQUEST_ID_HEADER)).toBe(true)
  })

  it("exposes X-Request-Id via Access-Control-Expose-Headers", () => {
    const req = buildRequest("http://localhost/api/test")
    const res = middleware(req)

    const expose = res.headers.get("access-control-expose-headers")
    expect(expose).toContain("X-Request-Id")
  })

  it("forwards the request ID to route handlers via request headers", () => {
    const req = buildRequest("http://localhost/api/test", {
      "x-request-id": "forward-me",
    })
    const res = middleware(req)

    // The mock stashes injected request headers on __injectedRequestHeaders
    const injected = (res as unknown as ResponseWithInjected).__injectedRequestHeaders
    expect(injected).toBeDefined()
    expect(injected!.get(REQUEST_ID_HEADER)).toBe("forward-me")
  })

  it("response and injected request IDs match", () => {
    const req = buildRequest("http://localhost/api/test")
    const res = middleware(req)

    const responseId = res.headers.get(REQUEST_ID_HEADER)
    const injected = (res as unknown as ResponseWithInjected).__injectedRequestHeaders
    expect(injected!.get(REQUEST_ID_HEADER)).toBe(responseId)
  })
})

describe("security headers", () => {
  it("sets Content-Security-Policy-Report-Only on responses", () => {
    const req = buildRequest("http://localhost/chat")
    const res = middleware(req)

    const csp = res.headers.get("content-security-policy-report-only")
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it("includes connect-src with wss: for streaming", () => {
    const req = buildRequest("http://localhost/chat")
    const res = middleware(req)

    const csp = res.headers.get("content-security-policy-report-only")
    expect(csp).toContain("connect-src 'self' wss: https:")
  })

  it("derives frame-src from NEXT_PUBLIC_PREVIEW_BASE", () => {
    const originalEnv = process.env.NEXT_PUBLIC_PREVIEW_BASE
    process.env.NEXT_PUBLIC_PREVIEW_BASE = "example.com"
    try {
      const req = buildRequest("http://localhost/chat")
      const res = middleware(req)

      const csp = res.headers.get("content-security-policy-report-only")
      expect(csp).toContain("frame-src 'self' *.example.com")
    } finally {
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_PREVIEW_BASE = originalEnv
      } else {
        delete process.env.NEXT_PUBLIC_PREVIEW_BASE
      }
    }
  })

  it("falls back to self-only frame-src when NEXT_PUBLIC_PREVIEW_BASE is unset", () => {
    const originalEnv = process.env.NEXT_PUBLIC_PREVIEW_BASE
    delete process.env.NEXT_PUBLIC_PREVIEW_BASE
    try {
      const req = buildRequest("http://localhost/chat")
      const res = middleware(req)

      const csp = res.headers.get("content-security-policy-report-only")
      expect(csp).toContain("frame-src 'self'")
      expect(csp).not.toContain("frame-src 'self' *.")
    } finally {
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_PREVIEW_BASE = originalEnv
      }
    }
  })

  it("does not set CSP on API routes", () => {
    const req = buildRequest("http://localhost/api/user")
    const res = middleware(req)

    expect(res.headers.get("content-security-policy-report-only")).toBeNull()
  })
})

describe("internal API blocking (#310)", () => {
  const internalPaths = [
    "/api/internal/automation/trigger",
    "/api/internal-tools/read-logs",
    "/api/internal-tools/switch-serve-mode",
  ]

  for (const path of internalPaths) {
    it(`blocks proxied request to ${path} with 404`, async () => {
      // Simulate external request that went through Caddy (has X-Forwarded-For)
      const req = buildRequest(`http://localhost${path}`, {
        "x-forwarded-for": "203.0.113.42",
      })
      const res = middleware(req)

      expect(res.status).toBe(404)
      expect(await res.text()).toBe("Not Found")
    })

    it(`allows direct localhost request to ${path}`, () => {
      // Simulate internal request from worker/MCP tools (no X-Forwarded-For)
      const req = buildRequest(`http://localhost${path}`)
      const res = middleware(req)

      // Should pass through to route handler (200 from NextResponse.next())
      expect(res.status).toBe(200)
    })
  }

  it("does not block non-internal API routes with X-Forwarded-For", () => {
    const req = buildRequest("http://localhost/api/templates", {
      "x-forwarded-for": "203.0.113.42",
    })
    const res = middleware(req)

    expect(res.status).toBe(200)
  })
})
