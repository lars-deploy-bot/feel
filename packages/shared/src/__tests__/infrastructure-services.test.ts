/**
 * Unit tests for the infrastructure services registry.
 * Ensures no duplicate hostnames, valid ports, and no overlap with environments.
 */

import { describe, expect, it } from "vitest"
import { environments } from "../environments.js"
import { getCaddyServices, getDirectServices, INFRASTRUCTURE_SERVICES } from "../infrastructure-services.js"

describe("INFRASTRUCTURE_SERVICES", () => {
  it("has no duplicate hostnames", () => {
    const hostnames = INFRASTRUCTURE_SERVICES.map(s => s.hostname)
    const unique = new Set(hostnames)
    expect(unique.size).toBe(hostnames.length)
  })

  it("all ports are in valid range", () => {
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(svc.port).toBeGreaterThanOrEqual(1024)
      expect(svc.port).toBeLessThanOrEqual(65535)
    }
  })

  it("no hostname overlaps with environment domains", () => {
    const envDomains = new Set(Object.values(environments).map(e => e.domain))
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(envDomains.has(svc.hostname)).toBe(false)
    }
  })

  it("every service has a routeVia value", () => {
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(["direct", "caddy"]).toContain(svc.routeVia)
    }
  })

  it("every service has a displayName", () => {
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(svc.displayName.length).toBeGreaterThan(0)
    }
  })
})

describe("getDirectServices", () => {
  it("returns only services with routeVia=direct", () => {
    const direct = getDirectServices()
    expect(direct.length).toBeGreaterThan(0)
    for (const svc of direct) {
      expect(svc.routeVia).toBe("direct")
    }
  })

  it("includes widget.alive.best", () => {
    const direct = getDirectServices()
    const widget = direct.find(s => s.hostname === "widget.alive.best")
    expect(widget).toBeDefined()
    expect(widget?.port).toBe(5050)
  })
})

describe("getCaddyServices", () => {
  it("returns only services with routeVia=caddy", () => {
    const caddy = getCaddyServices()
    for (const svc of caddy) {
      expect(svc.routeVia).toBe("caddy")
    }
  })
})
