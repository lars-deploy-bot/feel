import { afterEach, describe, expect, it, vi } from "vitest"

const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
  vi.resetModules()
})

describe("alive-toml-services", () => {
  it("parses enabled services from alive.toml sections", async () => {
    const { parseEnabledServices } = await import("../alive-toml-services.mjs")

    expect(
      parseEnabledServices(`
[services.browser-control]
enabled = true
port = 5061

[services.preview-proxy]
enabled = false

[services.other]
enabled = true
`),
    ).toEqual(["browser-control", "other"])
  })

  it("resolves alive.toml independent of the current workspace cwd", async () => {
    process.chdir("/tmp")

    const { getEnabledServices } = await import("../alive-toml-services.mjs")

    expect(getEnabledServices()).toContain("browser-control")
  })
})
