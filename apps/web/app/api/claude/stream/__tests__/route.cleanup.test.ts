import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const requireSessionUserMock = vi.fn()
const verifyWorkspaceAccessMock = vi.fn()
const getSafeSessionCookieMock = vi.fn()

const sessionStoreGetMock = vi.fn()
const tabKeyMock = vi.fn()
const tryLockConversationMock = vi.fn()
const unlockConversationMock = vi.fn()

const createStreamBufferMock = vi.fn()
const errorStreamBufferMock = vi.fn()
const registerCancellationMock = vi.fn()
const unregisterCancellationMock = vi.fn()

const fetchOAuthTokensMock = vi.fn()
const fetchUserEnvKeysMock = vi.fn()
const createRLSAppClientMock = vi.fn()
const createAppClientMock = vi.fn()

const createRequestLoggerMock = vi.fn()
const resolveWorkspaceMock = vi.fn()
const getValidAccessTokenMock = vi.fn()
const getOrgCreditsMock = vi.fn()
const addCorsHeadersMock = vi.fn()

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

vi.mock("@webalive/shared", () => ({
  DEFAULTS: { CLAUDE_MAX_TURNS: 8 },
  SUPERADMIN: { WORKSPACE_NAME: "alive" },
  WORKER_POOL: { ENABLED: false },
  COOKIE_NAMES: { SESSION: "session" },
}))

vi.mock("@webalive/worker-pool", () => ({
  getWorkerPool: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: "session-cookie" })),
  })),
  headers: vi.fn(async () => ({
    get: vi.fn((name: string) => {
      if (name.toLowerCase() === "host") return "demo.alive.best"
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

vi.mock("@/features/auth/lib/sessionStore", () => ({
  sessionStore: {
    get: (...args: unknown[]) => sessionStoreGetMock(...args),
    set: vi.fn(),
    delete: vi.fn(),
  },
  tabKey: (...args: unknown[]) => tabKeyMock(...args),
  tryLockConversation: (...args: unknown[]) => tryLockConversationMock(...args),
  unlockConversation: (...args: unknown[]) => unlockConversationMock(...args),
}))

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

vi.mock("@/lib/models/claude-models", () => ({
  DEFAULT_MODEL: "model-default",
  isRetiredModel: vi.fn(() => false),
  isValidClaudeModel: vi.fn(() => true),
}))

vi.mock("@/lib/oauth/fetch-oauth-tokens", () => ({
  fetchOAuthTokens: (...args: unknown[]) => fetchOAuthTokensMock(...args),
}))

vi.mock("@/lib/oauth/fetch-user-env-keys", () => ({
  fetchUserEnvKeys: (...args: unknown[]) => fetchUserEnvKeysMock(...args),
}))

vi.mock("@/lib/request-id", () => ({
  getRequestId: vi.fn(() => "req-123"),
}))

vi.mock("@/lib/request-logger", () => ({
  createRequestLogger: (...args: unknown[]) => createRequestLoggerMock(...args),
}))

vi.mock("@/lib/stream/cancellation-registry", () => ({
  registerCancellation: (...args: unknown[]) => registerCancellationMock(...args),
  unregisterCancellation: (...args: unknown[]) => unregisterCancellationMock(...args),
  startTTLCleanup: vi.fn(),
}))

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
        workspace: "demo.alive.best",
        worktree: undefined,
        conversationId: "conv-1",
        tabGroupId: "tab-group-1",
        tabId: "tab-1",
        model: undefined,
        projectId: undefined,
        userId: undefined,
        additionalContext: undefined,
        analyzeImageUrls: undefined,
        planMode: false,
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
const SESSION_KEY = "user-1::demo.alive.best::tab-group-1::tab-1"

function createRequest(message = "test message"): NextRequest {
  return new NextRequest("http://localhost/api/claude/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ message, workspace: "demo.alive.best" }),
  })
}

function createMockDomainClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { domain_id: "domain-1", hostname: "demo.alive.best", port: 3777 },
          })),
        })),
      })),
    })),
  }
}

