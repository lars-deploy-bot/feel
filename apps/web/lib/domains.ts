import { existsSync } from "node:fs"
import { PATHS } from "@webalive/shared"
import { createAppClient } from "@/lib/supabase/app"

/**
 * Check if a domain exists on this server (has a site directory)
 * Used to filter domains from shared database to only show local domains
 */
export function domainExistsOnThisServer(hostname: string): boolean {
  const sitePath = `${PATHS.SITES_ROOT}/${hostname}`
  return existsSync(sitePath)
}

/**
 * Filter a list of hostnames to only include those deployed on this server
 */
export function filterLocalDomains(hostnames: string[]): string[] {
  return hostnames.filter(domainExistsOnThisServer)
}

export interface DomainConfig {
  domain_id: string
  hostname: string
  org_id: string | null
  port: number
  created_at: string
}

export async function getAllDomains(): Promise<Map<string, DomainConfig>> {
  const app = await createAppClient("service")
  const { data, error } = await app.from("domains").select("*")

  if (error) {
    console.error("[Domains] Failed to fetch domains:", error)
    return new Map()
  }

  const domainMap = new Map<string, DomainConfig>()
  for (const domain of data || []) {
    domainMap.set(domain.hostname, domain)
  }

  return domainMap
}

export async function getDomain(hostname: string): Promise<DomainConfig | null> {
  const app = await createAppClient("service")
  const { data, error } = await app.from("domains").select("*").eq("hostname", hostname).single()

  if (error || !data) {
    console.error(`[Domains] Domain not found: ${hostname}`, error)
    return null
  }

  return data
}

export async function getDomainPort(hostname: string): Promise<number | null> {
  const domain = await getDomain(hostname)
  return domain?.port ?? null
}
