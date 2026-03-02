import { COOKIE_NAMES } from "@webalive/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalPort = process.env.PORT
const originalSessionCookie = process.env.ALIVE_SESSION_COOKIE
const mockFetch = vi.fn()

function readHeader(requestInit: RequestInit | undefined, headerName: string): string | null {
  const headers = requestInit?.headers
  if (!headers) return null

  const normalized = headerName.toLowerCase()

  if (headers instanceof Headers) {
    return headers.get(headerName)
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === normalized)
    return match?.[1] ?? null
  }

  const record = headers as Record<string, string>
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === normalized) {
      return value
    }
  }

  return null
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response
}

describe("tools-api", () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    global.fetch = mockFetch as typeof fetch
    process.env.PORT = "1234"
    process.env.ALIVE_SESSION_COOKIE = "session-a"
  })

  afterEach(() => {
    if (originalPort !== undefined) {
      process.env.PORT = originalPort
    } else {
      delete process.env.PORT
    }

    if (originalSessionCookie !== undefined) {
      process.env.ALIVE_SESSION_COOKIE = originalSessionCookie
    } else {
      delete process.env.ALIVE_SESSION_COOKIE
    }

    vi.clearAllMocks()
  })

  it("enforces narrowed automations/create schema for MCP tools", async () => {
    const { validateToolsRequest } = await import("../src/lib/tools-api.js")

    expect(() =>
      validateToolsRequest("automations/create", {
        site_id: "site_1",
        name: "My automation",
        trigger_type: "webhook",
        action_type: "prompt",
      }),
    ).toThrow()

    expect(() =>
      validateToolsRequest("automations/create", {
        site_id: "site_1",
        name: "My automation",
        trigger_type: "cron",
        action_type: "sync",
      }),
    ).toThrow()

    expect(() =>
      validateToolsRequest("automations/create", {
        site_id: "site_1",
        name: "My automation",
        trigger_type: "cron",
        action_type: "prompt",
        action_prompt: "Do the thing",
      }),
    ).not.toThrow()
  })

  it("maps automations/create schema key to POST /api/automations", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        ok: true,
        automation: {
          id: "auto_1",
          name: "Daily sync",
          site_id: "site_1",
          trigger_type: "cron",
          cron_schedule: "0 9 * * *",
          cron_timezone: "UTC",
          run_at: null,
          is_active: true,
          next_run_at: null,
        },
      }),
    )

    const { api, validateToolsRequest } = await import("../src/lib/tools-api.js")
    const validated = validateToolsRequest("automations/create", {
      site_id: "site_1",
      name: "Daily sync",
      trigger_type: "cron",
      action_type: "prompt",
      action_prompt: "Do it",
      cron_schedule: "0 9 * * *",
      cron_timezone: "UTC",
      run_at: null,
      action_model: null,
      skills: [],
      is_active: true,
    })

    await api().postty("automations/create", validated)

    const calledUrl = String(mockFetch.mock.calls[0]?.[0] ?? "")
    expect(calledUrl).toBe("http://localhost:1234/api/automations")
  })

  it("rebuilds the typed client when ALIVE_SESSION_COOKIE changes", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, sites: [] }))

    const { api } = await import("../src/lib/tools-api.js")

    await api().getty("sites")
    process.env.ALIVE_SESSION_COOKIE = "session-b"
    await api().getty("sites")

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const firstCookie = readHeader(mockFetch.mock.calls[0]?.[1] as RequestInit, "Cookie")
    const secondCookie = readHeader(mockFetch.mock.calls[1]?.[1] as RequestInit, "Cookie")

    expect(firstCookie).toBe(`${COOKIE_NAMES.SESSION}=session-a`)
    expect(secondCookie).toBe(`${COOKIE_NAMES.SESSION}=session-b`)
  })

  it("requires a `path` field on every schema key containing a slash", async () => {
    // Guard against #234: schema keys with "/" get turned into URL paths by default,
    // causing silent 405s. Every such key must have an explicit `path` override.
    // Dynamic-route keys (caller always passes pathOverride) are exempt — add them
    // here with a comment explaining why.
    const dynamicRouteKeys = new Set([
      "automations/trigger", // URL includes automation ID, always needs pathOverride
    ])

    const { toolsSchemas } = await import("../src/lib/tools-api.js")

    const missingPath: string[] = []
    for (const [key, schema] of Object.entries(toolsSchemas)) {
      if (key.includes("/") && !schema.path && !dynamicRouteKeys.has(key)) {
        missingPath.push(key)
      }
    }

    expect(
      missingPath,
      `Schema keys with "/" must have a \`path\` field to prevent URL mismatch bugs (#234): ${missingPath.join(", ")}`,
    ).toEqual([])
  })

  it("drops the Cookie header when ALIVE_SESSION_COOKIE is removed", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, sites: [] }))

    const { api } = await import("../src/lib/tools-api.js")

    await api().getty("sites")
    delete process.env.ALIVE_SESSION_COOKIE
    await api().getty("sites")

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const firstCookie = readHeader(mockFetch.mock.calls[0]?.[1] as RequestInit, "Cookie")
    const secondCookie = readHeader(mockFetch.mock.calls[1]?.[1] as RequestInit, "Cookie")

    expect(firstCookie).toBe(`${COOKIE_NAMES.SESSION}=session-a`)
    expect(secondCookie).toBeNull()
  })
})