async function readErrorPayload(response: Response): Promise<{
  error: string | undefined
  message: string | undefined
}> {
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

function expectCancellationRegisteredOnce() {
  expect(registerCancellationMock).toHaveBeenCalledTimes(1)
  const firstCall = registerCancellationMock.mock.calls[0]
  expect(firstCall?.[0]).toBe("req-123")
  expect(firstCall?.[1]).toBe("user-1")
  expect(firstCall?.[2]).toBe(SESSION_KEY)
  expect(typeof firstCall?.[3]).toBe("function")
}

function expectCleanupCalledOnce(errorMessageMatcher: unknown) {
  expect(unregisterCancellationMock).toHaveBeenCalledWith("req-123")
  expect(unregisterCancellationMock).toHaveBeenCalledTimes(1)
  expect(unlockConversationMock).toHaveBeenCalledWith(SESSION_KEY)
  expect(unlockConversationMock).toHaveBeenCalledTimes(1)
  expect(errorStreamBufferMock).toHaveBeenCalledWith("req-123", errorMessageMatcher)
  expect(errorStreamBufferMock).toHaveBeenCalledTimes(1)
}

function expectCleanupOrder() {
  const unregisterOrder = unregisterCancellationMock.mock.invocationCallOrder[0]
  const unlockOrder = unlockConversationMock.mock.invocationCallOrder[0]
  const errorBufferOrder = errorStreamBufferMock.mock.invocationCallOrder[0]

  expect(unregisterOrder).toBeLessThan(unlockOrder)
  expect(unlockOrder).toBeLessThan(errorBufferOrder)
}

function expectNoLockedCleanup() {
  expect(registerCancellationMock).not.toHaveBeenCalled()
  expect(unregisterCancellationMock).not.toHaveBeenCalled()
  expect(unlockConversationMock).not.toHaveBeenCalled()
  expect(errorStreamBufferMock).not.toHaveBeenCalled()
}

describe("POST /api/claude/stream cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    requireSessionUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      isAdmin: false,
      isSuperadmin: false,
      enabledModels: ["model-default"],
    })
    verifyWorkspaceAccessMock.mockResolvedValue("demo.alive.best")
    getSafeSessionCookieMock.mockResolvedValue("session-cookie")

    tabKeyMock.mockReturnValue(SESSION_KEY)
    tryLockConversationMock.mockReturnValue(true)

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
  })

  it("unregisters cancellation and unlocks when a non-auth error happens after lock", async () => {
    sessionStoreGetMock.mockRejectedValueOnce(new Error("session store unavailable"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expect(tryLockConversationMock).toHaveBeenCalledOnce()
    expectCancellationRegisteredOnce()
    expectCleanupCalledOnce(expect.stringContaining("[SESSION LOOKUP FAILED]"))
    expectCleanupOrder()
  })

  it("unregisters cancellation and unlocks when AuthenticationError happens after lock", async () => {
    sessionStoreGetMock.mockResolvedValueOnce(null)
    fetchOAuthTokensMock.mockRejectedValueOnce(new AuthenticationError("Authentication required"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(401)
    expect(payload.error).toBe(ErrorCodes.NO_SESSION)
    expect(tryLockConversationMock).toHaveBeenCalledOnce()
    expectCancellationRegisteredOnce()
    expectCleanupCalledOnce("Authentication required")
    expectCleanupOrder()
    expect(addCorsHeadersMock).toHaveBeenCalled()
  })

  it("continues cleanup when unregisterCancellation throws", async () => {
    sessionStoreGetMock.mockRejectedValueOnce(new Error("session store unavailable"))
    unregisterCancellationMock.mockImplementationOnce(() => {
      throw new Error("cancellation registry unavailable")
    })

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expectCancellationRegisteredOnce()
    expectCleanupCalledOnce(expect.stringContaining("[SESSION LOOKUP FAILED]"))
    expectCleanupOrder()
  })

  it("continues cleanup when unlockConversation throws", async () => {
    sessionStoreGetMock.mockRejectedValueOnce(new Error("session store unavailable"))
    unlockConversationMock.mockImplementationOnce(() => {
      throw new Error("lock store unavailable")
    })

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expectCancellationRegisteredOnce()
    expectCleanupCalledOnce(expect.stringContaining("[SESSION LOOKUP FAILED]"))
    expectCleanupOrder()
  })

  it("continues cleanup when errorStreamBuffer rejects", async () => {
    sessionStoreGetMock.mockRejectedValueOnce(new Error("session store unavailable"))
    errorStreamBufferMock.mockRejectedValueOnce(new Error("redis unavailable"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expectCancellationRegisteredOnce()
    expectCleanupCalledOnce(expect.stringContaining("[SESSION LOOKUP FAILED]"))
    expectCleanupOrder()
  })

  it("uses Unknown error fallback for non-Error failures after lock", async () => {
    sessionStoreGetMock.mockResolvedValueOnce(null)
    fetchOAuthTokensMock.mockRejectedValueOnce("boom")

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expect(payload.message).toBe("Unknown error")
    expectCancellationRegisteredOnce()
    expectCleanupCalledOnce("Unknown error")
    expectCleanupOrder()
  })

  it("does not run locked cleanup when error happens before lock acquisition", async () => {
    requireSessionUserMock.mockRejectedValueOnce(new Error("user lookup failed"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(500)
    expect(payload.error).toBe(ErrorCodes.REQUEST_PROCESSING_FAILED)
    expect(tryLockConversationMock).not.toHaveBeenCalled()
    expectNoLockedCleanup()
  })

  it("does not run locked cleanup for AuthenticationError before lock acquisition", async () => {
    requireSessionUserMock.mockRejectedValueOnce(new AuthenticationError("Authentication required"))

    const res = await POST(createRequest())
    const payload = await readErrorPayload(res)

    expect(res.status).toBe(401)
    expect(payload.error).toBe(ErrorCodes.NO_SESSION)
    expect(tryLockConversationMock).not.toHaveBeenCalled()
    expectNoLockedCleanup()
  })
})
