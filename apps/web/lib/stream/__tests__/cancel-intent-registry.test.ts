import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearCancelIntent,
  consumeCancelIntent,
  getCancelIntentCount,
  hasCancelIntent,
  registerCancelIntent,
} from "../cancel-intent-registry"

describe("cancel-intent-registry", () => {
  const conversationKey = "user-1::workspace::tab-group::tab"

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-28T00:00:00Z"))
  })

  afterEach(() => {
    clearCancelIntent(conversationKey)
    vi.useRealTimers()
  })

  it("registers and consumes an intent for the same user", () => {
    registerCancelIntent(conversationKey, "user-1")
    expect(hasCancelIntent(conversationKey, "user-1")).toBe(true)
    expect(getCancelIntentCount()).toBe(1)

    const consumed = consumeCancelIntent(conversationKey, "user-1")
    expect(consumed).toBe(true)
    expect(hasCancelIntent(conversationKey, "user-1")).toBe(false)
    expect(getCancelIntentCount()).toBe(0)
  })

  it("does not allow another user to consume intent", () => {
    registerCancelIntent(conversationKey, "user-1")

    const consumed = consumeCancelIntent(conversationKey, "user-2")
    expect(consumed).toBe(false)
    expect(hasCancelIntent(conversationKey, "user-1")).toBe(true)
  })

  it("expires intents after ttl", () => {
    registerCancelIntent(conversationKey, "user-1")
    expect(hasCancelIntent(conversationKey, "user-1")).toBe(true)

    vi.advanceTimersByTime(15_001)

    expect(hasCancelIntent(conversationKey, "user-1")).toBe(false)
    expect(getCancelIntentCount()).toBe(0)
  })
})
