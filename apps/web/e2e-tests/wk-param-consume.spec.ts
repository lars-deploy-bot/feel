/**
 * E2E test for ?wk= URL parameter consume-once behavior.
 *
 * Bug (#343): The ?wk= param was never cleared, causing a loop where
 * switching workspace via sidebar reverted back to the URL value.
 *
 * Fix: consume the param once on mount, set workspace, clear param.
 * A ref guard prevents re-consumption even if the effect re-runs.
 *
 * @see https://github.com/lars-deploy-bot/feel/issues/343
 */

import { parseWorkspaceStorageValue, WORKSPACE_STORAGE } from "@webalive/shared"
import { expect, test } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { waitForChatReady } from "./helpers/assertions"

test.describe("?wk= URL param consume-once (#343)", () => {
  test("deep link sets workspace and clears ?wk= from URL", async ({ authenticatedPage, workerTenant }) => {
    // Navigate with ?wk= param (deep link from widget "Edit me" button)
    await authenticatedPage.goto(`/chat?wk=${workerTenant.workspace}`, { waitUntil: "domcontentloaded" })
    await waitForChatReady(authenticatedPage)

    // Verify workspace is set
    const storageValue = await authenticatedPage.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
    expect(parseWorkspaceStorageValue(storageValue).state.currentWorkspace).toBe(workerTenant.workspace)

    // Verify ?wk= is removed from URL (consumed)
    await expect(async () => {
      const url = new URL(authenticatedPage.url())
      expect(url.searchParams.has("wk")).toBe(false)
    }).toPass({ timeout: TEST_TIMEOUTS.medium })
  })

  test("switching workspace after deep link does NOT revert (#343)", async ({ authenticatedPage, workerTenant }) => {
    const SECOND_WORKSPACE = "switched-workspace.test.example"

    // Mock all-workspaces to include both workspaces
    await authenticatedPage.route("**/api/auth/all-workspaces**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-e2e-mock": "1" },
        body: JSON.stringify({
          ok: true,
          workspaces: {
            [workerTenant.orgId]: [workerTenant.workspace, SECOND_WORKSPACE],
          },
        }),
      })
    })

    await authenticatedPage.route("**/api/auth/workspaces**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-e2e-mock": "1" },
        body: JSON.stringify({
          ok: true,
          workspaces: [workerTenant.workspace, SECOND_WORKSPACE],
        }),
      })
    })

    // Step 1: Navigate with ?wk= param (deep link)
    await authenticatedPage.goto(`/chat?wk=${workerTenant.workspace}`, { waitUntil: "domcontentloaded" })
    await waitForChatReady(authenticatedPage)

    // Verify initial workspace is set from URL param
    const initialStorage = await authenticatedPage.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
    expect(parseWorkspaceStorageValue(initialStorage).state.currentWorkspace).toBe(workerTenant.workspace)

    // Wait for ?wk= to be cleared from URL
    await expect(async () => {
      const url = new URL(authenticatedPage.url())
      expect(url.searchParams.has("wk")).toBe(false)
    }).toPass({ timeout: TEST_TIMEOUTS.medium })

    // Step 2: Simulate user switching workspace via sidebar
    // This is equivalent to clicking a different project in the workspace switcher,
    // which calls setCurrentWorkspace() on the Zustand store
    await authenticatedPage.evaluate(
      ({ storageKey, newWorkspace, orgId }) => {
        const raw = localStorage.getItem(storageKey)
        if (!raw) throw new Error("workspace storage missing")
        const parsed = JSON.parse(raw)
        parsed.state.currentWorkspace = newWorkspace
        parsed.state.selectedOrgId = orgId
        localStorage.setItem(storageKey, JSON.stringify(parsed))

        // Dispatch storage event to trigger Zustand's cross-tab sync
        window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue: JSON.stringify(parsed) }))
      },
      { storageKey: WORKSPACE_STORAGE.KEY, newWorkspace: SECOND_WORKSPACE, orgId: workerTenant.orgId },
    )

    // Step 3: Verify workspace stays at the switched value (NOT reverted to original)
    // The old bug: effect sees wkParam !== workspace and forces it back
    // Poll until workspace equals the switched value (no fixed sleep)
    await expect
      .poll(
        async () => {
          const raw = await authenticatedPage.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
          return parseWorkspaceStorageValue(raw).state.currentWorkspace
        },
        { timeout: TEST_TIMEOUTS.slow },
      )
      .toBe(SECOND_WORKSPACE)

    // Verify ?wk= is NOT back in the URL
    const finalUrl = new URL(authenticatedPage.url())
    expect(finalUrl.searchParams.has("wk")).toBe(false)
  })
})
