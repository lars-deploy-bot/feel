import { describe, expect, it } from "vitest"

/**
 * Test that demonstrates the Anthropic API safety mechanism
 *
 * This test verifies that attempting to call the real Anthropic SDK
 * in a unit test will throw an error instead of making a real API call.
 */
describe("Anthropic API Safety", () => {
  it("should block real Anthropic SDK calls in tests", async () => {
    // Dynamic import to avoid top-level import issues
    const { query } = await import("@anthropic-ai/claude-agent-sdk")

    // Attempting to use the SDK should throw an error
    expect(() => query({ prompt: "test" })).toThrow(/Anthropic SDK query\(\) called in test without mocking/)
  })

  it("explains the safety mechanism in error message", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk")

    try {
      query({ prompt: "test" })
      // Should not reach here
      expect.fail("Should have thrown an error")
    } catch (error) {
      const message = (error as Error).message

      // Verify helpful error message
      expect(message).toContain("would make a REAL API call")
      expect(message).toContain("cost money")
      expect(message).toContain("Mock the API response")
    }
  })
})
