import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@webalive/env/server", () => ({
  getRedisUrl: () => null,
}))

import {
  clearCancelIntent,
  clearCancelIntentByRequestId,
  consumeCancelIntent,
  consumeCancelIntentByRequestId,
  getCancelIntentCount,
  hasCancelIntent,
  hasCancelIntentByRequestId,
  registerCancelIntent,
  registerCancelIntentByRequestId,
} from "../cancel-intent-registry"

describe("cancel-intent-registry", () => {
  const conversationKey = "user-1::workspace::tab-group::tab"

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-28T00:00:00Z"))
  })

  afterEach(async () => {
    await clearCancelIntent(conversationKey)
    await clearCancelIntentByRequestId("req-1")
    vi.useRealTimers()
  })

  it("registers and consumes an intent for the same user", async () => {
    await registerCancelIntent(conversationKey, "user-1")
    await expect(hasCancelIntent(conversationKey, "user-1")).resolves.toBe(true)
    await expect(getCancelIntentCount()).resolves.toBe(1)

    const consumed = await consumeCancelIntent(conversationKey, "user-1")
    expect(consumed).toBe(true)
    await expect(hasCancelIntent(conversationKey, "user-1")).resolves.toBe(false)
    await expect(getCancelIntentCount()).resolves.toBe(0)
  })

  it("does not allow another user to consume intent", async () => {
    await registerCancelIntent(conversationKey, "user-1")

    const consumed = await consumeCancelIntent(conversationKey, "user-2")
    expect(consumed).toBe(false)
    await expect(hasCancelIntent(conversationKey, "user-1")).resolves.toBe(true)
  })

  it("expires intents after ttl", async () => {
    await registerCancelIntent(conversationKey, "user-1")
    await expect(hasCancelIntent(conversationKey, "user-1")).resolves.toBe(true)

    vi.advanceTimersByTime(15_001)

    await expect(hasCancelIntent(conversationKey, "user-1")).resolves.toBe(false)
    await expect(getCancelIntentCount()).resolves.toBe(0)
  })

  it("supports requestId-scoped intents", async () => {
    await registerCancelIntentByRequestId("req-1", "user-1")
    await expect(hasCancelIntentByRequestId("req-1", "user-1")).resolves.toBe(true)

    const consumed = await consumeCancelIntentByRequestId("req-1", "user-1")
    expect(consumed).toBe(true)
    await expect(hasCancelIntentByRequestId("req-1", "user-1")).resolves.toBe(false)
  })
})
