import { describe, expect, it } from "vitest"
import { parseServerConfig } from "../server-config-schema"

function buildBaseConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    serverId: "srv_test_server_123456",
    serverIp: "127.0.0.1",
    automationPrimary: false,
    paths: {
      aliveRoot: "/root/alive",
      sitesRoot: "/srv/webalive/sites",
      templatesRoot: "/srv/webalive/templates",
      imagesStorage: "/srv/webalive/storage",
    },
    domains: {
      main: "example.com",
      wildcard: "example.com",
      cookieDomain: ".example.com",
      previewBase: "preview.example.com",
    },
    shell: {
      domains: ["go.example.com"],
      listen: ":8443",
      upstream: "localhost:3888",
    },
    sentry: {
      dsn: "https://abc123@sentry.example.com/2",
      url: "https://sentry.example.com",
      projectId: "2",
    },
    contactEmail: "ops@example.com",
    generated: {
      dir: "/var/lib/alive/generated",
      caddySites: "/var/lib/alive/generated/Caddyfile.sites",
      caddyShell: "/var/lib/alive/generated/Caddyfile.shell",
      nginxMap: "/var/lib/alive/generated/nginx.sni.map",
    },
    ...overrides,
  }
}

describe("parseServerConfig sentry compatibility", () => {
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
