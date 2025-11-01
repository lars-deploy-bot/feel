import { vi } from "vitest"

process.env.TZ = "UTC"
process.env.BRIDGE_ENV = "local"

if (process.env.CI) {
  process.env.FORCE_COLOR = "0"
}

vi.mock("@anthropic-ai/claude-agent-sdk", async () => {
  const actual = await vi.importActual("@anthropic-ai/claude-agent-sdk")
  return {
    ...actual,
    query: vi.fn(() => {
      throw new Error(
        "🚨 Anthropic SDK query() called in test without mocking!\n" +
          "This would make a REAL API call and cost money.\n\n" +
          "To fix this:\n" +
          "1. Mock the API response in your test\n" +
          "2. Or use route mocking for e2e tests (Playwright)\n" +
          "3. Never call real Anthropic API in unit tests",
      )
    }),
  }
})
