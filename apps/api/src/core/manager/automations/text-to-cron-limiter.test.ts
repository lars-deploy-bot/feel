import { beforeEach, describe, expect, it, vi } from "vitest"
import { RateLimitError } from "../../../infra/errors"

// Mock Redis with a fake sorted set implementation
const fakeZSets = new Map<string, Map<string, number>>()

const mockMulti = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
}

const mockRedis = {
  multi: vi.fn(() => mockMulti),
  zrem: vi.fn(),
}

vi.mock("@webalive/redis", () => ({
  createRedisClient: vi.fn(() => mockRedis),
}))

vi.mock("../../../config/env", () => ({
  env: { REDIS_URL: "redis://localhost:6379" },
}))

import { checkTextToCronLimit } from "./text-to-cron-limiter"

describe("checkTextToCronLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeZSets.clear()
  })

  it("allows requests under the limit", async () => {
    // ZCARD returns 3 (under limit of 10)
    mockMulti.exec.mockResolvedValueOnce([
      [null, 0], // zremrangebyscore
      [null, 3], // zcard — 3 requests in window
      [null, 1], // zadd
      [null, 1], // expire
    ])

    await expect(checkTextToCronLimit("user_123")).resolves.toBeUndefined()
  })

  it("throws RateLimitError when at limit", async () => {
    // ZCARD returns 10 (at limit)
    mockMulti.exec.mockResolvedValueOnce([
      [null, 0],
      [null, 10], // at limit
      [null, 1],
      [null, 1],
    ])

    await expect(checkTextToCronLimit("user_spammer")).rejects.toThrow(RateLimitError)
    // Should undo the ZADD
    expect(mockRedis.zrem).toHaveBeenCalled()
  })

  it("throws RateLimitError when over limit", async () => {
    mockMulti.exec.mockResolvedValueOnce([
      [null, 0],
      [null, 15], // way over limit
      [null, 1],
      [null, 1],
    ])

    await expect(checkTextToCronLimit("user_spammer")).rejects.toThrow(RateLimitError)
  })

  it("throws on Redis pipeline failure", async () => {
    mockMulti.exec.mockResolvedValueOnce(null)

    await expect(checkTextToCronLimit("user_123")).rejects.toThrow("Redis pipeline returned null")
  })

  it("throws on Redis ZCARD error", async () => {
    mockMulti.exec.mockResolvedValueOnce([
      [null, 0],
      [new Error("Redis connection lost"), null], // ZCARD error
      [null, 1],
      [null, 1],
    ])

    await expect(checkTextToCronLimit("user_123")).rejects.toThrow("Redis connection lost")
  })

  it("uses different keys per user", async () => {
    mockMulti.exec.mockResolvedValue([
      [null, 0],
      [null, 0],
      [null, 1],
      [null, 1],
    ])

    await checkTextToCronLimit("user_a")
    await checkTextToCronLimit("user_b")

    // Both calls should go through (separate keys)
    expect(mockRedis.multi).toHaveBeenCalledTimes(2)
  })
})
