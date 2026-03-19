/**
 * Tests for textToCron — natural language schedule → cron expression.
 *
 * Mocks the Groq API fetch to test parsing logic, validation,
 * timezone handling, and error paths without network calls.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import type { TextToCronResult } from "../text-to-cron"

const FAKE_API_KEY = "gsk_test_key_123"

/** Helper: build a mock Groq API Response */
function groqResponse(content: string, status = 200): Response {
  if (status !== 200) {
    return new Response(`Error ${status}`, { status })
  }
  return Response.json({
    choices: [{ message: { content } }],
  })
}

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

/** Import fresh module per test group to reset module state */
async function importTextToCron() {
  const mod = await import("../text-to-cron")
  return mod.textToCron
}

describe("textToCron", () => {
  test("parses a simple cron-only response", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("0 9 * * 1-5")))
    const textToCron = await importTextToCron()
    const result: TextToCronResult = await textToCron("weekdays at 9am", FAKE_API_KEY)
    expect(result.cron).toBe("0 9 * * 1-5")
    expect(result.timezone).toBeNull()
  })

  test("parses cron + timezone on two lines", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("30 9 * * 1-5\nEurope/Amsterdam")))
    const textToCron = await importTextToCron()
    const result = await textToCron("weekdays at 9:30 amsterdam time", FAKE_API_KEY)
    expect(result.cron).toBe("30 9 * * 1-5")
    expect(result.timezone).toBe("Europe/Amsterdam")
  })

  test("trims whitespace and blank lines", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("  */15 * * * *  \n  \n")))
    const textToCron = await importTextToCron()
    const result = await textToCron("every 15 minutes", FAKE_API_KEY)
    expect(result.cron).toBe("*/15 * * * *")
    expect(result.timezone).toBeNull()
  })

  test("throws on invalid cron expression from LLM", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("not a cron")))
    const textToCron = await importTextToCron()
    await expect(textToCron("something weird", FAKE_API_KEY)).rejects.toThrow()
  })

  test("throws on invalid timezone", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("0 9 * * *\nFake/Timezone")))
    const textToCron = await importTextToCron()
    await expect(textToCron("daily at 9am fake tz", FAKE_API_KEY)).rejects.toThrow(/Invalid timezone/)
  })

  test("throws on empty response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        Response.json({
          choices: [{ message: { content: "" } }],
        }),
      ),
    )
    const textToCron = await importTextToCron()
    await expect(textToCron("test", FAKE_API_KEY)).rejects.toThrow("Empty response")
  })

  test("throws on too many lines (3+)", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("0 9 * * *\nEurope/Amsterdam\nextra line")))
    const textToCron = await importTextToCron()
    await expect(textToCron("daily at 9am", FAKE_API_KEY)).rejects.toThrow("Unexpected format")
  })

  test("throws on Groq API error", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("", 500)))
    const textToCron = await importTextToCron()
    await expect(textToCron("test", FAKE_API_KEY)).rejects.toThrow(/Groq API error/)
  })

  test("sends correct request to Groq", async () => {
    const mockFetch = mock(() => Promise.resolve(groqResponse("0 * * * *")))
    globalThis.fetch = mockFetch
    const textToCron = await importTextToCron()
    await textToCron("every hour", FAKE_API_KEY)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe(`Bearer ${FAKE_API_KEY}`)
    const body = JSON.parse(init.body)
    expect(body.model).toBe("llama-3.3-70b-versatile")
    expect(body.temperature).toBe(0)
    expect(body.messages[1].content).toBe("every hour")
  })

  test("handles \\r\\n line endings", async () => {
    globalThis.fetch = mock(() => Promise.resolve(groqResponse("0 8 * * *\r\nAmerica/New_York")))
    const textToCron = await importTextToCron()
    const result = await textToCron("daily at 8am eastern", FAKE_API_KEY)
    expect(result.cron).toBe("0 8 * * *")
    expect(result.timezone).toBe("America/New_York")
  })
})
