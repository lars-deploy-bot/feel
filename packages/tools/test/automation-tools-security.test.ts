import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalPort = process.env.PORT
const originalSessionCookie = process.env.ALIVE_SESSION_COOKIE
const mockFetch = vi.fn()

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("automation tools runtime validation", { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    vi.stubGlobal("fetch", mockFetch)
    process.env.PORT = "1234"
    process.env.ALIVE_SESSION_COOKIE = "session-token"
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

  it("rejects invalid create_automation params before calling the API", async () => {
    const { createAutomation } = await import("../src/tools/automations/create-automation.js")

    // Deliberately invalid params: "webhook" is not a valid trigger_type.
    // Pass through JSON round-trip to bypass compile-time type checking.
    const invalidParams: Record<string, unknown> = {
      site_id: "site_1",
      name: "Bad automation",
      trigger_type: "webhook",
      action_type: "prompt",
      action_prompt: "Do something",
    }
    const result = await createAutomation(JSON.parse(JSON.stringify(invalidParams)))

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("Invalid automation configuration")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("rejects invalid trigger_automation ids before URL construction", async () => {
    const { triggerAutomation } = await import("../src/tools/automations/trigger-automation.js")

    // Deliberately invalid: path traversal in automation_id.
    // Pass through JSON round-trip to bypass compile-time type checking.
    const invalidParams: Record<string, unknown> = { automation_id: "../../etc/passwd" }
    const result = await triggerAutomation(JSON.parse(JSON.stringify(invalidParams)))

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("Invalid automation ID")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("checks site ownership before applying a site_id filter in list_automations", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/api/sites")) {
        return jsonResponse({
          ok: true,
          sites: [{ id: "site_owned", hostname: "owned.test.example", org_id: "org_1" }],
        })
      }

      if (url.includes("/api/automations")) {
        return jsonResponse({ ok: true, automations: [], total: 0 })
      }

      return new Response(JSON.stringify({ ok: false }), { status: 404 })
    })

    const { listAutomations } = await import("../src/tools/automations/list-automations.js")

    const result = await listAutomations({ site_id: "site_foreign" })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("site_id is not accessible")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain("/api/sites")
  })

  it("accepts hostname filters and resolves them to a site_id query", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/api/sites")) {
        return jsonResponse({
          ok: true,
          sites: [{ id: "site_owned", hostname: "owned.test.example", org_id: "org_1" }],
        })
      }

      if (url.includes("/api/automations?site_id=site_owned")) {
        return jsonResponse({ ok: true, automations: [], total: 0 })
      }

      return new Response(JSON.stringify({ ok: false }), { status: 404 })
    })

    const { listAutomations } = await import("../src/tools/automations/list-automations.js")

    const result = await listAutomations({ site_id: "owned.test.example" })

    expect(result.isError).toBe(false)
    expect(result.content[0]?.text).toContain("No automations found")
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("/api/automations?site_id=site_owned")
  })
})
