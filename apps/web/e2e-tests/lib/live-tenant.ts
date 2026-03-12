import { expect, type Page, type TestInfo } from "@playwright/test"
import { parseWorkspaceStorageValue, TEST_CONFIG, WORKSPACE_STORAGE } from "@webalive/shared"
import {
  BootstrapTenantRequestSchema,
  BootstrapTenantResponseSchema,
  TestE2BDomainResponseSchema,
  type TestE2BDomainUpdateBody,
  type TestTenant,
  VerifyTenantResponseSchema,
} from "@/app/api/test/test-route-schemas"
import { TEST_TIMEOUTS } from "../fixtures/test-data"
import { login } from "../helpers"
import { requireProjectBaseUrl } from "./base-url"
import { buildE2ETestHeaders } from "./test-headers"

function getRunId(): string {
  const runId = process.env.E2E_RUN_ID
  if (!runId) {
    throw new Error("E2E_RUN_ID is required for live staging tests")
  }
  return runId
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

export async function getLiveStagingUser(
  workerIndex: number,
  baseUrl: string,
): Promise<Pick<TestTenant, "email" | "workspace" | "orgId"> & { password: string }> {
  const runId = getRunId()
  const { email, workspace, normalizedWorkerIndex } = getWorkerTenantAddress(workerIndex)
  const bootstrapBody = BootstrapTenantRequestSchema.parse({
    runId,
    workerIndex: normalizedWorkerIndex,
    email,
    workspace,
  })

  const response = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
    method: "POST",
    headers: buildE2ETestHeaders(true),
    body: JSON.stringify(bootstrapBody),
  })

  if (!response.ok) {
    throw new Error(`bootstrap-tenant failed (${response.status})`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    throw new Error(`bootstrap-tenant returned non-JSON response: ${contentType || "unknown"}`)
  }

  const payload = BootstrapTenantResponseSchema.parse(await response.json())
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

export async function loginLiveStaging(
  page: Page,
  user: Pick<TestTenant, "email" | "workspace" | "orgId"> & { password: string },
): Promise<void> {
  await login(page, user)

  await page.waitForURL("**/chat", { timeout: TEST_TIMEOUTS.max })

  await expect(page.locator('[data-testid="workspace-ready"]')).toBeAttached({
    timeout: TEST_TIMEOUTS.max,
  })

  const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
  if (!storageValue) {
    throw new Error("Workspace storage missing after login")
  }
  const parsed = parseWorkspaceStorageValue(storageValue)
  expect(parsed.state.currentWorkspace).toBe(user.workspace)
  expect(parsed.state.selectedOrgId).toBe(user.orgId)

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible({
    timeout: TEST_TIMEOUTS.slow,
  })
}

export async function updateTestDomainRuntime(baseUrl: string, payload: TestE2BDomainUpdateBody): Promise<void> {
  const response = await fetch(`${baseUrl}/api/test/e2b-domain`, {
    method: "POST",
    headers: buildE2ETestHeaders(true),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`e2b-domain POST failed (${response.status})`)
  }

  const data = TestE2BDomainResponseSchema.parse(await response.json())
  if (!data.ok) {
    throw new Error("e2b-domain POST returned ok=false")
  }
}

export async function getTenantSandboxState(baseUrl: string, email: string) {
  const response = await fetch(
    `${baseUrl}/api/test/verify-tenant?email=${encodeURIComponent(email)}&includeSandbox=1`,
    { headers: buildE2ETestHeaders() },
  )

  if (!response.ok) {
    throw new Error(`verify-tenant failed (${response.status})`)
  }

  const payload = VerifyTenantResponseSchema.parse(await response.json())
  if (!payload.ready) {
    throw new Error("verify-tenant returned ready=false while checking sandbox state")
  }

  if (!payload.sandbox) {
    throw new Error("verify-tenant response missing sandbox payload")
  }
  return payload.sandbox
}
