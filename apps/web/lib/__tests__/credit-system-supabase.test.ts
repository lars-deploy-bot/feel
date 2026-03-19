/**
 * Supabase Credit System Integration Tests
 *
 * Tests the complete credit flow with Supabase PostgreSQL:
 * 1. Reading credits from iam.orgs
 * 2. Deducting credits when Claude is used
 * 3. Updating database correctly
 * 4. Handling insufficient credits
 * 5. Domain → Org mapping via app.domains
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { assertSupabaseManagementEnv, assertSupabaseServiceEnv } from "@/lib/test-helpers/integration-env"
import {
  calculateLLMTokenCost,
  ensureSufficientCredits,
  getOrgCredits,
  hasEnoughCredits,
  type LLMTokenUsage,
  updateOrgCredits,
} from "@/lib/tokens"
import { createTestAppClient, createTestIamClient } from "./supabase-test-utils"

assertSupabaseServiceEnv()
assertSupabaseManagementEnv()

describe("Supabase Credit System Integration", () => {
  const TEST_ORG_ID = `test-org-${Date.now()}`
  const TEST_DOMAIN = `test-credits-${Date.now()}.example.com`
  const INITIAL_CREDITS = 100

  beforeAll(async () => {
    // Create test org with credits in IAM schema
    const iam = createTestIamClient()
    const { error: orgError } = await iam.from("orgs").insert({
      org_id: TEST_ORG_ID,
      name: "Test Organization",
      credits: INITIAL_CREDITS,
      is_test_env: true,
    })

    if (orgError) {
      throw new Error(`Failed to create test org: ${orgError.message}`)
    }

    // Create test domain in app schema linking to org
    const app = createTestAppClient()
    const { error: domainError } = await app.from("domains").insert({
      hostname: TEST_DOMAIN,
      port: 9999,
      org_id: TEST_ORG_ID,
      is_test_env: true,
    })

    if (domainError) {
      throw new Error(`Failed to create test domain: ${domainError.message}`)
    }
  })

  afterAll(async () => {
    // Clean up test data
    const app = createTestAppClient()
    const iam = createTestIamClient()

    await app.from("domains").delete().eq("hostname", TEST_DOMAIN)
    await iam.from("orgs").delete().eq("org_id", TEST_ORG_ID)
  })

  describe("getOrgCredits()", () => {
    test("should load credits from Supabase via domain → org mapping", async () => {
      const credits = await getOrgCredits(TEST_DOMAIN)
      expect(credits).toBe(INITIAL_CREDITS)
    })

    test("should return null for non-existent domain", async () => {
      const credits = await getOrgCredits("non-existent-domain.com")
      expect(credits).toBeNull()
    })

    test("should return 0 for org with 0 credits", async () => {
      await updateOrgCredits(TEST_DOMAIN, 0)
      const credits = await getOrgCredits(TEST_DOMAIN)
      expect(credits).toBe(0)

      // Reset for other tests
      await updateOrgCredits(TEST_DOMAIN, INITIAL_CREDITS)
    })
  })

  describe("hasEnoughCredits()", () => {
    test("should return true when credits are sufficient", async () => {
      const hasCredits = await hasEnoughCredits(TEST_DOMAIN, 50)
      expect(hasCredits).toBe(true)
    })

    test("should return false when credits are insufficient", async () => {
      const hasCredits = await hasEnoughCredits(TEST_DOMAIN, 150)
      expect(hasCredits).toBe(false)
    })

    test("should return false for non-existent domain", async () => {
      const hasCredits = await hasEnoughCredits("non-existent.com", 10)
      expect(hasCredits).toBe(false)
    })

    test("should return true when credits exactly match required", async () => {
      const hasCredits = await hasEnoughCredits(TEST_DOMAIN, INITIAL_CREDITS)
      expect(hasCredits).toBe(true)
    })
  })

  describe("ensureSufficientCredits()", () => {
    test("should not throw when credits are sufficient", async () => {
      await expect(ensureSufficientCredits(TEST_DOMAIN)).resolves.toBeUndefined()
    })

    test("should throw when credits are 0", async () => {
      await updateOrgCredits(TEST_DOMAIN, 0)
      await expect(ensureSufficientCredits(TEST_DOMAIN)).rejects.toThrow("Insufficient credits")

      // Reset for other tests
      await updateOrgCredits(TEST_DOMAIN, INITIAL_CREDITS)
    })

    test("should throw for non-existent domain", async () => {
      await expect(ensureSufficientCredits("non-existent.com")).rejects.toThrow("Workspace not found")
    })
  })

  describe("calculateLLMTokenCost()", () => {
    test("should calculate total tokens correctly", () => {
      const usage: LLMTokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
      }
      expect(calculateLLMTokenCost(usage)).toBe(150)
    })

    test("should ignore cache tokens", () => {
      const usage: LLMTokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      }
      // Should only count input + output, ignore cache
      expect(calculateLLMTokenCost(usage)).toBe(150)
    })
  })

  describe("updateOrgCredits()", () => {
    test("should update org credits via domain", async () => {
      const newCredits = 250
      const success = await updateOrgCredits(TEST_DOMAIN, newCredits)

      expect(success).toBe(true)

      const balance = await getOrgCredits(TEST_DOMAIN)
      expect(balance).toBe(newCredits)

      // Reset for other tests
      await updateOrgCredits(TEST_DOMAIN, INITIAL_CREDITS)
    })

    test("should return false for non-existent domain", async () => {
      const success = await updateOrgCredits("non-existent.com", 100)
      expect(success).toBe(false)
    })
  })
})
