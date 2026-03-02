import { STREAM_ENV } from "@webalive/shared"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getMessageDbName } from "../messageDb"

describe("getMessageDbName", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses NEXT_PUBLIC_STREAM_ENV when set", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAM_ENV", STREAM_ENV.STAGING)
    vi.stubEnv("STREAM_ENV", STREAM_ENV.LOCAL)

    expect(getMessageDbName("user-1")).toBe("claude-messages-staging-user-1")
  })

  it("falls back to STREAM_ENV when NEXT_PUBLIC_STREAM_ENV is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAM_ENV", "")
    vi.stubEnv("STREAM_ENV", STREAM_ENV.DEV)

    expect(getMessageDbName("user-2")).toBe("claude-messages-dev-user-2")
  })

  it("accepts standalone as a valid message db environment", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAM_ENV", STREAM_ENV.STANDALONE)
    vi.stubEnv("STREAM_ENV", STREAM_ENV.LOCAL)

    expect(getMessageDbName("user-3")).toBe("claude-messages-standalone-user-3")
  })

  it("throws when environment is missing or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAM_ENV", "")
    vi.stubEnv("STREAM_ENV", "invalid-env")

    expect(() => getMessageDbName("user-4")).toThrow("Invalid message DB environment")
  })
})
