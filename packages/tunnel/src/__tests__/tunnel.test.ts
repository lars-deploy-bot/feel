import { describe, expect, it, vi } from "vitest"
import type { TunnelConfig } from "../config.js"
import { TunnelApiError, TunnelDnsError } from "../errors.js"
import { type IngressRule, TunnelManager } from "../tunnel.js"

// ---------------------------------------------------------------------------
// Cloudflare SDK mock
// ---------------------------------------------------------------------------

function createMockCf() {
  return {
    zeroTrust: {
      tunnels: {
        cloudflared: {
          configurations: {
            get: vi.fn(),
            update: vi.fn(),
          },
        },
      },
    },
    dns: {
      records: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  }
}

type MockCf = ReturnType<typeof createMockCf>

function createTestConfig(overrides?: Partial<TunnelConfig>): TunnelConfig {
  return {
    accountId: "test-account",
    tunnelId: "test-tunnel-uuid",
    apiToken: "test-token",
    zoneId: "test-zone",
    baseDomain: "alive.best",
    ...overrides,
  }
}

function createManager(config?: TunnelConfig, mockCf?: MockCf): { manager: TunnelManager; cf: MockCf } {
  const cfg = config ?? createTestConfig()
  const manager = new TunnelManager(cfg)
  const cf = mockCf ?? createMockCf()
  // Replace the private cf client with our mock
  Object.defineProperty(manager, "cf", { value: cf, writable: false })
  return { manager, cf }
}

function mockIngressResponse(cf: MockCf, rules: Array<{ hostname?: string; service: string }>) {
  cf.zeroTrust.tunnels.cloudflared.configurations.get.mockResolvedValue({
    config: {
      ingress: rules.map(r => ({
        hostname: r.hostname ?? "",
        service: r.service,
      })),
    },
  })
  cf.zeroTrust.tunnels.cloudflared.configurations.update.mockResolvedValue({})
}

function mockDnsEmpty(cf: MockCf) {
  cf.dns.records.list.mockResolvedValue({ result: [] })
  cf.dns.records.create.mockResolvedValue({})
}

function mockDnsExisting(cf: MockCf, content: string, id = "rec-1") {
  cf.dns.records.list.mockResolvedValue({ result: [{ id, content }] })
  cf.dns.records.update.mockResolvedValue({})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TunnelManager", () => {
  describe("getIngress", () => {
    it("returns parsed ingress rules", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { hostname: "", service: "http_status:404" },
      ])

      const rules = await manager.getIngress()
      expect(rules).toEqual([
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { hostname: undefined, service: "http_status:404" },
      ])
    })

    it("returns empty array when no ingress rules", async () => {
      const { manager, cf } = createManager()
      cf.zeroTrust.tunnels.cloudflared.configurations.get.mockResolvedValue({
        config: { ingress: undefined },
      })

      const rules = await manager.getIngress()
      expect(rules).toEqual([])
    })

    it("throws TunnelApiError when config is missing", async () => {
      const { manager, cf } = createManager()
      cf.zeroTrust.tunnels.cloudflared.configurations.get.mockResolvedValue({
        config: null,
      })

      await expect(manager.getIngress()).rejects.toThrow(TunnelApiError)
      await expect(manager.getIngress()).rejects.toThrow(/has no config/)
    })

    it("wraps SDK errors in TunnelApiError with cause", async () => {
      const { manager, cf } = createManager()
      const sdkError = new Error("Rate limited")
      cf.zeroTrust.tunnels.cloudflared.configurations.get.mockRejectedValue(sdkError)

      const thrown = await manager.getIngress().catch((e: unknown) => e)
      expect(thrown).toBeInstanceOf(TunnelApiError)
      expect(thrown).toHaveProperty("message", expect.stringContaining("Rate limited"))
      expect(thrown).toHaveProperty("cause", sdkError)
    })
  })

  describe("addRoute", () => {
    it("adds a new route before catch-all", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "existing.alive.best", service: "http://localhost:3001" },
        { service: "http_status:404" },
      ])
      mockDnsEmpty(cf)

      await manager.addRoute("new.alive.best", 3500)

      const updateCall = cf.zeroTrust.tunnels.cloudflared.configurations.update.mock.calls[0]
      const ingress = updateCall[1].config.ingress
      // New route should be before catch-all
      expect(ingress.map((r: { hostname: string }) => r.hostname)).toEqual([
        "existing.alive.best",
        "new.alive.best",
        "",
      ])
      expect(ingress[1].service).toBe("http://localhost:3500")
    })

    it("updates port for existing hostname without DNS re-creation", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:3000" },
        { service: "http_status:404" },
      ])
      mockDnsExisting(cf, "test-tunnel-uuid.cfargotunnel.com")

      await manager.addRoute("app.alive.best", 9000)

      const updateCall = cf.zeroTrust.tunnels.cloudflared.configurations.update.mock.calls[0]
      const ingress = updateCall[1].config.ingress
      expect(ingress[0].service).toBe("http://localhost:9000")
    })

    it("no-ops when hostname and port match exactly", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { service: "http_status:404" },
      ])

      await manager.addRoute("app.alive.best", 9000)

      expect(cf.zeroTrust.tunnels.cloudflared.configurations.update).not.toHaveBeenCalled()
    })

    it("creates DNS CNAME for owned hostnames", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      mockDnsEmpty(cf)

      await manager.addRoute("test.alive.best", 3500)

      expect(cf.dns.records.create).toHaveBeenCalledWith({
        zone_id: "test-zone",
        type: "CNAME",
        name: "test.alive.best",
        content: "test-tunnel-uuid.cfargotunnel.com",
        proxied: true,
        ttl: 1,
      })
    })

    it("skips DNS for external custom domains", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])

      await manager.addRoute("custom.example.com", 3500)

      expect(cf.dns.records.list).not.toHaveBeenCalled()
      expect(cf.dns.records.create).not.toHaveBeenCalled()
    })
  })

  describe("removeRoute", () => {
    it("removes a route and its DNS record", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { hostname: "old.alive.best", service: "http://localhost:3500" },
        { service: "http_status:404" },
      ])
      cf.dns.records.list.mockResolvedValue({ result: [{ id: "rec-1", content: "x.cfargotunnel.com" }] })
      cf.dns.records.delete.mockResolvedValue({})

      await manager.removeRoute("old.alive.best")

      const updateCall = cf.zeroTrust.tunnels.cloudflared.configurations.update.mock.calls[0]
      const hostnames = updateCall[1].config.ingress.map((r: { hostname: string }) => r.hostname)
      expect(hostnames).not.toContain("old.alive.best")
      expect(cf.dns.records.delete).toHaveBeenCalled()
    })

    it("no-ops when hostname not in ingress", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { service: "http_status:404" },
      ])

      await manager.removeRoute("missing.alive.best")

      expect(cf.zeroTrust.tunnels.cloudflared.configurations.update).not.toHaveBeenCalled()
    })
  })

  describe("updateRoutePort", () => {
    it("updates port for existing route", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:3000" },
        { service: "http_status:404" },
      ])

      await manager.updateRoutePort("app.alive.best", 9000)

      const updateCall = cf.zeroTrust.tunnels.cloudflared.configurations.update.mock.calls[0]
      expect(updateCall[1].config.ingress[0].service).toBe("http://localhost:9000")
    })

    it("throws TunnelApiError for unknown hostname", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])

      await expect(manager.updateRoutePort("missing.alive.best", 9000)).rejects.toThrow(TunnelApiError)
    })
  })

  describe("listRoutes", () => {
    it("returns only hostname rules, not catch-all", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { hostname: "staging.alive.best", service: "http://localhost:8998" },
        { service: "http_status:404" },
      ])

      const routes = await manager.listRoutes()
      expect(routes).toEqual([
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { hostname: "staging.alive.best", service: "http://localhost:8998" },
      ])
    })
  })

  describe("syncRoutes", () => {
    it("adds, updates, and removes routes in a single operation", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "keep.alive.best", service: "http://localhost:3001" },
        { hostname: "update.alive.best", service: "http://localhost:3002" },
        { hostname: "stale.alive.best", service: "http://localhost:3003" },
        { service: "http_status:404" },
      ])
      mockDnsEmpty(cf)
      cf.dns.records.delete.mockResolvedValue({})

      const sites = new Map([
        ["keep.alive.best", 3001],
        ["update.alive.best", 3099], // port changed
        ["new.alive.best", 3500], // new site
      ])

      const result = await manager.syncRoutes(sites, [])

      expect(result.added).toEqual(["new.alive.best"])
      expect(result.updated).toEqual(["update.alive.best"])
      expect(result.removed).toEqual(["stale.alive.best"])
      expect(result.dnsErrors).toEqual([])
    })

    it("preserves static routes at the front of ingress", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      mockDnsEmpty(cf)

      const staticRoutes: IngressRule[] = [{ hostname: "app.alive.best", service: "http://localhost:9000" }]
      const sites = new Map([["site.alive.best", 3500]])

      await manager.syncRoutes(sites, staticRoutes)

      const updateCall = cf.zeroTrust.tunnels.cloudflared.configurations.update.mock.calls[0]
      const hostnames = updateCall[1].config.ingress.map((r: { hostname: string }) => r.hostname)
      // Static first, then dynamic, then catch-all
      expect(hostnames).toEqual(["app.alive.best", "site.alive.best", ""])
    })

    it("reports DNS errors without aborting the sync", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      // DNS list fails for one hostname
      cf.dns.records.list.mockRejectedValue(new Error("DNS API down"))

      const sites = new Map([["fail.alive.best", 3500]])
      const result = await manager.syncRoutes(sites, [])

      // Ingress was still updated (before DNS)
      expect(cf.zeroTrust.tunnels.cloudflared.configurations.update).toHaveBeenCalled()
      // DNS error is reported, not thrown
      expect(result.dnsErrors.length).toBe(1)
      expect(result.dnsErrors[0]).toContain("fail.alive.best")
    })

    it("does not include static hostnames in removed list", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [
        { hostname: "app.alive.best", service: "http://localhost:9000" },
        { hostname: "dynamic.alive.best", service: "http://localhost:3001" },
        { service: "http_status:404" },
      ])
      mockDnsEmpty(cf)

      const staticRoutes: IngressRule[] = [{ hostname: "app.alive.best", service: "http://localhost:9000" }]
      // Only dynamic sites in the map — "dynamic.alive.best" is gone
      const sites = new Map<string, number>()

      const result = await manager.syncRoutes(sites, staticRoutes)

      // app.alive.best is static, not removed. dynamic.alive.best is stale.
      expect(result.removed).toEqual(["dynamic.alive.best"])
    })
  })

  describe("ensureDnsRecord (via addRoute)", () => {
    it("updates existing DNS record when CNAME target differs", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      mockDnsExisting(cf, "old-tunnel.cfargotunnel.com", "rec-42")

      await manager.addRoute("test.alive.best", 3500)

      expect(cf.dns.records.update).toHaveBeenCalledWith("rec-42", {
        zone_id: "test-zone",
        type: "CNAME",
        name: "test.alive.best",
        content: "test-tunnel-uuid.cfargotunnel.com",
        proxied: true,
        ttl: 1,
      })
    })

    it("skips DNS update when CNAME already correct", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      mockDnsExisting(cf, "test-tunnel-uuid.cfargotunnel.com")

      await manager.addRoute("test.alive.best", 3500)

      expect(cf.dns.records.update).not.toHaveBeenCalled()
      expect(cf.dns.records.create).not.toHaveBeenCalled()
    })

    it("throws TunnelDnsError when DNS record has no id", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      cf.dns.records.list.mockResolvedValue({
        result: [{ id: undefined, content: "old.cfargotunnel.com" }],
      })

      await expect(manager.addRoute("test.alive.best", 3500)).rejects.toThrow(TunnelDnsError)
    })

    it("includes 'has no id' in error message for id-less DNS records", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      cf.dns.records.list.mockResolvedValue({
        result: [{ id: undefined, content: "old.cfargotunnel.com" }],
      })

      await expect(manager.addRoute("test.alive.best", 3500)).rejects.toThrow(/has no id/)
    })
  })

  describe("isOwnedHostname (via addRoute DNS behavior)", () => {
    it("treats baseDomain itself as owned", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      mockDnsEmpty(cf)

      await manager.addRoute("alive.best", 9000)
      expect(cf.dns.records.list).toHaveBeenCalled()
    })

    it("treats subdomains of baseDomain as owned", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      mockDnsEmpty(cf)

      await manager.addRoute("deep.sub.alive.best", 3500)
      expect(cf.dns.records.list).toHaveBeenCalled()
    })

    it("treats external domains as not owned — no DNS operations", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])

      await manager.addRoute("example.com", 3500)
      expect(cf.dns.records.list).not.toHaveBeenCalled()
    })

    it("does not treat partial suffix match as owned", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])

      // "notalive.best" ends with "alive.best" but is NOT ".alive.best"
      await manager.addRoute("notalive.best", 3500)
      expect(cf.dns.records.list).not.toHaveBeenCalled()
    })
  })

  describe("updateIngress (via addRoute)", () => {
    it("adds catch-all when missing", async () => {
      const { manager, cf } = createManager()
      // Ingress with no catch-all
      mockIngressResponse(cf, [{ hostname: "app.alive.best", service: "http://localhost:9000" }])
      mockDnsEmpty(cf)

      await manager.addRoute("new.alive.best", 3500)

      const updateCall = cf.zeroTrust.tunnels.cloudflared.configurations.update.mock.calls[0]
      const ingress = updateCall[1].config.ingress
      const lastRule = ingress[ingress.length - 1]
      expect(lastRule.hostname).toBe("")
      expect(lastRule.service).toBe("http_status:404")
    })

    it("wraps SDK update errors in TunnelApiError", async () => {
      const { manager, cf } = createManager()
      mockIngressResponse(cf, [{ service: "http_status:404" }])
      cf.zeroTrust.tunnels.cloudflared.configurations.update.mockRejectedValue(new Error("API 500"))

      await expect(manager.addRoute("test.alive.best", 3500)).rejects.toThrow(TunnelApiError)
    })
  })
})
