import { expect, type Page, type TestInfo } from "@playwright/test"
import { parseWorkspaceStorageValue, TEST_CONFIG, WORKSPACE_STORAGE } from "@webalive/shared"
import {
  BootstrapTenantRequestSchema,
  BootstrapTenantResponseSchema,
  type TestE2BDomain,
  TestE2BDomainResponseSchema,
  type TestE2BDomainUpdateBody,
  type TestTenant,
  VerifyTenantResponseSchema,
} from "@/app/api/test/test-route-schemas"
import { TEST_SELECTORS, TEST_TIMEOUTS } from "../fixtures/test-data"
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

  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({
    timeout: TEST_TIMEOUTS.max,
  })

  const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
  if (!storageValue) {
    throw new Error("Workspace storage missing after login")
  }
  const parsed = parseWorkspaceStorageValue(storageValue)
  expect(parsed.state.currentWorkspace).toBe(user.workspace)
  expect(parsed.state.selectedOrgId).toBe(user.orgId)

  await expect(page.locator(TEST_SELECTORS.messageInput)).toBeVisible({
    timeout: TEST_TIMEOUTS.slow,
  })
}

/** GET the E2B domain runtime state. Returns null with `allow404AsNull` if endpoint unavailable. */
export function getDomainRuntime(baseUrl: string, workspace: string): Promise<TestE2BDomain>
export function getDomainRuntime(
  baseUrl: string,
  workspace: string,
  options: { allow404AsNull: true },
): Promise<TestE2BDomain | null>
export async function getDomainRuntime(
  baseUrl: string,
  workspace: string,
  options?: { allow404AsNull?: boolean },
): Promise<TestE2BDomain | null> {
  const response = await fetch(`${baseUrl}/api/test/e2b-domain?workspace=${encodeURIComponent(workspace)}`, {
    method: "GET",
    headers: buildE2ETestHeaders(),
  })

  if (response.status === 404 && options?.allow404AsNull) {
    return null
  }

  if (!response.ok) {
    throw new Error(`e2b-domain GET failed (${response.status})`)
  }

  const payload = TestE2BDomainResponseSchema.parse(await response.json())
  if (!payload.ok) {
    throw new Error("e2b-domain GET returned ok=false")
  }

  return payload.domain
}

/** POST to update E2B domain runtime state. Returns the updated domain. */
export async function updateTestDomainRuntime(
  baseUrl: string,
  payload: TestE2BDomainUpdateBody,
): Promise<TestE2BDomain> {
  const response = await fetch(`${baseUrl}/api/test/e2b-domain`, {
    method: "POST",
    headers: buildE2ETestHeaders(true),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorCode = typeof error.error === "string" ? error.error : "unknown_error"
    throw new Error(`e2b-domain POST failed (${response.status}): ${errorCode}`)
  }

  const data = TestE2BDomainResponseSchema.parse(await response.json())
  return data.domain
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
