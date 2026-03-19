import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Browser Tool Tests
 *
 * Tests for the browser tool client that communicates with browser-control service.
 * Focuses on:
 * - Error propagation (HTTP errors reported as isError: true)
 * - Connection failure detection (ECONNREFUSED, Bun-style errors)
 * - Session ID inclusion for isolation
 */

// Mock workspace validator to allow any path
vi.mock("../src/lib/workspace-validator.js", () => ({
  validateWorkspacePath: vi.fn(),
  extractDomainFromWorkspace: vi.fn(() => "example.com"),
}))

import { type BrowserParams, browserAction } from "../src/tools/workspace/browser.js"

const mockFetch = vi.fn()
global.fetch = mockFetch as ReturnType<typeof vi.fn>

describe("browserAction", () => {
  beforeEach(() => {
    mockFetch.mockClear()
    process.env.INTERNAL_TOOLS_SECRET = "test-secret"
  })

  afterEach(() => {
    delete process.env.INTERNAL_TOOLS_SECRET
  })

  describe("error propagation", () => {
    it("status action reports HTTP errors as isError: true", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      })

      const result = await browserAction({ action: "status" } as BrowserParams)
      expect(result.isError).toBe(true)
      expect(result.content[0]).toEqual(
        expect.objectContaining({ type: "text", text: expect.stringContaining("Unauthorized") }),
      )
    })

    it("open action reports HTTP errors as isError: true", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Navigation failed" }),
      })

      const result = await browserAction({ action: "open", path: "/" } as BrowserParams)
      expect(result.isError).toBe(true)
    })

    it("snapshot action reports HTTP errors as isError: true", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "No page loaded" }),
      })

      const result = await browserAction({ action: "snapshot" } as BrowserParams)
      expect(result.isError).toBe(true)
    })

    it("click action reports HTTP errors as isError: true", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "ref is required" }),
      })

      const result = await browserAction({ action: "click", ref: "e1" } as BrowserParams)
      expect(result.isError).toBe(true)
    })

    it("console action reports HTTP errors as isError: true", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Console read failed" }),
      })

      const result = await browserAction({ action: "console" } as BrowserParams)
      expect(result.isError).toBe(true)
    })
  })

  describe("connection failure detection", () => {
    it("detects ECONNREFUSED (Node.js style)", async () => {
      mockFetch.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5061"))

      const result = await browserAction({ action: "status" } as BrowserParams)
      expect(result.isError).toBe(true)
      expect(result.content[0]).toEqual(
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("alive.toml"),
        }),
      )
    })

    it("detects 'Unable to connect' (Bun style)", async () => {
      mockFetch.mockRejectedValue(new Error("Unable to connect. Is the computer able to access the url?"))

      const result = await browserAction({ action: "status" } as BrowserParams)
      expect(result.isError).toBe(true)
      expect(result.content[0]).toEqual(
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("alive.toml"),
        }),
      )
    })

    it("detects 'fetch failed' errors", async () => {
      mockFetch.mockRejectedValue(new TypeError("fetch failed"))

      const result = await browserAction({ action: "status" } as BrowserParams)
      expect(result.isError).toBe(true)
      expect(result.content[0]).toEqual(
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("alive.toml"),
        }),
      )
    })
  })

  describe("session ID isolation", () => {
    it("includes sessionId in POST body for open", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, url: "http://localhost:3333/", title: "Test", status: 200 }),
      })

      await browserAction({ action: "open", path: "/" } as BrowserParams)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.sessionId).toMatch(/^worker-\d+$/)
    })

    it("includes sessionId in POST body for snapshot", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          tree: "- heading",
          refs: {},
          stats: { refs: 0, interactive: 0, lines: 1, chars: 9 },
          url: "http://localhost:3333/",
          title: "Test",
        }),
      })

      await browserAction({ action: "snapshot" } as BrowserParams)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.sessionId).toMatch(/^worker-\d+$/)
    })

    it("includes sessionId in POST body for act", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, action: "click", ref: "e1", url: "http://localhost:3333/" }),
      })

      await browserAction({ action: "click", ref: "e1" } as BrowserParams)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.sessionId).toMatch(/^worker-\d+$/)
    })
  })

  describe("successful responses", () => {
    it("open returns page info on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          url: "http://localhost:3333/about",
          title: "About",
          status: 200,
        }),
      })

      const result = await browserAction({ action: "open", path: "/about" } as BrowserParams)
      expect(result.isError).toBe(false)
      expect(result.content[0]).toEqual(
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("About"),
        }),
      )
    })

    it("status returns data on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ browserConnected: true, activeSessions: 1 }),
      })

      const result = await browserAction({ action: "status" } as BrowserParams)
      expect(result.isError).toBe(false)
      expect(result.content[0]).toEqual(
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("browserConnected"),
        }),
      )
    })
  })
})
