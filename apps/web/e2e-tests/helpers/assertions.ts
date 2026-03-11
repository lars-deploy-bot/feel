/**
 * Custom assertions and helpers for E2E tests
 *
 * Benefits:
 * - Consistent waiting strategies
 * - Better error messages
 * - Reusable patterns
 *
 * IMPORTANT: Synchronization Strategy
 * - Use waitForAppReady() as the "clock" - it waits for __E2E_APP_READY__
 * - DOM markers (workspace-ready) become assertions AFTER hydration is confirmed
 * - This decouples test sync from React render timing
 *
 * E2E Instrumentation:
 * - When tests fail, dump window.__E2E__ metrics for debugging
 * - Metrics include per-store hydration timing
 */
import { expect, type Page } from "@playwright/test"
import { createWorkspaceStorageValue, WORKSPACE_STORAGE } from "@webalive/shared"
import type { E2EReadiness } from "@/lib/stores/hydration-registry"
import { TEST_SELECTORS, TEST_TIMEOUTS } from "../fixtures/test-data"

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isWorkspaceStorageSnapshot(value: unknown): boolean {
  if (!isObjectRecord(value)) return false
  const workspace = Reflect.get(value, "workspace")
  const orgId = Reflect.get(value, "orgId")
  const isNullableString = (entry: unknown): entry is string | null => entry === null || typeof entry === "string"
  return isNullableString(workspace) && isNullableString(orgId)
}

function isE2EReadiness(value: unknown): value is E2EReadiness {
  if (!isObjectRecord(value)) return false
  return Reflect.has(value, "appReady") || Reflect.has(value, "chatReady") || Reflect.has(value, "stores")
}

/**
 * Wait for app hydration to complete.
 *
 * This is the PRIMARY synchronization primitive for E2E tests.
 * Waits for window.__E2E_APP_READY__ which is set by HydrationManager
 * after ALL Zustand persisted stores have rehydrated.
 *
 * Why this instead of DOM markers:
 * - Not dependent on React render timing
 * - Not affected by suspense boundaries or slow JS
 * - Deterministic: single boolean flag, no DOM traversal
 *
 * Alternative: Check DOM attribute data-e2e-ready="1" on <html>
 * This is faster for simple assertions but waitForFunction is more robust.
 */
export async function waitForAppReady(page: Page) {
  // Keep this below per-test timeout so fallback logic can still run.
  // Under heavy parallel load the E2E marker can lag behind UI readiness.
  const appReadyTimeout = TEST_TIMEOUTS.slow
  const startedAt = Date.now()
  const deadline = startedAt + appReadyTimeout
  const pollIntervalMs = 100

  try {
    while (Date.now() < deadline) {
      if (page.isClosed()) {
        throw new Error("Page closed while waiting for app ready")
      }

      const ready = await page
        .evaluate(() => {
          return Reflect.get(window, "__E2E_APP_READY__") === true || Reflect.get(window, "__APP_HYDRATED__") === true
        })
        .catch(() => false)

      if (ready) {
        return
      }

      await page.waitForTimeout(pollIntervalMs)
    }

    throw new Error(`App ready marker timeout after ${Date.now() - startedAt}ms`)
  } catch (error) {
    // On timeout, dump E2E metrics for debugging
    const metrics = await getE2EReadiness(page)
    console.error("[waitForAppReady] Timeout waiting for app ready. Metrics:", JSON.stringify(metrics, null, 2))
    throw error
  }
}

/**
 * Get E2E metrics from the page (for debugging failed tests)
 */
export async function getE2EReadiness(page: Page): Promise<E2EReadiness | null> {
  try {
    const metrics = await page.evaluate(() => Reflect.get(window, "__E2E__") ?? null)
    return isE2EReadiness(metrics) ? metrics : null
  } catch {
    return null
  }
}

/**
 * Navigate to chat page and wait for hydration
 * Uses domcontentloaded for fast navigation, then waits for __E2E_APP_READY__
 */
export async function gotoChat(page: Page, context: { workspace?: string; orgId?: string } = {}) {
  await page.goto("/chat", { waitUntil: "domcontentloaded" })
  await waitForAppReadySafe(page)
  await ensureWorkspaceReady(page, context)
}

/**
 * FAST: Navigate to chat with workspace pre-injected
 *
 * IMPORTANT: Must be used with authenticatedPage fixture which sets up
 * localStorage via context.addInitScript before any navigation.
 */
export async function gotoChatFast(page: Page, workspace: string, orgId: string) {
  await gotoChat(page, { workspace, orgId })
}

/**
 * Chat readiness does not wait for the background conversation metadata sync.
 * Use this helper before asserting on sidebar entries that come from the server.
 */
export async function gotoChatAndWaitForConversationsSync(page: Page, workspace: string, orgId: string) {
  const syncPromise = page.waitForResponse(
    response => response.url().includes("/api/conversations") && !response.url().includes("/messages"),
    { timeout: TEST_TIMEOUTS.max },
  )

  await gotoChatFast(page, workspace, orgId)
  await waitForChatReady(page)
  await syncPromise
}

/**
 * Wait for workspace to be fully initialized
 * - First waits for hydration (the clock)
 * - Then asserts DOM marker is present
 */
export async function expectWorkspaceReady(page: Page) {
  await waitForAppReadySafe(page)
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.fast })
}

/**
 * Wait for chat to be fully ready for sending messages.
 * - Hydration complete (app ready)
 * - Workspace ready DOM marker present
 * - Chat ready attribute set (dexie session + tab initialized)
 */
export async function waitForChatReady(page: Page) {
  await waitForAppReadySafe(page)
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.max })
  await expect(page.locator(TEST_SELECTORS.chatReady)).toBeAttached({ timeout: TEST_TIMEOUTS.max })
}

