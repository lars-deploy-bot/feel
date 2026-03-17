/**
 * Unit tests for the infrastructure services registry.
 * Validates data integrity: no duplicates, valid ports, no overlap with environments.
 */

import { describe, expect, it } from "vitest"
import { environments } from "../environments.js"
import { INFRASTRUCTURE_SERVICES } from "../infrastructure-services.js"

describe("INFRASTRUCTURE_SERVICES", () => {
  it("has no duplicate subdomains", () => {
    const subdomains = INFRASTRUCTURE_SERVICES.map(s => s.subdomain)
    const unique = new Set(subdomains)
    expect(unique.size).toBe(subdomains.length)
  })

  it("all ports are in valid range", () => {
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(svc.port).toBeGreaterThanOrEqual(1024)
      expect(svc.port).toBeLessThanOrEqual(65535)
    }
  })

  it("subdomains are lowercase DNS labels (no dots, no special chars)", () => {
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(svc.subdomain).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
    }
  })

  it("no subdomain overlaps with environment subdomains", () => {
    // Extract subdomain part from environment domains (e.g. "app" from "app.alive.best")
    const envSubdomains = new Set(
      Object.values(environments)
        .map(e => e.domain.split(".")[0])
        .filter(Boolean),
    )
    for (const svc of INFRASTRUCTURE_SERVICES) {
      expect(envSubdomains.has(svc.subdomain)).toBe(false)
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

  it("includes widget as direct", () => {
    const widget = INFRASTRUCTURE_SERVICES.find(s => s.subdomain === "widget")
    expect(widget).toBeDefined()
    expect(widget?.port).toBe(5050)
    expect(widget?.routeVia).toBe("direct")
  })
})
