import { describe, expect, it } from "vitest"
import { renderCaddyShell, renderCaddySites } from "../src/infra/generate-routing.ts"

type RenderShellInput = Parameters<typeof renderCaddyShell>[0]

function makeConfig(overrides?: Partial<RenderShellInput["shell"]>): RenderShellInput {
  return {
    serverId: "srv_test_server_123456",
    serverIp: "127.0.0.1",
    serverIpv6: "::1",
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
      frameAncestors: ["https://app.example.com"],
    },
    urls: {
      prod: "https://app.example.com",
      staging: "https://staging.example.com",
      dev: "https://dev.example.com",
    },
    shell: {
      domains: ["go.example.com"],
      listen: ":8443",
      upstream: "localhost:3888",
      ...overrides,
    },
    sentry: {
      dsn: "https://abc123@sentry.example.com/2",
      url: "https://sentry.example.com",
      projectId: "2",
      org: "sentry",
      project: "alive",
    },
    contactEmail: "ops@example.com",
    previewProxy: {
      port: 5055,
    },
    generated: {
      dir: "/var/lib/alive/generated",
      caddySites: "/var/lib/alive/generated/Caddyfile.sites",
      caddyShell: "/var/lib/alive/generated/Caddyfile.shell",
      nginxMap: "/var/lib/alive/generated/nginx.sni.map",
    },
  } as RenderShellInput
}

describe("renderCaddyShell", () => {
  it("includes explicit /e2b/ws websocket path handling", () => {
    const output = renderCaddyShell(makeConfig())
    expect(output).toContain("@e2b_ws path /e2b/ws /e2b/ws/*")
    expect(output).toContain("@ws path /ws /ws/*")
  })

  it("routes /e2b websocket traffic to shell.e2bUpstream when configured", () => {
    const output = renderCaddyShell(makeConfig({ e2bUpstream: "localhost:5075" }))
    expect(output).toContain("reverse_proxy localhost:5075")
    expect(output).toContain("reverse_proxy localhost:3888")
  })
})

describe("renderCaddySites", () => {
  it("excludes the internal alive workspace from public site routing", () => {
    const output = renderCaddySites(
      makeConfig(),
      [
        {
          key: "production",
          port: 9000,
          domain: "app.example.com",
          previewBase: "preview.app.example.com",
        },
      ],
      [
        { hostname: "alive", port: 0 },
        { hostname: "demo.example.com", port: 3333 },
      ],
      new Set(),
      "production",
    )

    expect(output).not.toContain("alive {")
    expect(output).toContain("demo.example.com {")
  })
})
