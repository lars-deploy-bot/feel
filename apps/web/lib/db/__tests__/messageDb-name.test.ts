import { ALIVE_ENV } from "@webalive/shared"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getMessageDbName } from "../messageDb"

describe("getMessageDbName", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses NEXT_PUBLIC_ALIVE_ENV when set", () => {
    vi.stubEnv("NEXT_PUBLIC_ALIVE_ENV", ALIVE_ENV.STAGING)
    vi.stubEnv("ALIVE_ENV", ALIVE_ENV.LOCAL)

    expect(getMessageDbName("user-1")).toBe("claude-messages-staging-user-1")
  })

  it("throws when NEXT_PUBLIC_ALIVE_ENV is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_ALIVE_ENV", "")

    expect(() => getMessageDbName("user-2")).toThrow("Invalid message DB environment")
  })

  it("accepts standalone as a valid message db environment", () => {
    vi.stubEnv("NEXT_PUBLIC_ALIVE_ENV", ALIVE_ENV.STANDALONE)
    vi.stubEnv("ALIVE_ENV", ALIVE_ENV.LOCAL)

    expect(getMessageDbName("user-3")).toBe("claude-messages-standalone-user-3")
  })

  it("throws when environment is missing or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_ALIVE_ENV", "")
    vi.stubEnv("ALIVE_ENV", "invalid-env")

    expect(() => getMessageDbName("user-4")).toThrow("Invalid message DB environment")
  })
})
