import { vi } from "vitest"

process.env.TZ = "UTC"
process.env.BRIDGE_ENV = "local"

// Mock Supabase credentials for tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test.supabase.co"
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key"

if (process.env.CI) {
  process.env.FORCE_COLOR = "0"
}

// Mock Next.js cookies() to prevent "called outside request scope" errors
vi.mock("next/headers", async () => {
  return {
    cookies: async () => ({
      getAll: () => [],
      get: () => undefined,
      set: () => {},
      delete: () => {},
    }),
    headers: async () => ({
      get: () => null,
      has: () => false,
      entries: () => [],
    }),
  }
})

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