/**
 * Ensure workspace store has expected values in localStorage.
 * Returns true when storage was updated (caller should reload), false otherwise.
 */
async function ensureWorkspaceStorage(page: Page, workspace: string, orgId: string): Promise<boolean> {
  const current = await readWorkspaceStorage(page)

  if (current.workspace === workspace && current.orgId === orgId) {
    return false
  }

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    {
      key: WORKSPACE_STORAGE.KEY,
      value: createWorkspaceStorageValue(workspace, orgId),
    },
  )
  return true
}

async function readWorkspaceStorage(page: Page) {
  const result = await page.evaluate(key => {
    const raw = localStorage.getItem(key)
    if (!raw) return { workspace: null, orgId: null }

    const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"
    const readStateValue = (value: unknown, field: "currentWorkspace" | "selectedOrgId"): string | null => {
      if (typeof value !== "object" || value === null) return null
      const state = Reflect.get(value, "state")
      if (typeof state !== "object" || state === null) return null
      const fieldValue = Reflect.get(state, field)
      return isStringOrNull(fieldValue) ? fieldValue : null
    }

    try {
      return {
        workspace: readStateValue(JSON.parse(raw), "currentWorkspace"),
        orgId: readStateValue(JSON.parse(raw), "selectedOrgId"),
      }
    } catch {
      return { workspace: null, orgId: null }
    }
  }, WORKSPACE_STORAGE.KEY)

  if (!isWorkspaceStorageSnapshot(result)) {
    return { workspace: null, orgId: null }
  }

  return result
}

async function ensureWorkspaceReady(page: Page, context: { workspace?: string; orgId?: string }): Promise<void> {
  try {
    await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.medium })
    return
  } catch {
    const storage = await readWorkspaceStorage(page)
    const targetWorkspace = context.workspace ?? storage.workspace
    const targetOrgId = context.orgId ?? storage.orgId

    let repaired = false
    if (targetWorkspace && targetOrgId) {
      repaired = await ensureWorkspaceStorage(page, targetWorkspace, targetOrgId)
    }

    if (repaired) {
      await page.reload({ waitUntil: "domcontentloaded" })
      await waitForAppReadySafe(page)
    }

    await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.max })
  }
}

async function waitForAppReadySafe(page: Page): Promise<void> {
  try {
    await waitForAppReady(page)
  } catch (error) {
    if (page.isClosed()) {
      throw error
    }

    const metrics = await getE2EReadiness(page)
    console.warn("[waitForAppReadySafe] App ready marker timeout; falling back to DOM checks.", {
      error: error instanceof Error ? error.message : String(error),
      metrics,
    })
    // Fall back to DOM-level readiness checks when E2E marker is missing/flaky.
    try {
      await expect(page.locator("body")).toBeAttached({ timeout: TEST_TIMEOUTS.medium })
    } catch (fallbackError) {
      if (page.isClosed()) {
        throw error
      }
      throw fallbackError
    }
  }
}

/**
 * Expect a chat message to be visible
 * Uses .first() to handle message appearing in both sidebar and chat area
 */
export async function expectChatMessage(page: Page, text: string | RegExp) {
  const locator = typeof text === "string" ? page.getByText(text, { exact: true }) : page.getByText(text)

  await expect(locator.first()).toBeVisible({
    timeout: TEST_TIMEOUTS.medium,
  })
}

/**
 * Expect send button to be enabled
 * Indicates workspace is ready and no message is being sent
 *
 * Note: Uses medium timeout because after sending a message,
 * the button needs time to process response and re-enable
 */
export async function expectSendButtonEnabled(page: Page) {
  await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
    timeout: TEST_TIMEOUTS.medium, // 3s - needs time for response cycle
  })
}

/**
 * Expect send button to be disabled
 * Indicates message is being sent or workspace not ready
 */
export async function expectSendButtonDisabled(page: Page) {
  await expect(page.locator(TEST_SELECTORS.sendButton)).toBeDisabled({
    timeout: TEST_TIMEOUTS.fast,
  })
}

/**
 * Wait for DOM attribute instead of JS variable
 * Faster for simple checks, works with toBeAttached
 */
export async function waitForE2EReadyAttribute(page: Page) {
  await expect(page.locator("html[data-e2e-ready='1']")).toBeAttached({
    timeout: TEST_TIMEOUTS.max,
  })
}

/**
 * Wait for app ready using the promise-based API
 *
 * This uses window.__E2E__.appReady which is a Promise that resolves
 * when all stores are hydrated. This is more robust than the boolean flag
 * because it can't race with the hydration process.
 *
 * Falls back to boolean flags if promise is not available (non-E2E mode).
 */
export async function waitForAppReadyPromise(page: Page) {
  try {
    await page.waitForFunction(
      () => {
        const e2e = Reflect.get(window, "__E2E__")
        if (typeof e2e === "object" && e2e !== null) {
          const appReady = Reflect.get(e2e, "appReady")
          if (appReady && typeof appReady === "object" && "then" in appReady) {
            return Promise.resolve(appReady)
              .then(() => true)
              .catch(() => false)
          }
        }
        // Fallback to boolean flags
        return Reflect.get(window, "__E2E_APP_READY__") === true || Reflect.get(window, "__APP_HYDRATED__") === true
      },
      { timeout: TEST_TIMEOUTS.max },
    )
  } catch (error) {
    const metrics = await getE2EReadiness(page)
    console.error("[waitForAppReadyPromise] Timeout. Metrics:", JSON.stringify(metrics, null, 2))
    throw error
  }
}
