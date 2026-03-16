/**
 * Cloudflare Tunnel routing manager.
 *
 * Replaces: generate-routing.ts, 00-assign-port.sh, 05-caddy-inject.sh,
 * port-map.json, nginx SNI, caddy-shell, Go preview-proxy routing.
 *
 * Each site gets a CNAME → tunnel + an ingress rule. That's it.
 * Cloudflare handles TLS, WebSocket upgrades, and HTTP/2.
 */

import Cloudflare from "cloudflare"
import type { TunnelConfig } from "./config.js"

export interface IngressRule {
  hostname?: string
  service: string
  originRequest?: Record<string, unknown>
}

export class TunnelManager {
  private readonly cf: Cloudflare
  private readonly config: TunnelConfig

  constructor(config: TunnelConfig) {
    this.config = config
    this.cf = new Cloudflare({ apiToken: config.apiToken })
  }

  /**
   * Get current tunnel ingress configuration
   */
  async getIngress(): Promise<IngressRule[]> {
    const result = await this.cf.zeroTrust.tunnels.cloudflared.configurations.get(this.config.tunnelId, {
      account_id: this.config.accountId,
    })
    const ingress = (result.config as { ingress?: IngressRule[] } | undefined)?.ingress
    return ingress ?? []
  }

  /**
   * Add a site route to the tunnel.
   * Called during site deployment — replaces 05-caddy-inject.sh + port allocation.
   */
  async addRoute(hostname: string, localPort: number): Promise<void> {
    const ingress = await this.getIngress()

    // Check if route already exists
    const existing = ingress.find(r => r.hostname === hostname)
    if (existing) {
      const newService = `http://localhost:${localPort}`
      if (existing.service === newService) return
      existing.service = newService
    } else {
      // Insert before the catch-all (last rule has no hostname)
      const catchAllIndex = ingress.findIndex(r => !r.hostname)
      const rule: IngressRule = {
        hostname,
        service: `http://localhost:${localPort}`,
      }
      if (catchAllIndex >= 0) {
        ingress.splice(catchAllIndex, 0, rule)
      } else {
        ingress.push(rule)
      }
    }

    await this.updateIngress(ingress)
    await this.ensureDnsRecord(hostname)
  }

  /**
   * Remove a site route from the tunnel.
   * Called during site teardown — replaces 99-teardown.sh Caddy removal.
   */
  async removeRoute(hostname: string): Promise<void> {
    const ingress = await this.getIngress()
    const filtered = ingress.filter(r => r.hostname !== hostname)
    if (filtered.length === ingress.length) return
    await this.updateIngress(filtered)
    await this.removeDnsRecord(hostname)
  }

  /**
   * Update port for an existing route.
   */
  async updateRoutePort(hostname: string, newPort: number): Promise<void> {
    const ingress = await this.getIngress()
    const rule = ingress.find(r => r.hostname === hostname)
    if (!rule) {
      throw new Error(`No tunnel route found for ${hostname}`)
    }
    rule.service = `http://localhost:${newPort}`
    await this.updateIngress(ingress)
  }

  /**
   * List all routed hostnames (excluding catch-all).
   */
  async listRoutes(): Promise<Array<{ hostname: string; service: string }>> {
    const ingress = await this.getIngress()
    return ingress
      .filter((r): r is IngressRule & { hostname: string } => !!r.hostname)
      .map(r => ({ hostname: r.hostname, service: r.service }))
  }

