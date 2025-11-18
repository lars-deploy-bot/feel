import { AsyncLocalStorage } from "node:async_hooks"
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

// AsyncLocalStorage for test request context
const testRequestContext = new AsyncLocalStorage<Request>()

// Export function to run code with request context
export function runWithRequestContext<T>(request: Request, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(testRequestContext.run(request, fn))
}

// Helper to parse cookie strings
function parseCookies(cookieString: string) {
  const cookies = new Map<string, string>()
  for (const pair of cookieString.split(";")) {
    const [key, ...values] = pair.trim().split("=")
    if (key) {
      cookies.set(key, values.join("="))
    }
  }
  return cookies
}

// Mock Next.js cookies() to read from AsyncLocalStorage
vi.mock("next/headers", () => {
  return {
    cookies: async () => {
      const request = testRequestContext.getStore()
      const cookieHeader = request?.headers?.get("cookie") || ""
      const cookieMap = parseCookies(cookieHeader)

      return {
        getAll: () => Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value })),
        get: (name: string) => {
          const value = cookieMap.get(name)
          return value ? { name, value } : undefined
        },
        set: () => {},
        delete: () => {},
      }
    },
    headers: async () => {
      const request = testRequestContext.getStore()
      return {
        get: (name: string) => request?.headers?.get(name) || null,
        has: (name: string) => request?.headers?.has(name) || false,
        entries: () => request?.headers?.entries() || [],
      }
    },
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
