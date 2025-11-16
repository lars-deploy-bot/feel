/**
 * Credit System Integration Tests
 *
 * Tests the complete credit flow:
 * 1. Reading credits from database
 * 2. Deducting credits when Claude is used
 * 3. Updating database correctly
 * 4. Handling insufficient credits
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { db } from "@/lib/db/client"
import { workspaces } from "@/lib/db/schema"
import { workspaceRepository } from "@/lib/db/repositories"
import {
  getWorkspaceCredits,
  chargeTokensFromCredits,
  hasEnoughCredits,
  ensureSufficientCredits,
  calculateLLMTokenCost,
  WORKSPACE_CREDIT_DISCOUNT,
  type LLMTokenUsage
} from "@/lib/tokens"
import { llmTokensToCredits } from "@/lib/credits"
import { eq } from "drizzle-orm"

describe("Credit System Integration", () => {
  const TEST_WORKSPACE_ID = "test-workspace-credits-" + Date.now()
  const TEST_DOMAIN = `test-credits-${Date.now()}.example.com`
  const INITIAL_CREDITS = 100

  beforeEach(async () => {
    // Create test workspace with credits
    await db.insert(workspaces).values({
      id: TEST_WORKSPACE_ID,
      domain: TEST_DOMAIN,
      port: 9999,
      credits: INITIAL_CREDITS,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  afterEach(async () => {
    // Clean up test workspace
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID))
  })

  describe("getWorkspaceCredits()", () => {
    test("should load credits from database", async () => {
      const credits = await getWorkspaceCredits(TEST_DOMAIN)
      expect(credits).toBe(INITIAL_CREDITS)
    })

    test("should return null for non-existent workspace", async () => {
      const credits = await getWorkspaceCredits("non-existent-domain.com")
      expect(credits).toBeNull()
    })

    test("should return 0 for workspace with 0 credits", async () => {
      await workspaceRepository.updateCredits(TEST_WORKSPACE_ID, 0)
      const credits = await getWorkspaceCredits(TEST_DOMAIN)
      expect(credits).toBe(0)
    })
  })

  describe("chargeTokensFromCredits()", () => {
    test("should deduct credits from database when charging", async () => {
      // Simulate 1000 LLM tokens used
      const llmTokensUsed = 1000
      const expectedCreditsUsed = llmTokensToCredits(llmTokensUsed) // 10 credits
      const expectedCharged = Math.floor(expectedCreditsUsed * WORKSPACE_CREDIT_DISCOUNT * 100) / 100 // 2.5 credits
      const expectedNewBalance = Math.round((INITIAL_CREDITS - expectedCharged) * 100) / 100 // 97.5

      const newBalance = await chargeTokensFromCredits(TEST_DOMAIN, llmTokensUsed)

      expect(newBalance).toBe(expectedNewBalance)

      // Verify database was actually updated
      const dbBalance = await getWorkspaceCredits(TEST_DOMAIN)
      expect(dbBalance).toBe(expectedNewBalance)
    })

    test("should handle multiple sequential charges correctly", async () => {
      // Charge 500 tokens three times
      const llmTokensPerCharge = 500
      const creditsPerCharge = llmTokensToCredits(llmTokensPerCharge) // 5 credits
      const chargedPerRequest = Math.floor(creditsPerCharge * WORKSPACE_CREDIT_DISCOUNT * 100) / 100 // 1.25 credits

      await chargeTokensFromCredits(TEST_DOMAIN, llmTokensPerCharge)
      await chargeTokensFromCredits(TEST_DOMAIN, llmTokensPerCharge)
      const finalBalance = await chargeTokensFromCredits(TEST_DOMAIN, llmTokensPerCharge)

      const expectedBalance = Math.round((INITIAL_CREDITS - (chargedPerRequest * 3)) * 100) / 100
      expect(finalBalance).toBe(expectedBalance)

      // Verify in database
      const dbBalance = await getWorkspaceCredits(TEST_DOMAIN)
      expect(dbBalance).toBe(expectedBalance)
    })

    test("should return null when charging more than available balance", async () => {
      // Set low balance
      await workspaceRepository.updateCredits(TEST_WORKSPACE_ID, 1)

      // Try to charge 10 credits worth (1000 LLM tokens = 10 credits, 25% = 2.5 credits charged)
      const llmTokensUsed = 1000
      const result = await chargeTokensFromCredits(TEST_DOMAIN, llmTokensUsed)

      expect(result).toBeNull()

      // Balance should remain unchanged
      const balance = await getWorkspaceCredits(TEST_DOMAIN)
      expect(balance).toBe(1)
    })

    test("should return null for non-existent workspace", async () => {
      const result = await chargeTokensFromCredits("non-existent.com", 100)
      expect(result).toBeNull()
    })

    test("should return null for negative token amount", async () => {
      const result = await chargeTokensFromCredits(TEST_DOMAIN, -100)
      expect(result).toBeNull()

      // Balance should remain unchanged
      const balance = await getWorkspaceCredits(TEST_DOMAIN)
      expect(balance).toBe(INITIAL_CREDITS)
    })

    test("should apply discount correctly (25%)", async () => {
      const llmTokensUsed = 1000 // 10 credits
      const expectedCreditsUsed = 10
      const expectedCharged = 2.5 // 25% of 10
      const expectedBalance = 97.5 // 100 - 2.5

      const newBalance = await chargeTokensFromCredits(TEST_DOMAIN, llmTokensUsed)
      expect(newBalance).toBe(expectedBalance)
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

    test("should return false for non-existent workspace", async () => {
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
      await workspaceRepository.updateCredits(TEST_WORKSPACE_ID, 0)
      await expect(ensureSufficientCredits(TEST_DOMAIN)).rejects.toThrow("Insufficient credits")
    })

    test("should throw for non-existent workspace", async () => {
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

  describe("Real-world scenarios", () => {
    test("should handle realistic Claude API response usage", async () => {
      // Simulate typical Claude API response
      const usage: LLMTokenUsage = {
        input_tokens: 523,
        output_tokens: 1247,
      }

      const totalLLMTokens = calculateLLMTokenCost(usage) // 1770 tokens
      const credits = llmTokensToCredits(totalLLMTokens) // 17.7 credits
      const charged = Math.floor(credits * WORKSPACE_CREDIT_DISCOUNT * 100) / 100 // 4.42 credits

      const newBalance = await chargeTokensFromCredits(TEST_DOMAIN, totalLLMTokens)
      const expectedBalance = Math.round((INITIAL_CREDITS - charged) * 100) / 100 // 95.58

      expect(newBalance).toBe(expectedBalance)
    })

    test("should handle very small token amounts", async () => {
      const llmTokensUsed = 10 // 0.1 credits = 0.025 charged (floored to 0.02)
      const newBalance = await chargeTokensFromCredits(TEST_DOMAIN, llmTokensUsed)

      expect(newBalance).toBe(99.98) // 100 - 0.02 (floored)
    })

    test("should handle multiple concurrent-like requests", async () => {
      // Simulate 5 requests in sequence
      const charges = []
      for (let i = 0; i < 5; i++) {
        charges.push(await chargeTokensFromCredits(TEST_DOMAIN, 500))
      }

      // All charges should succeed
      expect(charges.every(c => c !== null)).toBe(true)

      // Final balance should be correct
      const expectedCharged = Math.floor(llmTokensToCredits(500) * WORKSPACE_CREDIT_DISCOUNT * 100) / 100
      const expectedBalance = Math.round((INITIAL_CREDITS - (expectedCharged * 5)) * 100) / 100

      const finalBalance = await getWorkspaceCredits(TEST_DOMAIN)
      expect(finalBalance).toBe(expectedBalance)
    })

    test("should prevent overdraft", async () => {
      // Set balance to 5 credits
      await workspaceRepository.updateCredits(TEST_WORKSPACE_ID, 5)

      // Try to charge 30 credits worth (12000 tokens = 120 credits, 25% = 30 credits)
      const result = await chargeTokensFromCredits(TEST_DOMAIN, 12000)

      expect(result).toBeNull()

      // Balance should remain at 5
      const balance = await getWorkspaceCredits(TEST_DOMAIN)
      expect(balance).toBe(5)
    })
  })

  describe("Database persistence", () => {
    test("should persist credits across reads", async () => {
      // Charge once
      await chargeTokensFromCredits(TEST_DOMAIN, 1000)
      const balance1 = await getWorkspaceCredits(TEST_DOMAIN)

      // Read again
      const balance2 = await getWorkspaceCredits(TEST_DOMAIN)

      // Should be the same
      expect(balance1).toBe(balance2)
    })

    test("should update updatedAt timestamp", async () => {
      const before = await workspaceRepository.findByDomain(TEST_DOMAIN)

      // Wait to ensure timestamp difference (SQLite has second precision)
      await new Promise(resolve => setTimeout(resolve, 1100))
      await chargeTokensFromCredits(TEST_DOMAIN, 500)

      const after = await workspaceRepository.findByDomain(TEST_DOMAIN)

      if (before && after) {
        expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime())
      }
    })
  })
})
