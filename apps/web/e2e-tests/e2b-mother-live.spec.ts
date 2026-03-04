import { expect, type Page, test } from "@playwright/test"
import { ErrorCodes } from "@/lib/error-codes"
import { CANCEL_ENDPOINT_STATUS } from "@/lib/stream/cancel-status"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

interface E2bRuntime {
  domain_id: string
  hostname: string
  org_id: string
  is_test_env: boolean
  execution_mode: "systemd" | "e2b"
  sandbox_id: string | null
  sandbox_status: "creating" | "running" | "dead" | null
}

interface E2bRuntimeResponse {
  ok: boolean
  domain: E2bRuntime
}

interface E2bRuntimeUpdatePayload {
  workspace: string
  executionMode: "systemd" | "e2b"
  killSandbox?: boolean
  resetSandboxFields?: boolean
  restartWorkspaceWorkers?: boolean
  sandboxId?: string | null
  sandboxStatus?: "creating" | "running" | "dead" | null
}

interface ErrorResponse {
  ok?: false
  error: string
  message?: string
}

interface CancelResponse {
  ok: boolean
  status: string
  requestId?: string
  tabId?: string
}

interface BrowserUploadResult {
  status: number
  body: unknown
}

const EXPECTED_CANCEL_STATUSES = new Set<string>([
  CANCEL_ENDPOINT_STATUS.CANCELLED,
  CANCEL_ENDPOINT_STATUS.CANCEL_QUEUED,
  CANCEL_ENDPOINT_STATUS.CANCEL_TIMED_OUT,
])

function buildTestHeaders(withJsonContentType: boolean): Record<string, string> {
  const headers: Record<string, string> = {}
  if (withJsonContentType) {
    headers["Content-Type"] = "application/json"
  }
  const testSecret = process.env.E2E_TEST_SECRET
  if (testSecret) {
    headers["x-test-secret"] = testSecret
  }
  return headers
}

function getDomainRuntime(baseUrl: string, workspace: string): Promise<E2bRuntime>
function getDomainRuntime(
  baseUrl: string,
  workspace: string,
  options: { allow404AsNull: true },
): Promise<E2bRuntime | null>
async function getDomainRuntime(
  baseUrl: string,
  workspace: string,
  options?: { allow404AsNull?: boolean },
): Promise<E2bRuntime | null> {
  const response = await fetch(`${baseUrl}/api/test/e2b-domain?workspace=${encodeURIComponent(workspace)}`, {
    method: "GET",
    headers: buildTestHeaders(false),
  })

  if (response.status === 404 && options?.allow404AsNull) {
    return null
  }

  if (!response.ok) {
    throw new Error(`e2b-domain GET failed (${response.status})`)
  }

  const payload = (await response.json()) as E2bRuntimeResponse
  if (!payload.ok) {
    throw new Error("e2b-domain GET returned ok=false")
  }

  return payload.domain
}

async function updateDomainRuntime(baseUrl: string, payload: E2bRuntimeUpdatePayload): Promise<E2bRuntime> {
  const response = await fetch(`${baseUrl}/api/test/e2b-domain`, {
    method: "POST",
    headers: buildTestHeaders(true),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ErrorResponse
    throw new Error(`e2b-domain POST failed (${response.status}): ${error.error ?? "unknown_error"}`)
  }

  const data = (await response.json()) as E2bRuntimeResponse
  return data.domain
}

async function sendMessage(page: Page, message: string): Promise<string> {
  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill(message)
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })

  const streamResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)
  await sendButton.click()
  const response = await streamResponsePromise

  expect(response.status()).toBe(200)
  const requestId = response.headers()["x-request-id"]
  expect(typeof requestId).toBe("string")
  expect(requestId.length).toBeGreaterThan(0)

  const ndjson = await response.text()
  const assistantText = extractAssistantTextFromNDJSON(ndjson)
  expect(assistantText.length).toBeGreaterThan(0)
  return assistantText
}

async function cancelLatestStreamViaTab(page: Page, workspace: string, message: string): Promise<string> {
  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  const streamRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
  await messageInput.fill(message)
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await sendButton.click()

  const streamRequest = await streamRequestPromise
  const bodyRaw = streamRequest.postData()
  if (!bodyRaw) {
    throw new Error("Stream request body missing")
  }

  const body = JSON.parse(bodyRaw) as {
    tabId?: string
    tabGroupId?: string
    workspace?: string
  }
  if (!body.tabId || !body.tabGroupId) {
    throw new Error("Stream request missing tab identifiers")
  }

  const cancelRes = await page.request.post("/api/claude/stream/cancel", {
    data: {
      tabId: body.tabId,
      tabGroupId: body.tabGroupId,
      workspace,
    },
  })

  expect(cancelRes.status()).toBe(200)
  const cancelJson = (await cancelRes.json()) as CancelResponse
  expect(cancelJson.ok).toBe(true)
  if (!EXPECTED_CANCEL_STATUSES.has(cancelJson.status)) {
    throw new Error(`Unexpected cancel status: ${cancelJson.status}`)
  }
  return cancelJson.status
}

