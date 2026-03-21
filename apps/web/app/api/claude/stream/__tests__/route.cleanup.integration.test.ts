import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock Redis-related modules so cancel-intent-registry uses in-memory fallback
vi.mock("@webalive/env/server", () => ({
  getRedisUrl: () => null,
}))

import { ErrorCodes } from "@/lib/error-codes"

// Force in-memory fallback so tests don't hang waiting for Redis
vi.mock("@webalive/env/server", () => ({
  getRedisUrl: () => null,
}))

const requireSessionUserMock = vi.fn()
const verifyWorkspaceAccessMock = vi.fn()
const getSafeSessionCookieMock = vi.fn()
const sessionStoreGetMock = vi.fn()
const fetchOAuthTokensMock = vi.fn()
const fetchUserEnvKeysMock = vi.fn()
const resolveWorkspaceMock = vi.fn()
const getValidAccessTokenMock = vi.fn()
const getOrgCreditsMock = vi.fn()
const createStreamBufferMock = vi.fn()
const errorStreamBufferMock = vi.fn()
const createRLSAppClientMock = vi.fn()
const createAppClientMock = vi.fn()
const createRequestLoggerMock = vi.fn()
const addCorsHeadersMock = vi.fn()

const REQUEST_ID = "req-123"
const USER_ID = "user-1"
const WORKSPACE = "demo.test.example"
const TAB_GROUP_ID = "tab-group-1"
const TAB_ID = "tab-1"

// Force cancel-intent-registry to use in-memory fallback (no Redis in tests)
vi.mock("@webalive/env/server", () => ({
  getRedisUrl: () => null,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

vi.mock("@webalive/shared", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@webalive/shared")
  return {
    ...actual,
    DEFAULTS: Object.assign({}, actual.DEFAULTS, { CLAUDE_MAX_TURNS: 8 }),
    SUPERADMIN: { WORKSPACE_NAME: "alive" },
    WORKER_POOL: { ENABLED: false },
    COOKIE_NAMES: { SESSION: "session" },
    isValidClaudeModel: vi.fn(() => true),
    isRetiredModel: vi.fn(() => false),
  }
})

vi.mock("@webalive/worker-pool", () => ({
  getWorkerPool: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: "session-cookie" })),
  })),
  headers: vi.fn(async () => ({
    get: vi.fn((name: string) => {
      if (name.toLowerCase() === "host") return WORKSPACE
      return null
    }),
  })),
}))

vi.mock("@/features/auth/lib/auth", () => {
  class AuthenticationError extends Error {
    constructor(message = "Authentication required") {
      super(message)
      this.name = "AuthenticationError"
    }
  }

  return {
    AuthenticationError,
    requireSessionUser: () => requireSessionUserMock(),
    verifyWorkspaceAccess: () => verifyWorkspaceAccessMock(),
    getSafeSessionCookie: () => getSafeSessionCookieMock(),
  }
})

vi.mock("@/features/auth/lib/sessionStore", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth/lib/sessionStore")>(
    "@/features/auth/lib/sessionStore",
  )

  return {
    ...actual,
    sessionStore: {
      get: (...args: unknown[]) => sessionStoreGetMock(...args),
      set: vi.fn(),
      delete: vi.fn(),
    },
  }
})

vi.mock("@/features/auth/types/guards", () => ({
  hasSessionCookie: vi.fn(() => true),
}))

vi.mock("@/features/chat/lib/formatMessage", () => ({
  isInputSafeWithDebug: vi.fn(async () => ({ result: "safe", debug: {} })),
}))

vi.mock("@/features/chat/lib/systemPrompt", () => ({
  getSystemPrompt: vi.fn(() => "system prompt"),
}))

vi.mock("@/features/workspace/lib/ensure-workspace-schema", () => ({
  ensureWorkspaceSchema: vi.fn(async () => undefined),
}))

vi.mock("@/features/workspace/lib/workspace-utils", () => ({
  resolveWorkspace: (...args: unknown[]) => resolveWorkspaceMock(...args),
}))

