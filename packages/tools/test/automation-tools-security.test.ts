import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalPort = process.env.PORT
const originalSessionCookie = process.env.ALIVE_SESSION_COOKIE
const mockFetch = vi.fn()

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response
}

describe("automation tools runtime validation", { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    global.fetch = mockFetch as typeof fetch
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

    const result = await createAutomation({
      site_id: "site_1",
      name: "Bad automation",
      trigger_type: "webhook",
      action_type: "prompt",
      action_prompt: "Do something",
    } as never)

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("Invalid automation configuration")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("rejects invalid trigger_automation ids before URL construction", async () => {
    const { triggerAutomation } = await import("../src/tools/automations/trigger-automation.js")

    const result = await triggerAutomation({
      automation_id: "../../etc/passwd",
    } as never)

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
          sites: [{ id: "site_owned", hostname: "owned.alive.best", org_id: "org_1" }],
        })
      }

      if (url.includes("/api/automations")) {
        return jsonResponse({ ok: true, automations: [], total: 0 })
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ ok: false }),
      } as Response
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
          sites: [{ id: "site_owned", hostname: "owned.alive.best", org_id: "org_1" }],
        })
      }

      if (url.includes("/api/automations?site_id=site_owned")) {
        return jsonResponse({ ok: true, automations: [], total: 0 })
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ ok: false }),
      } as Response
    })

    const { listAutomations } = await import("../src/tools/automations/list-automations.js")

    const result = await listAutomations({ site_id: "owned.alive.best" })

    expect(result.isError).toBe(false)
    expect(result.content[0]?.text).toContain("No automations found")
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("/api/automations?site_id=site_owned")
  })
})
