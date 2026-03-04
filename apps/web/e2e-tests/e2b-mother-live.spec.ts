import { expect, type Page, test } from "@playwright/test"
import { ErrorCodes } from "@/lib/error-codes"
import { isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
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
  sandboxId?: string | null
  sandboxStatus?: "creating" | "running" | "dead" | null
}

interface ErrorResponse {
  ok?: false
  error: string
  message?: string
}

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

test.describe("E2B Mother - Phases 0-3", () => {
  test("bootstraps e2b runtime, creates sandbox via chat, and verifies files security gates", async ({ page }) => {
    const baseUrl = getProjectBaseUrl(test.info())
    const user = await getLiveStagingUser(test.info().workerIndex, baseUrl)

    // Deterministic cleanup for shared staging data
    const restoreSystemd = async () => {
      await updateDomainRuntime(baseUrl, {
        workspace: user.workspace,
        executionMode: "systemd",
        killSandbox: true,
        resetSandboxFields: true,
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
      const filename = `e2b-proof-${Date.now()}.txt`
      const content = `e2b-nonce-${Date.now()}`

      const uploadRes = await page.request.post("/api/files/upload", {
        multipart: {
          workspace: user.workspace,
          file: {
            name: filename,
            mimeType: "text/plain",
            buffer: Buffer.from(content, "utf8"),
          },
        },
      })
      expect(uploadRes.status()).toBe(200)
      const uploadJson = await uploadRes.json()
      const uploadedPath = uploadJson.path as string
      expect(uploadedPath).toContain(filename)

      const listRes = await page.request.post("/api/files", {
        data: { workspace: user.workspace, path: "" },
      })
      expect(listRes.status()).toBe(200)

      const readRes = await page.request.post("/api/files/read", {
        data: { workspace: user.workspace, path: uploadedPath },
      })
      expect(readRes.status()).toBe(200)
      const readJson = await readRes.json()
      expect(readJson.content).toBe(content)

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
    } finally {
      await restoreSystemd()
    }
  })
})