vi.mock("@/lib/anthropic-oauth", () => ({
  hasOAuthCredentials: vi.fn(() => true),
  getValidAccessToken: (...args: unknown[]) => getValidAccessTokenMock(...args),
}))

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: vi.fn((code: string, opts: { status: number; details?: Record<string, unknown> }) => {
    return new Response(JSON.stringify({ ok: false, error: code, ...opts.details }), { status: opts.status })
  }),
}))

vi.mock("@/lib/claude/agent-constants.mjs", () => ({
  getAllowedTools: vi.fn(() => []),
  getDisallowedTools: vi.fn(() => []),
  getOAuthMcpServers: vi.fn(() => ({})),
  hasStripeMcpAccess: vi.fn(() => false),
  PERMISSION_MODE: "default",
  SETTINGS_SOURCES: ["project"],
  STREAM_TYPES: { SESSION: "session" },
}))

vi.mock("@/lib/cors-utils", () => ({
  addCorsHeaders: (...args: unknown[]) => addCorsHeadersMock(...args),
}))

vi.mock("@/lib/env", () => ({
  env: { CLAUDE_MODEL: "model-default" },
}))

vi.mock("@/lib/image-analyze/fetch-and-save", () => ({
  buildAnalyzeImagePrompt: vi.fn((message: string) => message),
  fetchAndSaveAnalyzeImages: vi.fn(async () => []),
}))

vi.mock("@/lib/input-logger", () => ({
  logInput: vi.fn(),
}))

vi.mock("@/lib/oauth/fetch-oauth-tokens", () => ({
  fetchOAuthTokens: (...args: unknown[]) => fetchOAuthTokensMock(...args),
}))

vi.mock("@/lib/oauth/fetch-user-env-keys", () => ({
  fetchUserEnvKeys: (...args: unknown[]) => fetchUserEnvKeysMock(...args),
}))

vi.mock("@/lib/request-id", () => ({
  getRequestId: vi.fn(() => REQUEST_ID),
}))

vi.mock("@/lib/request-logger", () => ({
  createRequestLogger: (...args: unknown[]) => createRequestLoggerMock(...args),
}))

vi.mock("@/lib/stream/cancellation-registry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stream/cancellation-registry")>(
    "@/lib/stream/cancellation-registry",
  )

  return {
    ...actual,
    startTTLCleanup: vi.fn(),
  }
})

vi.mock("@/lib/stream/ndjson-stream-handler", () => ({
  createNDJSONStream: vi.fn(),
}))

vi.mock("@/lib/stream/stream-buffer", () => ({
  appendToStreamBuffer: vi.fn(),
  completeStreamBuffer: vi.fn(),
  createStreamBuffer: (...args: unknown[]) => createStreamBufferMock(...args),
  errorStreamBuffer: (...args: unknown[]) => errorStreamBufferMock(...args),
}))

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: (...args: unknown[]) => createAppClientMock(...args),
}))

vi.mock("@/lib/supabase/server-rls", () => ({
  createRLSAppClient: (...args: unknown[]) => createRLSAppClientMock(...args),
}))

vi.mock("@/lib/tokens", () => ({
  getOrgCredits: (...args: unknown[]) => getOrgCreditsMock(...args),
}))

vi.mock("@/lib/workspace-execution/agent-child-runner", () => ({
  runAgentChild: vi.fn(),
}))

vi.mock("@/lib/workspace-execution/command-runner", () => ({
  detectServeMode: vi.fn(() => "dev"),
}))

vi.mock("@/types/guards/api", () => ({
  BodySchema: {
    safeParse: vi.fn((body: Record<string, unknown>) => ({
      success: true,
      data: {
        message: typeof body.message === "string" ? body.message : "hello",
        workspace: WORKSPACE,
        worktree: undefined,
        conversationId: "conv-1",
        tabGroupId: TAB_GROUP_ID,
        tabId: TAB_ID,
        model: undefined,
        projectId: undefined,
        userId: undefined,
        additionalContext: undefined,
        analyzeImageUrls: undefined,
        streamMode: undefined,
        resumeSessionAt: undefined,
      },
    })),
  },
}))

vi.mock("../retry-observability", () => ({
  logRetryContract: vi.fn(),
}))

