import { afterEach, describe, expect, it, vi } from "vitest"

async function loadTestEnvModule() {
  vi.resetModules()
  return import("../../e2e-tests/lib/test-env")
}

describe("e2e test env guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("reads TEST_ENV=preview", async () => {
    vi.stubEnv("TEST_ENV", "preview")
    const { getTestEnv } = await loadTestEnvModule()

    expect(getTestEnv()).toBe("preview")
  })

  it("rejects unknown TEST_ENV values", async () => {
    vi.stubEnv("TEST_ENV", "local")
    const { getTestEnv } = await loadTestEnvModule()
    vi.stubEnv("TEST_ENV", "production")

    expect(() => getTestEnv()).toThrow('Invalid TEST_ENV="production"')
  })

  it("accepts local standard E2E targets", async () => {
    vi.stubEnv("TEST_ENV", "local")
    const { assertStandardE2ETarget } = await loadTestEnvModule()

    expect(() => assertStandardE2ETarget("local", "http://127.0.0.1:9547")).not.toThrow()
  })

  it("rejects staging in the standard E2E lane", async () => {
    vi.stubEnv("TEST_ENV", "local")
    const { assertStandardE2ETarget } = await loadTestEnvModule()

    expect(() => assertStandardE2ETarget("staging", "https://staging.test.example")).toThrow(
      'Standard E2E rejects TEST_ENV="staging"',
    )
  })

  it("rejects non-loopback URLs for local E2E", async () => {
    vi.stubEnv("TEST_ENV", "local")
    const { assertStandardE2ETarget } = await loadTestEnvModule()

    expect(() => assertStandardE2ETarget("local", "https://staging.test.example")).toThrow(
      "TEST_ENV=local requires an HTTP loopback base URL.",
    )
  })

  it("accepts remote live targets", async () => {
    vi.stubEnv("TEST_ENV", "staging")
    const { assertLiveE2ETarget } = await loadTestEnvModule()

    expect(() => assertLiveE2ETarget("staging", "https://staging.test.example")).not.toThrow()
  })

  it("rejects local targets in the live lane", async () => {
    vi.stubEnv("TEST_ENV", "local")
    const { assertLiveE2ETarget } = await loadTestEnvModule()

    expect(() => assertLiveE2ETarget("local", "http://127.0.0.1:9547")).toThrow('Live E2E rejects TEST_ENV="local"')
  })

  it("rejects non-local test envs for local-only server lanes", async () => {
    vi.stubEnv("TEST_ENV", "preview")
    const { assertLocalTestEnv } = await loadTestEnvModule()

    expect(() => assertLocalTestEnv("preview", "Local test server")).toThrow(
      "Local test server requires TEST_ENV=local.",
    )
  })
})
