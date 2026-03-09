import { expect, type Page, type TestInfo } from "@playwright/test"
import { TEST_CONFIG, WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { TEST_TIMEOUTS } from "../fixtures/test-data"
import { login } from "../helpers"
import { requireProjectBaseUrl } from "./base-url"
import { BootstrapTenantApiResponseSchema } from "./tenant-types"

export interface LiveStagingUser {
  email: string
  password: string
  workspace: string
  orgId: string
}

interface VerifyTenantResponse {
  ready: boolean
  sandbox?: {
    executionMode: "systemd" | "e2b"
    sandboxId: string | null
    sandboxStatus: "creating" | "running" | "dead" | null
  }
}

function getRunId(): string {
  const runId = process.env.E2E_RUN_ID
  if (!runId) {
    throw new Error("E2E_RUN_ID is required for live staging tests")
  }
  return runId
}

function buildTestHeaders(includeJsonContentType: boolean): Record<string, string> {
  const headers: Record<string, string> = {}
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json"
  }
  const testSecret = process.env.E2E_TEST_SECRET
  if (testSecret) {
    headers["x-test-secret"] = testSecret
  }
  return headers
}

function getWorkerTenantAddress(workerIndex: number): {
  email: string
  workspace: string
  normalizedWorkerIndex: number
} {
  const normalizedWorkerIndex = workerIndex % TEST_CONFIG.MAX_WORKERS
  return {
    email: `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${normalizedWorkerIndex}@${TEST_CONFIG.EMAIL_DOMAIN}`,
    workspace: `${TEST_CONFIG.WORKSPACE_PREFIX}${normalizedWorkerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`,
    normalizedWorkerIndex,
  }
}

export function getProjectBaseUrl(testInfo: TestInfo): string {
  return requireProjectBaseUrl(testInfo.project.use.baseURL)
}

export async function getLiveStagingUser(workerIndex: number, baseUrl: string): Promise<LiveStagingUser> {
  const runId = getRunId()
  const { email, workspace, normalizedWorkerIndex } = getWorkerTenantAddress(workerIndex)

  const response = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
    method: "POST",
    headers: buildTestHeaders(true),
    body: JSON.stringify({
      runId,
      workerIndex: normalizedWorkerIndex,
      email,
      workspace,
    }),
  })

  if (!response.ok) {
    throw new Error(`bootstrap-tenant failed (${response.status})`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    throw new Error(`bootstrap-tenant returned non-JSON response: ${contentType || "unknown"}`)
  }

  const payload = BootstrapTenantApiResponseSchema.parse(await response.json())
  if (!payload.ok) {
    throw new Error("bootstrap-tenant returned ok=false")
  }

  return {
    email: payload.tenant.email,
    password: TEST_CONFIG.TEST_PASSWORD,
    workspace: payload.tenant.workspace,
    orgId: payload.tenant.orgId,
  }
}

export async function loginLiveStaging(page: Page, user: LiveStagingUser): Promise<void> {
  await login(page, user)

  await page.waitForURL("**/chat", { timeout: TEST_TIMEOUTS.max })

  await expect(page.locator('[data-testid="workspace-ready"]')).toBeAttached({
    timeout: TEST_TIMEOUTS.max,
  })

  const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
  if (!storageValue) {
    throw new Error("Workspace storage missing after login")
  }
  const parsed = JSON.parse(storageValue) as WorkspaceStorageValue
  expect(parsed.state.currentWorkspace).toBe(user.workspace)
  expect(parsed.state.selectedOrgId).toBe(user.orgId)

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible({
    timeout: TEST_TIMEOUTS.slow,
  })
}

export async function getTenantSandboxState(baseUrl: string, email: string): Promise<VerifyTenantResponse["sandbox"]> {
  const response = await fetch(
    `${baseUrl}/api/test/verify-tenant?email=${encodeURIComponent(email)}&includeSandbox=1`,
    { headers: buildTestHeaders(false) },
  )

  if (!response.ok) {
    throw new Error(`verify-tenant failed (${response.status})`)
  }

  const payload = (await response.json()) as VerifyTenantResponse
  if (!payload.ready) {
    throw new Error("verify-tenant returned ready=false while checking sandbox state")
  }

  if (!payload.sandbox) {
    throw new Error("verify-tenant response missing sandbox payload")
  }
  return payload.sandbox
}
