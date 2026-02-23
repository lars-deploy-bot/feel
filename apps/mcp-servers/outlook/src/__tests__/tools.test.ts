/**
 * Outlook MCP Tools Tests
 *
 * Tests for tool contracts, compose payload shape, input validation, and error handling.
 */

import { describe, expect, it } from "vitest"
import { OutlookClient } from "../outlook-client.js"
import { executeTool, tools } from "../tools/index.js"

// ============================================================
// Tool Listing
// ============================================================

describe("tool definitions", () => {
  it("exposes the expected tool names", () => {
    const names = tools.map(t => t.name)
    expect(names).toEqual([
      "compose_email",
      "get_profile",
      "search_emails",
      "get_email",
      "list_folders",
      "move_to_folder",
      "archive_email",
      "mark_as_read",
      "mark_as_unread",
      "trash_email",
    ])
  })

  it("every tool has a description and inputSchema", () => {
    for (const tool of tools) {
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe("object")
    }
  })

  it("does NOT expose send_email or create_draft tools", () => {
    const names = tools.map(t => t.name)
    expect(names).not.toContain("send_email")
    expect(names).not.toContain("create_draft")
  })
})

// ============================================================
// Compose Email — Payload Contract
// ============================================================

describe("compose_email", () => {
  // compose_email doesn't hit the Graph API, so a dummy client is fine
  function dummyClient(): OutlookClient {
    return new OutlookClient("fake-token")
  }

  it("returns the correct payload shape", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "alice@example.com",
      subject: "Hello",
      body: "Hi Alice",
    })

    expect(result.isError).toBeUndefined()
    const payload = JSON.parse(result.content[0].text)
    expect(payload).toEqual({
      to: ["alice@example.com"],
      subject: "Hello",
      body: "Hi Alice",
      status: "draft",
    })
  })

  it("includes cc, bcc, and threadId when provided", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "alice@example.com",
      subject: "Re: Hello",
      body: "Following up",
      cc: "bob@example.com, charlie@example.com",
      bcc: "secret@example.com",
      threadId: "conv-123",
    })

    const payload = JSON.parse(result.content[0].text)
    expect(payload.to).toEqual(["alice@example.com"])
    expect(payload.cc).toEqual(["bob@example.com", "charlie@example.com"])
    expect(payload.bcc).toEqual(["secret@example.com"])
    expect(payload.threadId).toBe("conv-123")
    expect(payload.status).toBe("draft")
  })

  it("omits cc/bcc/threadId when not provided", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "alice@example.com",
      subject: "Test",
      body: "Body",
    })

    const payload = JSON.parse(result.content[0].text)
    expect(payload.cc).toBeUndefined()
    expect(payload.bcc).toBeUndefined()
    expect(payload.threadId).toBeUndefined()
  })

  it("splits multiple comma-separated recipients", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "a@x.com, b@x.com, c@x.com",
      subject: "Group",
      body: "Hey all",
    })

    const payload = JSON.parse(result.content[0].text)
    expect(payload.to).toEqual(["a@x.com", "b@x.com", "c@x.com"])
  })

  it("validates required fields", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "alice@example.com",
      // missing subject and body
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Error")
  })

  it("rejects empty recipient list after splitting", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: ",",
      subject: "Test",
      body: "Body",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("recipient")
  })

  it("rejects whitespace-only recipient", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "  ,  ,  ",
      subject: "Test",
      body: "Body",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("recipient")
  })

  it("rejects invalid email addresses", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "notanemail",
      subject: "Test",
      body: "Body",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Invalid email")
    expect(result.content[0].text).toContain("notanemail")
  })

  it("rejects mixed valid and invalid emails", async () => {
    const result = await executeTool(dummyClient(), "compose_email", {
      to: "valid@example.com, bad-addr, also@ok.com",
      subject: "Test",
      body: "Body",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("bad-addr")
  })
})

// ============================================================
// Unknown Tool
// ============================================================

describe("unknown tool", () => {
  it("returns isError for unrecognized tool names", async () => {
    const client = new OutlookClient("fake-token")
    const result = await executeTool(client, "nonexistent_tool", {})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Unknown tool: nonexistent_tool")
  })
})

// ============================================================
// Graph API error propagation
// ============================================================

describe("error propagation", () => {
  function mockFetch(impl: (...args: unknown[]) => unknown) {
    const originalFetch = globalThis.fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = impl as typeof fetch
    return () => {
      globalThis.fetch = originalFetch
    }
  }

  it("wraps Graph API errors in isError response", async () => {
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid token"),
      }),
    )

    try {
      const client = new OutlookClient("expired-token")
      const result = await executeTool(client, "get_profile", {})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("401")
    } finally {
      restore()
    }
  })

  it("wraps network errors in isError response", async () => {
    const restore = mockFetch(() => Promise.reject(new Error("Network failure")))

    try {
      const client = new OutlookClient("token")
      const result = await executeTool(client, "search_emails", { query: "test" })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Network failure")
    } finally {
      restore()
    }
  })
})

// ============================================================
// Input validation
// ============================================================

describe("input validation", () => {
  it("search_emails requires query", async () => {
    const client = new OutlookClient("fake-token")
    const result = await executeTool(client, "search_emails", {})

    expect(result.isError).toBe(true)
  })

  it("get_email requires messageId", async () => {
    const client = new OutlookClient("fake-token")
    const result = await executeTool(client, "get_email", {})

    expect(result.isError).toBe(true)
  })

  it("move_to_folder requires messageId and folderId", async () => {
    const client = new OutlookClient("fake-token")
    const result = await executeTool(client, "move_to_folder", { messageId: "abc" })

    expect(result.isError).toBe(true)
  })
})
