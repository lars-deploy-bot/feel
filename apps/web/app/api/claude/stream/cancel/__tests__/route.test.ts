import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test"
import {
  registerCancellation,
  unregisterCancellation,
  getRegistrySize,
} from "@/lib/stream/cancellation-registry"

// Mock requireSessionUser
mock.module("@/features/auth/lib/auth", () => ({
  requireSessionUser: async () => ({ id: "test-user-123" }),
}))

import { POST } from "../route"

describe("POST /api/claude/stream/cancel", () => {
  beforeEach(() => {
    // Clean up any stale registrations
    const initialSize = getRegistrySize()
    if (initialSize > 0) {
      console.warn(`Registry not clean before test: ${initialSize} entries`)
    }
  })

  afterEach(() => {
    // Cleanup: remove any test registrations
    unregisterCancellation("test-req-1")
    unregisterCancellation("test-req-2")
    unregisterCancellation("test-req-3")
  })

  it("should cancel an active stream", async () => {
    let cancelled = false
    const requestId = "test-req-1"
    const userId = "test-user-123"

    // Register a stream
    registerCancellation(requestId, userId, "conv-key", () => {
      cancelled = true
    })

    // Call cancel endpoint
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.status).toBe("cancelled")
    expect(cancelled).toBe(true)
  })

  it("should return already_complete for non-existent stream", async () => {
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId: "non-existent" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.status).toBe("already_complete")
  })

  it("should return 400 for missing both requestId and conversationId", async () => {
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.message).toContain("Either requestId or conversationId is required")
  })

  it("should return 403 when cancelling another user's stream", async () => {
    let cancelled = false
    const requestId = "test-req-2"
    const ownerUserId = "other-user-456"

    // Register a stream owned by different user
    registerCancellation(requestId, ownerUserId, "conv-key", () => {
      cancelled = true
    })

    // Try to cancel as test-user-123
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(cancelled).toBe(false) // Should NOT be cancelled
  })

  it("should be idempotent (calling twice is safe)", async () => {
    let cancelCount = 0
    const requestId = "test-req-3"
    const userId = "test-user-123"

    // Register a stream
    registerCancellation(requestId, userId, "conv-key", () => {
      cancelCount++
    })

    // First call - should cancel
    const req1 = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId }),
      headers: { "Content-Type": "application/json" },
    })

    const response1 = await POST(req1 as any)
    const data1 = await response1.json()

    expect(response1.status).toBe(200)
    expect(data1.status).toBe("cancelled")
    expect(cancelCount).toBe(1)

    // Second call - should return already_complete
    const req2 = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId }),
      headers: { "Content-Type": "application/json" },
    })

    const response2 = await POST(req2 as any)
    const data2 = await response2.json()

    expect(response2.status).toBe(200)
    expect(data2.status).toBe("already_complete")
    expect(cancelCount).toBe(1) // Should NOT increment
  })

  // conversationId fallback tests (super-early Stop case)
  it("should cancel by conversationId when requestId not available", async () => {
    let cancelled = false
    const requestId = "test-req-conv-1"
    const userId = "test-user-123"
    const conversationId = "conv-abc-123"
    const workspace = "test-workspace"
    const convKey = `${userId}::${workspace}::${conversationId}`

    // Register a stream
    registerCancellation(requestId, userId, convKey, () => {
      cancelled = true
    })

    // Call cancel endpoint with conversationId (super-early Stop)
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ conversationId, workspace }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.status).toBe("cancelled")
    expect(data.conversationId).toBe(conversationId)
    expect(cancelled).toBe(true)
  })

  it("should return already_complete for non-existent conversationId", async () => {
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ conversationId: "non-existent", workspace: "test" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.status).toBe("already_complete")
  })

  it("should not find another user's stream when cancelling by conversationId (security by isolation)", async () => {
    let cancelled = false
    const requestId = "test-req-conv-2"
    const ownerUserId = "other-user-456"
    const conversationId = "conv-xyz-789"
    const workspace = "test-workspace"
    const convKey = `${ownerUserId}::${workspace}::${conversationId}`

    // Register a stream owned by different user
    registerCancellation(requestId, ownerUserId, convKey, () => {
      cancelled = true
    })

    // Try to cancel as test-user-123 using conversationId
    // Security: conversationKey is built using caller's userId, so will never match
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ conversationId, workspace }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    // Should return "already_complete" (not found) - users are isolated by conversationKey
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.status).toBe("already_complete")
    expect(cancelled).toBe(false) // Should NOT be cancelled - different user

    // Cleanup
    unregisterCancellation(requestId)
  })

  it("should prefer requestId over conversationId when both provided", async () => {
    let cancelled1 = false
    let cancelled2 = false
    const requestId1 = "test-req-primary"
    const requestId2 = "test-req-fallback"
    const userId = "test-user-123"
    const conversationId = "conv-both-123"
    const workspace = "test-workspace"
    const convKey = `${userId}::${workspace}::${conversationId}`

    // Register two streams: one for requestId, one for conversationKey
    registerCancellation(requestId1, userId, convKey, () => {
      cancelled1 = true
    })
    registerCancellation(requestId2, userId, convKey, () => {
      cancelled2 = true
    })

    // Call cancel endpoint with BOTH requestId and conversationId
    const req = new Request("http://localhost/api/claude/stream/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId: requestId1, conversationId, workspace }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.status).toBe("cancelled")
    expect(data.requestId).toBe(requestId1) // Should use requestId path
    expect(cancelled1).toBe(true) // Primary path
    expect(cancelled2).toBe(false) // Fallback path NOT used

    // Cleanup
    unregisterCancellation(requestId1)
    unregisterCancellation(requestId2)
  })
})
