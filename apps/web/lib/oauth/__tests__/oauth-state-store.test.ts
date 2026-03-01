import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the shared service client
const mockRpc = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServicePublicClient: () => ({ rpc: mockRpc }),
}))

// Import after mocks
const { OAuthStateStore } = await import("../oauth-state-store")

describe("OAuthStateStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createState", () => {
    it("generates a token and calls RPC with SHA-256 hash", async () => {
      mockRpc.mockResolvedValue({ error: null })

      const token = await OAuthStateStore.createState("google", "user-123")

      // Token is 64 hex chars (32 bytes)
      expect(token).toMatch(/^[a-f0-9]{64}$/)

      // RPC was called with hashed state (not raw token)
      expect(mockRpc).toHaveBeenCalledWith("create_oauth_state", {
        p_state_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_provider: "google",
        p_user_id: "user-123",
        p_expires_at: expect.any(String),
      })

      // Hash should NOT equal the raw token
      const callArgs = mockRpc.mock.calls[0][1]
      expect(callArgs.p_state_hash).not.toBe(token)
    })

    it("throws on RPC error", async () => {
      mockRpc.mockResolvedValue({ error: { message: "DB error" } })

      await expect(OAuthStateStore.createState("google", "user-123")).rejects.toThrow(
        "[OAuthStateStore] Failed to create state: DB error",
      )
    })
  })

  describe("consumeState", () => {
    it("returns valid result for a valid state", async () => {
      mockRpc.mockResolvedValue({
        data: [{ found: true, valid: true, user_id: "user-123", provider: "google", failure_reason: null }],
        error: null,
      })

      const result = await OAuthStateStore.consumeState("some-raw-token")

      expect(result).toEqual({
        valid: true,
        userId: "user-123",
        provider: "google",
      })
    })

    it("returns state_not_found for unknown state", async () => {
      mockRpc.mockResolvedValue({
        data: [{ found: false, valid: false, user_id: null, provider: null, failure_reason: "state_not_found" }],
        error: null,
      })

      const result = await OAuthStateStore.consumeState("unknown-token")

      expect(result).toEqual({
        valid: false,
        failureReason: "state_not_found",
      })
    })

    it("returns state_already_consumed for replay attack", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            found: true,
            valid: false,
            user_id: "user-123",
            provider: "google",
            failure_reason: "state_already_consumed",
          },
        ],
        error: null,
      })

      const result = await OAuthStateStore.consumeState("replayed-token")

      expect(result).toEqual({
        valid: false,
        userId: "user-123",
        provider: "google",
        failureReason: "state_already_consumed",
      })
    })

    it("returns state_expired for expired state", async () => {
      mockRpc.mockResolvedValue({
        data: [{ found: true, valid: false, user_id: "user-123", provider: "google", failure_reason: "state_expired" }],
        error: null,
      })

      const result = await OAuthStateStore.consumeState("expired-token")

      expect(result).toEqual({
        valid: false,
        userId: "user-123",
        provider: "google",
        failureReason: "state_expired",
      })
    })

    it("returns state_not_found when RPC returns empty data", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null })

      const result = await OAuthStateStore.consumeState("some-token")

      expect(result).toEqual({
        valid: false,
        failureReason: "state_not_found",
      })
    })

    it("throws on RPC error", async () => {
      mockRpc.mockResolvedValue({ error: { message: "Connection failed" } })

      await expect(OAuthStateStore.consumeState("some-token")).rejects.toThrow(
        "[OAuthStateStore] Failed to consume state: Connection failed",
      )
    })
  })
})