test.describe("E2B Mother - Phases 0-6", () => {
  // Live E2B sandbox provisioning + Claude stream completion can exceed default live test timeout.
  test.setTimeout(10 * 60 * 1000)

  test("validates e2b chat/files/watch/terminal/cancel/recreate end-to-end", async ({ page }) => {
    const baseUrl = getProjectBaseUrl(test.info())
    const user = await getLiveStagingUser(test.info().workerIndex, baseUrl)

    // Deterministic cleanup for shared staging data
    const restoreSystemd = async () => {
      await updateDomainRuntime(baseUrl, {
        workspace: user.workspace,
        executionMode: "systemd",
        killSandbox: true,
        resetSandboxFields: true,
        restartWorkspaceWorkers: true,
      }).catch(() => {})
    }

    // Trigger: flip one worker domain to E2B and run real chat/files calls.
    // Expected user-visible outcome: assistant replies and file APIs work for the user's workspace.
    // Negative boundary: traversal and cross-workspace access are blocked with explicit errors.
    // Completion signal: runtime reaches running sandbox, then all phase checks pass.
    const initialRuntime = await getDomainRuntime(baseUrl, user.workspace, { allow404AsNull: true })
    if (!initialRuntime) {
      test.skip(true, "Requires /api/test/e2b-domain in target environment.")
      return
    }

    await restoreSystemd()

    try {
      // Phase 0: preflight
      expect(initialRuntime.hostname).toBe(user.workspace)
      expect(initialRuntime.is_test_env).toBe(true)

      // Phase 1: switch to E2B with clean sandbox baseline
      const e2bRuntime = await updateDomainRuntime(baseUrl, {
        workspace: user.workspace,
        executionMode: "e2b",
        killSandbox: true,
        resetSandboxFields: true,
        restartWorkspaceWorkers: true,
      })
      expect(e2bRuntime.execution_mode).toBe("e2b")
      expect(e2bRuntime.sandbox_id).toBeNull()

      await loginLiveStaging(page, user)

      // Phase 2: real chat creates the sandbox
      const assistantText = await sendMessage(page, "Reply with exactly READY.")
      expect(assistantText.toLowerCase()).toContain("ready")

      const runningRuntime = await getDomainRuntime(baseUrl, user.workspace)
      if (!runningRuntime) {
        throw new Error("Unexpected null runtime while endpoint is available")
      }
      expect(runningRuntime.execution_mode).toBe("e2b")
      expect(runningRuntime.sandbox_status).toBe("running")
      expect(runningRuntime.sandbox_id).toBeTruthy()

      // Phase 3: file APIs over E2B
      const filename = `e2b-proof-${Date.now()}.png`
      const tinyPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0wAAAABJRU5ErkJggg=="

      const uploadResult = await page.evaluate(
        async ({ workspace, filename: innerFilename, pngBase64 }) => {
          const binary = atob(pngBase64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }

          const formData = new FormData()
          formData.append("workspace", workspace)
          formData.append("file", new File([bytes], innerFilename, { type: "image/png" }))

          const res = await fetch("/api/files/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
          })

          const body = await res.json().catch(() => ({}))
          return { status: res.status, body }
        },
        { workspace: user.workspace, filename, pngBase64: tinyPngBase64 },
      )
      const typedUploadResult = uploadResult as BrowserUploadResult
      if (typedUploadResult.status !== 200) {
        throw new Error(`Upload failed (${typedUploadResult.status}): ${JSON.stringify(typedUploadResult.body)}`)
      }
      const uploadJson = typedUploadResult.body as { path: string }
      const uploadedPath = uploadJson.path as string
      expect(uploadedPath.startsWith(".uploads/e2b-proof-")).toBe(true)
      expect(uploadedPath.endsWith(".png")).toBe(true)

      const listRes = await page.request.post("/api/files", {
        data: { workspace: user.workspace, path: ".uploads" },
      })
      expect(listRes.status()).toBe(200)
      const listJson = (await listRes.json()) as {
        files?: Array<{ path: string }>
      }
      expect(Array.isArray(listJson.files)).toBe(true)
      expect(listJson.files?.some(file => file.path === uploadedPath)).toBe(true)

      const readRes = await page.request.post("/api/files/read", {
        data: { workspace: user.workspace, path: "README.md" },
      })
      expect(readRes.status()).toBe(200)
      const readJson = await readRes.json()
      expect(typeof readJson.content).toBe("string")
      expect(readJson.content).toContain("E2E Workspace")

      // Negative: traversal should always be blocked
      const traversalRes = await page.request.post("/api/files/read", {
        data: { workspace: user.workspace, path: "../../etc/passwd" },
      })
      expect(traversalRes.status()).toBe(403)
      const traversalError = (await traversalRes.json()) as ErrorResponse
      expect(traversalError.error).toBe(ErrorCodes.PATH_OUTSIDE_WORKSPACE)

      // Negative: authenticated user must not access another workspace
      const secondaryUser = await getLiveStagingUser(test.info().workerIndex + 1, baseUrl)
      const crossWorkspaceRes = await page.request.post("/api/files/read", {
        data: { workspace: secondaryUser.workspace, path: "README.md" },
      })
      expect(crossWorkspaceRes.status()).toBe(403)
      const crossWorkspaceError = (await crossWorkspaceRes.json()) as ErrorResponse
      expect(crossWorkspaceError.error).toBe(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED)

      // Phase 4: watch + terminal route behavior for E2B
      const watchRes = await page.request.post("/api/watch/lease", {
        data: { workspace: user.workspace },
      })
      expect(watchRes.status()).toBe(501)
      const watchErr = (await watchRes.json()) as ErrorResponse
      expect(watchErr.error).toBe(ErrorCodes.WATCH_UNSUPPORTED)

      const terminalRes = await page.request.post("/api/terminal/lease", {
        data: { workspace: user.workspace },
      })
      expect(terminalRes.status()).toBe(200)
      const terminalData = (await terminalRes.json()) as {
        ok: boolean
        wsUrl: string
      }
      expect(terminalData.ok).toBe(true)
      expect(terminalData.wsUrl).toContain("/e2b/ws?lease=")

      await updateDomainRuntime(baseUrl, {
        workspace: user.workspace,
        executionMode: "e2b",
        killSandbox: true,
        sandboxStatus: "dead",
        restartWorkspaceWorkers: true,
      })

      const terminalNotReadyRes = await page.request.post("/api/terminal/lease", {
        data: { workspace: user.workspace },
      })
      expect(terminalNotReadyRes.status()).toBe(503)
      const terminalNotReadyErr = (await terminalNotReadyRes.json()) as ErrorResponse
      expect(terminalNotReadyErr.error).toBe(ErrorCodes.SANDBOX_NOT_READY)

      // Recreate a running sandbox for the next phases
      await sendMessage(page, "Reply with exactly READY-AGAIN.")
      await expect
        .poll(
          async () => {
            const runtime = await getDomainRuntime(baseUrl, user.workspace)
            return runtime?.sandbox_status ?? null
          },
          {
            timeout: TEST_TIMEOUTS.max,
          },
        )
        .toBe("running")
      const runtimeAfterTerminalRecovery = await getDomainRuntime(baseUrl, user.workspace)
      if (!runtimeAfterTerminalRecovery) {
        throw new Error("Runtime unavailable after terminal recovery")
      }
      expect(runtimeAfterTerminalRecovery.sandbox_status).toBe("running")
      expect(runtimeAfterTerminalRecovery.sandbox_id).toBeTruthy()

      // Phase 5: cancel stream and verify lock release by immediate follow-up send
      const cancelStatus = await cancelLatestStreamViaTab(
        page,
        user.workspace,
        "Write a very long response: count from 1 to 400, one number per line, with no extra text.",
      )
      expect(EXPECTED_CANCEL_STATUSES.has(cancelStatus)).toBe(true)
      await sendMessage(page, "Reply with exactly LOCK-RELEASED.")

      // Phase 6: force dead, then recreate and assert a new sandbox id
      const runtimeBeforeRotate = await getDomainRuntime(baseUrl, user.workspace)
      if (!runtimeBeforeRotate) {
        throw new Error("Runtime unavailable before sandbox rotate")
      }
      const previousSandboxId = runtimeBeforeRotate.sandbox_id

      await updateDomainRuntime(baseUrl, {
        workspace: user.workspace,
        executionMode: "e2b",
        killSandbox: true,
        sandboxStatus: "dead",
        restartWorkspaceWorkers: true,
      })

      await sendMessage(page, "Reply with exactly SANDBOX-RECREATED.")
      await expect
        .poll(
          async () => {
            const runtime = await getDomainRuntime(baseUrl, user.workspace)
            return runtime?.sandbox_status ?? null
          },
          {
            timeout: TEST_TIMEOUTS.max,
          },
        )
        .toBe("running")
      const runtimeAfterRotate = await getDomainRuntime(baseUrl, user.workspace)
      if (!runtimeAfterRotate) {
        throw new Error("Runtime unavailable after sandbox rotate")
      }
      expect(runtimeAfterRotate.sandbox_status).toBe("running")
      expect(runtimeAfterRotate.sandbox_id).toBeTruthy()
      if (previousSandboxId) {
        expect(runtimeAfterRotate.sandbox_id).not.toBe(previousSandboxId)
      }
    } finally {
      await restoreSystemd()
    }
  })
})
