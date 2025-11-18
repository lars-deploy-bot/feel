/**
 * Playwright Fixtures for E2E Tests
 *
 * Fixtures provide automatic setup/teardown of test resources.
 * Using dynamic imports to avoid loading server code during test discovery.
 */

import { test as base } from "@playwright/test"

export interface TestUser {
  userId: string
  email: string
  orgId: string
  orgName: string
}

type TestFixtures = {
  /** Test user with organization for deployment tests */
  deployUser: TestUser
}

export const test = base.extend<TestFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures require empty object when no dependencies
  deployUser: async ({}, use) => {
    // Setup: Create test user (dynamic import - safe during test execution)
    const { createTestUser } = await import("@/lib/test-helpers/auth-test-helper")
    const user = await createTestUser("deploy-e2e@bridge-playwright.internal")

    console.log(`[Fixture] Created deployUser: ${user.email} (org: ${user.orgId})`)

    // Provide to test
    await use(user)

    // Teardown: Clean up after test
    const { cleanupTestUser } = await import("@/lib/test-helpers/auth-test-helper")
    await cleanupTestUser(user.userId)

    console.log(`[Fixture] Cleaned up deployUser: ${user.email}`)
  },
})

export { expect } from "@playwright/test"
