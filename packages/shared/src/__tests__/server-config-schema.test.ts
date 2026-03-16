import { describe, expect, it } from "vitest"
import { parseServerConfig } from "../server-config-schema"
import { buildBaseConfig } from "./fixtures/server-config-fixture"

describe("parseServerConfig sentry compatibility", () => {
  it("parses optional shell.e2bUpstream", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        shell: {
          domains: ["go.example.com"],
          listen: ":8443",
          upstream: "localhost:3888",
          e2bUpstream: "localhost:5075",
        },
      }),
    )

    const parsed = parseServerConfig(raw)
    expect(parsed.shell.e2bUpstream).toBe("localhost:5075")
  })

  it("parses optional tunnel configuration", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        tunnel: {
          accountId: "cf-account",
          tunnelId: "055f6248-5434-487c-a074-f9fab9aa6fe1",
          apiToken: "cf-token",
          zoneId: "cf-zone",
        },
      }),
    )

    const parsed = parseServerConfig(raw)
    expect(parsed.tunnel).toEqual({
      accountId: "cf-account",
      tunnelId: "055f6248-5434-487c-a074-f9fab9aa6fe1",
      apiToken: "cf-token",
      zoneId: "cf-zone",
    })
  })

  it("parses canonical sentry.url + sentry.projectId", () => {
    const raw = JSON.stringify(buildBaseConfig())
    const parsed = parseServerConfig(raw)

    expect(parsed.sentry.url).toBe("https://sentry.example.com")
    expect(parsed.sentry.projectId).toBe("2")
  })

  it("normalizes legacy sentry.host + sentry.projectId", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        sentry: {
          dsn: "https://abc123@sentry.example.com/2",
          host: "sentry.example.com",
          projectId: "2",
          org: "sentry",
          project: "alive",
        },
      }),
    )

    const parsed = parseServerConfig(raw)
    expect(parsed.sentry.url).toBe("https://sentry.example.com")
    expect(parsed.sentry.projectId).toBe("2")
    expect(parsed.sentry.org).toBe("sentry")
    expect(parsed.sentry.project).toBe("alive")
  })

  it("derives projectId from dsn when missing", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        sentry: {
          dsn: "https://abc123@sentry.example.com/42",
          host: "sentry.example.com",
          org: "sentry",
          project: "alive",
        },
      }),
    )

    const parsed = parseServerConfig(raw)
    expect(parsed.sentry.projectId).toBe("42")
    expect(parsed.sentry.url).toBe("https://sentry.example.com")
    expect(parsed.sentry.org).toBe("sentry")
    expect(parsed.sentry.project).toBe("alive")
  })

  it("rejects legacy sentry.host values that are not bare hostnames", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        sentry: {
          dsn: "https://abc123@sentry.example.com/2",
          host: "https://sentry.example.com/path",
          projectId: "2",
        },
      }),
    )

    expect(() => parseServerConfig(raw)).toThrow(/bare hostname/)
  })

  it("keeps sentry strict for unknown keys", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        sentry: {
          dsn: "https://abc123@sentry.example.com/2",
          url: "https://sentry.example.com",
          projectId: "2",
          unexpected: "nope",
        },
      }),
    )

    expect(() => parseServerConfig(raw)).toThrow(/unexpected/)
  })
})

describe("parseServerConfig tunnel validation", () => {
  it("rejects tunnel with empty accountId", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        tunnel: {
          accountId: "",
          tunnelId: "some-id",
          apiToken: "some-token",
          zoneId: "some-zone",
        },
      }),
    )

    expect(() => parseServerConfig(raw)).toThrow()
  })

  it("rejects tunnel with empty tunnelId", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        tunnel: {
          accountId: "some-account",
          tunnelId: "",
          apiToken: "some-token",
          zoneId: "some-zone",
        },
      }),
    )

    expect(() => parseServerConfig(raw)).toThrow()
  })

  it("rejects tunnel with unknown keys (strict mode)", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        tunnel: {
          accountId: "some-account",
          tunnelId: "some-id",
          apiToken: "some-token",
          zoneId: "some-zone",
          extraField: "nope",
        },
      }),
    )

    expect(() => parseServerConfig(raw)).toThrow()
  })

  it("rejects partial tunnel object (missing zoneId)", () => {
    const raw = JSON.stringify(
      buildBaseConfig({
        tunnel: {
          accountId: "some-account",
          tunnelId: "some-id",
          apiToken: "some-token",
        },
      }),
    )

    expect(() => parseServerConfig(raw)).toThrow()
  })

  it("accepts config without tunnel section", () => {
    const raw = JSON.stringify(buildBaseConfig())
    const parsed = parseServerConfig(raw)
    expect(parsed.tunnel).toBeUndefined()
  })
})