  /**
   * Sync all sites from a hostname→port map to the tunnel.
   * Adds missing routes, updates changed ports, removes stale routes.
   * Used for bulk migration from Caddy.
   */
  async syncRoutes(
    sites: Map<string, number>,
    staticRoutes: IngressRule[],
  ): Promise<{ added: string[]; updated: string[]; removed: string[] }> {
    const ingress = await this.getIngress()
    const added: string[] = []
    const updated: string[] = []
    const removed: string[] = []

    // Index existing dynamic routes (exclude static and catch-all)
    const staticHostnames = new Set(staticRoutes.map(r => r.hostname).filter(Boolean))
    const existingDynamic = new Map<string, IngressRule>()
    for (const rule of ingress) {
      if (rule.hostname && !staticHostnames.has(rule.hostname)) {
        existingDynamic.set(rule.hostname, rule)
      }
    }

    // Build new ingress: static routes first, then sites, then catch-all
    const newIngress: IngressRule[] = [...staticRoutes]

    for (const [hostname, port] of sites) {
      const service = `http://localhost:${port}`
      const existing = existingDynamic.get(hostname)

      if (!existing) {
        added.push(hostname)
      } else if (existing.service !== service) {
        updated.push(hostname)
      }
      existingDynamic.delete(hostname)
      newIngress.push({ hostname, service })
    }

    // Remaining in existingDynamic are stale
    for (const hostname of existingDynamic.keys()) {
      removed.push(hostname)
    }

    // Always end with catch-all
    newIngress.push({ service: "http_status:404" })

    await this.updateIngress(newIngress)

    // Sync DNS records
    const dnsPromises: Promise<void>[] = []
    for (const hostname of added) {
      dnsPromises.push(this.ensureDnsRecord(hostname))
    }
    for (const hostname of removed) {
      dnsPromises.push(this.removeDnsRecord(hostname))
    }
    await Promise.all(dnsPromises)

    return { added, updated, removed }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async updateIngress(ingress: IngressRule[]): Promise<void> {
    const hasCatchAll = ingress.some(r => !r.hostname)
    if (!hasCatchAll) {
      ingress.push({ service: "http_status:404" })
    }

    // The Cloudflare API requires a catch-all rule with no hostname as the last entry.
    // The SDK types mark hostname as required, but the API accepts it without one.
    // We build a properly-typed array and append the catch-all with a type assertion
    // for the single rule that legitimately omits hostname.
    const typedIngress = ingress
      .filter(r => r.hostname)
      .map(r => ({
        hostname: r.hostname as string,
        service: r.service,
        ...(r.originRequest ? { originRequest: r.originRequest } : {}),
      }))

    // Catch-all must be last
    const catchAll = ingress.find(r => !r.hostname)
    const catchAllRule = { hostname: "", service: catchAll?.service ?? "http_status:404" }

    await this.cf.zeroTrust.tunnels.cloudflared.configurations.update(this.config.tunnelId, {
      account_id: this.config.accountId,
      config: { ingress: [...typedIngress, catchAllRule] },
    })
  }

  private async ensureDnsRecord(hostname: string): Promise<void> {
    // Only create DNS records for hostnames under our zone (e.g. *.alive.best).
    // External custom domains (barendbootsma.com, etc.) manage their own DNS.
    if (!hostname.endsWith(`.${this.config.baseDomain}`) && hostname !== this.config.baseDomain) {
      return
    }

    const tunnelCname = `${this.config.tunnelId}.cfargotunnel.com`

    // Check if record already exists
    const existing = await this.cf.dns.records.list({
      zone_id: this.config.zoneId,
      name: { exact: hostname },
      type: "CNAME",
    })

    if (existing.result.length > 0) {
      const record = existing.result[0]
      if (record.content !== tunnelCname) {
        await this.cf.dns.records.update(record.id, {
          zone_id: this.config.zoneId,
          type: "CNAME",
          name: hostname,
          content: tunnelCname,
          proxied: true,
          ttl: 1, // 1 = automatic
        })
      }
      return
    }

    await this.cf.dns.records.create({
      zone_id: this.config.zoneId,
      type: "CNAME",
      name: hostname,
      content: tunnelCname,
      proxied: true,
      ttl: 1, // 1 = automatic
    })
  }

  private async removeDnsRecord(hostname: string): Promise<void> {
    // Only manage DNS records for hostnames under our zone.
    if (!hostname.endsWith(`.${this.config.baseDomain}`) && hostname !== this.config.baseDomain) {
      return
    }

    const records = await this.cf.dns.records.list({
      zone_id: this.config.zoneId,
      name: { exact: hostname },
      type: "CNAME",
    })

    for (const record of records.result) {
      await this.cf.dns.records.delete(record.id, {
        zone_id: this.config.zoneId,
      })
    }
  }
}
