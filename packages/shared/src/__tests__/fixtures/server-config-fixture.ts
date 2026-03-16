/**
 * Shared test fixture for server-config.json shapes.
 * Used by both config.test.ts and server-config-schema.test.ts.
 */
export function buildBaseConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
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
    },
    sentry: {
      dsn: "https://abc123@sentry.example.com/2",
      url: "https://sentry.example.com",
      projectId: "2",
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
    ...overrides,
  }
}
