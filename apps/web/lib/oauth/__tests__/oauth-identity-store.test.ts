import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the shared service client
const mockRpc = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServicePublicClient: () => ({ rpc: mockRpc }),
}))

// Import after mocks
const { OAuthIdentityStore } = await import("../oauth-identity-store")

describe("OAuthIdentityStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("upsert", () => {
    it("returns success for a new identity", async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true, conflict: false, existing_user_id: null }],
        error: null,
      })

      const result = await OAuthIdentityStore.upsert("user-123", "google", "google-id-456", "user@example.com")

      expect(result).toEqual({
        success: true,
        conflict: false,
      })

      expect(mockRpc).toHaveBeenCalledWith("upsert_oauth_identity", {
        p_user_id: "user-123",
        p_provider: "google",
        p_provider_user_id: "google-id-456",
        p_provider_email: "user@example.com",
      })
    })

    it("returns success when same user reconnects", async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true, conflict: false, existing_user_id: null }],
        error: null,
      })

      const result = await OAuthIdentityStore.upsert("user-123", "google", "google-id-456")

      expect(result).toEqual({
        success: true,
        conflict: false,
      })
    })

    it("returns conflict when different user owns the external account", async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: false, conflict: true, existing_user_id: "other-user-789" }],
        error: null,
      })

      const result = await OAuthIdentityStore.upsert("user-123", "google", "google-id-456")

      expect(result).toEqual({
        success: false,
        conflict: true,
        existingUserId: "other-user-789",
      })
    })

    it("omits email when not provided", async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true, conflict: false, existing_user_id: null }],
        error: null,
      })

      await OAuthIdentityStore.upsert("user-123", "linear", "linear-id-456")

      expect(mockRpc).toHaveBeenCalledWith("upsert_oauth_identity", {
        p_user_id: "user-123",
        p_provider: "linear",
        p_provider_user_id: "linear-id-456",
        p_provider_email: undefined,
      })
    })

    it("throws on RPC error", async () => {
      mockRpc.mockResolvedValue({ error: { message: "DB error" } })

      await expect(OAuthIdentityStore.upsert("user-123", "google", "id")).rejects.toThrow(
        "[OAuthIdentityStore] Failed to upsert identity: DB error",
      )
    })

    it("throws on unexpected empty response", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null })

      await expect(OAuthIdentityStore.upsert("user-123", "google", "id")).rejects.toThrow(
        "[OAuthIdentityStore] Unexpected empty response",
      )
    })
  })
})
