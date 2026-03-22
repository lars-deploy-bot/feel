import { readdirSync } from "node:fs"
import { PATHS, SUPERADMIN } from "@webalive/shared"
import { createAppClient } from "@/lib/supabase/app"

/**
 * Cached set of site directories. Single readdirSync instead of N existsSync calls.
 * Refreshed every 30s since directories rarely change.
 */
let _siteDirCache: Set<string> | null = null
let _siteDirCacheTime = 0
const SITE_DIR_CACHE_TTL = 30_000

function getSiteDirs(): Set<string> {
  const now = Date.now()
  if (_siteDirCache && now - _siteDirCacheTime < SITE_DIR_CACHE_TTL) {
    return _siteDirCache
  }
  try {
    _siteDirCache = new Set(readdirSync(PATHS.SITES_ROOT))
  } catch {
    _siteDirCache = new Set()
  }
  _siteDirCacheTime = now
  return _siteDirCache
}

/**
 * Check if a domain exists on this server (has a site directory)
 * Used to filter domains from shared database to only show local domains
 *
 * Special case: alive is always available (it's the codebase itself)
 */
export function domainExistsOnThisServer(hostname: string): boolean {
  if (hostname === SUPERADMIN.WORKSPACE_NAME) return true
  return getSiteDirs().has(hostname)
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
