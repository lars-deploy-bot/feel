import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAllUserEnvKeysMock } = vi.hoisted(() => ({
  getAllUserEnvKeysMock: vi.fn(),
}))

vi.mock("../oauth-instances", () => ({
  getUserEnvKeysManager: () => ({
    getAllUserEnvKeys: getAllUserEnvKeysMock,
  }),
}))

import { fetchUserEnvKeys, formatEnvKeysForSubprocess } from "../fetch-user-env-keys"

describe("fetchUserEnvKeys", () => {
  beforeEach(() => {
    getAllUserEnvKeysMock.mockReset()
  })

  it("filters reserved keys (including ASK_LARS_KEY) before returning env keys", async () => {
    getAllUserEnvKeysMock.mockResolvedValue({
      ASK_LARS_KEY: "blocked",
      ANTHROPIC_API_KEY: "blocked",
      OPENAI_API_KEY: "allowed",
      CUSTOM_TOKEN: "allowed",
    })

    const logs: string[] = []
    const logger = { log: (message: string) => logs.push(message) }

    const result = await fetchUserEnvKeys("user-1", logger)

    expect(result).toEqual({
      envKeys: {
        OPENAI_API_KEY: "allowed",
        CUSTOM_TOKEN: "allowed",
      },
      count: 2,
    })
    expect(logs).toContain("Blocked 2 reserved user environment key(s) from agent runtime")
    expect(logs).toContain("Loaded 2 user environment key(s): OPENAI_API_KEY, CUSTOM_TOKEN")
  })

  it("returns empty result when env key loading fails", async () => {
    getAllUserEnvKeysMock.mockRejectedValue(new Error("lockbox unavailable"))

    const logs: string[] = []
    const logger = { log: (message: string) => logs.push(message) }

    const result = await fetchUserEnvKeys("user-2", logger)

    expect(result).toEqual({ envKeys: {}, count: 0 })
    expect(logs.some(log => log.includes("Failed to fetch user env keys: lockbox unavailable"))).toBe(true)
  })
})

describe("formatEnvKeysForSubprocess", () => {
  it("formats user env keys with optional prefix", () => {
    const result = formatEnvKeysForSubprocess(
      {
        OPENAI_API_KEY: "sk-openai",
        CUSTOM_TOKEN: "custom",
      },
      "USER_",
    )

    expect(result).toEqual({
      USER_OPENAI_API_KEY: "sk-openai",
      USER_CUSTOM_TOKEN: "custom",
    })
  })
})