const { POST } = await import("../route")
const { AuthenticationError } = await import("@/features/auth/lib/auth")
const { getRegistrySize, unregisterCancellation } = await import("@/lib/stream/cancellation-registry")
const { tabKey, isConversationLocked, unlockConversation } = await import("@/features/auth/lib/sessionStore")

function getSessionKey() {
  return tabKey({
    userId: USER_ID,
    workspace: WORKSPACE,
    worktree: undefined,
    tabGroupId: TAB_GROUP_ID,
    tabId: TAB_ID,
  })
}

function createRequest(message = "test message"): NextRequest {
  return new NextRequest("http://localhost/api/claude/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ message, workspace: WORKSPACE }),
  })
}

function createMockDomainClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { domain_id: "domain-1", hostname: WORKSPACE, port: 3777 },
          })),
        })),
      })),
    })),
  }
}

async function readErrorPayload(
  response: Response,
): Promise<{ error: string | undefined; message: string | undefined }> {
  const raw = await response.json()
  if (!raw || typeof raw !== "object") {
    return { error: undefined, message: undefined }
  }

  const errorValue = Reflect.get(raw, "error")
  const messageValue = Reflect.get(raw, "message")

  return {
    error: typeof errorValue === "string" ? errorValue : undefined,
    message: typeof messageValue === "string" ? messageValue : undefined,
  }
}

describe("POST /api/claude/stream cleanup integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    requireSessionUserMock.mockResolvedValue({
      id: USER_ID,
      email: "user@example.com",
      name: "User",
      isAdmin: false,
      isSuperadmin: false,
      enabledModels: ["model-default"],
    })
    verifyWorkspaceAccessMock.mockResolvedValue(WORKSPACE)
    getSafeSessionCookieMock.mockResolvedValue("session-cookie")

    resolveWorkspaceMock.mockResolvedValue({ success: true, workspace: "/tmp/demo-workspace" })
    getValidAccessTokenMock.mockResolvedValue({ accessToken: "oauth-token", refreshed: false })
    getOrgCreditsMock.mockResolvedValue(10)

    createStreamBufferMock.mockResolvedValue(undefined)
    errorStreamBufferMock.mockResolvedValue(undefined)

    fetchOAuthTokensMock.mockResolvedValue({ tokens: {}, warnings: [] })
    fetchUserEnvKeysMock.mockResolvedValue({ envKeys: {} })

    createRLSAppClientMock.mockResolvedValue(createMockDomainClient())
    createAppClientMock.mockResolvedValue(createMockDomainClient())

    createRequestLoggerMock.mockReturnValue({
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })

    const sessionKey = getSessionKey()
    unregisterCancellation(REQUEST_ID)
    unlockConversation(sessionKey)
  })

  afterEach(() => {
    const sessionKey = getSessionKey()
    unregisterCancellation(REQUEST_ID)
    unlockConversation(sessionKey)
  })

  it("releases real lock and cancellation entry on non-auth setup failure after lock acquisition", async () => {
    const sessionKey = getSessionKey()
    expect(isConversationLocked(sessionKey)).toBe(false)
    expect(getRegistrySize()).toBe(0)

    sessionStoreGetMock.mockRejectedValueOnce(new Error("session store unavailable"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expect(errorStreamBufferMock).toHaveBeenCalledWith(REQUEST_ID, expect.stringContaining("[SESSION LOOKUP FAILED]"))
    expect(getRegistrySize()).toBe(0)
    expect(isConversationLocked(sessionKey)).toBe(false)
  })

  it("releases real lock and cancellation entry on AuthenticationError after lock acquisition", async () => {
    const sessionKey = getSessionKey()
    expect(isConversationLocked(sessionKey)).toBe(false)
    expect(getRegistrySize()).toBe(0)

    sessionStoreGetMock.mockResolvedValueOnce(null)
    fetchOAuthTokensMock.mockRejectedValueOnce(new AuthenticationError("Authentication required"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(401)
    expect(payload.error).toBe(ErrorCodes.NO_SESSION)
    expect(errorStreamBufferMock).toHaveBeenCalledWith(REQUEST_ID, "Authentication required")
    expect(getRegistrySize()).toBe(0)
    expect(isConversationLocked(sessionKey)).toBe(false)
  })
})
