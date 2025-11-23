/**
 * E2E Test Setup - Tenant Fixtures
 *
 * Exposes workerIndex and tenant info as fixtures using Playwright's
 * built-in workerInfo.
 */

import { test as base } from "@playwright/test"
import { TEST_CONFIG } from "@webalive/shared"

export const test = base.extend<{
  tenant: { email: string; workspace: string; workerIndex: number }
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring even when no fixtures are used
  tenant: async ({}, use, testInfo) => {
    const workerIndex = testInfo.parallelIndex
    await use({
      workerIndex,
      email: `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${workerIndex}@${TEST_CONFIG.EMAIL_DOMAIN}`,
      workspace: `${TEST_CONFIG.WORKSPACE_PREFIX}${workerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`,
    })
  },
})

export const expect = test.expect
